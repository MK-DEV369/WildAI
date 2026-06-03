"""
Simple scraper to fetch zoo policy pages and save them as JSON records under data/dataset/zoos-policy/
Usage:
    python scripts/scrape_zoo_policies.py

This script uses requests + BeautifulSoup and heuristics to extract main article text.
"""
from __future__ import annotations

import os
import json
import re
import time
from urllib.parse import urljoin, urlparse
from pathlib import Path
from typing import List

import requests
from bs4 import BeautifulSoup

OUT_DIR = Path("data/dataset/zoos-policy")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Seed URLs to scrape. Add more as needed. These are examples and may need updating.
SEEDS: List[dict] = [
    {
        "url": "https://cza.nic.in/",  # Central Zoo Authority (India) - landing page; may need deeper links
        "source": "Central Zoo Authority (India)",
    },
    # Global / regional zoo associations and policy resources
    {"url": "https://www.aza.org/", "source": "Association of Zoos and Aquariums (AZA)"},
    {"url": "https://www.waza.org/", "source": "World Association of Zoos and Aquariums (WAZA)"},
    {"url": "https://www.eaza.net/", "source": "European Association of Zoos and Aquaria (EAZA)"},
]

USER_AGENT = "WILDAI-Scraper/1.0 (+https://example.org)"
KEYWORDS = [
    'policy', 'policies', 'standards', 'guidelines', 'publication', 'publications', 'report', 'reports', 'pdf', 'notification', 'act', 'rules', 'council'
]


def extract_main_text(soup: BeautifulSoup) -> str:
    # Heuristic: prefer <article>, then <main>, otherwise collect largest block of <p>
    article = soup.find("article")
    if article:
        return "\n\n".join(p.get_text(separator=" ").strip() for p in article.find_all("p"))
    main = soup.find("main")
    if main:
        return "\n\n".join(p.get_text(separator=" ").strip() for p in main.find_all("p"))

    # Fallback: collect longest div/p sequence
    paragraphs = [p.get_text(separator=" ").strip() for p in soup.find_all("p")]
    if not paragraphs:
        # as last resort, take visible text from body
        body = soup.body
        if body:
            return body.get_text(separator=" ")
        return ""

    # Return concatenated paragraphs
    return "\n\n".join(paragraphs)


def fetch_and_save(url: str, source: str | None = None):
    headers = {"User-Agent": USER_AGENT}
    try:
        res = requests.get(url, headers=headers, timeout=20)
        res.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return

    soup = BeautifulSoup(res.text, "lxml")
    title = soup.title.string.strip() if soup.title and soup.title.string else url
    content = extract_main_text(soup)

    # Try to find a year in content
    year_match = re.search(r"(19|20)\d{2}", content)
    year = int(year_match.group(0)) if year_match else None

    record = {
        "title": title,
        "url": url,
        "source": source or url,
        "category": "zoos",
        "type": "policy",
        "year": year,
        "content": content,
    }

    safe_name = re.sub(r"[^0-9a-zA-Z_-]", "_", title)[:120]
    out_file = OUT_DIR / f"{safe_name}.json"
    with open(out_file, "w", encoding="utf-8") as fh:
        json.dump(record, fh, ensure_ascii=False, indent=2)
    print(f"Saved {out_file}")


def download_file(url: str, dest: Path):
    headers = {"User-Agent": USER_AGENT}
    try:
        r = requests.get(url, headers=headers, stream=True, timeout=30)
        r.raise_for_status()
        with open(dest, 'wb') as fh:
            for chunk in r.iter_content(1024 * 8):
                fh.write(chunk)
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False


def crawl_and_collect(seed_url: str, source: str | None = None, max_links: int = 30):
    """Crawl a seed page (depth 1) and collect links/pages that match KEYWORDS; download PDFs."""
    headers = {"User-Agent": USER_AGENT}
    try:
        res = requests.get(seed_url, headers=headers, timeout=20)
        res.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch seed {seed_url}: {e}")
        return

    base = urlparse(seed_url)
    domain = base.netloc
    soup = BeautifulSoup(res.text, 'lxml')

    # collect candidate links
    links = set()
    for a in soup.find_all('a', href=True):
        href = str(a['href'])
        # normalize
        full = urljoin(seed_url, href)
        parsed = urlparse(full)
        if parsed.netloc != domain:
            continue
        links.add(full)

    # include the seed page itself first
    candidates = [seed_url] + list(links)[:max_links]

    for link in candidates:
        try:
            time.sleep(1)
            r = requests.get(link, headers=headers, timeout=20)
            r.raise_for_status()
        except Exception as e:
            print(f"Failed to fetch {link}: {e}")
            continue

        # If link is a PDF
        if link.lower().endswith('.pdf') or 'application/pdf' in r.headers.get('Content-Type', ''):
            fname = re.sub(r"[^0-9a-zA-Z_-]", "_", link.split('/')[-1])
            dest = OUT_DIR / fname
            if download_file(link, dest):
                # save metadata
                record = {
                    'title': fname,
                    'url': link,
                    'source': source or seed_url,
                    'category': 'zoos',
                    'type': 'policy',
                    'year': None,
                    'content': '',
                }
                meta_file = dest.with_suffix('.json')
                with open(meta_file, 'w', encoding='utf-8') as fh:
                    json.dump(record, fh, ensure_ascii=False, indent=2)
                print(f"Downloaded PDF and saved metadata {meta_file}")
            continue

        page_soup = BeautifulSoup(r.text, 'lxml')
        text = extract_main_text(page_soup)
        lower = (page_soup.get_text() or '').lower()
        # filter by keywords
        if any(k in link.lower() for k in KEYWORDS) or any(k in lower for k in KEYWORDS):
            title = page_soup.title.string.strip() if page_soup.title and page_soup.title.string else link
            year_match = re.search(r"(19|20)\d{2}", text)
            year = int(year_match.group(0)) if year_match else None
            record = {
                'title': title,
                'url': link,
                'source': source or seed_url,
                'category': 'zoos',
                'type': 'policy',
                'year': year,
                'content': text,
            }
            safe_name = re.sub(r"[^0-9a-zA-Z_-]", "_", title)[:120]
            out_file = OUT_DIR / f"{safe_name}.json"
            with open(out_file, 'w', encoding='utf-8') as fh:
                json.dump(record, fh, ensure_ascii=False, indent=2)
            print(f"Saved policy page {out_file}")


def main():
    for seed in SEEDS:
        fetch_and_save(seed["url"], seed.get("source"))
        # be polite
        time.sleep(2)


if __name__ == "__main__":
    main()
