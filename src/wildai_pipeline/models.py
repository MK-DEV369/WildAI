from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class SourceSeed:
    title: str
    url: str
    category: str
    source: str
    content_type: str = "html"
    tags: list[str] = field(default_factory=list)
    year: int | None = None
    notes: str | None = None


@dataclass(slots=True)
class DocumentRecord:
    title: str
    year: int | None
    category: str
    source: str
    type: str
    content: str
    tags: list[str]
    url: str
    cleaned_content: str | None = None
    chunks: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)
