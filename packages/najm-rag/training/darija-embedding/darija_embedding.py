"""Fine-tune EmbeddingGemma on Darija sentence pairs, and embed routing benchmark texts.

    python darija_embedding.py train --input colab-input.json --out darija-model
    python darija_embedding.py embed --model darija-model --input colab-input.json --out embeddings-embeddinggemma-st-darija.json

`train` pairs Arabic-script Darija with English, French and MSA (and the reverse),
drops every pair close to a benchmark test message, trains with in-batch
negatives, and reports Darija -> English retrieval on held-out sentences before
and after. `embed` writes the benchmark's cache format: {exact input text: vector}.

Data: the Darija Open Dataset (DODa), CC BY-NC 4.0 (non-commercial). A model
trained on it inherits that question; use --pairs with your own data for a
commercial model.
"""
import argparse
import csv
import io
import json
import os
import random
import re
import sys
import urllib.request

QUERY = 'task: search result | query: '
DOCUMENT = 'title: none | text: '
DODA_SENTENCES = 'https://raw.githubusercontent.com/darija-open-dataset/dataset/main/sentences/sentences.csv'
DODA_10K = 'MBZUAI-Paris/DODa-10K'

_MARKS = re.compile(r'[ً-ْـ]')
_PUNCT = re.compile(r'[^\w\s]')


def norm(text: str) -> str:
    """Close to najm-rag's normalizeQuery: lowercase, no vowel marks, folded alef/ya/ta marbuta."""
    text = _MARKS.sub('', (text or '').lower())
    text = re.sub('[أإآ]', 'ا', text).replace('ى', 'ي').replace('ة', 'ه')
    return ' '.join(_PUNCT.sub(' ', text).split())


def is_arabic(text: str) -> bool:
    return bool(re.search('[ء-ي]', text or ''))


# ─── Data ──────────────────────────────────────────────────────────────────

def load_doda(latin: bool) -> list[dict]:
    """Rows of {darija, latin?, en, fr?, msa?} from DODa sentences.csv and DODa-10K."""
    rows = []
    print('downloading DODa sentences.csv ...', flush=True)
    with urllib.request.urlopen(DODA_SENTENCES, timeout=120) as res:
        reader = csv.DictReader(io.StringIO(res.read().decode('utf-8')))
        for r in reader:
            rows.append({'darija': r.get('darija_ar', ''), 'latin': r.get('darija', '') if latin else '', 'en': r.get('eng', '')})
    print(f'  {len(rows)} rows', flush=True)
    try:
        from datasets import load_dataset
        print(f'downloading {DODA_10K} ...', flush=True)
        ten = load_dataset(DODA_10K, split='train')
        for r in ten:
            rows.append({'darija': r['Darija_arabic'], 'latin': r['Darija_latin'] if latin else '', 'en': r['English'], 'fr': r['French'], 'msa': r['MSA']})
        print(f'  {len(ten)} rows', flush=True)
    except Exception as error:  # the CSV alone still trains
        print(f'  skipped DODa-10K: {error}', flush=True)
    return rows


def load_pairs_file(path: str) -> list[dict]:
    """Your own data: a CSV with a `darija` column and any of en, fr, msa (and latin)."""
    with open(path, encoding='utf-8') as f:
        return [dict(r) for r in csv.DictReader(f)]


def leaks(text: str, excluded: list[set[str]], excluded_exact: set[str]) -> bool:
    """True when `text` is a test message or shares most of its words with one."""
    n = norm(text)
    if n in excluded_exact:
        return True
    words = set(n.split())
    if len(words) < 2:
        return False
    for test in excluded:
        common = len(words & test)
        if common and common / len(words | test) >= 0.6:
            return True
    return False


def build_pairs(rows: list[dict], exclude: list[str], seed: int, eval_size: int):
    excluded_exact = {norm(q) for q in exclude}
    excluded = [set(norm(q).split()) for q in exclude]
    by_darija: dict[str, dict] = {}
    dropped = 0
    for r in rows:
        d = (r.get('darija') or '').strip()
        if not d or not is_arabic(d) or len(d) > 300:
            continue
        if leaks(d, excluded, excluded_exact):
            dropped += 1
            continue
        group = by_darija.setdefault(norm(d), {'darija': d, 'targets': set(), 'latin': set(), 'en': set(), 'fr': set(), 'msa': set()})
        for key in ('en', 'fr', 'msa'):
            t = (r.get(key) or '').strip()
            if t and len(t) <= 300:
                group['targets'].add(t)
                group[key].add(t)
        if (r.get('latin') or '').strip():
            group['latin'].add(r['latin'].strip())
    groups = [g for g in by_darija.values() if g['targets']]
    random.Random(seed).shuffle(groups)
    # Held-out sentences are never trained on, in any direction.
    eval_groups, train_groups = groups[:eval_size], groups[eval_size:]
    pairs = []
    for g in train_groups:
        for t in sorted(g['targets']):
            pairs.append({'anchor': g['darija'], 'positive': t})   # Darija message -> English/French/MSA text
            pairs.append({'anchor': t, 'positive': g['darija']})   # other language message -> Darija phrase
        for l in sorted(g['latin']):
            pairs.append({'anchor': l, 'positive': g['darija']})
    random.Random(seed + 1).shuffle(pairs)
    english = [(g['darija'], min(g['en'])) for g in eval_groups if g['en']]
    return pairs, english, dropped, train_groups


# ─── Model ─────────────────────────────────────────────────────────────────

def load_model(name: str, max_seq_length: int | None = None):
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(name)
    if max_seq_length:
        model.max_seq_length = max_seq_length
    return model


def retrieval_at_1(model, eval_pairs) -> float:
    """Share of held-out Darija sentences whose own English translation ranks first."""
    if not eval_pairs:
        return float('nan')
    queries = model.encode([QUERY + d for d, _ in eval_pairs], batch_size=64, normalize_embeddings=True, convert_to_tensor=True)
    docs = model.encode([DOCUMENT + e for _, e in eval_pairs], batch_size=64, normalize_embeddings=True, convert_to_tensor=True)
    best = (queries @ docs.T).argmax(dim=1).cpu().tolist()
    return sum(1 for i, j in enumerate(best) if i == j) / len(eval_pairs)


def kept_similarity(student, teacher, texts) -> float:
    """Mean cosine between the student and the frozen base on the same texts: 1.0 means unchanged."""
    if not texts:
        return float('nan')
    a = student.encode(texts, batch_size=64, normalize_embeddings=True, convert_to_tensor=True)
    b = teacher.encode(texts, batch_size=64, normalize_embeddings=True, convert_to_tensor=True)
    return float((a * b).sum(dim=1).mean())


def warmup_args() -> dict:
    import transformers
    # Transformers 5 takes the warmup ratio as a float warmup_steps.
    return {'warmup_steps': 0.1} if int(transformers.__version__.split('.')[0]) >= 5 else {'warmup_ratio': 0.1}


def train_distill(args, train_groups, eval_pairs, dropped):
    """
    Multilingual knowledge distillation: a frozen copy of the base model is the
    teacher. The student learns to embed a Darija sentence where the teacher
    embeds its English translation, and to keep English, French and MSA where
    the teacher puts them, under both EmbeddingGemma prompts. Darija joins the
    existing space instead of the whole space moving.
    """
    import torch
    from datasets import Dataset
    from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments
    try:
        from sentence_transformers.sentence_transformer.losses import MSELoss
    except ImportError:
        from sentence_transformers.losses import MSELoss

    items = []  # (student text, teacher text)
    for g in train_groups:
        english = sorted(g['en'])
        for prompt in (QUERY, DOCUMENT):
            if english:
                items.append((prompt + g['darija'], prompt + english[0]))
            for key in ('en', 'fr', 'msa'):
                for t in sorted(g[key])[:1]:
                    items.append((prompt + t, prompt + t))
    random.Random(args.seed + 2).shuffle(items)
    if args.max_items and len(items) > args.max_items:
        items = items[:args.max_items]
    darija_items = sum(1 for s, t in items if s != t)
    print(f'{len(items)} distillation items ({darija_items} Darija -> English, {len(items) - darija_items} kept as they are), '
          f'{len(eval_pairs)} held-out sentences, {dropped} rows dropped as close to a test message', flush=True)

    teacher = load_model(args.base, args.max_seq_length)
    teacher.eval()
    student = load_model(args.base, args.max_seq_length)
    targets = sorted({t for _s, t in items})
    print(f'teacher embeds {len(targets)} texts ...', flush=True)
    vectors = teacher.encode(targets, batch_size=128, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=True)
    label_of = {t: v for t, v in zip(targets, vectors)}
    data = Dataset.from_dict({'text': [s for s, _t in items], 'label': [label_of[t].tolist() for _s, t in items]})

    held_out_english = [e for _d, e in eval_pairs]
    keep_texts = [QUERY + e for e in held_out_english] + [DOCUMENT + e for e in held_out_english]
    before = retrieval_at_1(teacher, eval_pairs)
    print(f'held-out Darija -> English retrieval@1, base model: {before:.3f}', flush=True)

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    training_args = SentenceTransformerTrainingArguments(
        output_dir=f'{args.out}-checkpoints',
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps else -1,
        per_device_train_batch_size=min(args.batch, 64),
        learning_rate=args.lr,
        **warmup_args(),
        bf16=bf16,
        fp16=False,
        logging_steps=50,
        save_strategy='no',
        report_to='none',
        seed=args.seed,
    )
    trainer = SentenceTransformerTrainer(model=student, args=training_args, train_dataset=data, loss=MSELoss(student))
    trainer.train()

    after = retrieval_at_1(student, eval_pairs)
    kept = kept_similarity(student, teacher, keep_texts)
    print(f'held-out Darija -> English retrieval@1: base {before:.3f} -> trained {after:.3f}', flush=True)
    print(f'held-out English kept: {kept:.4f} (1.0 = unchanged; under 0.95 means routing in other languages will likely change)', flush=True)
    student.max_seq_length = 2048
    student.save(args.out)
    json.dump({'mode': 'distill', 'base': args.base, 'items': len(items), 'darija_items': darija_items,
               'retrieval_at_1': {'base': before, 'trained': after}, 'english_kept': kept,
               'epochs': args.epochs, 'batch': min(args.batch, 64), 'lr': args.lr, 'bf16': bf16,
               'data': args.pairs or 'DODa (CC BY-NC 4.0)'},
              open(f'{args.out}/training-summary.json', 'w'), indent=2)
    print(f'saved {args.out}', flush=True)


def cmd_train(args):
    import torch
    from datasets import Dataset
    from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments
    try:  # sentence-transformers 6 moved these
        from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss
        from sentence_transformers.sentence_transformer.training_args import BatchSamplers
    except ImportError:
        from sentence_transformers.losses import CachedMultipleNegativesRankingLoss
        from sentence_transformers.training_args import BatchSamplers

    config = json.load(open(args.input, encoding='utf-8')) if args.input else {}
    exclude = config.get('exclude', [])
    rows = load_pairs_file(args.pairs) if args.pairs else load_doda(args.latin)
    pairs, eval_pairs, dropped, train_groups = build_pairs(rows, exclude, args.seed, args.eval_size)
    if args.mode == 'distill':
        return train_distill(args, train_groups, eval_pairs, dropped)
    if args.max_pairs and len(pairs) > args.max_pairs:
        pairs = pairs[:args.max_pairs]
    print(f'{len(pairs)} training pairs, {len(eval_pairs)} held-out sentences, {dropped} rows dropped as close to a test message', flush=True)

    model = load_model(args.base, args.max_seq_length)
    before = retrieval_at_1(model, eval_pairs)
    print(f'held-out Darija -> English retrieval@1, base model: {before:.3f}', flush=True)

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    # EmbeddingGemma does not support float16 activations: bf16 or fp32 only.
    training_args = SentenceTransformerTrainingArguments(
        output_dir=f'{args.out}-checkpoints',
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps else -1,
        per_device_train_batch_size=args.batch,
        learning_rate=args.lr,
        **warmup_args(),
        bf16=bf16,
        fp16=False,
        batch_sampler=BatchSamplers.NO_DUPLICATES,
        prompts={'anchor': QUERY, 'positive': DOCUMENT},
        logging_steps=50,
        save_strategy='no',
        report_to='none',
        seed=args.seed,
    )
    loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=args.mini_batch)
    trainer = SentenceTransformerTrainer(model=model, args=training_args, train_dataset=Dataset.from_list(pairs), loss=loss)
    trainer.train()

    after = retrieval_at_1(model, eval_pairs)
    print(f'held-out Darija -> English retrieval@1: base {before:.3f} -> trained {after:.3f}', flush=True)
    model.max_seq_length = 2048
    model.save(args.out)
    json.dump({'mode': 'pairs', 'base': args.base, 'pairs': len(pairs), 'retrieval_at_1': {'base': before, 'trained': after},
               'epochs': args.epochs, 'batch': args.batch, 'lr': args.lr, 'bf16': bf16, 'data': args.pairs or 'DODa (CC BY-NC 4.0)'},
              open(f'{args.out}/training-summary.json', 'w'), indent=2)
    print(f'saved {args.out}', flush=True)


def cmd_embed(args):
    config = json.load(open(args.input, encoding='utf-8'))
    texts = config['inputs']
    if '/' not in args.model and not os.path.isdir(args.model):
        sys.exit(f'model folder {args.model!r} not found: did training finish? (see the train cell output)')
    model = load_model(args.model)
    # Inputs already carry their prompt (the benchmark adds it), so none is added here.
    vectors = model.encode(texts, batch_size=args.batch, normalize_embeddings=True, show_progress_bar=True, prompt='')
    out = {t: [round(float(x), 6) for x in v] for t, v in zip(texts, vectors)}
    json.dump(out, open(args.out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'wrote {len(out)} vectors of {len(vectors[0])} values to {args.out}', flush=True)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='command', required=True)
    t = sub.add_parser('train')
    t.add_argument('--base', default='google/embeddinggemma-300m')
    t.add_argument('--input', help='colab-input.json from prepare.ts; its `exclude` messages are kept out of training')
    t.add_argument('--pairs', help='your own CSV (darija, en, fr, msa, latin) instead of DODa')
    t.add_argument('--out', default='darija-model')
    t.add_argument('--mode', choices=['distill', 'pairs'], default='distill',
                   help='distill (default): keep the base space, add Darija; pairs: contrastive pairs, which moved the whole space and lowered routing')
    t.add_argument('--max-items', type=int, default=200000, help='distill: cap on training items')
    t.add_argument('--latin', action='store_true', help='also train Latin-script (Arabizi) -> Darija pairs')
    t.add_argument('--epochs', type=float, default=1)
    t.add_argument('--max-steps', type=int, default=0, help='stop after this many steps (smoke tests)')
    t.add_argument('--max-pairs', type=int, default=0)
    t.add_argument('--batch', type=int, default=128)
    t.add_argument('--mini-batch', type=int, default=32)
    t.add_argument('--lr', type=float, default=2e-5)
    t.add_argument('--max-seq-length', type=int, default=96)
    t.add_argument('--eval-size', type=int, default=1000)
    t.add_argument('--seed', type=int, default=13)
    t.set_defaults(func=cmd_train)
    e = sub.add_parser('embed')
    e.add_argument('--model', required=True)
    e.add_argument('--input', required=True)
    e.add_argument('--out', required=True)
    e.add_argument('--batch', type=int, default=64)
    e.set_defaults(func=cmd_embed)
    args = p.parse_args(argv)
    args.func(args)


if __name__ == '__main__':
    sys.exit(main())
