from __future__ import annotations

import gc
import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, cast, Generator
import os
import numpy as np

from .cleaning import chunk_text
from .config import PipelineConfig

logger = logging.getLogger(__name__)

try:
    import orjson
except Exception:
    orjson = None


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
    searchable_text: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.searchable_text = " ".join(
            [
                self.title,
                " ".join(self.tags),
                self.category,
                self.source,
                self.text[:1200],
            ]
        ).lower()


class RAGEngine:
    def __init__(self, config: PipelineConfig | None = None) -> None:
        self.config = config or PipelineConfig()
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        self._model = None
        self._encoder_mode = "sentence-transformers"
        self._index = None
        self._documents: list[ChunkDocument] = []
        self._device = "cuda" if self.config.use_gpu else "cpu"

    def _emit_progress(
        self,
        message: str,
        progress_callback: Callable[[str], None] | None = None,
    ) -> None:
        logger.info(message)
        if progress_callback is not None:
            progress_callback(message)

    @staticmethod
    def _ollama_model_base_name(model_name: str) -> str:
        return model_name.removeprefix("ollama:").split(":", 1)[0].strip().lower()

    def _is_ollama_embedding_model(self) -> bool:
        raw_model_name = self.config.embedding_model_name.strip().lower()
        if not raw_model_name.startswith("ollama:"):
            return False

        model_name = self._ollama_model_base_name(raw_model_name)
        if model_name not in {"nomic-embed-text", "mxbai-embed-large", "bge-m3"}:
            return False
        return self._ollama_embedding_model_available(model_name)

    def _ollama_embedding_model_available(self, model_name: str) -> bool:
        import requests

        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=5)
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", []) if isinstance(payload, dict) else []
            available_names = {
                self._ollama_model_base_name(str(item.get("name", "")))
                for item in models
                if isinstance(item, dict)
            }
            return self._ollama_model_base_name(model_name) in available_names
        except Exception:
            return False

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
            if self._is_ollama_embedding_model():
                self._encoder_mode = "ollama"
                return None

            try:
                from sentence_transformers import SentenceTransformer
            except Exception as import_exc:
                logger.warning(f"Failed to import sentence-transformers: {import_exc}, falling back to hashing")
                self._encoder_mode = "hashing"
                self._model = None
                return None

            try:
                logger.info(f"Loading embedding model: {self.config.embedding_model_name} on {self._device}")
                self._model = SentenceTransformer(self.config.embedding_model_name, device=self._device)
            except Exception as exc:
                logger.warning(f"Failed to load sentence-transformers model on {self._device}: {exc}")
                if self._device != "cpu":
                    try:
                        logger.info(f"Retrying embedding model on cpu: {self.config.embedding_model_name}")
                        self._model = SentenceTransformer(self.config.embedding_model_name, device="cpu")
                        self._device = "cpu"
                    except Exception as cpu_exc:
                        logger.warning(f"Failed to load sentence-transformers model on cpu: {cpu_exc}, falling back to hashing")
                        self._encoder_mode = "hashing"
                        self._model = None
                else:
                    logger.warning("Falling back to hashing")
                    self._encoder_mode = "hashing"
                    self._model = None

        return self._model

    def _extract_ollama_embeddings(self, payload: Any) -> list[list[float]] | None:
        if not isinstance(payload, dict):
            return None

        for key in ("embeddings", "vectors"):
            value = payload.get(key)
            if isinstance(value, list) and value:
                first_item = value[0]
                if isinstance(first_item, list) and first_item and isinstance(first_item[0], (int, float)):
                    return [[float(item) for item in vector] for vector in value if isinstance(vector, list)]

        single_vector = payload.get("embedding")
        if isinstance(single_vector, list) and single_vector and isinstance(single_vector[0], (int, float)):
            return [[float(item) for item in single_vector]]

        data = payload.get("data")
        if isinstance(data, list) and data:
            extracted: list[list[float]] = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                vector = item.get("embedding") or item.get("vector")
                if isinstance(vector, list) and vector and isinstance(vector[0], (int, float)):
                    extracted.append([float(item) for item in vector])
            if extracted:
                return extracted

        return None

    def _encode_with_ollama(
        self,
        texts: list[str],
        progress_callback: Callable[[str], None] | None = None,
    ) -> np.ndarray:
        import requests
        last_error: Exception | None = None
        model_name = self.config.embedding_model_name.removeprefix("ollama:")
        batch_size = max(1, self.config.embedding_batch_size)
        total_batches = max(1, (len(texts) + batch_size - 1) // batch_size)
        embeddings: list[list[float]] = []

        for batch_number, start in enumerate(range(0, len(texts), batch_size), start=1):
            batch = texts[start : start + batch_size]
            self._emit_progress(
                f"Encoding Ollama batch {batch_number}/{total_batches} ({len(batch)} chunks)...",
                progress_callback,
            )
            try:
                response = requests.post(
                    "http://localhost:11434/api/embed",
                    json={"model": model_name, "input": batch if len(batch) > 1 else batch[0], "truncate": True},
                    timeout=self.config.request_timeout_seconds,
                )
                if response.ok:
                    extracted = self._extract_ollama_embeddings(response.json())
                    if extracted is not None:
                        embeddings.extend(extracted)
                        continue

                raise RuntimeError(f"Ollama embedding endpoint returned {response.status_code}")
            except Exception as exc:
                last_error = exc
                logger.warning("Ollama embedding failed for one batch: %s", exc)
                break

        if len(embeddings) != len(texts):
            if last_error is not None:
                logger.warning("Falling back to hashing embeddings after Ollama error: %s", last_error)
            from sklearn.feature_extraction.text import HashingVectorizer

            vectorizer = HashingVectorizer(n_features=768, alternate_sign=False, norm="l2")
            matrix = vectorizer.transform(texts)
            dense_matrix = cast(Any, matrix).toarray()
            return np.asarray(dense_matrix, dtype="float32")

        return np.asarray(embeddings, dtype="float32")

    def _encode_batch(
        self,
        texts: list[str],
        batch_size: int | None = None,
        progress_callback: Callable[[str], None] | None = None,
    ) -> np.ndarray:
        """Encode texts with optional batching for memory efficiency."""
        batch_size = batch_size or self.config.max_batch_size
        model = self._load_model()

        if self._encoder_mode == "ollama":
            return self._encode_with_ollama(texts, progress_callback=progress_callback)

        if model is not None:
            import torch
            import contextlib
            
            # Use fp16 mixed-precision autocast for CUDA encoding
            ctx = torch.amp.autocast("cuda") if self._device == "cuda" else contextlib.nullcontext()
            
            num_texts = len(texts)
            # Pre-allocate array to avoid intermediate memory copies (np.vstack)
            embeddings_array = np.zeros((num_texts, 768), dtype=np.float32)
            total_batches = max(1, (num_texts + batch_size - 1) // batch_size)
            
            for i in range(0, num_texts, batch_size):
                batch = texts[i : i + batch_size]
                batch_number = (i // batch_size) + 1
                self._emit_progress(
                    f"Encoding batch {batch_number}/{total_batches} ({len(batch)} chunks)...",
                    progress_callback,
                )
                with ctx:
                    batch_emb = model.encode(
                        batch,
                        convert_to_numpy=True,
                        normalize_embeddings=True,
                        show_progress_bar=False,
                    )
                embeddings_array[i : i + len(batch)] = batch_emb.astype("float32")
                self._cleanup_gpu_memory()

            return embeddings_array

        from sklearn.feature_extraction.text import HashingVectorizer

        vectorizer = HashingVectorizer(n_features=768, alternate_sign=False, norm="l2")
        matrix = vectorizer.transform(texts)
        self._emit_progress(f"Encoding {len(texts)} chunks with hashing fallback...", progress_callback)
        dense_matrix = cast(Any, matrix).toarray()
        return np.asarray(dense_matrix, dtype="float32")

    def _json_loads(self, raw_bytes: bytes) -> Any:
        if orjson is not None:
            return orjson.loads(raw_bytes)
        return json.loads(raw_bytes.decode("utf-8"))

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

            searchable_text = document.searchable_text

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

    def load_documents(
        self,
        progress_callback: Callable[[str], None] | None = None,
    ) -> list[ChunkDocument]:
        documents: list[ChunkDocument] = []
        dataset_root = self.config.data_dir
        if not dataset_root.exists():
            self._documents = []
            self._emit_progress(f"Dataset directory not found at {dataset_root}", progress_callback)
            return []

        json_paths = sorted(dataset_root.rglob("*.json"))
        if not json_paths:
            self._emit_progress(f"No source documents found under {dataset_root}", progress_callback)
            self._documents = []
            return []

        total_files = len(json_paths)
        self._emit_progress(f"Loading {total_files} source files...", progress_callback)

        for file_index, json_path in enumerate(json_paths, start=1):
            if file_index == 1 or file_index == total_files or file_index % 10 == 0:
                self._emit_progress(
                    f"Reading source file {file_index}/{total_files}: {json_path.name}",
                    progress_callback,
                )
            payload = self._json_loads(json_path.read_bytes())

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

    def _yield_document_chunks(self) -> Generator[ChunkDocument, None, None]:
        dataset_root = self.config.data_dir
        if not dataset_root.exists():
            return

        json_paths = sorted(dataset_root.rglob("*.json"))
        for json_path in json_paths:
            if "failed" in json_path.name or ".model_cache" in str(json_path):
                continue
            try:
                payload = self._json_loads(json_path.read_bytes())
                records = payload if isinstance(payload, list) else [payload]
                for record_index, record in enumerate(records):
                    if not isinstance(record, dict):
                        continue
                    content = record.get("cleaned_content") or record.get("content") or ""
                    chunks = record.get("chunks") or chunk_text(content, self.config.chunk_target_words)
                    if not chunks and content:
                        chunks = [content]
                    for chunk_index, chunk in enumerate(chunks):
                        yield ChunkDocument(
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
            except Exception:
                continue

    def build_index(
        self,
        progress_callback: Callable[[str], None] | None = None,
        chunk_batch_size: int = 1000,
    ) -> dict[str, int | str]:
        from .energy_tracker import EnergyTracker
        import gc
        
        with EnergyTracker("FAISS Index Building & Encoding"):
            self._emit_progress("Starting index build...", progress_callback)
            
            import faiss
            
            index = None
            total_chunks = 0
            unique_sources = set()
            
            # Temporary metadata stream file
            temp_metadata_path = self.metadata_path.with_suffix(".tmp")
            
            with open(temp_metadata_path, "w", encoding="utf-8") as handle:
                handle.write("[\n")
                
                block_documents = []
                first_item = True
                
                for document in self._yield_document_chunks():
                    block_documents.append(document)
                    
                    if len(block_documents) >= chunk_batch_size:
                        self._emit_progress(
                            f"Processing chunk block {(total_chunks // chunk_batch_size) + 1} (chunks {total_chunks} to {total_chunks + len(block_documents)})...",
                            progress_callback,
                        )
                        
                        block_texts = [doc.text for doc in block_documents]
                        block_embeddings = self._encode_batch(
                            block_texts,
                            batch_size=self.config.max_batch_size,
                            progress_callback=progress_callback,
                        )
                        
                        if index is None:
                            self._emit_progress(
                                f"Building FAISS index with embedding dimension {block_embeddings.shape[1]}...",
                                progress_callback,
                            )
                            index = faiss.IndexFlatIP(block_embeddings.shape[1])
                            
                        index.add(block_embeddings)  # type: ignore
                        
                        # Write metadata block to temp file
                        for doc in block_documents:
                            unique_sources.add(doc.extra["source_path"])
                            doc_dict = asdict(doc)
                            json_str = json.dumps(doc_dict, ensure_ascii=True)
                            if not first_item:
                                handle.write(",\n")
                            else:
                                first_item = False
                            handle.write(json_str)
                            
                        total_chunks += len(block_documents)
                        block_documents.clear()
                        self._cleanup_gpu_memory()
                        gc.collect()
                
                # Process remaining documents in final block
                if block_documents:
                    self._emit_progress(
                        f"Processing final chunk block {(total_chunks // chunk_batch_size) + 1} (chunks {total_chunks} to {total_chunks + len(block_documents)})...",
                        progress_callback,
                    )
                    block_texts = [doc.text for doc in block_documents]
                    block_embeddings = self._encode_batch(
                        block_texts,
                        batch_size=self.config.max_batch_size,
                        progress_callback=progress_callback,
                    )
                    
                    if index is None:
                        index = faiss.IndexFlatIP(block_embeddings.shape[1])
                    index.add(block_embeddings)  # type: ignore
                    
                    for doc in block_documents:
                        unique_sources.add(doc.extra["source_path"])
                        doc_dict = asdict(doc)
                        json_str = json.dumps(doc_dict, ensure_ascii=True)
                        if not first_item:
                            handle.write(",\n")
                        else:
                            first_item = False
                        handle.write(json_str)
                        
                    total_chunks += len(block_documents)
                    block_documents.clear()
                    self._cleanup_gpu_memory()
                    gc.collect()
                
                handle.write("\n]")
            
            # If we indexed successfully, save the index and finalize metadata
            if index is not None:
                self._emit_progress(f"Writing FAISS index to {self.index_path}...", progress_callback)
                faiss.write_index(index, str(self.index_path))
                self._index = index
                
                # Overwrite metadata file with the temp file
                if self.metadata_path.exists():
                    self.metadata_path.unlink()
                temp_metadata_path.rename(self.metadata_path)
            else:
                self._index = None
                if temp_metadata_path.exists():
                    temp_metadata_path.unlink()
                    
            self._cleanup_gpu_memory()
            
            result = {
                "total_documents": len(unique_sources),
                "total_chunks": total_chunks,
                "index_path": str(self.index_path),
                "embedding_model": self.config.embedding_model_name,
            }
            self._emit_progress(f"Index built: {result}", progress_callback)
            
            self._documents = []
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
            for doc in raw_documents:
                doc.pop("searchable_text", None)
            self._documents = [ChunkDocument(**doc) for doc in raw_documents]
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
            "how",
            "make",
            "better",
            "best",
            "good",
            "should",
            "would",
            "could",
            "does",
            "do",
            "did",
            "done",
            "has",
            "have",
            "had",
            "is",
            "are",
            "were",
            "was",
            "be",
            "been",
            "being",
            "document",
            "documents",
            "report",
            "reports",
            "page",
            "pages",
            "about",
            "some",
            "any",
            "detail",
            "details",
            "info",
            "information",
            "guideline",
            "guidelines",
            "rule",
            "rules",
            "act",
            "acts",
            "law",
            "laws",
            "regulation",
            "regulations",
            "plan",
            "plans",
            "program",
            "programs",
            "project",
            "projects",
            "national",
            "state",
            "local",
            "global",
        }
        anchor_terms = {term for term in query_terms if term not in generic_terms}
        min_year, max_year = self._year_bounds()
        recent_cutoff = max_year - 4

        if latest_query and year is None:
            search_top_k = min(max(top_k * 500, 4000), len(self._documents))
        elif compare_query and year is None:
            search_top_k = min(max(top_k * 200, 2000), len(self._documents))
        else:
            search_top_k = min(max(top_k * 100, 500), len(self._documents))
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

            searchable_text = document.searchable_text

            if tiger_intent and "tiger" not in searchable_text:
                continue

            if policy_intent and (
                document.category == "zoos"
                or document.document_type == "profile"
                or document.source == "India Zoo Network"
            ):
                if anchor_terms and any(term in searchable_text for term in anchor_terms):
                    pass
                else:
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

                if anchor_terms:
                    anchor_matches = sum(1 for term in anchor_terms if term in searchable_text)
                    if anchor_matches == 0:
                        adjusted_score -= 1.50
                    else:
                        adjusted_score += 0.40 * (anchor_matches / len(anchor_terms))

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
                    if anchor_terms and any(term in searchable_text for term in anchor_terms):
                        adjusted_score -= 0.10
                    else:
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

        results = self._dedupe_hits(ranked_results)

        if latest_query and year is None:
            recent_floor = 2023
            recent_hits = [hit for hit in results if (hit.get("year") or 0) >= recent_floor]
            older_hits = [hit for hit in results if (hit.get("year") or 0) < recent_floor]
            results = recent_hits + older_hits

        results = results[:top_k]

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
        if latest_query and not compare_query:
            top = sorted_hits[0]
        else:
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

        def excerpt(text: str, limit: int = 260) -> str:
            cleaned = " ".join(text.split())
            if len(cleaned) <= limit:
                return cleaned
            shortened = cleaned[:limit].rsplit(" ", 1)[0].rstrip(".,;:-")
            return f"{shortened}..."

        theme_line = (
            f"The retrieved evidence centers on habitat protection, conservation planning, and legal safeguards for {query.strip().rstrip('?').lower()}."
            if query.strip()
            else "The retrieved evidence centers on habitat protection, conservation planning, and legal safeguards."
        )

        summary_lines = [
            f"Summary for: {query}",
            "",
            f"Best supported answer: {top['title']} is the strongest match, and the surrounding evidence points to a policy path that combines habitat protection, species safeguards, and implementation guidance.",
            f"Top match: {top['title']} ({top_year})",
            f"Category: {top['category']} | Source: {top['source']}",
            theme_line,
        ]

        if years:
            summary_lines.append(f"Year coverage in retrieved evidence: {max(years)} down to {min(years)}")
            if latest_query:
                summary_lines.append(f"Latest-focus query detected; prioritized recent documents from {max(years) - 4} onward when relevant.")

        summary_lines.extend(["", "What the evidence says:"])

        for idx, hit in enumerate(sorted_hits[:5], start=1):
            snippet = excerpt(hit["text"], 260)
            summary_lines.append(
                f"- {idx}. {hit['title']} ({hit['year'] or 'year not specified'}) | {hit['source']} | score={hit['score']:.3f}"
            )
            summary_lines.append(f"  {snippet}")

        summary_lines.extend(["", "Policy evolution:"])

        if compare_query or latest_query:
            comparison_years = []
            for hit in comparison_hits[:6]:
                year_value = hit.get("year") or "year not specified"
                comparison_years.append(str(year_value))
                summary_lines.append(
                    f"- {year_value}: {hit['title']} | {hit['category']} | {hit['source']}"
                )
            if len(comparison_years) > 1:
                summary_lines.append(
                    f"- Evolution trend: the retrieved evidence moves from older baseline documents toward newer {max(years) if years else 'recent'} policy and status material, suggesting that habitat protection is increasingly tied to implementation, monitoring, and species-specific recovery measures."
                )
        else:
            for hit in comparison_hits[:4]:
                summary_lines.append(
                    f"- {hit['year'] or 'year not specified'}: {hit['title']} | {hit['category']} | {hit['source']}"
                )

        summary_lines.extend(["", "Why this matters:"])
        if compare_query:
            summary_lines.append(
                f"- The newest available documents provide the current baseline, while earlier iterations show how the policy has evolved over time. For a policy question, that means the answer should be read as a progression rather than a single static rule."
            )
        elif latest_query:
            summary_lines.append(
                f"- The strongest recent evidence is anchored in {top_year} documents, with {top['source']} providing the freshest usable context and the most relevant operational guidance for current decisions."
            )
        else:
            summary_lines.append(
                f"- The answer is grounded in the most relevant retrieved documents, led by {top['title']} from {top_year}. The supporting material is strong enough to explain both the policy direction and the practical habitat-protection angle.")

        summary_lines.append(
            "- In practical terms, the retrieved policies point to protected-area management, wildlife conservation planning, and regulatory enforcement as the main mechanisms protecting endangered habitats."
            )

        summary_lines.extend(["", "Sources used:"])
        for source_name in sources:
            summary_lines.append(f"- {source_name}")

        return "\n".join(summary_lines)
