"""Offline ONNX retrieval experiment. No corpus or query is sent to a service.

Requires numpy, tokenizers and onnxruntime. Models are downloaded at pinned
revisions; all artifacts stay under the ignored research output directory.
"""
import argparse
import hashlib
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

MODELS = {
    'e5': ('intfloat/multilingual-e5-small', '614241f622f53c4eeff9890bdc4f31cfecc418b3',
           'onnx/model_qint8_avx512_vnni.onnx'),
    'reranker': ('jinaai/jina-reranker-v2-base-multilingual', '9cfeff2df7d40d1b78e75e5e9cebec92a99813c9',
                 'onnx/model_quantized.onnx'),
}


def load_model(root, name, threads):
    repo, revision, model_file = MODELS[name]
    folder = root / 'models' / name
    folder.mkdir(parents=True, exist_ok=True)
    for remote in [model_file, 'tokenizer.json']:
        target = folder / Path(remote).name
        if not target.exists():
            print(f'Downloading {repo}/{remote}', flush=True)
            partial = target.with_suffix('.partial')
            urllib.request.urlretrieve(f'https://huggingface.co/{repo}/resolve/{revision}/{remote}', partial)
            partial.replace(target)
    tokenizer = Tokenizer.from_file(str(folder / 'tokenizer.json'))
    tokenizer.enable_truncation(max_length=512)
    tokenizer.enable_padding(pad_id=tokenizer.token_to_id('<pad>') or 0, pad_token='<pad>')
    options = ort.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(folder / Path(model_file).name), sess_options=options,
                                   providers=['CPUExecutionProvider'])
    return tokenizer, session


def infer(tokenizer, session, texts):
    encoded = tokenizer.encode_batch(texts)
    inputs = {'input_ids': np.array([e.ids for e in encoded], dtype=np.int64),
              'attention_mask': np.array([e.attention_mask for e in encoded], dtype=np.int64),
              'token_type_ids': np.array([e.type_ids for e in encoded], dtype=np.int64)}
    output = session.run(None, {i.name: inputs[i.name] for i in session.get_inputs()})[0]
    return output, inputs['attention_mask']


def embed(tokenizer, session, texts, label, batch):
    vectors = []
    for start in range(0, len(texts), batch):
        hidden, mask = infer(tokenizer, session, texts[start:start + batch])
        pooled = (hidden * mask[:, :, None]).sum(axis=1) / mask.sum(axis=1)[:, None]
        pooled /= np.linalg.norm(pooled, axis=1, keepdims=True)
        vectors.append(pooled.astype(np.float32))
        if start % (batch * 20) == 0:
            print(f'{label}: {start}/{len(texts)}', flush=True)
    return np.concatenate(vectors)


def fuse(lists, k=60):
    scores = {}
    for ranking in lists:
        for i, hit in enumerate(ranking[:100]):
            scores[hit['id']] = scores.get(hit['id'], 0) + 1 / (k + i + 1)
    return [{'id': key, 'score': val} for key, val in sorted(scores.items(), key=lambda x: -x[1])][:100]


def metrics(ranking, relevant):
    ids = list(dict.fromkeys(hit['id'] for hit in ranking))
    relevant = set(relevant)
    rank = next((i + 1 for i, key in enumerate(ids) if key in relevant), 0)
    dcg = sum(1 / np.log2(i + 2) for i, key in enumerate(ids[:10]) if key in relevant)
    ideal = sum(1 / np.log2(i + 2) for i in range(min(10, len(relevant))))
    return dict(rank=rank, hit1=int(rank == 1), hit3=int(0 < rank <= 3), hit5=int(0 < rank <= 5),
                mrr10=1 / rank if 0 < rank <= 10 else 0, ndcg10=float(dcg / ideal) if ideal else 0,
                recall10=len(set(ids[:10]) & relevant) / len(relevant) if relevant else 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', type=Path, default=Path('.codex/search-lab'))
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--batch', type=int, default=8)
    parser.add_argument('--rerank', action='store_true')
    args = parser.parse_args()
    root = args.dir
    source_manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    corpus = json.loads((root / 'corpus.json').read_text(encoding='utf-8'))
    queries = json.loads((root / 'queries.json').read_text(encoding='utf-8'))
    tasks = json.loads((root / 'tasks.json').read_text(encoding='utf-8'))
    docs = {d['id']: d for d in corpus}
    ids = [d['id'] for d in corpus]
    texts = [f"{d['context']}\n{d['title']}\n{d['body']}" for d in corpus]
    query_index = {q['id']: i for i, q in enumerate(queries)}
    started = time.perf_counter()
    tokenizer, session = load_model(root, 'e5', args.threads)
    fingerprint = hashlib.sha256(json.dumps([texts, MODELS['e5'], 512], ensure_ascii=False).encode()).hexdigest()
    vector_file = root / f'embeddings-{fingerprint}.npy'
    cached = vector_file.exists()
    if cached:
        vectors = np.load(vector_file)
    else:
        vectors = embed(tokenizer, session, ['passage: ' + s for s in texts], 'chapters', args.batch)
        np.save(vector_file, vectors)
    indexing_seconds = time.perf_counter() - started
    started = time.perf_counter()
    qvectors = embed(tokenizer, session, ['query: ' + q['query'] for q in queries], 'queries', args.batch)
    query_seconds = time.perf_counter() - started
    # Matrix multiplication is exact: no ANN approximation and no database needed.
    similarities = qvectors @ vectors.T
    rows = []
    hybrids = {}
    for task in tasks:
        started = time.perf_counter()
        allowed = set(task['allowed'])
        candidates = [i for i, doc in enumerate(corpus) if doc['reportSlug'] in allowed]
        sim = similarities[query_index[task['queryId']]]
        ordered = sorted(candidates, key=lambda i: -float(sim[i]))[:100]
        dense = [{'id': ids[i], 'score': float(sim[i])} for i in ordered]
        dense_ms = (time.perf_counter() - started) * 1000
        hybrid = fuse([task['rankings']['context-bm25'], dense])
        hybrids[task['id']] = hybrid
        for name, ranking in [('e5-dense', dense), ('rrf-hybrid', hybrid)]:
            rows.append(dict(task=task['id'], system=name, ms=dense_ms,
                             **metrics(ranking, task['relevant']), returned=len(ranking), top=ranking[:10]))

    rerank_seconds = 0
    if args.rerank:
        del session
        tokenizer, session = load_model(root, 'reranker', args.threads)
        # Cache unique query/passage pairs across scopes; checkpoint every batch.
        digest = hashlib.sha256((fingerprint + str(MODELS['reranker']) + '512').encode()).hexdigest()
        cache_path = root / f'rerank-{digest}.json'
        cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
        pairs = {}
        for task in tasks:
            for hit in hybrids[task['id']][:20]:
                doc = docs[hit['id']]
                cache_key = task['query'] + '\x00' + hit['id']
                if cache_key not in cache:
                    pairs[cache_key] = (task['query'], f"{doc['context']}\n{doc['title']}\n{doc['body']}")
        items = list(pairs.items())
        started = time.perf_counter()
        for start in range(0, len(items), args.batch):
            part = items[start:start + args.batch]
            logits, _ = infer(tokenizer, session, [pair for _, pair in part])
            for (key, _), score in zip(part, logits.reshape(-1)):
                cache[key] = float(score)
            if start % (args.batch * 10) == 0:
                cache_path.write_text(json.dumps(cache), encoding='utf-8')
                print(f'rerank: {start}/{len(items)} unique pairs', flush=True)
        cache_path.write_text(json.dumps(cache), encoding='utf-8')
        rerank_seconds = time.perf_counter() - started
        for task in tasks:
            candidates = hybrids[task['id']][:20]
            ranking = sorted([dict(id=h['id'], score=cache[task['query'] + '\x00' + h['id']])
                              for h in candidates], key=lambda h: -h['score'])
            rows.append(dict(task=task['id'], system='rrf-jina-rerank20', ms=None,
                             **metrics(ranking, task['relevant']), returned=len(ranking), top=ranking[:10]))
    (root / 'neural.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    metadata = dict(models=MODELS, provider='CPUExecutionProvider', threads=args.threads, batch=args.batch,
                    sourceManifest={key: source_manifest[key] for key in ['corpusHash', 'questionsHash', 'productionIndexHash']},
                    maxTokens=512, embeddingBytes=vectors.nbytes, embeddingCached=cached,
                    indexingSeconds=indexing_seconds, queryBatchSeconds=query_seconds,
                    rerankSeconds=rerank_seconds,
                    latencyNote='Row ms for dense/hybrid excludes query encoding and lexical retrieval; rerank cached timings are not per-request latency.')
    (root / 'neural-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata, indent=2), flush=True)


if __name__ == '__main__':
    main()
