from __future__ import annotations

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=5, ge=1, le=12)
    category: str | None = None
    source: str | None = None
    year: str | int | None = None
    include_wordcloud: bool = False


class BuildIndexResponse(BaseModel):
    total_documents: int
    total_chunks: int
    index_path: str


class SearchHit(BaseModel):
    score: float
    chunk_id: str
    title: str
    year: int | None
    category: str
    source: str
    document_type: str
    url: str
    text: str
    tags: list[str]


class QueryResponse(BaseModel):
    query: str
    answer: str
    total_hits: int
    highlight_terms: list[str] = Field(default_factory=list)
    hits: list[SearchHit]


class SummaryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    summary_length: str = "2"  # "1" = 1 page, "2" = 2 pages, "3+" = 3+ pages
    summary_type: str = "abstractive"  # "abstractive", "comprehensive", "evolution", "executive"
    include_animal_photo: bool = True
    include_telemetry_charts: bool = True
    attach_snippets: bool = True
    category: str | None = None
    source: str | None = None
    year: str | int | None = None
    top_k: int = 5


class ExportRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    summary_length: str = "2"
    summary_type: str = "abstractive"
    include_animal_photo: bool = True
    include_telemetry_charts: bool = True
    attach_snippets: bool = True
    category: str | None = None
    source: str | None = None
    year: str | int | None = None
    top_k: int = 5
    detailed_report: str | None = None
    ai_image_base64: str | None = None


class ImageGenRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)