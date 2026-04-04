#!/usr/bin/env python3
"""
WILDAI Corpus Management Guide
================================

This script provides utilities for managing and updating the corpus.
Run this to refresh species data, add new policies, and optimize storage.
"""

from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "dataset"


def get_corpus_stats() -> dict:
    """Get current corpus statistics."""
    doc_count = len(list(DATA_DIR.rglob("*.json")))
    total_size = sum(f.stat().st_size for f in DATA_DIR.rglob("*") if f.is_file()) / 1024**2
    
    categories = {}
    for json_file in DATA_DIR.rglob("*.json"):
        cat = json_file.parent.name
        categories[cat] = categories.get(cat, 0) + 1
    
    return {
        "total_documents": doc_count,
        "storage_mb": round(total_size, 2),
        "categories": categories,
    }


def print_corpus_summary():
    """Print current corpus summary."""
    stats = get_corpus_stats()
    print("\n" + "=" * 70)
    print("WILDAI CORPUS SUMMARY")
    print("=" * 70)
    print(f"Total Documents: {stats['total_documents']}")
    print(f"Storage Used: {stats['storage_mb']} MB / 10,000 MB (10 GB)")
    print(f"Storage Available: {10000 - stats['storage_mb']:.2f} MB")
    print("\nDocuments by Category:")
    for cat, count in sorted(stats['categories'].items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat.ljust(20)} : {count:3d} documents")
    print("=" * 70 + "\n")


def clean_starter_documents():
    """Remove old starter/placeholder documents to free up space."""
    starter_patterns = [
        "starter-",
        "moefcc-notifications",
        "wildlife-protection-act-resources",
        "iucn-red-list",
        "wwf-biodiversity",
        "convention-on-biological-diversity",
        "unep-environment",
    ]
    
    removed = 0
    for json_file in DATA_DIR.rglob("*.json"):
        for pattern in starter_patterns:
            if pattern.lower() in json_file.name.lower():
                try:
                    json_file.unlink()
                    removed += 1
                    logger.info(f"Removed: {json_file.name}")
                except Exception as exc:
                    logger.error(f"Failed to remove {json_file.name}: {exc}")
                break
    
    logger.info(f"Cleaned {removed} old starter documents")
    return removed


def verify_corpus_integrity():
    """Verify all JSON files are valid and have required fields."""
    required_fields = {"title", "category", "source", "content", "url"}
    invalid_files = []
    
    # Skip metadata/log files
    skip_patterns = ["failed-", ".model_cache"]
    
    for json_file in DATA_DIR.rglob("*.json"):
        # Skip metadata files
        if any(pattern in json_file.name for pattern in skip_patterns):
            continue
        
        try:
            with json_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Handle both single object and array formats
            records = data if isinstance(data, list) else [data]
            for record in records:
                if not isinstance(record, dict):
                    invalid_files.append((str(json_file), "Not a dict"))
                    continue
                
                missing = required_fields - set(record.keys())
                if missing:
                    invalid_files.append((str(json_file), f"Missing fields: {missing}"))
        
        except json.JSONDecodeError as exc:
            invalid_files.append((str(json_file), f"JSON error: {exc}"))
        except Exception as exc:
            invalid_files.append((str(json_file), str(exc)))
    
    if invalid_files:
        print(f"\n⚠️  Found {len(invalid_files)} invalid documents:")
        for path, reason in invalid_files:
            print(f"  {path}: {reason}")
    else:
        print("\n✓ All documents are valid")
    
    return len(invalid_files) == 0


def main():
    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║           WILDAI CORPUS MANAGEMENT                                ║
    ║                                                                   ║
    ║  Options:                                                         ║
    ║    1. View corpus summary                                        ║
    ║    2. Clean old starter documents (free space)                   ║
    ║    3. Verify corpus integrity                                    ║
    ║    4. Rebuild embedding index                                    ║
    ║                                                                   ║
    ║  Run populate_corpus_extended.py to fetch 100+ animals,          ║
    ║  historical policies, and state regulations.                     ║
    ║                                                                   ║
    ║  Run scripts/test_expanded_corpus.py to test retrieval.          ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)
    
    print_corpus_summary()
    verify_corpus_integrity()


if __name__ == "__main__":
    main()
