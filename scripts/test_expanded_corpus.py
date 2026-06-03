#!/usr/bin/env python3
"""Test the expanded corpus with larger embeddings model."""

from wildai_pipeline.rag_engine import RAGEngine
from wildai_pipeline.config import PipelineConfig

config = PipelineConfig(
    embedding_model_name="all-mpnet-base-v2",
    use_gpu=True,
    aggressive_cleanup=True,
)
engine = RAGEngine(config)

# Test queries
queries = [
    "endangered tigers in India",
    "wildlife protection laws and acts",
    "forest conservation and biodiversity",
    "endangered species threatened with extinction",
    "national environmental policies",
    "state regulations for wildlife protection",
]

print("=" * 80)
print("RETRIEVAL TESTS WITH EXPANDED CORPUS (all-mpnet-base-v2 embeddings)")
print("=" * 80)

for query in queries:
    hits = engine.search(query, top_k=3)
    if hits:
        print(f"\nQuery: {query}")
        print(f"  Hits: {len(hits)} results found")
        for i, hit in enumerate(hits, 1):
            print(f"  [{i}] {hit['title']} ({hit['year'] or 'N/A'}) - {hit['source']}")
            print(f"      Score: {hit['score']:.4f}, Category: {hit['category']}")
    else:
        print(f"\nQuery: {query}")
        print(f"  No results found")

print("\n" + "=" * 80)
print("Test complete. Corpus now contains 140+ documents with 96+ species profiles.")
print("=" * 80)
