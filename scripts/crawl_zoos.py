#!/usr/bin/env python3
"""Crawl a list of zoo seeds, collect profile JSONs and policy PDFs.

Usage:
  python scripts/crawl_zoos.py --seeds seeds/india_zoos.csv --depth 2 --max-links 50 \
    --out-dir data/dataset/zoos/india --policy-out data/dataset/zoos-policy/
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh',
    'Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Delhi','Puducherry'
]

KEYWORDS = ['zoo', 'wildlife', 'park', 'aquarium', 'conservation', 'zoological', 'sanctuary']
POLICY_KEYWORDS = ['policy', 'act', 'rules', 'regulation', '.pdf']


def sanitize_filename(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", '_', s)[:200]


def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, 'lxml')
    for script in soup(['script', 'style']):
        script.decompose()
    return soup.get_text(separator=' ', strip=True)


def extract_metadata(text: str) -> dict:
    meta = {}
    # year
    m = re.search(r"(19|20)\d{2}", text)
    if m:
        meta['founded_year'] = int(m.group(0))
    # state
    lower = text.lower()
    for st in INDIAN_STATES:
        if st.lower() in lower:
            meta['state'] = st
            break
    # simple zoo type guess
    if 'aquarium' in lower:
        meta['zoo_type'] = 'aquarium'
    elif 'safari' in lower:
        meta['zoo_type'] = 'safari'
    elif 'wildlife' in lower or 'wildlife park' in lower:
        meta['zoo_type'] = 'wildlife park'
    else:
        meta['zoo_type'] = 'zoological park'
    return meta


def download_file(url: str, out_path: Path) -> bool:
    try:
        r = requests.get(url, timeout=30, stream=True)
        r.raise_for_status()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, 'wb') as fh:
            for chunk in r.iter_content(8192):
                fh.write(chunk)
        return True
    except Exception:
        return False


def crawl_seed(seed_name: str, seed_url: str, depth: int, max_links: int, out_dir: Path, policy_out: Path):
    visited = set()
    q = deque()
    q.append((seed_url, 0))
    collected = 0
    profiles = []
    policy_count = 0
    seed_policy_links: list[str] = []

    # First, always fetch and save the seed URL as a profile
    try:
        r0 = requests.get(seed_url, timeout=20)
        if r0.ok:
            html0 = r0.text
            text0 = extract_text(html0)
            meta0 = extract_metadata(text0)
            profile0 = {
                'name': seed_name,
                'url': seed_url,
                'source': urlparse(seed_url).netloc,
                'content': text0[:20000],
                'extra': meta0,
                'fetched_at': int(time.time()),
            }
            fname0 = sanitize_filename(seed_name or urlparse(seed_url).netloc)
            out_path0 = out_dir / (fname0 + '.json')
            out_path0.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path0, 'w', encoding='utf-8') as fh:
                json.dump(profile0, fh, ensure_ascii=False, indent=2)
            collected += 1
    except Exception:
        pass

    while q and collected < max_links:
        url, d = q.popleft()
        if url in visited:
            continue
        visited.add(url)
        try:
            r = requests.get(url, timeout=20)
            if r.status_code >= 400:
                continue
            html = r.text
        except Exception:
            continue

        text = extract_text(html)

        # heuristics: if page looks like a profile (contains keywords), save as profile
        if any(k in url.lower() for k in KEYWORDS) or any(k in text.lower() for k in KEYWORDS):
            meta = extract_metadata(text)
            profile = {
                'name': seed_name,
                'url': url,
                'source': urlparse(seed_url).netloc,
                'content': text[:20000],
                'extra': meta,
                'fetched_at': int(time.time()),
            }
            # include any policy links discovered so far
            if seed_policy_links:
                profile['extra']['policy_links'] = seed_policy_links
            fname = sanitize_filename(seed_name or urlparse(url).netloc)
            out_path = out_dir / (fname + '.json')
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, 'w', encoding='utf-8') as fh:
                json.dump(profile, fh, ensure_ascii=False, indent=2)
            profiles.append(out_path)
            collected += 1

        # find policy/pdf links
        soup = BeautifulSoup(html, 'lxml')
        for a in soup.find_all('a', href=True):
            href = str(a['href'])
            full = urljoin(url, href)
            low = full.lower()

            # If this link looks like a policy or PDF, handle it
            if any(p in low for p in POLICY_KEYWORDS):
                parsed = urlparse(full)
                # PDF file
                if parsed.path.lower().endswith('.pdf'):
                    fname = sanitize_filename(parsed.netloc + parsed.path)
                    pdf_path = policy_out / (fname + '.pdf')
                    if download_file(full, pdf_path):
                        meta = {'source_url': full, 'saved_as': str(pdf_path), 'fetched_at': int(time.time())}
                        jpath = policy_out / (fname + '.json')
                        with open(jpath, 'w', encoding='utf-8') as fh:
                            json.dump(meta, fh, ensure_ascii=False, indent=2)
                        policy_count += 1
                        seed_policy_links.append(full)
                else:
                    # policy landing page: fetch and save summary JSON
                    try:
                        r2 = requests.get(full, timeout=20)
                        if r2.ok:
                            text2 = extract_text(r2.text)
                            seed_policy_links.append(full)
                            fname = sanitize_filename(urlparse(full).netloc + urlparse(full).path)
                            jpath = policy_out / (fname + '.json')
                            with open(jpath, 'w', encoding='utf-8') as fh:
                                json.dump({'url': full, 'content': text2[:20000], 'fetched_at': int(time.time())}, fh, ensure_ascii=False, indent=2)
                            policy_count += 1
                    except Exception:
                        # ignore individual link failures
                        pass

            # enqueue deeper links for BFS
            if d + 1 <= depth:
                if full not in visited and len(visited) < max_links:
                    q.append((full, d + 1))

    return len(profiles), policy_count


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--seeds', required=True)
    p.add_argument('--depth', type=int, default=2)
    p.add_argument('--max-links', type=int, default=50)
    p.add_argument('--out-dir', required=True)
    p.add_argument('--policy-out', required=True)
    args = p.parse_args()

    out_dir = Path(args.out_dir)
    policy_out = Path(args.policy_out)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(policy_out, exist_ok=True)

    total_profiles = 0
    total_policies = 0

    with open(args.seeds, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        seeds = [(row.get('name') or row.get('Name') or '', row['url']) for row in reader]

    for name, url in seeds:
        print(f"Crawling seed: {name} -> {url}")
        try:
            pcount, polcount = crawl_seed(name, url, args.depth, args.max_links, out_dir, policy_out)
            total_profiles += pcount
            total_policies += polcount
            print(f"Collected {pcount} profiles, {polcount} policy items from {url}")
        except Exception as e:
            print(f"Error crawling {url}: {e}")

    print(f"Done. Profiles: {total_profiles}, Policy items: {total_policies}")


if __name__ == '__main__':
    main()
