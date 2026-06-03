# WILDAI NLP GenAI - Multimodal Wildlife + RAG + Agentic System

A comprehensive full-stack wildlife information retrieval, conservation policy analysis, and chatbot system with AI-powered generation. Designed for learning advanced NLP, vector search, embeddings, RAG, and modern web technologies.

---

## 🎯 Features & Capabilities

✅ **364 Curated Documents** across **34 categories** and **21 sources** spanning **155+ years** (1871-2026).
✅ **High-Authority Sources** including full texts of India's Wildlife Protection Act (1972 with amendments), Forest Rights Act (2006), National Wildlife Action Plans (2002-2031 & 2017-2031), CITES, and Ramsar Convention.
✅ **Intelligent Chunking** using sentence-boundary-aware adaptive splitting (max 500 words per chunk).
✅ **FAISS Vector Search** with 768-dim `nomic-embed-text` embeddings (605.1 MB index, 206,529 chunks).
✅ **Heuristic Query Re-ranking** combining semantic embeddings, lexical overlap keyword matching, and recency/policy intent boosting.
✅ **Local Chatbot Experience** integrating RAG-grounded prompts with a local Ollama model (`llama3.2:3b`).
✅ **Dynamic Data Exports** generating cited query reports in **Markdown (`.md`)**, **PDF (`.pdf`)**, or **Word (`.docx`)** formats, embedding a dynamically generated word cloud.
✅ **Rich Visual Console** incorporating interactive SVG word clouds, analytics charts (yearly trends & categories), a document viewer, and visual micro-animations.

---

## 📊 Corpus Statistics (v4.1)

- **Total Documents:** 364
- **Total Indexed Chunks:** 206,529
- **FAISS Index Size:** 605.1 MB
- **Corpus Size on Disk:** 2.089 GB (exceeding the 2GB project target)
- **Metadata Completeness:** 98.9% (fully populated year fields, tags, and categories)
- **Year Range:** 1871 - 2026
- **Categories Mix:**
  - Species: 105 documents
  - Policies: 48 documents
  - Ecosystems: 16 documents
  - International Treaties: 16 documents
  - Zoo Networks: 15 documents
  - Biodiversity: 11 documents
  - Legal Documents: 11 documents
  - and 27 other categories.

---

## 🏗️ System Architecture

### Backend Stack
- **Python 3.11** with virtual environment (`venv`)
- **FastAPI** for HTTP REST API
- **FAISS** for vector similarity search
- **Sentence-Transformers / Ollama** for 768-dim embeddings (`nomic-embed-text`)
- **PyMuPDF** for PDF parsing
- **BeautifulSoup + requests** for web scraping and cleanups
- **Pillow + pytesseract** for image OCR fallbacks
- **ReportLab & python-docx** for on-the-fly PDF and DOCX generation
- **WordCloud & Matplotlib** for server-side word cloud PNG generation

### Frontend Stack  
- **React 18** with **TypeScript**
- **Vite** for blazingly fast builds
- **Framer Motion** for smooth glassmorphic page transitions
- **Lucide Icons** for a premium icon system
- **D3 Cloud** for interactive, client-rendered word clouds
- **Vanilla CSS** (`styles.css`) for layout, responsive breaks, and glowing background effects

### Dataset Layout
```
data/
└── dataset/
    ├── biodiversity/
    ├── ecosystems/
    ├── legal/
    ├── national-policy/         # High-authority national policies
    ├── international-convention/ # Treaties (CITES, Ramsar, CBD)
    ├── state-policy/            # State-level policies (Karnataka, MP, etc.)
    ├── species/                 # Species profiles & endangered animals
    ├── species-plan/            # Species-specific recovery programs (Project Tiger, Project Elephant)
    ├── protected-area-plan/     # Sanctuary and national park management plans
    ├── zoos/                    # Zoo profiles and histories
    └── zoos-policy/             # Zoo regulatory policies
```

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
# API runs on http://127.0.0.1:8000
```

### 5. Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://127.0.0.1:5173
```

---

## 🌐 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Health and index readiness check |
| `POST` | `/api/query` | Grounded search & query response |
| `POST` | `/api/index/rebuild` | Programmatic index rebuilding |
| `POST` | `/api/export?fmt={md\|pdf\|docx}` | Generates exportable query report |
| `POST` | `/api/chat` | Basic chat endpoint |
| `POST` | `/api/chat/ollama` | Local RAG chat with Ollama LLM |
| `GET` | `/api/corpus/stats` | Dynamic corpus & category statistics |
| `GET` | `/api/analytics/category_counts` | Summary of documents per category |
| `GET` | `/api/analytics/time_series` | Yearly document count series |
| `GET` | `/api/analytics/wordcloud` | Keyword frequencies for D3 cloud |
| `GET` | `/api/analytics/wordcloud_image` | Streams a matplotlib-drawn PNG word cloud |

---

## 🔬 Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run_phase1.py` | Command-line utility to build/rebuild the FAISS index |
| `scripts/run_api.py` | Launches the uvicorn development server for FastAPI |
| `scripts/corpus_inventory.py` | Prints a summary of all categories, sources, and titles |
| `scripts/corpus_management.py` | Utilities for dataset pruning, verifying metadata integrity, and cleaning |
| `scripts/populate_corpus_extended.py` | Scraping script to fetch and build the target species/policy documents |

---

## 🗺️ Learning Path & Future Roadmap

### In Place & Completed:
* **Dynamic Backend Metrics:** Replaced hardcoded indicators with backend sync metrics.
* **Zoo Policy Integration:** Embedded state-level zoo plans as first-class categories.
* **Comprehensive Exporting:** Document downloads in PDF, Markdown, and Word formats.
* **Local Chat Interface:** LLM retrieval-augmented grounding using a local llama instance.
* **Analytics Board:** Dynamic time-series bar charts, category listings, and word clouds.

### Next Improvements (Roadmap):
1. **Dynamic Statistics Binding:** Hook the Team Page statistics block to dynamic API indicators.
2. **Database Memory:** Persist multi-turn conversations using a local SQLite/PostgreSQL layer.
3. **Agentic Router (Task Orchestrator):** Empower a planning model to orchestrate sequential search, analysis, word cloud creation, and compilation tasks.
4. **Evaluation Loop:** Set up a local test suite to validate context relevance and hallucination indicators.
