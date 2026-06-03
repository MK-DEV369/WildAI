#!/usr/bin/env python3
"""Augment seeds CSV from local zoo profile JSONs.

Usage:
  python scripts/augment_seeds_from_local.py --profiles-dir "data/dataset/zoos/india zoo network" --seeds seeds/india_zoos.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path


def load_existing(seeds_path: Path) -> dict:
    if not seeds_path.exists():
        return {}
    out = {}
    with seeds_path.open('r', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            out[row['url']] = row
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--profiles-dir', required=True)
    p.add_argument('--seeds', required=True)
    args = p.parse_args()

    profiles_dir = Path(args.profiles_dir)
    seeds_path = Path(args.seeds)
    seeds_path.parent.mkdir(parents=True, exist_ok=True)

    existing = load_existing(seeds_path)

    added = 0
    for pth in sorted(profiles_dir.glob('*.json')):
        try:
            data = json.loads(pth.read_text(encoding='utf-8'))
        except Exception:
            continue
        url = data.get('url') or data.get('source_url') or data.get('homepage')
        name = data.get('title') or pth.stem
        if not url:
            continue
        if url in existing:
            continue
        existing[url] = {'name': name, 'url': url, 'source': 'local'}
        added += 1

    # write CSV
    with seeds_path.open('w', encoding='utf-8', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['name', 'url', 'source'])
        for row in existing.values():
            writer.writerow([row.get('name', ''), row.get('url', ''), row.get('source', 'mixed')])

    print(f'Wrote {len(existing)} seeds to {seeds_path} (added {added} from local profiles)')


if __name__ == '__main__':
    main()
