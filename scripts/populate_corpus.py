from __future__ import annotations

import json
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


@dataclass(slots=True)
class SourceItem:
    title: str
    url: str
    category: str
    source: str
    doc_type: str
    year: int | None = None
    tags: list[str] | None = None
    target_subdir: str | None = None


HEADERS = {"User-Agent": "WILDAI-Corpus-Builder/1.0"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
SESSION.verify = False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def normalize_slug(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "document"


def download_bytes(url: str) -> bytes:
    response = SESSION.get(url, timeout=60, verify=False)
    response.raise_for_status()
    return response.content


def extract_html(url: str) -> str:
    response = SESSION.get(url, timeout=60, verify=False)
    response.raise_for_status()
    return extract_html_text(response.text)


def extract_pdf(url: str) -> str:
    pdf_bytes = download_bytes(url)
    return extract_pdf_text_from_bytes(pdf_bytes)


def wikipedia_species(page_title: str, canonical_name: str, year: int | None = None) -> tuple[str, str | None, dict[str, Any]]:
    api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"
    response = SESSION.get(api_url, timeout=60, verify=False)
    response.raise_for_status()
    payload = response.json()
    extract = payload.get("extract") or ""
    thumbnail = payload.get("thumbnail", {}).get("source")
    metadata = {
        "page_title": page_title,
        "canonical_name": canonical_name,
        "description": payload.get("description"),
        "content_urls": payload.get("content_urls", {}),
        "thumbnail_source": thumbnail,
        "page_url": payload.get("content_urls", {}).get("desktop", {}).get("page"),
        "wikidata_item": payload.get("wikidata_item"),
    }
    return extract, thumbnail, metadata


def save_image(url: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    response = SESSION.get(url, timeout=60, verify=False)
    response.raise_for_status()
    output_path.write_bytes(response.content)


def write_document(dataset_store: DatasetStore, item: SourceItem, content: str, extra: dict[str, Any] | None = None) -> Path:
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
        extra=extra or {},
    )
    return dataset_store.save_document(record)


def build_corpus() -> list[Path]:
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved_paths: list[Path] = []

    sources = [
        SourceItem(
            title="MoEFCC Content Review Policy",
            url="https://moef.gov.in/content-review-crp-policy",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "governance", "web"],
        ),
        SourceItem(
            title="MoEFCC Content Archival Policy",
            url="https://moef.gov.in/content-archival-policy-cap",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "archival", "governance"],
        ),
        SourceItem(
            title="MoEFCC Privacy Policy",
            url="https://moef.gov.in/privacy-policy",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "privacy"],
        ),
        SourceItem(
            title="MoEFCC Security Policy",
            url="https://moef.gov.in/security-policy",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "security"],
        ),
        SourceItem(
            title="MoEFCC Website Monitoring Plan",
            url="https://moef.gov.in/website-monitoring-plan",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "monitoring", "web"],
        ),
        SourceItem(
            title="MoEFCC Right to Information Act",
            url="https://moef.gov.in/right-to-information-act",
            category="legal",
            source="India",
            doc_type="html",
            tags=["right to information", "legal", "transparency"],
        ),
        SourceItem(
            title="MoEFCC Hyperlinking Policy",
            url="https://moef.gov.in/hyperlinking-policy",
            category="policies",
            source="India",
            doc_type="html",
            tags=["policy", "hyperlinking"],
        ),
        SourceItem(
            title="CBD Convention Text",
            url="https://www.cbd.int/convention/text/",
            category="legal",
            source="Global",
            doc_type="html",
            tags=["treaty", "biodiversity", "legal"],
        ),
        SourceItem(
            title="CBD Press Release on Cali Fund",
            url="https://www.cbd.int/doc/press/2026/pr-2026-03-04-califund-en.pdf",
            category="legal",
            source="Global",
            doc_type="pdf",
            year=2026,
            tags=["treaty", "funding", "biodiversity"],
        ),
        SourceItem(
            title="CBD Press Release on National Reports",
            url="https://www.cbd.int/doc/press/2026/pr-2026-03-09-nr7-en.pdf",
            category="legal",
            source="Global",
            doc_type="pdf",
            year=2026,
            tags=["reporting", "biodiversity", "treaty"],
        ),
        SourceItem(
            title="Forest Survey of India Annual Report",
            url="https://fsi.nic.in/documents/annualreport.pdf",
            category="ecosystems",
            source="India",
            doc_type="pdf",
            year=2024,
            tags=["forest", "report", "ecosystem"],
        ),
        SourceItem(
            title="Forest Survey of India Forest Report 2023",
            url="https://fsi.nic.in/forest-report-2023",
            category="ecosystems",
            source="India",
            doc_type="html",
            year=2023,
            tags=["forest cover", "report", "ecosystem"],
        ),
        SourceItem(
            title="Forest Survey of India Forest Report 2021",
            url="https://fsi.nic.in/forest-report-2021",
            category="ecosystems",
            source="India",
            doc_type="html",
            year=2021,
            tags=["forest cover", "report", "habitat"],
        ),
        SourceItem(
            title="Forest Survey of India Forest Report 2019",
            url="https://fsi.nic.in/forest-report-2019",
            category="ecosystems",
            source="India",
            doc_type="html",
            year=2019,
            tags=["forest cover", "report", "habitat"],
        ),
        SourceItem(
            title="Bengal Tiger",
            url="https://en.wikipedia.org/wiki/Bengal_tiger",
            category="species",
            source="Wikipedia",
            doc_type="html",
            year=2024,
            tags=["tiger", "endangered", "species"],
            target_subdir="species/wiki",
        ),
        SourceItem(
            title="Indian Elephant",
            url="https://en.wikipedia.org/wiki/Indian_elephant",
            category="species",
            source="Wikipedia",
            doc_type="html",
            year=2024,
            tags=["elephant", "species", "habitat"],
            target_subdir="species/wiki",
        ),
        SourceItem(
            title="Greater One-horned Rhinoceros",
            url="https://en.wikipedia.org/wiki/Indian_rhinoceros",
            category="species",
            source="Wikipedia",
            doc_type="html",
            year=2024,
            tags=["rhinoceros", "species", "conservation"],
            target_subdir="species/wiki",
        ),
        SourceItem(
            title="Snow Leopard",
            url="https://en.wikipedia.org/wiki/Snow_leopard",
            category="species",
            source="Wikipedia",
            doc_type="html",
            year=2024,
            tags=["leopard", "species", "conservation"],
            target_subdir="species/wiki",
        ),
        SourceItem(
            title="Ganges River Dolphin",
            url="https://en.wikipedia.org/wiki/Ganges_river_dolphin",
            category="species",
            source="Wikipedia",
            doc_type="html",
            year=2024,
            tags=["dolphin", "species", "river"],
            target_subdir="species/wiki",
        ),
    ]

    for item in sources:
        try:
            if item.source == "Wikipedia":
                extract, thumbnail, metadata = wikipedia_species(
                    page_title=item.url.rsplit("/", 1)[-1],
                    canonical_name=item.title,
                    year=item.year,
                )
                target_dir = dataset_store.dataset_dir / (item.target_subdir or item.category)
                target_dir.mkdir(parents=True, exist_ok=True)
                document_path = write_document(dataset_store, item, extract, extra=metadata)
                saved_paths.append(document_path)

                if thumbnail:
                    image_dir = dataset_store.dataset_dir / "images" / "species"
                    image_path = image_dir / f"{normalize_slug(item.title)}.jpg"
                    save_image(thumbnail, image_path)
                continue

            if item.doc_type == "pdf":
                content = extract_pdf(item.url)
            else:
                content = extract_html(item.url)

            saved_paths.append(write_document(dataset_store, item, content))
        except Exception as exc:
            failure_path = dataset_store.dataset_dir / "failed-downloads.json"
            failures: list[dict[str, Any]] = []
            if failure_path.exists():
                failures = json.loads(failure_path.read_text(encoding="utf-8"))
            failures.append({"title": item.title, "url": item.url, "error": str(exc)})
            failure_path.write_text(json.dumps(failures, indent=2, ensure_ascii=True), encoding="utf-8")

    return saved_paths


def main() -> None:
    saved = build_corpus()
    print(f"Saved {len(saved)} documents")
    for path in saved:
        print(path)


if __name__ == "__main__":
    main()
