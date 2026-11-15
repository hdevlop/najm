# EmbeddingGemma for Darija

Fine-tunes EmbeddingGemma on Arabic-script Darija sentence pairs and measures
whether routing gets better, with the same router code and test sets as
`scripts/routing-benchmark.ts`. Nothing here ships in the npm package.

**Data license.** The default data, the Darija Open Dataset (DODa: GitHub
`sentences.csv` and `MBZUAI-Paris/DODa-10K`), is CC BY-NC 4.0: non-commercial.
Measuring with it is fine. Before serving a model trained on it in a paid app,
get that cleared or train on your own pairs (`--pairs your.csv`, columns
`darija` plus any of `en`, `fr`, `msa`, `latin`). EmbeddingGemma itself is under
the Gemma terms.

## 1. Prepare (local)

```sh
bun packages/najm-rag/training/darija-embedding/prepare.ts
```

Writes `work/colab-input.json`:
- `inputs`: every text the benchmark embeds on the main set and the three
  Darija sets, prompts included;
- `exclude`: every benchmark test message. Training drops any Darija sentence
  equal to one, or sharing 60% of its words with one.

## 2. Train and embed (Google Colab, free T4 GPU)

Open `darija_embedding.ipynb` in Colab (File → Upload notebook), select a GPU
runtime and run all cells. You need a Hugging Face token, after accepting the
Gemma terms on the `google/embeddinggemma-300m` page. The notebook:

1. trains by distillation (`--mode distill`, the default): a frozen copy of the
   base model is the teacher; the student learns to embed each Darija sentence
   where the teacher embeds its English translation, and to keep English,
   French and MSA where they were, under both EmbeddingGemma prompts;
2. prints Darija → English retrieval@1 on 1,000 held-out sentences, base vs
   trained, and how much held-out English stayed the same ("English kept", 1.0
   = unchanged). These are sanity checks: routing is measured locally;
3. embeds `inputs` with the base and the trained model and downloads
   `embeddings-embeddinggemma-st-base.json` and
   `embeddings-embeddinggemma-st-darija.json`.

The notebook is generated: edit `darija_embedding.py`, then run
`bun packages/najm-rag/training/darija-embedding/build-notebook.ts`.

### Or on a rented GPU (RunPod and similar)

Faster than the free T4 (an RTX 4090 trains in minutes; bf16 is used
automatically). Start a pod from a PyTorch template with Jupyter and 30 GB of
container disk, upload `darija_embedding.py` and `work/colab-input.json`, and
in a terminal:

```bash
pip install -q -U "sentence-transformers>=5.1" "transformers>=4.57" datasets accelerate
export HF_TOKEN=...   # a Read token, after accepting the Gemma terms
python darija_embedding.py train --input colab-input.json --out darija-model
python darija_embedding.py embed --model google/embeddinggemma-300m --input colab-input.json --out embeddings-embeddinggemma-st-base.json
python darija_embedding.py embed --model darija-model --input colab-input.json --out embeddings-embeddinggemma-st-darija.json
```

Download the two `embeddings-*.json` files and `darija-model/training-summary.json`,
then terminate the pod: it is billed while it runs.

`--mode pairs` (contrastive pairs with in-batch negatives) is kept for
comparison: on 2026-11-15 it raised retrieval@1 from 0.26 to 0.84 but moved the
whole space (trained vectors 0.52 similar to the base) and lowered routing: main
set 85% → 70% (English 90% → 55%), small talk given tools 0 → 4 of 10, Darija
sets down 3 to 8 points. Routing needs the base space kept. The distill run kept English (0.96
similar) but moved Arabic-script text (0.76) and still routed worse at every
threshold (main set 85% → 80%, Darija sets 55/46/59% → 50/48/46% at matching
small talk). Neither method helps with DODa's everyday conversation; retry only
with in-domain pairs (real messages mapped to tools) via `--pairs`.

## 3. Compare (local)

Copy the two downloaded files into `apps/playground/bench/routing/.cache/`, then:

```sh
bun packages/najm-rag/training/darija-embedding/compare.ts
```

It scores Ollama's `embeddinggemma`, the base model as embedded in Colab
(`embeddinggemma-st-base`) and the trained one (`embeddinggemma-st-darija`) on
the main set and the three Darija sets. Compare **st-base with st-darija**:
the same library computed both. The trained model is worth keeping only if
Darija rises and English, French and Arabic on the main set do not fall.

## 4. Serve it (only if it is better)

Export GGUF with the notebook's last cell. It needs
`--sentence-transformers-dense-modules`: without it llama.cpp drops
EmbeddingGemma's two projection layers and the vectors change.

Ollama:

```sh
# Modelfile containing one line: FROM ./embeddinggemma-darija.gguf
ollama create embeddinggemma-darija -f Modelfile
bun packages/najm-rag/training/darija-embedding/verify-server.ts --model embeddinggemma-darija
```

or llama.cpp (`provider: 'openai-compatible'` in najm-rag, see its README):

```sh
llama-server -m embeddinggemma-darija.gguf --embeddings --alias embeddinggemma-darija --port 18080
bun packages/najm-rag/training/darija-embedding/verify-server.ts --model embeddinggemma-darija --openai http://127.0.0.1:18080/v1
```

`verify-server.ts` checks that the server returns the vectors the trained model
returned in Colab (cosine ≥ 0.99 on 40 texts, 768 values). Then set
`embedding.model: 'embeddinggemma-darija'`. A name starting with
`embeddinggemma` keeps the EmbeddingGemma prompts and the 0.35 threshold.
Changing the model re-indexes tools on the next run; run "reindex semantics"
and reindex knowledge documents.
