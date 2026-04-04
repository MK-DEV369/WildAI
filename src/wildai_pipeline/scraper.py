from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import requests

from .extractors import extract_html_text
from .models import SourceSeed


@dataclass(slots=True)
class FetchedDocument:
    seed: SourceSeed
    url: str
    content_type: str
    raw_text: str | None = None
    raw_bytes: bytes | None = None
    title: str | None = None


class Scraper:
    def __init__(self, timeout_seconds: int = 30, user_agent: str = "WILDAI-Phase1/1.0") -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})

    def fetch_url(self, seed: SourceSeed) -> FetchedDocument:
        response = self.session.get(seed.url, timeout=self.timeout_seconds)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "text/html").lower()
        if "pdf" in content_type or seed.url.lower().endswith(".pdf"):
            return FetchedDocument(seed=seed, url=seed.url, content_type="pdf", raw_bytes=response.content)

        if content_type.startswith("image/"):
            return FetchedDocument(seed=seed, url=seed.url, content_type="image", raw_bytes=response.content)

        text = extract_html_text(response.text)
        return FetchedDocument(seed=seed, url=seed.url, content_type="html", raw_text=text)

    def fetch_many(self, seeds: Iterable[SourceSeed], limit: int | None = None) -> list[FetchedDocument]:
        fetched: list[FetchedDocument] = []
        for seed in seeds:
            if limit is not None and len(fetched) >= limit:
                break
            try:
                fetched.append(self.fetch_url(seed))
            except requests.RequestException:
                continue
        return fetched
