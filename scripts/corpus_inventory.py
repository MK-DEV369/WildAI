#!/usr/bin/env python3
"""Generate a detailed corpus inventory."""
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "dataset"

inventory = defaultdict(list)

for json_file in sorted(DATA_DIR.rglob("*.json")):
    if "failed" in json_file.name or ".model_cache" in str(json_file):
        continue
    
    try:
        with json_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
        
        records = data if isinstance(data, list) else [data]
        for record in records:
            if isinstance(record, dict):
                title = record.get("title", "Unknown")
                year = record.get("year", "N/A")
                category = record.get("category", "unknown")
                source = record.get("source", "unknown")
                
                inventory[f"{category}/{source}"].append({
                    "title": title,
                    "year": year,
                    "file": json_file.name
                })
    except Exception as exc:
        pass

# Print inventory
print("\n" + "=" * 100)
print("WILDAI CORPUS INVENTORY")
print("=" * 100 + "\n")

for key in sorted(inventory.keys()):
    docs = inventory[key]
    print(f"[{key.upper()}] {len(docs)} documents")
    print("-" * 100)
    for doc in sorted(docs, key=lambda d: str(d["year"]), reverse=True):
        year_str = f" ({doc['year']})" if doc['year'] != "N/A" else ""
        print(f"  {doc['title']}{year_str}")
    print()

# Summary
total = sum(len(docs) for docs in inventory.values())
print("=" * 100)
print(f"Total: {total} documents across {len(inventory)} categories")
print("=" * 100 + "\n")
