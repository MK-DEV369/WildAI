from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from .models import DocumentRecord


class DatasetStore:
    def __init__(self, dataset_dir: Path) -> None:
        self.dataset_dir = dataset_dir
        self.dataset_dir.mkdir(parents=True, exist_ok=True)

    def category_dir(self, category: str, source: str | None = None) -> Path:
        category_path = self.dataset_dir / category
        if source:
            # Sanitize source name for Windows filesystem (remove colons, etc.)
            sanitized_source = source.lower().replace(":", "-").replace("/", "-").replace("\\", "-")
            category_path = category_path / sanitized_source[:64]  # Cap at 64 chars for safety
        category_path.mkdir(parents=True, exist_ok=True)
        return category_path

    def save_document(self, document: DocumentRecord) -> Path:
        output_dir = self.category_dir(document.category, document.source)
        safe_title = "-".join(document.title.lower().split())[:80] or "document"
        output_path = output_dir / f"{safe_title}.json"
        payload = asdict(document)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=True, indent=2)
        return output_path
