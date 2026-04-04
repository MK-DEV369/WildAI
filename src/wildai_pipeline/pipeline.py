from __future__ import annotations

from pathlib import Path

from .cleaning import chunk_text, keyword_tags
from .config import PipelineConfig
from .extractors import extract_image_text_from_bytes, extract_pdf_text_from_bytes
from .models import DocumentRecord
from .scraper import Scraper
from .source_registry import SOURCE_SEEDS
from .storage import DatasetStore


class PhaseOnePipeline:
    def __init__(self, config: PipelineConfig | None = None) -> None:
        self.config = config or PipelineConfig()
        self.scraper = Scraper(
            timeout_seconds=self.config.request_timeout_seconds,
            user_agent=self.config.user_agent,
        )
        self.store = DatasetStore(self.config.data_dir)

    def run(self) -> list[Path]:
        saved_paths: list[Path] = []
        fetched = self.scraper.fetch_many(
            SOURCE_SEEDS,
            limit=self.config.max_documents_per_category * 4,
        )

        for item in fetched:
            text = self._extract_text(item)
            if not text:
                continue

            cleaned = text
            chunks = chunk_text(cleaned, self.config.chunk_target_words)
            record = DocumentRecord(
                title=item.seed.title,
                year=item.seed.year,
                category=item.seed.category,
                source=item.seed.source,
                type=item.content_type,
                content=text,
                tags=keyword_tags(text, item.seed.tags),
                url=item.url,
                cleaned_content=cleaned,
                chunks=chunks,
                extra={"notes": item.seed.notes, "content_type": item.seed.content_type},
            )
            saved_paths.append(self.store.save_document(record))

        return saved_paths

    def _extract_text(self, item) -> str:
        if item.content_type == "pdf" and item.raw_bytes is not None:
            return extract_pdf_text_from_bytes(item.raw_bytes)

        if item.content_type == "image" and item.raw_bytes is not None:
            return extract_image_text_from_bytes(item.raw_bytes)

        return item.raw_text or ""


def main() -> None:
    config = PipelineConfig()
    pipeline = PhaseOnePipeline(config)
    saved_paths = pipeline.run()
    print(f"Saved {len(saved_paths)} documents")
    for path in saved_paths:
        print(path)
