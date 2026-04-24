from __future__ import annotations

import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import PipelineConfig
from .rag_engine import RAGEngine
from .schemas import BuildIndexResponse, QueryRequest, QueryResponse, SearchHit


HIGHLIGHT_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}


def extract_highlight_terms(query: str, max_terms: int = 12) -> list[str]:
    """Return de-duplicated query tokens suitable for safe regex highlighting."""
    if not query.strip():
        return []

    # Keep words, numbers, and common internal separators (hyphen/apostrophe/slash).
    raw_terms = re.findall(r"[A-Za-z0-9]+(?:[-'/][A-Za-z0-9]+)*", query)

    unique_terms: list[str] = []
    seen_terms: set[str] = set()

    for term in raw_terms:
        normalized = term.lower()
        if len(normalized) < 2:
            continue
        if normalized in HIGHLIGHT_STOPWORDS:
            continue
        if normalized in seen_terms:
            continue

        seen_terms.add(normalized)
        unique_terms.append(term)

    unique_terms.sort(key=len, reverse=True)
    return unique_terms[:max_terms]


def create_app() -> FastAPI:
    config = PipelineConfig()
    engine = RAGEngine(config)

    app = FastAPI(title="WILDAI RAG API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str | bool]:
        return {"status": "ok", "index_ready": engine.index_path.exists()}

    @app.post("/api/index/rebuild", response_model=BuildIndexResponse)
    def rebuild_index() -> BuildIndexResponse:
        payload = engine.build_index()
        return BuildIndexResponse(
            total_documents=int(payload["total_documents"]),
            total_chunks=int(payload["total_chunks"]),
            index_path=str(payload["index_path"]),
        )

    @app.post("/api/query", response_model=QueryResponse)
    def query(request: QueryRequest) -> QueryResponse:
        hits = engine.search(
            request.query,
            top_k=request.top_k,
            category=request.category,
            source=request.source,
            year=request.year,
        )
        answer = engine.answer(request.query, hits)
        highlight_terms = extract_highlight_terms(request.query)
        return QueryResponse(
            query=request.query,
            answer=answer,
            total_hits=len(hits),
            highlight_terms=highlight_terms,
            hits=[SearchHit(**hit) for hit in hits],
        )

    return app


app = create_app()
