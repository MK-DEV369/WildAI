from __future__ import annotations

import re
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_VENV_SITES = _ROOT / "venv" / "Lib" / "site-packages"
if _VENV_SITES.exists() and str(_VENV_SITES) not in sys.path:
    sys.path.insert(0, str(_VENV_SITES))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import PipelineConfig
from .rag_engine import RAGEngine
from .schemas import BuildIndexResponse, QueryRequest, QueryResponse, SearchHit
from .ollama_client import generate as ollama_generate
from fastapi.responses import FileResponse, JSONResponse
from tempfile import NamedTemporaryFile
import io
import datetime
from typing import Any
from fastapi.responses import StreamingResponse
import docx
import json
from pathlib import Path


HIGHLIGHT_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}


def extract_highlight_terms(query: str, max_terms: int = 12) -> list[str]:
    """Return de-duplicated query tokens suitable for safe regex highlighting."""
    if not query.strip():
        return []

    # Keep words, numbers, and common internal separators (hyphen/apostrophe/slash).
    raw_terms = re.findall(r"[A-Za-z0-9]+(?:[-'/][A-Za-z0-9]+)*", query)

    unique_terms: list[str] = []
    seen_terms: set[str] = set()

    for term in raw_terms:
        normalized = term.lower()
        if len(normalized) < 2:
            continue
        if normalized in HIGHLIGHT_STOPWORDS:
            continue
        if normalized in seen_terms:
            continue

        seen_terms.add(normalized)
        unique_terms.append(term)

    unique_terms.sort(key=len, reverse=True)
    return unique_terms[:max_terms]


def create_app() -> FastAPI:
    config = PipelineConfig()
    engine = RAGEngine(config)

    app = FastAPI(title="WILDAI RAG API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str | bool]:
        return {"status": "ok", "index_ready": engine.index_path.exists()}

    @app.post("/api/index/rebuild", response_model=BuildIndexResponse)
    def rebuild_index() -> BuildIndexResponse:
        freq_path = config.output_dir / "word_frequencies.json"
        if freq_path.exists():
            try:
                freq_path.unlink()
            except Exception:
                pass
        payload = engine.build_index()
        return BuildIndexResponse(
            total_documents=int(payload["total_documents"]),
            total_chunks=int(payload["total_chunks"]),
            index_path=str(payload["index_path"]),
        )

    @app.get("/api/document/full_text")
    def get_full_text(source_path: str, record_index: int = 0) -> dict:
        try:
            import json
            from pathlib import Path
            path = Path(source_path)
            if not path.exists():
                return JSONResponse({"error": f"File not found: {source_path}"}, status_code=404)
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            records = payload if isinstance(payload, list) else [payload]
            if record_index < 0 or record_index >= len(records):
                return JSONResponse({"error": f"Record index {record_index} out of bounds"}, status_code=400)
            record = records[record_index]
            content = record.get("cleaned_content") or record.get("content") or ""
            return {"full_text": content}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @app.get("/api/corpus/stats")
    def corpus_stats() -> dict:
        # Return simple corpus statistics and available sources/categories
        engine.ensure_index()
        total_docs = len({doc.extra.get("source_path") for doc in engine._documents})
        total_chunks = len(engine._documents)
        categories = {}
        sources = {}
        years = set()
        for doc in engine._documents:
            categories[doc.category] = categories.get(doc.category, 0) + 1
            sources[doc.source] = sources.get(doc.source, 0) + 1
            if isinstance(doc.year, int):
                years.add(doc.year)

        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "categories": categories,
            "sources": sources,
            "year_range": [min(years) if years else None, max(years) if years else None],
        }

    def get_word_frequencies() -> dict[str, int]:
        import logging
        logger = logging.getLogger(__name__)
        freq_path = config.output_dir / "word_frequencies.json"
        index_path = config.index_path

        # If index has been updated more recently than frequencies cache, clear cache
        if freq_path.exists() and index_path.exists():
            if index_path.stat().st_mtime > freq_path.stat().st_mtime:
                try:
                    logger.info("Index updated since last word frequency computation. Clearing cached frequencies...")
                    freq_path.unlink()
                except Exception:
                    pass

        if freq_path.exists():
            try:
                with freq_path.open("r", encoding="utf-8") as handle:
                    return json.load(handle)
            except Exception:
                pass

        # Fallback: compute from engine documents
        from collections import Counter
        engine.ensure_index()
        logger.info(f"Computing cached word frequencies from {len(engine._documents)} documents...")
        counter = Counter()
        for doc in engine._documents:
            words = [w.lower() for w in re.findall(r"[A-Za-z0-9]+", doc.text) if len(w) > 3]
            counter.update(words)
        for w in list(counter.keys()):
            if w in HIGHLIGHT_STOPWORDS:
                del counter[w]

        frequencies = {t: c for t, c in counter.most_common(500)}
        try:
            with freq_path.open("w", encoding="utf-8") as handle:
                json.dump(frequencies, handle, indent=2, ensure_ascii=True)
        except Exception:
            pass
        return frequencies

    def generate_wordcloud_bytes(top_n_local: int = 80) -> io.BytesIO | None:
        """Generate a PNG wordcloud from the current engine documents and return BytesIO."""
        try:
            from wordcloud import WordCloud
        except Exception:
            return None

        freq = get_word_frequencies()
        most = dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n_local])
        if not most:
            return None

        wc = WordCloud(width=1600, height=550, background_color='white', random_state=42)
        wc.generate_from_frequencies(most)

        img = wc.to_image()
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return buf

    @app.post("/api/export")
    def export_result(request: QueryRequest, fmt: str = "md") -> Any:
        from .energy_tracker import EnergyTracker
        with EnergyTracker(f"Query Result Exporting ({fmt.upper()})"):
            # Reuse existing query functionality
            hits = engine.search(request.query, top_k=request.top_k, category=request.category, source=request.source, year=request.year)
            answer = engine.answer(request.query, hits)
            # Always include the wordcloud in exported documents per user requirement
            include_wc = True

            timestamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            filename = f"wildai_report_{timestamp}.{fmt}"

            if fmt == "md":
                body_lines = ["# WILDAI Query Report", "", f"Query: {request.query}", "", "## Answer", answer, "", "## References", ""]
                for idx, hit in enumerate(hits, start=1):
                    body_lines.append(f"{idx}. {hit['title']} ({hit.get('year')}) — {hit.get('source')}")
                content = "\n".join(body_lines)
                # If including wordcloud, embed as base64 data URI
                if include_wc:
                    wc_buf = generate_wordcloud_bytes(120)
                    if wc_buf:
                        try:
                            img_bytes = wc_buf.getvalue()
                            import base64
                            b64 = base64.b64encode(img_bytes).decode('ascii')
                            content = content + "\n\n![wordcloud](data:image/png;base64," + b64 + ")"
                        except Exception:
                            pass

                tmp = NamedTemporaryFile(delete=False, suffix=".md")
                tmp.write(content.encode("utf-8"))
                tmp.flush()
                return FileResponse(tmp.name, filename=filename, media_type="text/markdown")

            if fmt in {"pdf", "docx"}:
                # Generate a simple PDF or DOCX using reportlab / python-docx
                if fmt == "pdf":
                    from reportlab.lib.pagesizes import letter
                    from reportlab.pdfgen import canvas

                    tmp = NamedTemporaryFile(delete=False, suffix=".pdf")
                    c = canvas.Canvas(tmp.name, pagesize=letter)
                    width, height = letter
                    y = height - 50
                    c.setFont("Helvetica-Bold", 14)
                    c.drawString(50, y, "WILDAI Query Report")
                    y -= 30
                    c.setFont("Helvetica", 10)
                    c.drawString(50, y, f"Query: {request.query}")
                    y -= 20
                    # If requested, include the wordcloud image at the top of the PDF
                    if include_wc:
                        wc_buf = generate_wordcloud_bytes(120)
                        if wc_buf:
                            try:
                                # draw image centered at top
                                from reportlab.lib.utils import ImageReader
                                img = ImageReader(wc_buf)
                                iw, ih = img.getSize()
                                target_w = width - 100
                                target_h = (ih / iw) * target_w
                                c.drawImage(img, 50, height - 60 - target_h, width=target_w, height=target_h)
                                y = height - 60 - target_h - 20
                            except Exception:
                                y = height - 50
                        else:
                            y = height - 50
                    else:
                        y = height - 50

                    for line in answer.split('\n'):
                        if y < 80:
                            c.showPage()
                            y = height - 50
                        c.drawString(50, y, line)
                        y -= 14
                    c.save()
                    return FileResponse(tmp.name, filename=filename, media_type="application/pdf")

                if fmt == "docx":
                    from docx import Document

                    doc = Document()
                    doc.add_heading('WILDAI Query Report', level=1)
                    doc.add_paragraph(f'Query: {request.query}')
                    doc.add_heading('Answer', level=2)
                    doc.add_paragraph(answer)
                    # include wordcloud image in docx if requested
                    if include_wc:
                        wc_buf = generate_wordcloud_bytes(120)
                        if wc_buf:
                            try:
                                from docx.shared import Inches
                                # python-docx add_picture accepts file-like objects
                                doc.add_page_break()
                                p = doc.add_paragraph()
                                run = p.add_run()
                                run.add_picture(wc_buf, width=Inches(6))
                            except Exception:
                                pass
                    doc.add_heading('References', level=2)
                    for hit in hits:
                        doc.add_paragraph(f"{hit['title']} ({hit.get('year')}) — {hit.get('source')}")
                    tmp = NamedTemporaryFile(delete=False, suffix=".docx")
                    doc.save(tmp.name)
                    return FileResponse(tmp.name, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

            return JSONResponse({"error": "Unsupported format"}, status_code=400)

    @app.post("/api/chat")
    def chat_endpoint(request: QueryRequest, session_id: str | None = None) -> dict:
        # Very small retrieval + generation endpoint
        hits = engine.search(request.query, top_k=request.top_k, category=request.category, source=request.source, year=request.year)
        # For now, generation uses engine.answer (simple synthesis). If an LLM is wired, delegate to it.
        answer = engine.answer(request.query, hits)
        return {"session_id": session_id or f"s-{int(datetime.datetime.utcnow().timestamp())}", "query": request.query, "answer": answer, "hits": hits}

    @app.post('/api/chat/ollama')
    def chat_ollama(request: QueryRequest, model: str | None = None, session_id: str | None = None) -> dict:
        """RAG chat endpoint that uses the local Ollama LLM for final generation.

        It retrieves top hits from the index, constructs a prompt with the
        evidence snippets, and calls the local Ollama service via the
        `ollama_client.generate` adapter.
        """
        from .energy_tracker import EnergyTracker
        chosen_model = model or "llama3.2:3b"
        
        with EnergyTracker(f"Local LLM Chat (Ollama - {chosen_model})"):
            hits = engine.search(request.query, top_k=max(6, request.top_k), category=request.category, source=request.source, year=request.year)

            # build prompt
            prompt_lines = [
                "You are an expert assistant that answers user queries using provided evidence.",
                "Generate a detailed, comprehensive, and well-structured answer.",
                "Use clear bullet points or numbered lists to break down different aspects of the information.",
                "Cite the source titles in square brackets after assertions (e.g., [Himachal Pradesh Forest Rules (2023)]).",
                "Do not hallucinate facts that are not present in the evidence.",
                "",
                "Evidence:",
            ]
            for idx, hit in enumerate(hits[:6], start=1):
                snippet = " ".join(hit.get('text', '').split())[:400]
                title = hit.get('title') or f"doc{idx}"
                year = hit.get('year') or ''
                src = hit.get('source') or ''
                prompt_lines.append(f"{idx}. {title} ({year}) — {src}: {snippet}")

            prompt_lines.extend(["", "User question:", request.query, "", "Answer:" ] )
            prompt = "\n".join(prompt_lines)

            try:
                llm_out = ollama_generate(prompt, model=chosen_model, timeout=60)
            except Exception as exc:
                # fallback to engine.answer when Ollama not available
                answer = engine.answer(request.query, hits)
                return {"session_id": session_id or f"s-{int(datetime.datetime.utcnow().timestamp())}", "query": request.query, "answer": answer, "hits": hits, "warning": str(exc)}

            return {"session_id": session_id or f"s-{int(datetime.datetime.utcnow().timestamp())}", "query": request.query, "answer": llm_out, "hits": hits}

    @app.get("/api/analytics/terms")
    def analytics_terms(top_n: int = 50) -> dict:
        # Compute term frequencies across document chunks (naive).
        # If `query` is provided, restrict to matching hits.
        from collections import Counter

        query = None
        # allow query via query param ?q=...
        # FastAPI maps unknown params via request args; use fallback to global terms
        # For simplicity we read from request args in the URL
        try:
            from fastapi import Request

            @app.get('/_')
            def _noop():
                return {}
        except Exception:
            pass

        engine.ensure_index()
        counter = Counter()
        for doc in engine._documents:
            words = [w.lower() for w in re.findall(r"[A-Za-z0-9]+", doc.text) if len(w) > 3]
            counter.update(words)
        # filter stopwords
        stop = HIGHLIGHT_STOPWORDS
        for w in list(counter.keys()):
            if w in stop:
                del counter[w]

        most = counter.most_common(top_n)
        return {"top_terms": most}

    @app.get('/api/analytics/category_counts')
    def analytics_category_counts() -> dict:
        engine.ensure_index()
        counts: dict[str, int] = {}
        for doc in engine._documents:
            counts[doc.category] = counts.get(doc.category, 0) + 1
        return {"category_counts": counts}

    @app.get('/api/analytics/time_series')
    def analytics_time_series(category: str | None = None) -> dict:
        # Return counts per year, optionally filtered by category
        engine.ensure_index()
        counts: dict[int, int] = {}
        for doc in engine._documents:
            if category and doc.category != category:
                continue
            if isinstance(doc.year, int):
                counts[doc.year] = counts.get(doc.year, 0) + 1
        # return sorted list of (year, count)
        series = sorted(list(counts.items()))
        return {"time_series": series}

    @app.get('/api/analytics/wordcloud')
    def analytics_wordcloud(top_n: int = 80) -> dict:
        freq = get_word_frequencies()
        most = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return {"words": [{"term": t, "count": c} for t, c in most]}

    @app.get('/api/analytics/policy_time_series')
    def analytics_policy_time_series(source: str | None = None) -> dict:
        """Scan files in data/dataset/zoos-policy and return counts per year grouped by source/authority."""
        policy_dir = Path('data/dataset/zoos-policy')
        if not policy_dir.exists():
            return {"time_series": []}

        series: dict[int, dict[str, int]] = {}
        for path in policy_dir.glob('*.json'):
            try:
                with path.open('r', encoding='utf-8') as fh:
                    payload = json.load(fh)
            except Exception:
                continue
            year = payload.get('year')
            src = payload.get('source') or payload.get('url')
            if source and src and source.lower() not in src.lower():
                continue
            if not isinstance(year, int):
                # try to extract from content
                content = (payload.get('content') or '')
                ym = re.search(r"(19|20)\d{2}", content)
                year = int(ym.group(0)) if ym else None
            if year is None:
                continue
            series.setdefault(year, {})
            series[year][src] = series[year].get(src, 0) + 1

        # convert to sorted list
        result = []
        for y in sorted(series.keys()):
            result.append({"year": y, "counts": series[y]})
        return {"time_series": result}

    @app.get('/api/analytics/wordcloud_image')
    def analytics_wordcloud_image(q: str = None, top_n: int = 80) -> Any:
        # Build frequency dict and render PNG via python-wordcloud
        try:
            from wordcloud import WordCloud
        except Exception as e:
            return JSONResponse({"error": f"Missing dependency: {e}"}, status_code=500)

        if q:
            # Generate query-specific word cloud from search results
            hits = engine.search(q, top_k=20)
            from collections import Counter
            counter = Counter()
            for hit in hits:
                words = [w.lower() for w in re.findall(r"[A-Za-z0-9]+", hit["text"]) if len(w) > 3]
                counter.update(words)
            for w in list(counter.keys()):
                if w in HIGHLIGHT_STOPWORDS:
                    del counter[w]
            freq = {t: c for t, c in counter.most_common(top_n)}
        else:
            # Fall back to entire corpus frequencies
            freq = get_word_frequencies()

        most = dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n])
        if not most:
            return JSONResponse({"error": "No terms to render"}, status_code=400)

        wc = WordCloud(width=1600, height=550, background_color='white', random_state=42)
        wc.generate_from_frequencies(most)

        img = wc.to_image()
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return StreamingResponse(buf, media_type='image/png')

    @app.get('/api/analytics/energy')
    def get_energy_analytics() -> dict:
        import re
        from pathlib import Path
        from .energy_tracker import get_system_specs, LOG_FILE
        log_path = LOG_FILE
        try:
            specs = get_system_specs()
        except Exception:
            specs = {
                "os": "Windows",
                "cpu": "Intel(R) Core(TM) i7-11800H CPU @ 2.30GHz",
                "gpu": "NVIDIA GeForce RTX 3050 Laptop GPU",
                "ram": "16 GB"
            }
            
        logs = []
        if log_path.exists():
            pattern = re.compile(
                r"\[(?P<timestamp>.*?)\] Task: (?P<task>.*?) \| "
                r"Duration: (?P<duration>[\d.]+)s \| CPU Mean Util: (?P<cpu_util>[\d.]+)% \| "
                r"CPU Power: (?P<cpu_w>[\d.]+)W \| GPU Power: (?P<gpu_w>[\d.]+)W \| "
                r"Energy: (?P<energy>[\d.]+) Wh"
            )
            try:
                with log_path.open("r", encoding="utf-8") as f:
                    for line in f:
                        match = pattern.search(line)
                        if match:
                            d = match.groupdict()
                            logs.append({
                                "timestamp": d["timestamp"],
                                "task": d["task"],
                                "duration": float(d["duration"]),
                                "cpu_util": float(d["cpu_util"]),
                                "cpu_w": float(d["cpu_w"]),
                                "gpu_w": float(d["gpu_w"]),
                                "energy": float(d["energy"]),
                            })
            except Exception as e:
                return {"error": str(e), "logs": [], "system_specs": specs}
                
        return {"logs": logs, "system_specs": specs}

    @app.post("/api/query", response_model=QueryResponse)
    def query(request: QueryRequest) -> QueryResponse:
        from .energy_tracker import EnergyTracker
        with EnergyTracker("RAG Search & Synthesis Query"):
            hits = engine.search(
                request.query,
                top_k=request.top_k,
                category=request.category,
                source=request.source,
                year=request.year,
            )
            answer = engine.answer(request.query, hits)
            highlight_terms = extract_highlight_terms(request.query)
            return QueryResponse(
                query=request.query,
                answer=answer,
                total_hits=len(hits),
                highlight_terms=highlight_terms,
                hits=[SearchHit(**hit) for hit in hits],
            )

    return app


app = create_app()
