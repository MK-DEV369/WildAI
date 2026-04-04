#!/usr/bin/env python3
"""
Extended corpus builder for WILDAI.
Fetches 100+ endangered species, historical policies, and state-level regulations.
Uses adaptive chunking and aggressive memory cleanup.
"""

from __future__ import annotations

import gc
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

from wildai_pipeline.cleaning import clean_text, adaptive_chunk_text, keyword_tags
from wildai_pipeline.extractors import extract_html_text, extract_pdf_text_from_bytes
from wildai_pipeline.models import DocumentRecord
from wildai_pipeline.storage import DatasetStore


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "WILDAI-Corpus-Builder-Extended/2.0"}
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
    target_subdir: str | None = None


def normalize_slug(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "document"


def download_bytes(url: str, timeout: int = 60) -> bytes:
    try:
        response = SESSION.get(url, timeout=timeout, verify=False)
        response.raise_for_status()
        return response.content
    except Exception as exc:
        logger.error(f"Failed to download {url}: {exc}")
        raise


def extract_html(url: str, timeout: int = 60) -> str:
    try:
        response = SESSION.get(url, timeout=timeout, verify=False)
        response.raise_for_status()
        return extract_html_text(response.text)
    except Exception as exc:
        logger.error(f"Failed to extract HTML from {url}: {exc}")
        raise


def extract_pdf(url: str) -> str:
    try:
        pdf_bytes = download_bytes(url)
        return extract_pdf_text_from_bytes(pdf_bytes)
    except Exception as exc:
        logger.error(f"Failed to extract PDF from {url}: {exc}")
        raise


def wikipedia_species(page_title: str, canonical_name: str, year: int | None = None) -> tuple[str, str | None, dict[str, Any]]:
    try:
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
    except Exception as exc:
        logger.error(f"Failed to fetch Wikipedia species {page_title}: {exc}")
        raise


def save_image(url: str, output_path: Path) -> None:
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        response = SESSION.get(url, timeout=60, verify=False)
        response.raise_for_status()
        output_path.write_bytes(response.content)
    except Exception as exc:
        logger.error(f"Failed to save image from {url}: {exc}")


def write_document(dataset_store: DatasetStore, item: SourceItem, content: str, extra: dict[str, Any] | None = None) -> Path:
    """Write document with adaptive chunking."""
    cleaned = clean_text(content)
    chunks = adaptive_chunk_text(cleaned, max_words=400)
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


TOP_100_ENDANGERED_SPECIES = [
    "Bengal tiger",
    "Indian elephant",
    "Greater one-horned rhinoceros",
    "Snow leopard",
    "Ganges river dolphin",
    "Asian lion",
    "Indian wild dog",
    "Asiatic buffalo",
    "Clouded leopard",
    "Sun bear",
    "Sloth bear",
    "Himalayan brown bear",
    "Indian pangolin",
    "Giant pangolin",
    "Primate gibbon",
    "Proboscis monkey",
    "Nilgiri tahr",
    "Kashmir stag",
    "Swamp deer",
    "Barasingha",
    "Musk deer",
    "Red panda",
    "Clouded leopard cat",
    "Flat-headed cat",
    "Rusty-spotted cat",
    "Bengal florican",
    "Bengal vulture",
    "Indian vulture",
    "White-rumped vulture",
    "Philippine eagle",
    "Crested serpent eagle",
    "Black eagle",
    "Grey-headed fish eagle",
    "Indian skimmer",
    "Bengal bustard",
    "Indian bustard",
    "Green peafowl",
    "Indian peafowl",
    "Kalij pheasant",
    "Cheer pheasant",
    "Manipur brow antlered deer",
    "Asiatic cheetah",
    "Dhole",
    "Bengal slow loris",
    "Capped langur",
    "Golden langur",
    "Pig-tailed macaque",
    "Bonnet macaque",
    "Rhesus macaque",
    "Gray langur",
    "Common otter",
    "Smooth-coated otter",
    "Clawless otter",
    "Fishing cat",
    "Marbled cat",
    "Asian golden cat",
    "Jungle cat",
    "Asian wild boar",
    "Hog badger",
    "Asian badger",
    "Honey badger",
    "Common palm civet",
    "Asian palm civet",
    "Small Indian civet",
    "Large Indian civet",
    "Oriental civet",
    "Masked palm civet",
    "Indian crested porcupine",
    "Himalayan porcupine",
    "Indian giant squirrel",
    "Black giant squirrel",
    "Grizzled giant squirrel",
    "Ratufa dwarf squirrel",
    "Javan rhinoceros",
    "Sumatran rhinoceros",
    "Black rhinoceros",
    "White rhinoceros",
    "Hippopotamus",
    "Pygmy hippopotamus",
    "Sumatran elephant",
    "African bush elephant",
    "African forest elephant",
    "Bornean orangutan",
    "Sumatran orangutan",
    "Tapanuli orangutan",
    "Western lowland gorilla",
    "Eastern lowland gorilla",
    "Western chimpanzee",
    "Eastern chimpanzee",
    "Bonobo",
    "Chimpanzee",
    "Gibbon",
    "Siamang",
    "Slender loris",
    "Slow loris",
    "Greater slow loris",
    "Pygmy slow loris",
    "Monito del monte",
    "Ring-tailed lemur",
    "Red-ruffed lemur",
    "Black-and-white ruffed lemur",
]

INDIAN_STATE_POLICIES = [
    ("Kerala Biodiversity Rules", "https://kerala.gov.in/", 2023),
    ("Maharashtra Forest Conservation", "https://www.maharashtra.gov.in/", 2022),
    ("Karnataka Wildlife Board", "https://www.karnataka.gov.in/", 2023),
    ("Assam Biodiversity Strategy", "https://assam.gov.in/", 2022),
    ("Meghalaya Environmental Policy", "https://meghalaya.gov.in/", 2021),
    ("Himachal Pradesh Forest Rules", "https://himachal.nic.in/", 2023),
    ("Uttarakhand Wildlife Conservation", "https://uttarakhand.gov.in/", 2022),
    ("West Bengal Environmental Act", "https://www.wbgov.in/", 2023),
    ("Tamil Nadu Forest Policy", "https://www.tn.gov.in/", 2022),
    ("Rajasthan Wildlife Protection", "https://www.rajasthan.gov.in/", 2023),
]

NATIONAL_POLICIES = [
    ("National Wildlife Action Plan", "https://moef.gov.in/", 2023),
    ("National Green Mission", "https://moef.gov.in/", 2022),
    ("National Coastal Zone Management", "https://moef.gov.in/", 2023),
    ("National Biodiversity Strategy and Action Plan", "https://www.cbd.int/", 2022),
    ("National Environmental Policy", "https://moef.gov.in/", 2023),
    ("National Forest Policy", "https://moef.gov.in/", 2021),
]


def build_species_corpus() -> list[Path]:
    """Build species corpus from Wikipedia."""
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved_paths: list[Path] = []

    logger.info(f"Downloading {len(TOP_100_ENDANGERED_SPECIES)} endangered species...")

    for idx, species_name in enumerate(TOP_100_ENDANGERED_SPECIES):
        if idx % 10 == 0:
            gc.collect()
            logger.info(f"Progress: {idx}/{len(TOP_100_ENDANGERED_SPECIES)}")

        try:
            page_title = species_name.replace(" ", "_")
            extract, thumbnail, metadata = wikipedia_species(page_title, species_name, year=2024)

            target_dir = dataset_store.dataset_dir / "species" / "endangered"
            target_dir.mkdir(parents=True, exist_ok=True)

            item = SourceItem(
                title=species_name,
                url=f"https://en.wikipedia.org/wiki/{page_title}",
                category="species",
                source="Wikipedia",
                doc_type="html",
                year=2024,
                tags=["endangered", "wildlife", "species"],
                target_subdir="species/endangered",
            )
            doc_path = write_document(dataset_store, item, extract, extra=metadata)
            saved_paths.append(doc_path)

            if thumbnail:
                image_dir = dataset_store.dataset_dir / "images" / "species"
                image_path = image_dir / f"{normalize_slug(species_name)}.jpg"
                save_image(thumbnail, image_path)

        except Exception as exc:
            logger.warning(f"Failed to fetch {species_name}: {exc}")
            failure_path = dataset_store.dataset_dir / "failed-species.json"
            failures: list[dict[str, Any]] = []
            if failure_path.exists():
                failures = json.loads(failure_path.read_text(encoding="utf-8"))
            failures.append({"species": species_name, "error": str(exc)})
            failure_path.write_text(json.dumps(failures, indent=2), encoding="utf-8")

    return saved_paths


def build_policy_corpus() -> list[Path]:
    """Build historical policy corpus."""
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved_paths: list[Path] = []

    # National policies
    logger.info("Downloading national policies...")
    for title, base_url, year in NATIONAL_POLICIES:
        try:
            item = SourceItem(
                title=f"{title} ({year})",
                url=base_url,
                category="policies",
                source="India National",
                doc_type="html",
                year=year,
                tags=["national", "policy", "regulation"],
            )
            content = extract_html(base_url)
            saved_paths.append(write_document(dataset_store, item, content))
        except Exception as exc:
            logger.warning(f"Failed to fetch {title}: {exc}")

    gc.collect()

    # State policies
    logger.info("Downloading state-level policies...")
    for title, base_url, year in INDIAN_STATE_POLICIES:
        try:
            item = SourceItem(
                title=f"{title} ({year})",
                url=base_url,
                category="policies",
                source="India State",
                doc_type="html",
                year=year,
                tags=["state", "policy", "regulation"],
            )
            content = extract_html(base_url)
            saved_paths.append(write_document(dataset_store, item, content))
        except Exception as exc:
            logger.warning(f"Failed to fetch {title}: {exc}")

    return saved_paths


def build_legal_corpus() -> list[Path]:
    """Build legal documents corpus."""
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved_paths: list[Path] = []

    legal_sources = [
        (
            "Convention on Biological Diversity - Main Text",
            "https://www.cbd.int/convention/text/",
            "legal",
            "Global",
            2024,
        ),
        (
            "Indian Wildlife Protection Act - 1972",
            "https://legislative.gov.in/",
            "legal",
            "India Legal",
            1972,
        ),
        (
            "Environment Protection Act - 1986",
            "https://legislative.gov.in/",
            "legal",
            "India Legal",
            1986,
        ),
        (
            "Forest Conservation Act - 1980",
            "https://legislative.gov.in/",
            "legal",
            "India Legal",
            1980,
        ),
        (
            "Biological Diversity Act - 2002",
            "https://legislative.gov.in/",
            "legal",
            "India Legal",
            2002,
        ),
    ]

    logger.info("Downloading legal documents...")
    for title, url, category, source, year in legal_sources:
        try:
            item = SourceItem(
                title=title,
                url=url,
                category=category,
                source=source,
                doc_type="html",
                year=year,
                tags=["legal", "act", "regulation"],
            )
            content = extract_html(url)
            saved_paths.append(write_document(dataset_store, item, content))
        except Exception as exc:
            logger.warning(f"Failed to fetch {title}: {exc}")

    return saved_paths


def build_ecosystem_corpus() -> list[Path]:
    """Build ecosystem and habitat corpus."""
    dataset_store = DatasetStore(ROOT / "data" / "dataset")
    saved_paths: list[Path] = []

    ecosystems = [
        ("Amazon Rainforest Ecosystem", "https://www.rainforest-alliance.org/", 2024),
        ("Indian Western Ghats Biodiversity", "https://moef.gov.in/", 2023),
        ("Sundarbans Mangrove Forest", "https://moef.gov.in/", 2023),
        ("Himalayan Ecosystem Health", "https://moef.gov.in/", 2022),
        ("Coral Reef Conservation", "https://www.cbd.int/", 2023),
        ("Grassland and Steppe Habitats", "https://www.cbd.int/", 2023),
        ("Wetlands and Ramsar Sites", "https://moef.gov.in/", 2022),
        ("Desert Ecosystem Management", "https://moef.gov.in/", 2023),
    ]

    logger.info("Downloading ecosystem documents...")
    for title, url, year in ecosystems:
        try:
            item = SourceItem(
                title=title,
                url=url,
                category="ecosystems",
                source="Global",
                doc_type="html",
                year=year,
                tags=["ecosystem", "habitat", "biodiversity"],
            )
            content = extract_html(url)
            saved_paths.append(write_document(dataset_store, item, content))
        except Exception as exc:
            logger.warning(f"Failed to fetch {title}: {exc}")

    return saved_paths


def main() -> None:
    logger.info("Starting extended corpus population...")
    total_saved = []

    try:
        total_saved.extend(build_species_corpus())
        gc.collect()
        total_saved.extend(build_policy_corpus())
        gc.collect()
        total_saved.extend(build_legal_corpus())
        gc.collect()
        total_saved.extend(build_ecosystem_corpus())
        gc.collect()
    except Exception as exc:
        logger.error(f"Corpus population failed: {exc}", exc_info=True)
        sys.exit(1)

    logger.info(f"✓ Saved {len(total_saved)} documents total")
    for path in total_saved[:10]:
        logger.info(f"  {path}")
    if len(total_saved) > 10:
        logger.info(f"  ... and {len(total_saved) - 10} more")


if __name__ == "__main__":
    main()
