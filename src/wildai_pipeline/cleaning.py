from __future__ import annotations

import re
from collections.abc import Iterable

WORD_RE = re.compile(r"\S+")
MULTISPACE_RE = re.compile(r"\s+")
NON_TEXT_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def normalize_text(text: str) -> str:
    text = NON_TEXT_RE.sub(" ", text)
    text = text.replace("\r", "\n")
    text = MULTISPACE_RE.sub(" ", text)
    return text.strip()


def clean_text(text: str) -> str:
    text = normalize_text(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, target_words: int = 400) -> list[str]:
    words = WORD_RE.findall(clean_text(text))
    if not words:
        return []

    chunks: list[str] = []
    for start in range(0, len(words), target_words):
        end = min(start + target_words, len(words))
        chunks.append(" ".join(words[start:end]))
    return chunks


def adaptive_chunk_text(text: str, max_words: int = 400) -> list[str]:
    """
    Adaptive chunking that respects sentence boundaries for better semantic preservation.
    """
    if not text or len(text) < 100:
        return [text] if text else []

    sentences = re.split(r"(?<=[.!?])\s+", clean_text(text).strip())
    chunks: list[str] = []
    current_chunk = ""
    current_words = 0

    for sentence in sentences:
        sentence_words = len(WORD_RE.findall(sentence))
        if current_words + sentence_words > max_words and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
            current_words = sentence_words
        else:
            current_chunk += (" " if current_chunk else "") + sentence
            current_words += sentence_words

    if current_chunk:
        chunks.append(current_chunk.strip())

    return [c for c in chunks if c and len(c) > 50]


def keyword_tags(text: str, extra_tags: Iterable[str] | None = None) -> list[str]:
    baseline = {
        "wildlife",
        "conservation",
        "forest",
        "habitat",
        "species",
        "law",
        "policy",
        "protected",
        "treaty",
        "biodiversity",
    }
    content = text.lower()
    tags = {tag for tag in baseline if tag in content}
    if extra_tags:
        tags.update(tag.strip().lower() for tag in extra_tags if tag.strip())
    return sorted(tags)
