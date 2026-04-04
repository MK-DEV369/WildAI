#!/usr/bin/env python3
"""
Refresh the corpus with current official policy and report sources from 2023-2026.

This script pulls a small set of high-authority documents from CBD and FSI,
then stores them in the dataset with cleaned text and metadata.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
import urllib3

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from wildai_pipeline.cleaning import clean_text, chunk_text, keyword_tags
from wildai_pipeline.extractors import extract_html_text, extract_pdf_text_from_bytes
from wildai_pipeline.models import DocumentRecord
from wildai_pipeline.storage import DatasetStore

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "WILDAI-Corpus-Refresh/1.0"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
SESSION.verify = False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@dataclass(slots=True)
class SourceItem:
    title: str
    url: str
    category: str
    source: str
    doc_type: str
    year: int | None = None
    tags: list[str] | None = None
    extra: dict[str, Any] | None = None


def normalize_slug(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "document"


def download_bytes(url: str, timeout: int = 60) -> bytes:
    response = SESSION.get(url, timeout=timeout, verify=False)
    response.raise_for_status()
    return response.content


def extract_html(url: str, timeout: int = 60) -> str:
    response = SESSION.get(url, timeout=timeout, verify=False)
    response.raise_for_status()
    return extract_html_text(response.text)


def extract_pdf(url: str) -> str:
    return extract_pdf_text_from_bytes(download_bytes(url))


def write_document(dataset_store: DatasetStore, item: SourceItem, content: str) -> Path:
    cleaned = clean_text(content)
    chunks = chunk_text(cleaned, 400)
    if not chunks and cleaned:
        chunks = [cleaned]

    tags = keyword_tags(cleaned, item.tags or [])
    record = DocumentRecord(
        title=item.title,
        year=item.year,
        category=item.category,
        source=item.source,
        type=item.doc_type,
        content=cleaned,
        tags=tags,
        url=item.url,
        cleaned_content=cleaned,
        chunks=chunks,
        extra=item.extra or {},
    )
    return dataset_store.save_document(record)


REFRESH_SOURCES = [
    SourceItem(
        title="CBD Press Release on Cali Fund",
        url="https://www.cbd.int/doc/press/2026/pr-2026-03-04-califund-en.pdf",
        category="legal",
        source="Global",
        doc_type="pdf",
        year=2026,
        tags=["biodiversity", "funding", "treaty", "2026"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="CBD Press Release on National Reports",
        url="https://www.cbd.int/doc/press/2026/pr-2026-03-09-nr7-en.pdf",
        category="legal",
        source="Global",
        doc_type="pdf",
        year=2026,
        tags=["biodiversity", "national-reports", "treaty", "2026"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="CBD Biodiversity Day 2026 Theme",
        url="https://www.cbd.int/article/2026-03-17-Biodiversity-Day-2026-theme",
        category="biodiversity",
        source="Global",
        doc_type="html",
        year=2026,
        tags=["biodiversity", "theme", "2026"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="State of Forest Report 2023",
        url="https://fsi.nic.in/forest-report-2023",
        category="ecosystems",
        source="India",
        doc_type="html",
        year=2023,
        tags=["forest", "report", "2023", "ecosystem"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="India State of Forest Report 2023 Volume I",
        url="https://fsi.nic.in/uploads/isfr2023/isfr_book_eng-vol-1_2023.pdf",
        category="ecosystems",
        source="India",
        doc_type="pdf",
        year=2023,
        tags=["forest", "report", "volume-1", "2023"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="India State of Forest Report 2023 Volume II",
        url="https://fsi.nic.in/uploads/isfr2023/isfr_book_eng-vol-2_2023.pdf",
        category="ecosystems",
        source="India",
        doc_type="pdf",
        year=2023,
        tags=["forest", "report", "volume-2", "2023"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="Forest Survey of India Annual Report 2024",
        url="https://fsi.nic.in/documents/annualreport.pdf",
        category="ecosystems",
        source="India",
        doc_type="pdf",
        year=2024,
        tags=["forest", "annual-report", "2024"],
        extra={"refresh_batch": "2023-2026"},
    ),
    SourceItem(
        title="MoEFCC Homepage Current Updates 2026",
        url="https://moef.gov.in/",
        category="governance",
        source="India",
        doc_type="html",
        year=2026,
        tags=["ministry", "current-updates", "2026"],
        extra={"refresh_batch": "2023-2026"},
    ),
]


def main() -> None:
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved: list[Path] = []
    failures: list[dict[str, Any]] = []

    logger.info("Refreshing corpus with 2023-2026 official sources...")
    for item in REFRESH_SOURCES:
        try:
            logger.info(f"Downloading: {item.title}")
            if item.doc_type == "pdf":
                content = extract_pdf(item.url)
            else:
                content = extract_html(item.url)
            saved_path = write_document(dataset_store, item, content)
            saved.append(saved_path)
            logger.info(f"  ✓ Saved {saved_path}")
        except Exception as exc:
            logger.warning(f"  ✗ Failed {item.title}: {exc}")
            failures.append({"title": item.title, "url": item.url, "error": str(exc)})

    if failures:
        failure_path = dataset_store.dataset_dir / "failed-refresh-2023-2026.json"
        failure_path.write_text(json.dumps(failures, indent=2, ensure_ascii=True), encoding="utf-8")
        logger.info(f"Wrote failures to {failure_path}")

    logger.info(f"Saved {len(saved)} refreshed documents")
    for path in saved:
        logger.info(f"  {path}")


if __name__ == "__main__":
    main()
