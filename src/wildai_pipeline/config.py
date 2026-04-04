from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class PipelineConfig:
    base_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parents[2])
    max_documents_per_category: int = 5
    request_timeout_seconds: int = 30
    user_agent: str = "WILDAI-Phase1/1.0"
    embedding_model_name: str = "sentence-transformers/all-mpnet-base-v2"
    chunk_target_words: int = 400
    use_gpu: bool = True
    max_batch_size: int = 32
    model_cache_enabled: bool = True
    aggressive_cleanup: bool = True

    @property
    def data_dir(self) -> Path:
        return self.base_dir / "data" / "dataset"

    @property
    def output_dir(self) -> Path:
        return self.base_dir / "output"

    @property
    def index_path(self) -> Path:
        return self.output_dir / "rag.index"

    @property
    def metadata_path(self) -> Path:
        return self.output_dir / "rag_chunks.json"

    @property
    def model_cache_dir(self) -> Path:
        cache_dir = self.output_dir / ".model_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir
