# WILDAI NLP GenAI - Multimodal Wildlife + RAG + Agentic System

A comprehensive full-stack wildlife information retrieval, conservation policy analysis, and chatbot system with AI-powered generation. Designed for learning advanced NLP, vector search, embeddings, RAG, and modern web technologies.

---

## 🎯 Features & Capabilities

### 🔍 Search & RAG Relevance
*   **364 Curated Documents** across **34 categories** and **21 sources** spanning **155+ years** (1871-2026).
*   **Heuristic Query Re-ranking** combining semantic embeddings, lexical overlap keyword matching, and recency/policy intent boosting.
*   **Entity Anchor Term Reranking:** Isolates specific query entities (e.g. `"bannerghatta"` or `"tiger"`) to bypass general zoo/profile filters and penalize irrelevant documents, ensuring target profiles are retrieved as Rank 1.
*   **Temporal Policy Synthesis:** Prompts backend LLMs to parse years/timeframes of retrieved policies (e.g. covering 2011 to 2026), preventing strict refusal responses when "latest" is queried.

### 🎙️ Interactive Voice Console
*   **Speech-to-Text (STT) Input:** Live mic dictation button integrating the browser-native `SpeechRecognition` API. Fully compatible with system-wide dictation utilities like Wispr Flow.
*   **Text-to-Speech (TTS) Output:** Synthesizes assistant responses using browser-native `SpeechSynthesis` with custom string pre-filtering to strip markdown/citations.
*   **Playback Controls:** Includes a voice selector dropdown listing all platform voices, an auto-read toggle, and a stop reading playback button.

### 📊 Corpus Analytics & Telemetry
*   **Telemetry Grouping/Clustering:** Groups duplicated system task logs (e.g. repeated scrapings, embedding encodings, or query synthesis runs). Displays summed task energy (Wh), cumulative duration (s), averaged power draws, and appends run counts (e.g. `(5 runs)`).
*   **Enhanced Donut Visualization:** Re-engineered SVG category distribution donut chart with center totals and fixed-width info grid layout to eliminate white-space gaps.
*   **Dynamic Word Clouds:** Generates query-specific transparent-background word clouds on-the-fly to filter out general stopwords and highlight active search terms.

### 📄 Customized Report Exports & Settings Panel
*   **Export Settings panel:** Replaces static previews with a custom RAG synthesis control panel in the Research console.
*   **Custom Summary Type:** Choose between *Abstractive Summary*, *Comprehensive Technical Report*, *Policy Evolution Analyst*, and *Executive Briefing*.
*   **Custom Length:** Set target sizes (1 Page Compact, 2 Pages Standard, or 3+ Pages Exhaustive).
*   **Watermarks & Page Borders:** PDF generator implements a custom double-pass canvas (`WildaiCanvas`) drawing a double-line border, dynamic page numbers ("Page X of Y"), and a faint diagonal **"WILDAI" watermark** on every page.
*   **Species Visualizations:** Matches queries to local animal JPEG illustrations (e.g. `bengal-tiger.jpg` or `indian-elephant.jpg`) inside `data/dataset/images/species/` to embed at the top of the report. Fallback plots a horizontal matplotlib bar chart of retrieved passage relevance scores.
*   **Grounded Passages section:** Inserts clickable links and attaches passage snippets inside styled callout cells at the end of the PDF. Excludes the word cloud image to preserve formal report styling.

---

## 📊 Corpus Statistics (v4.5)

- **Total Documents:** 364
- **Total Indexed Chunks:** 207,511
- **FAISS Index Size:** 608.2 MB
- **Corpus Size on Disk:** 2.089 GB
- **Metadata Completeness:** 98.9% (fully populated year fields, tags, and categories)
- **Year Range:** 1871 - 2026

---

## 🏗️ System Architecture

### Backend Stack
- **Python 3.11** with virtual environment (`venv`)
- **FastAPI** for HTTP REST API
- **FAISS** for vector similarity search
- **Sentence-Transformers / Ollama** for 768-dim embeddings (`nomic-embed-text` or `all-mpnet-base-v2`)
- **PyMuPDF** for PDF parsing
- **BeautifulSoup + requests** for web scraping and cleanups
- **Pillow + pytesseract** for image OCR fallbacks
- **ReportLab & python-docx** for custom styled PDF and DOCX generation
- **WordCloud & Matplotlib** for server-side word cloud and data charts generation

### Frontend Stack  
- **React 18** with **TypeScript**
- **Vite** for blazingly fast builds
- **Framer Motion** for smooth glassmorphic page transitions
- **Lucide Icons** for a premium icon system
- **D3 Cloud** for interactive, client-rendered word clouds
- **Vanilla CSS** (`styles.css`) for layout, responsive breaks, custom styled dropdown selects, and watermark layouts

---

## 🚀 Quick Start

### 1. Setup & Activate Environment
```bash
cd e:\6th_SEM_Data\Projects\WILDAI_NLP_GENAI
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate     # Linux/Mac
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Build/Rebuild FAISS Index
To ingest files from `data/dataset/` and rebuild the FAISS vector database:
```bash
python scripts/run_phase1.py
```
*(Or click "Rebuild FAISS Index" in the frontend Research Console).*

### 4. Start Backend API
```bash
python scripts/run_api.py
```
*API runs on `http://127.0.0.1:8000`*

### 5. Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173/`*

---

## 🌐 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Health and index readiness check |
| `POST` | `/api/query` | Grounded search & query response |
| `POST` | `/api/index/rebuild` | Programmatic index rebuilding |
| `POST` | `/api/generate_summary` | Generates a custom-tailored synthesis report based on length and type options |
| `POST` | `/api/export?fmt={md\|pdf\|docx}` | Generates exportable query reports (PDF with watermarks/borders/visuals, DOCX, MD) |
| `POST` | `/api/chat` | Basic chat endpoint |
| `POST` | `/api/chat/ollama` | Local RAG chat with Ollama LLM |
| `GET` | `/api/corpus/stats` | Dynamic corpus & category statistics |
| `GET` | `/api/analytics/category_counts` | Summary of documents per category |
| `GET` | `/api/analytics/time_series` | Yearly document count series |
| `GET` | `/api/analytics/wordcloud` | Keyword frequencies for D3 cloud |
| `GET` | `/api/analytics/wordcloud_image` | Streams a matplotlib-drawn PNG word cloud |
| `GET` | `/api/analytics/energy` | Hardware specifications and execution energy telemetry logs |
| `GET` | `/api/analytics/year_category` | Aggregates domain category composition per year |

---

## 🔬 Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run_phase1.py` | Command-line utility to build/rebuild the FAISS index |
| `scripts/run_api.py` | Launches the uvicorn development server for FastAPI |
| `scripts/corpus_inventory.py` | Prints a summary of all categories, sources, and titles |
| `scripts/corpus_management.py` | Utilities for dataset pruning, verifying metadata integrity, and cleaning |
| `scripts/populate_corpus_extended.py` | Scraping script to fetch and build the target species/policy documents |
