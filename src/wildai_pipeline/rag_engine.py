from __future__ import annotations

import gc
import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from .cleaning import chunk_text
from .config import PipelineConfig

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ChunkDocument:
    chunk_id: str
    title: str
    year: int | None
    category: str
    source: str
    document_type: str
    url: str
    text: str
    tags: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


class RAGEngine:
    def __init__(self, config: PipelineConfig | None = None) -> None:
        self.config = config or PipelineConfig()
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        self._model = None
        self._encoder_mode = "sentence-transformers"
        self._index = None
        self._documents: list[ChunkDocument] = []
        self._device = "cuda" if self.config.use_gpu else "cpu"

    @property
    def index_path(self) -> Path:
        return self.config.index_path

    @property
    def metadata_path(self) -> Path:
        return self.config.metadata_path

    def _cleanup_gpu_memory(self) -> None:
        """Aggressive GPU memory cleanup."""
        if self.config.aggressive_cleanup:
            gc.collect()
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass

    def _load_model(self):
        if self._model is None and self._encoder_mode == "sentence-transformers":
            try:
                from sentence_transformers import SentenceTransformer

                logger.info(f"Loading embedding model: {self.config.embedding_model_name} on {self._device}")
                self._model = SentenceTransformer(self.config.embedding_model_name, device=self._device)
            except Exception as exc:
                logger.warning(f"Failed to load sentence-transformers model: {exc}, falling back to hashing")
                self._encoder_mode = "hashing"
                self._model = None
        return self._model

    def _encode_batch(self, texts: list[str], batch_size: int | None = None) -> np.ndarray:
        """Encode texts with optional batching for memory efficiency."""
        batch_size = batch_size or self.config.max_batch_size
        model = self._load_model()

        if model is not None:
            all_embeddings: list[np.ndarray] = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                embeddings = model.encode(
                    batch,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                    show_progress_bar=False,
                )
                all_embeddings.append(embeddings.astype("float32"))
                self._cleanup_gpu_memory()

            return np.vstack(all_embeddings)

        from sklearn.feature_extraction.text import HashingVectorizer

        vectorizer = HashingVectorizer(n_features=768, alternate_sign=False, norm="l2")
        matrix = vectorizer.transform(texts)
        return np.asarray(matrix.toarray(), dtype="float32")  # type: ignore[attr-defined]

    def _encode(self, texts: list[str]) -> np.ndarray:
        """Legacy method for backward compatibility."""
        return self._encode_batch(texts)

    def _load_faiss(self):
        if self._index is None:
            import faiss

            if self.index_path.exists():
                self._index = faiss.read_index(str(self.index_path))
        return self._index

    def _is_latest_query(self, query: str) -> bool:
        query_lower = query.lower()
        latest_patterns = [
            r"\blatest\b",
            r"\brecent\b",
            r"\bnewest\b",
            r"\bcurrent\b",
            r"\bup[- ]to[- ]date\b",
            r"\bas of\b",
        ]
        return any(re.search(pattern, query_lower) for pattern in latest_patterns)

    def _is_compare_query(self, query: str) -> bool:
        query_lower = query.lower()
        compare_patterns = [
            r"\bcompare\b",
            r"\bcomparison\b",
            r"\bevolution\b",
            r"\bvs\b",
            r"\bversus\b",
            r"\bchanged\b",
            r"\bbetween\b",
            r"\bhistorical\b",
            r"\bprevious\b",
        ]
        return any(re.search(pattern, query_lower) for pattern in compare_patterns)

    def _year_bounds(self) -> tuple[int, int]:
        years = [doc.year for doc in self._documents if isinstance(doc.year, int)]
        if not years:
            return (2000, 2026)
        return (min(years), max(years))

    def _query_terms(self, query: str) -> set[str]:
        stopwords = {
            "the",
            "and",
            "for",
            "with",
            "from",
            "that",
            "this",
            "what",
            "when",
            "where",
            "which",
            "are",
            "was",
            "were",
            "latest",
            "recent",
            "newest",
            "current",
            "about",
            "into",
            "between",
            "information",
        }
        tokens = re.findall(r"[a-z0-9]+", query.lower())
        return {token for token in tokens if len(token) > 2 and token not in stopwords}

    def _fallback_rank_documents(
        self,
        query: str,
        query_terms: set[str],
        latest_query: bool,
        compare_query: bool,
        policy_intent: bool,
        tiger_intent: bool,
        top_k: int,
        category: str | None,
        source: str | None,
        year: int | None,
    ) -> list[dict[str, Any]]:
        min_year, max_year = self._year_bounds()
        recent_cutoff = max_year - 4
        ranked: list[dict[str, Any]] = []

        for document in self._documents:
            if category and document.category != category:
                continue
            if source and document.source != source:
                continue
            if year and document.year != year:
                continue

            searchable_text = " ".join(
                [
                    document.title,
                    " ".join(document.tags),
                    document.category,
                    document.source,
                    document.text[:1200],
                ]
            ).lower()

            if tiger_intent and "tiger" not in searchable_text:
                continue
            if policy_intent and (
                document.category == "zoos"
                or document.document_type == "profile"
                or document.source == "India Zoo Network"
            ):
                continue

            matched_terms = sum(1 for term in query_terms if term in searchable_text)
            lexical_overlap = matched_terms / max(1, len(query_terms))
            if lexical_overlap == 0 and not compare_query:
                continue

            doc_year = document.year if isinstance(document.year, int) else None
            adjusted_score = lexical_overlap

            if doc_year is not None and max_year > min_year:
                normalized_year = (doc_year - min_year) / (max_year - min_year)
                adjusted_score += 0.15 * normalized_year
                if latest_query:
                    adjusted_score += 0.20 * normalized_year
                    if doc_year >= recent_cutoff:
                        adjusted_score += 0.12
                if compare_query and doc_year < max_year:
                    adjusted_score += 0.05

            if policy_intent and document.document_type in {
                "policy",
                "act",
                "regulation",
                "strategy",
                "framework",
                "plan",
                "guidelines",
                "directive",
                "notification",
                "legislative",
                "convention",
                "protocol",
            }:
                adjusted_score += 0.20

            ranked.append(
                {
                    "score": adjusted_score,
                    "semantic_score": adjusted_score,
                    "lexical_overlap": lexical_overlap,
                    "recency_year": doc_year,
                    **asdict(document),
                }
            )

        ranked.sort(key=lambda item: (item.get("year") or 0, item["score"]), reverse=True)
        return ranked[:top_k]

    def _dedupe_hits(self, hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        seen: set[tuple[Any, ...]] = set()
        for hit in hits:
            key = (
                hit.get("title"),
                hit.get("year"),
                hit.get("source"),
                hit.get("category"),
                hit.get("document_type"),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(hit)
        return deduped

    def _unique_year_hits(self, hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
        unique_hits: list[dict[str, Any]] = []
        seen_years: set[int] = set()
        for hit in hits:
            year_value = hit.get("year")
            if not isinstance(year_value, int):
                unique_hits.append(hit)
                continue
            if year_value in seen_years:
                continue
            seen_years.add(year_value)
            unique_hits.append(hit)
        return unique_hits

    def load_documents(self) -> list[ChunkDocument]:
        documents: list[ChunkDocument] = []
        dataset_root = self.config.data_dir
        if not dataset_root.exists():
            self._documents = []
            return []

        for json_path in sorted(dataset_root.rglob("*.json")):
            with json_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)

            records = payload if isinstance(payload, list) else [payload]
            for record_index, record in enumerate(records):
                if not isinstance(record, dict):
                    continue

                content = record.get("cleaned_content") or record.get("content") or ""
                chunks = record.get("chunks") or chunk_text(content, self.config.chunk_target_words)
                if not chunks and content:
                    chunks = [content]

                for chunk_index, chunk in enumerate(chunks):
                    documents.append(
                        ChunkDocument(
                            chunk_id=f"{json_path.stem}-{record_index}-{chunk_index}",
                            title=record.get("title", json_path.stem),
                            year=record.get("year"),
                            category=record.get("category", "unknown"),
                            source=record.get("source", "unknown"),
                            document_type=record.get("type", "text"),
                            url=record.get("url", ""),
                            text=chunk,
                            tags=list(record.get("tags", [])),
                            extra={
                                "source_path": str(json_path),
                                "record_index": record_index,
                                "chunks_in_source": len(chunks),
                                "raw_title": record.get("title"),
                            },
                        )
                    )

        self._documents = documents
        return documents

    def build_index(self) -> dict[str, int | str]:
        documents = self.load_documents()
        if not documents:
            self._write_metadata([])
            self._index = None
            return {"total_documents": 0, "total_chunks": 0, "index_path": str(self.index_path)}

        logger.info(f"Encoding {len(documents)} chunks...")
        embeddings = self._encode_batch([document.text for document in documents], batch_size=self.config.max_batch_size)

        import faiss

        logger.info(f"Building FAISS index with embedding dimension {embeddings.shape[1]}...")
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)  # type: ignore[arg-type]
        faiss.write_index(index, str(self.index_path))

        self._index = index
        self._write_metadata(documents)
        self._cleanup_gpu_memory()

        result = {
            "total_documents": len({document.extra["source_path"] for document in documents}),
            "total_chunks": len(documents),
            "index_path": str(self.index_path),
            "embedding_model": self.config.embedding_model_name,
        }
        logger.info(f"Index built: {result}")
        return result

    def _write_metadata(self, documents: list[ChunkDocument]) -> None:
        payload = [asdict(document) for document in documents]
        with self.metadata_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=True)

    def ensure_index(self) -> None:
        if self._index is not None and self._documents:
            return

        if self.index_path.exists() and self.metadata_path.exists():
            self._load_faiss()
            with self.metadata_path.open("r", encoding="utf-8") as handle:
                raw_documents = json.load(handle)
            self._documents = [ChunkDocument(**document) for document in raw_documents]
            return

        self.build_index()

    def search(
        self,
        query: str,
        top_k: int = 5,
        category: str | None = None,
        source: str | None = None,
        year: int | None = None,
    ) -> list[dict[str, Any]]:
        self.ensure_index()
        if self._index is None or not self._documents:
            return []

        query_embedding = self._encode([query])
        latest_query = self._is_latest_query(query)
        compare_query = self._is_compare_query(query)
        query_terms = self._query_terms(query)
        policy_intent_terms = {"policy", "policies", "strategy", "strategies", "plan", "plans", "act", "regulation", "framework"}
        policy_intent = bool(query_terms.intersection(policy_intent_terms))
        tiger_intent = "tiger" in query_terms
        generic_terms = {
            "conservation",
            "strategy",
            "strategies",
            "policy",
            "policies",
            "india",
            "indian",
            "wildlife",
            "management",
        }
        anchor_terms = {term for term in query_terms if term not in generic_terms}
        min_year, max_year = self._year_bounds()
        recent_cutoff = max_year - 4

        if latest_query and year is None:
            search_top_k = min(max(top_k * 500, 4000), len(self._documents))
        elif compare_query and year is None:
            search_top_k = min(max(top_k * 200, 2000), len(self._documents))
        else:
            search_top_k = min(max(top_k * 4, top_k), len(self._documents))
        distances, indices = self._index.search(query_embedding, search_top_k)  # type: ignore[call-arg]

        ranked_results: list[dict[str, Any]] = []
        for score, index in zip(distances[0], indices[0], strict=False):
            if index < 0:
                continue

            document = self._documents[index]
            if category and document.category != category:
                continue
            if source and document.source != source:
                continue
            if year and document.year != year:
                continue

            searchable_text = " ".join(
                [
                    document.title,
                    " ".join(document.tags),
                    document.category,
                    document.source,
                    document.text[:1200],
                ]
            ).lower()

            if tiger_intent and "tiger" not in searchable_text:
                continue

            if policy_intent and (
                document.category == "zoos"
                or document.document_type == "profile"
                or document.source == "India Zoo Network"
            ):
                continue

            semantic_score = float(score)
            adjusted_score = semantic_score
            doc_year = document.year if isinstance(document.year, int) else None

            lexical_overlap = 0.0
            if query_terms:
                matched_terms = sum(1 for term in query_terms if term in searchable_text)
                lexical_overlap = matched_terms / len(query_terms)

                adjusted_score += 0.25 * lexical_overlap
                if latest_query:
                    adjusted_score += 0.20 * lexical_overlap
                    if lexical_overlap == 0:
                        adjusted_score -= 0.35

                if latest_query and anchor_terms:
                    anchor_matches = sum(1 for term in anchor_terms if term in searchable_text)
                    if anchor_matches == 0:
                        adjusted_score -= 0.30
                    else:
                        adjusted_score += 0.12 * (anchor_matches / len(anchor_terms))

                if tiger_intent:
                    if "tiger" in searchable_text:
                        adjusted_score += 0.28
                        if "tiger" in document.title.lower():
                            adjusted_score += 0.12
                    else:
                        adjusted_score -= 0.35

            if doc_year is not None and max_year > min_year:
                normalized_year = (doc_year - min_year) / (max_year - min_year)
                adjusted_score += 0.03 * normalized_year

                if latest_query and year is None:
                    adjusted_score += 0.10 * normalized_year
                    if doc_year >= recent_cutoff:
                        adjusted_score += 0.15
                    elif doc_year < max_year - 10:
                        adjusted_score -= 0.10

            if query_terms.intersection({"policy", "policies", "strategy", "strategies", "plan", "conservation"}):
                if document.category in {"policy", "policies", "legal", "species-plan", "national-policy"}:
                    adjusted_score += 0.08

            if policy_intent:
                if document.document_type in {
                    "policy",
                    "act",
                    "regulation",
                    "strategy",
                    "framework",
                    "plan",
                    "guidelines",
                    "directive",
                    "notification",
                    "legislative",
                    "convention",
                    "protocol",
                }:
                    adjusted_score += 0.25

                if document.category in {"policies", "policy", "legal", "legislative", "national-policy", "state-policy", "species-plan"}:
                    adjusted_score += 0.18

                if document.category == "zoos" or document.document_type == "profile" or document.source == "India Zoo Network":
                    adjusted_score -= 1.20

            ranked_results.append(
                {
                    "score": adjusted_score,
                    "semantic_score": semantic_score,
                    "lexical_overlap": lexical_overlap,
                    "recency_year": doc_year,
                    **asdict(document),
                }
            )

        if latest_query and year is None:
            ranked_results.sort(
                key=lambda item: (
                    (item.get("year") or 0) >= recent_cutoff,
                    item.get("year") or 0,
                    item["score"],
                ),
                reverse=True,
            )
        else:
            ranked_results.sort(key=lambda item: item["score"], reverse=True)

        if not ranked_results and (latest_query or compare_query or policy_intent):
            ranked_results = self._fallback_rank_documents(
                query=query,
                query_terms=query_terms,
                latest_query=latest_query,
                compare_query=compare_query,
                policy_intent=policy_intent,
                tiger_intent=tiger_intent,
                top_k=top_k,
                category=category,
                source=source,
                year=year,
            )

        results = self._dedupe_hits(ranked_results)[:top_k]

        return results

    def answer(self, query: str, hits: list[dict[str, Any]]) -> str:
        if not hits:
            return "No relevant documents were found for this query. Try a different category, year, or source."

        latest_query = self._is_latest_query(query)
        compare_query = self._is_compare_query(query)
        sorted_hits = self._unique_year_hits(
            self._dedupe_hits(
                sorted(
                    hits,
                    key=lambda hit: (
                        hit.get("year") or 0,
                        hit.get("score", 0.0),
                    ),
                    reverse=True,
                )
            )
        )
        policy_like_types = {
            "policy",
            "act",
            "regulation",
            "strategy",
            "framework",
            "plan",
            "guidelines",
            "directive",
            "notification",
            "legislative",
            "convention",
            "protocol",
        }
        policy_like_categories = {"policy", "policies", "legal", "legislative", "national-policy", "state-policy", "species-plan"}
        top = next(
            (
                hit
                for hit in sorted_hits
                if hit.get("document_type") in policy_like_types or hit.get("category") in policy_like_categories
            ),
            sorted_hits[0],
        )
        years = [hit["year"] for hit in sorted_hits if isinstance(hit.get("year"), int)]
        sources = sorted({hit["source"] for hit in sorted_hits[:6]})

        top_year = top.get("year") or "year not specified"
        same_topic_hits = [hit for hit in sorted_hits if any(term in f"{hit['title']} {hit['text']} {hit['category']}".lower() for term in ("tiger", "policy", "strategy", "conservation"))]
        comparison_hits = same_topic_hits if same_topic_hits else sorted_hits
        comparison_hits = sorted(comparison_hits, key=lambda hit: hit.get("year") or 0, reverse=True)

        summary_lines = [
            f"Summary for: {query}",
            "",
            f"Top match: {top['title']} ({top_year})",
            f"Category: {top['category']} | Source: {top['source']}",
        ]

        if years:
            summary_lines.append(f"Year coverage in retrieved evidence: {max(years)} down to {min(years)}")
            if latest_query:
                summary_lines.append(f"Latest-focus query detected; prioritized recent documents from {max(years) - 4} onward when relevant.")

        summary_lines.extend(["", "Key Insights:"])

        for idx, hit in enumerate(sorted_hits[:4], start=1):
            snippet = " ".join(hit["text"].split())[:180].strip()
            summary_lines.append(
                f"- {idx}. {hit['title']} ({hit['year'] or 'year not specified'}) | {hit['source']} | score={hit['score']:.3f}"
            )
            summary_lines.append(f"  {snippet}")

        summary_lines.extend(["", "Policy Evolution:"])

        if compare_query or latest_query:
            comparison_years = []
            for hit in comparison_hits[:5]:
                year_value = hit.get("year") or "year not specified"
                comparison_years.append(str(year_value))
                summary_lines.append(
                    f"- {year_value}: {hit['title']} | {hit['category']} | {hit['source']}"
                )
            if len(comparison_years) > 1:
                summary_lines.append(
                    f"- Evolution trend: the retrieved evidence moves from older baseline documents toward newer {max(years) if years else 'recent'} policy and status material."
                )
        else:
            for hit in comparison_hits[:3]:
                summary_lines.append(
                    f"- {hit['year'] or 'year not specified'}: {hit['title']} | {hit['category']} | {hit['source']}"
                )

        summary_lines.extend(["", "Conclusion:"])
        if compare_query:
            summary_lines.append(
                f"- The newest available documents provide the current baseline, while earlier iterations show how the policy has evolved over time."
            )
        elif latest_query:
            summary_lines.append(
                f"- The strongest recent evidence is anchored in {top_year} documents, with {top['source']} providing the freshest usable context."
            )
        else:
            summary_lines.append(
                f"- The answer is grounded in the most relevant retrieved documents, led by {top['title']} from {top_year}."
            )

        summary_lines.extend(["", "Sources used:"])
        for source_name in sources:
            summary_lines.append(f"- {source_name}")

        return "\n".join(summary_lines)
