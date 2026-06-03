#!/usr/bin/env python3
"""Generate a CSV of zoo seeds for a country (India) by scraping Wikipedia and CZA.

Usage:
  python scripts/generate_zoo_seeds.py --country India --out seeds/india_zoos.csv
"""
from __future__ import annotations

import argparse
import csv
import os
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


WIKIPEDIA_PAGE = "List_of_zoos_in_India"
DEFAULT_SEEDS = [
    ("CZA", "https://cza.nic.in/"),
    ("Wikipedia:List of zoos in India", f"https://en.wikipedia.org/wiki/{WIKIPEDIA_PAGE}"),
]


def fetch_wikipedia_zoo_links() -> list[tuple[str, str]]:
    """Return (name, url) tuples extracted from the Wikipedia page by parsing HTML."""
    url = f"https://en.wikipedia.org/wiki/{WIKIPEDIA_PAGE}"
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        content = soup.select_one('#mw-content-text') or soup
        links = []
        # look for list items or paragraphs containing links
        # First scan anchor titles
        for a in content.select('a'):
            href = a.get('href')
            text = a.get_text(strip=True)
            if not href or href.startswith('#'):
                continue
            if href.startswith('/wiki/'):
                title = href.split('/wiki/', 1)[1]
                if re.search(r'zoo|park|aquarium|wildlife', title, re.I) or re.search(r'zoo|park|aquarium|wildlife', text, re.I):
                    full = urljoin('https://en.wikipedia.org/', href)
                    links.append((text or title.replace('_', ' '), full))
        # Also inspect list items and table rows for zoo-related text
        for li in content.select('li'):
            txt = li.get_text(' ', strip=True)
            if re.search(r'zoo|park|aquarium|wildlife', txt, re.I):
                a = li.find('a', href=True)
                if a:
                    href = a['href']
                    if href.startswith('/wiki/'):
                        full = urljoin('https://en.wikipedia.org/', href)
                        links.append((a.get_text(strip=True) or txt.split(' - ')[0], full))
        for td in content.select('td'):
            txt = td.get_text(' ', strip=True)
            if re.search(r'zoo|park|aquarium|wildlife', txt, re.I):
                a = td.find('a', href=True)
                if a and a.get('href', '').startswith('/wiki/'):
                    full = urljoin('https://en.wikipedia.org/', a['href'])
                    links.append((a.get_text(strip=True) or txt, full))
        # dedupe preserving order
        seen = set()
        out = []
        for name, u in links:
            if u in seen:
                continue
            seen.add(u)
            out.append((name, u))
        # if the HTML parsing produced very few links, try the API as a fallback
        if len(out) < 5:
            api_links = fetch_wikipedia_zoo_links_api()
            if api_links:
                return api_links
        return out
    except Exception:
        return []


def fetch_wikipedia_zoo_links_api() -> list[tuple[str, str]]:
    """Fallback: use Wikipedia's API to list links on the page and filter for zoo-like titles."""
    api_url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "parse",
        "page": WIKIPEDIA_PAGE,
        "prop": "links",
        "format": "json",
        "redirects": 1,
    }
    try:
        r = requests.get(api_url, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        links = data.get("parse", {}).get("links", [])
        out = []
        for item in links:
            title = item.get("*", "")
            if re.search(r'zoo|park|aquarium|wildlife', title, re.I):
                # Wikipedia titles map to /wiki/Title
                full = urljoin('https://en.wikipedia.org/', '/wiki/' + title.replace(' ', '_'))
                out.append((title, full))
        # dedupe
        seen = set()
        dedup = []
        for name, u in out:
            if u in seen:
                continue
            seen.add(u)
            dedup.append((name, u))
        return dedup
    except Exception:
        return []


def write_csv(rows: list[tuple[str, str, str]], out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline='', encoding='utf-8') as fh:
        writer = csv.writer(fh)
        writer.writerow(["name", "url", "source"])
        for name, url, source in rows:
            writer.writerow([name, url, source])


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--country", default="India")
    p.add_argument("--out", required=True)
    args = p.parse_args()

    rows: list[tuple[str, str, str]] = []
    # add default seeds
    for name, url in DEFAULT_SEEDS:
        rows.append((name, url, "seed"))

    if args.country.lower() == "india":
        wiki_links = fetch_wikipedia_zoo_links()
        for name, url in wiki_links:
            rows.append((name, url, "wikipedia"))

    # dedupe by url
    seen = set()
    deduped = []
    for name, url, source in rows:
        if url in seen:
            continue
        seen.add(url)
        deduped.append((name, url, source))

    write_csv(deduped, args.out)
    print(f"Wrote {len(deduped)} seeds to {args.out}")


if __name__ == "__main__":
    main()
