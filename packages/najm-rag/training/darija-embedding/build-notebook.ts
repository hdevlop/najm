/**
 * Builds darija_embedding.ipynb (Google Colab) from darija_embedding.py, so the
 * notebook always runs the script in this folder.
 *
 *   bun packages/najm-rag/training/darija-embedding/build-notebook.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dir;
const script = readFileSync(join(HERE, 'darija_embedding.py'), 'utf8');

const lines = (text: string) => {
  const parts = text.replace(/\r\n/g, '\n').split('\n');
  return parts.map((line, i) => (i < parts.length - 1 ? `${line}\n` : line)).filter((line, i) => line !== '' || i < parts.length - 1);
};
const md = (text: string) => ({ cell_type: 'markdown', metadata: {}, source: lines(text.trim()) });
const code = (text: string) => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: lines(text.trim()) });

const cells = [
  md(`
# EmbeddingGemma for Darija (najm-rag)

Fine-tunes \`google/embeddinggemma-300m\` on Arabic-script Darija sentence pairs and embeds the
najm-rag routing benchmark texts with the base and the trained model, so both are scored by the
same router locally.

1. **Runtime → Change runtime type → GPU** (the free T4 is enough).
2. Upload \`colab-input.json\` (from \`bun packages/najm-rag/training/darija-embedding/prepare.ts\`).
3. Run all cells, then copy the two downloaded \`embeddings-*.json\` files into
   \`apps/playground/bench/routing/.cache/\` and run \`compare.ts\`.

**Data license:** the Darija Open Dataset (DODa) is CC BY-NC 4.0, non-commercial. Fine for measuring;
a model for a commercial app should be trained on your own pairs (\`--pairs your.csv\`).
`),
  code(`
!pip install -q -U "sentence-transformers>=5.1" "transformers>=4.57" datasets accelerate
`),
  md(`
\`google/embeddinggemma-300m\` asks you to accept the Gemma terms on its Hugging Face page first.
Then add a **Read** token as a Colab secret: key icon in the left sidebar → name \`HF_TOKEN\`,
notebook access on. Without the secret, the cell asks for the token instead.
`),
  code(`
from huggingface_hub import login
try:
    from google.colab import userdata
    token = userdata.get('HF_TOKEN')
except Exception:  # no secret, or notebook access off
    token = None
if token:
    login(token=token)
else:
    login()
`),
  md('The training and embedding script (generated from `darija_embedding.py`, do not edit here):'),
  code(`%%writefile darija_embedding.py\n${script}`),
  code(`
from google.colab import files
uploaded = files.upload()  # choose colab-input.json
assert 'colab-input.json' in uploaded, 'upload colab-input.json'
`),
  md(`
Training: about 20–40 minutes on a T4. It prints held-out Darija → English retrieval for the base and
the trained model; if the trained number is not clearly higher, stop here.
`),
  // %%bash with set -e fails the cell when the script fails, so "Run all" stops
  // there; a `!python` line would let the next cell run and fail confusingly.
  code(`
%%bash
set -e
python darija_embedding.py train --input colab-input.json --out darija-model
`),
  code(`
%%bash
set -e
python darija_embedding.py embed --model google/embeddinggemma-300m --input colab-input.json --out embeddings-embeddinggemma-st-base.json
python darija_embedding.py embed --model darija-model --input colab-input.json --out embeddings-embeddinggemma-st-darija.json
`),
  code(`
from google.colab import files
files.download('embeddings-embeddinggemma-st-base.json')
files.download('embeddings-embeddinggemma-st-darija.json')
files.download('darija-model/training-summary.json')
`),
  md(`
## Optional: GGUF for Ollama or llama.cpp

Only once \`compare.ts\` shows the trained model is better. \`--sentence-transformers-dense-modules\`
keeps EmbeddingGemma's two projection layers; without it the vectors differ from the trained model.
Check the result locally with \`verify-server.ts\` before routing with it.
`),
  code(`
%%bash
set -e
git clone --depth 1 https://github.com/ggml-org/llama.cpp
pip install -q ./llama.cpp/gguf-py sentencepiece
python llama.cpp/convert_hf_to_gguf.py darija-model --outfile embeddinggemma-darija.gguf --outtype bf16 --sentence-transformers-dense-modules
`),
  code(`
from google.colab import files
files.download('embeddinggemma-darija.gguf')
`),
];

const notebook = {
  nbformat: 4,
  nbformat_minor: 0,
  metadata: {
    accelerator: 'GPU',
    colab: { provenance: [], gpuType: 'T4' },
    kernelspec: { name: 'python3', display_name: 'Python 3' },
    language_info: { name: 'python' },
  },
  cells,
};
writeFileSync(join(HERE, 'darija_embedding.ipynb'), `${JSON.stringify(notebook, null, 1)}\n`);
console.log(`wrote darija_embedding.ipynb (${cells.length} cells)`);
