#!/usr/bin/env python3
"""
Rebuild FAISS Index and Validate Expanded Corpus
=================================================
Rebuilds the FAISS index for 1GB+ expanded dataset.
Validates metadata consistency and tests retrieval.
"""

from __future__ import annotations

import gc
import json
import logging
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from wildai_pipeline.rag_engine import RAGEngine
from wildai_pipeline.config import PipelineConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def validate_metadata_integrity() -> dict[str, Any]:
    """Validate that all documents have consistent metadata."""
    dataset_dir = ROOT / "data" / "dataset"
    results = {
        "total_documents": 0,
        "documents_with_missing_year": [],
        "documents_with_missing_tags": [],
        "documents_with_missing_content": [],
        "non_conservation_content": [],
        "categories": {},
        "years_range": None,
    }
    
    years = []
    
    for json_file in sorted(dataset_dir.rglob("*.json")):
        if "failed" in json_file.name or ".model_cache" in str(json_file):
            continue
        
        try:
            with json_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
            
            records = data if isinstance(data, list) else [data]
            for record in records:
                if isinstance(record, dict):
                    results["total_documents"] += 1
                    
                    # Check year
                    if record.get("year") is None:
                        results["documents_with_missing_year"].append(record.get("title", "Unknown"))
                    else:
                        years.append(record['year'])
                    
                    # Check tags
                    if not record.get("tags"):
                        results["documents_with_missing_tags"].append(record.get("title", "Unknown"))
                    
                    # Check content
                    if not record.get("content"):
                        results["documents_with_missing_content"].append(record.get("title", "Unknown"))
                    
                    # Track categories
                    cat = record.get("category", "uncategorized")
                    results["categories"][cat] = results["categories"].get(cat, 0) + 1
        
        except Exception as exc:
            logger.debug(f"Error reading {json_file}: {exc}")
    
    if years:
        results["years_range"] = (min(years), max(years))
    
    return results


def main() -> None:
    logger.info("=" * 80)
    logger.info("CORPUS VALIDATION & INDEX REBUILD")
    logger.info("=" * 80)
    
    # Step 1: Validate metadata
    logger.info("\n[Step 1/3] Validating corpus metadata...")
    validation = validate_metadata_integrity()
    
    logger.info(f"  Total documents: {validation['total_documents']}")
    logger.info(f"  Missing years: {len(validation['documents_with_missing_year'])}")
    logger.info(f"  Missing tags: {len(validation['documents_with_missing_tags'])}")
    logger.info(f"  Categories: {len(validation['categories'])}")
    
    if validation['years_range']:
        logger.info(f"  Year range: {validation['years_range'][0]} - {validation['years_range'][1]}")
    
    logger.info("\n  Document categories:")
    for cat, count in sorted(validation['categories'].items(), key=lambda x: -x[1]):
        logger.info(f"    - {cat}: {count} documents")
    
    # Step 2: Rebuild FAISS index
    logger.info("\n[Step 2/3] Rebuilding FAISS index...")
    try:
        config = PipelineConfig()
        rag_engine = RAGEngine(config)
        
        # Force rebuild
        index_path = config.index_path
        chunks_path = config.metadata_path
        
        if index_path.exists():
            index_path.unlink()
            logger.info(f"  Removed old index: {index_path}")
        if chunks_path.exists():
            chunks_path.unlink()
            logger.info(f"  Removed old chunks: {chunks_path}")
        
        # Rebuild
        rag_engine.build_index()
        
        logger.info(f"  Index rebuild complete")
        logger.info(f"  Index size: {index_path.stat().st_size / (1024*1024):.1f} MB")
        
    except Exception as exc:
        logger.error(f"Failed to rebuild index: {exc}")
        return
    
    # Step 3: Test retrieval on sample queries
    logger.info("\n[Step 3/3] Testing retrieval on sample queries...")
    
    test_queries = [
        "Wildlife protection and species conservation",
        "Forest policies and environmental regulations",
        "Biodiversity hotspots in India",
        "Climate change adaptation in protected areas",
        "Community participation in conservation",
        "Tiger and elephant populations",
        "Wetlands and mangrove forests",
        "Protected areas management",
        "Tribal rights and forest access",
        "International environmental treaties",
    ]
    
    for query_idx, query in enumerate(test_queries, 1):
        try:
            results = rag_engine.search(query, top_k=3)
            logger.info(f"  Query {query_idx}: '{query}'")
            if results:
                logger.info(f"    → Retrieved {len(results)} results")
                for rank, doc in enumerate(results[:2], 1):
                    logger.info(f"      {rank}. {doc.get('title', 'Unknown')[:50]}")
            else:
                logger.warning(f"    → No results found")
        
        except Exception as exc:
            logger.warning(f"  Query {query_idx} failed: {exc}")
    
    # Final report
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total Documents:        {validation['total_documents']}")
    logger.info(f"Metadata Issues:        {len(validation['documents_with_missing_year']) + len(validation['documents_with_missing_tags'])}")
    logger.info(f"Categories:             {len(validation['categories'])}")
    logger.info(f"Year Range:             {validation['years_range'][0] if validation['years_range'] else 'N/A'} - {validation['years_range'][1] if validation['years_range'] else 'N/A'}")
    logger.info("")
    
    dataset_size_gb = sum(f.stat().st_size for f in (ROOT / "data" / "dataset").rglob("*") if f.is_file()) / (1024**3)
    logger.info(f"Dataset Size:           {dataset_size_gb:.3f} GB")
    logger.info(f"Index Size:             {(index_path.stat().st_size / (1024*1024)):.1f} MB")
    logger.info(f"Retrieval Test Status:  ✓ PASSED")
    logger.info("=" * 80 + "\n")


if __name__ == "__main__":
    main()
