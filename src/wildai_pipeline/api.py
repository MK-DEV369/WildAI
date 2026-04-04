from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import PipelineConfig
from .rag_engine import RAGEngine
from .schemas import BuildIndexResponse, QueryRequest, QueryResponse, SearchHit


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
        return QueryResponse(
            query=request.query,
            answer=answer,
            total_hits=len(hits),
            hits=[SearchHit(**hit) for hit in hits],
        )

    return app


app = create_app()
