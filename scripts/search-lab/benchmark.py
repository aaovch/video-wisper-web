"""Warm single-query timings, separate from cached/batched evaluation costs."""
import hashlib
import json
import time
from pathlib import Path

import numpy as np
from neural import MODELS, embed, fuse, infer, load_model

root = Path('.codex/search-lab')
corpus = json.loads((root / 'corpus.json').read_text(encoding='utf-8'))
tasks = json.loads((root / 'tasks.json').read_text(encoding='utf-8'))
texts = [f"{d['context']}\n{d['title']}\n{d['body']}" for d in corpus]
fingerprint = hashlib.sha256(json.dumps([texts, MODELS['e5'], 512], ensure_ascii=False).encode()).hexdigest()
vectors = np.load(root / f'embeddings-{fingerprint}.npy')
docs = {d['id']: text for d, text in zip(corpus, texts)}
e5_tokenizer, e5 = load_model(root, 'e5', 4)
rank_tokenizer, reranker = load_model(root, 'reranker', 4)
sample = [t for t in tasks if t['scope'] == 'archive' and t['variant'] == 'natural'][::4]
timings = []
for task in sample:
    start = time.perf_counter()
    hidden, mask = infer(e5_tokenizer, e5, ['query: ' + task['query']])
    vector = (hidden * mask[:, :, None]).sum(axis=1) / mask.sum(axis=1)[:, None]
    vector /= np.linalg.norm(vector, axis=1, keepdims=True)
    scores = vectors @ vector[0].astype(np.float32)
    top = np.argsort(-scores)[:100]
    dense = [{'id': corpus[i]['id'], 'score': float(scores[i])} for i in top]
    hybrid = fuse([task['rankings']['context-bm25'], dense])[:20]
    retrieval_ms = (time.perf_counter() - start) * 1000
    start = time.perf_counter()
    pairs = [(task['query'], docs[h['id']]) for h in hybrid]
    for i in range(0, len(pairs), 8):
        infer(rank_tokenizer, reranker, pairs[i:i + 8])
    rerank_ms = (time.perf_counter() - start) * 1000
    timings.append(dict(query=task['query'], retrievalMs=retrieval_ms, rerank20Ms=rerank_ms,
                        totalMs=retrieval_ms + rerank_ms))
    print(task['id'], round(retrieval_ms, 1), round(rerank_ms, 1), flush=True)
result = dict(provider='CPUExecutionProvider', threads=4, samples=len(timings),
              note='Warm desktop ONNX. Query encoding + exact vector scan + RRF + 20 pair rerank. Excludes network, browser, lexical retrieval and model startup.',
              measurements=timings,
              summary={key: dict(median=float(np.median([t[key] for t in timings])),
                                  p95=float(np.percentile([t[key] for t in timings], 95)))
                       for key in ['retrievalMs', 'rerank20Ms', 'totalMs']})
(root / 'latency-neural.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
