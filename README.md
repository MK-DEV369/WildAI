# WILDAI NLP GenAI - Multimodal Wildlife + RAG + Agentic System

A comprehensive full-stack wildlife information retrieval and conservation system with AI-powered generation. Designed for learning advanced NLP, embeddings, RAG, and modern web technologies.

## 🎯 Features

✅ **100+ Endangered Species** with Wikipedia profiles and thumbnail images
✅ **Historical Policy Versions** across multiple years for temporal comparison
✅ **State & National Regulations** from India (expandable to other regions)
✅ **Intelligent Chunking** using sentence-boundary-aware adaptive splitting
✅ **Large Embedding Model** (768-dim mpnet-base-v2) for better semantics
✅ **GPU Optimization** with batched encoding and aggressive memory cleanup
✅ **140+ Curated Documents** in only 6.6 MB (9.9 GB storage available)
✅ **Full Stack**: FastAPI backend, FAISS vector search, React animated UI

## 📊 Corpus Statistics

- **Total Documents**: 140+
- **Species Profiles**: 96+ endangered animals (Wikipedia)
- **Species Images**: 19+ thumbnail images
- **Policies**: National, state-level, and historical versions
- **Legal Documents**: Treaties, acts, regulations
- **Ecosystems**: Habitat and biodiversity reports
- **Storage Used**: 6.61 MB / 10,000 MB (10 GB allocated)
- **Embedding Dimension**: 768 (all-mpnet-base-v2) vs 384 (all-MiniLM-L6-v2)

## 🏗️ Architecture

### Backend Stack
- **Python 3.11** with venv
- **FastAPI** for REST API
- **FAISS** for vector similarity search (768-dim vectors)
- **sentence-transformers** for semantic embeddings (with hashing fallback)
- **PyMuPDF** for PDF text extraction
- **BeautifulSoup + requests** for web scraping
- **Pillow + pytesseract** for OCR on images

### Frontend Stack  
- **React 18** with TypeScript
- **Vite** for blazingly fast development
- **Framer Motion** for smooth animations
- **Lucide icons** for a polished UI
- **Tailwind CSS** for responsive styling

### Dataset Layout

```
data/
└── dataset/
    ├── policies/
    │   ├── india/           # National & state policies
    │   └── global/
    ├── species/             # 96+ endangered animal profiles
    │   ├── endangered/
    │   └── wiki/
    ├── ecosystems/          # Forest, coral, grassland reports
    ├── legal/               # Acts, treaties, regulations
    │   ├── india/           # 1972-2002 acts
    │   └── global/          # CBD, UNEP, etc.
    ├── images/
    │   └── species/         # Thumbnail images (19+)
    └── failed-downloads.json # Retry log
```

## 🚀 Quick Start

### 1. Setup & Activate Environment

```bash
cd e:\6th\ SEM\ Data\Projects\WILDAI_NLP_GENAI
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate     # Linux/Mac
```

### 2. Install & Build Corpus

```bash
# Install Python dependencies
pip install -r requirements.txt

# Option A: Use existing corpus
python scripts/populate_corpus.py              # ~15 documents, basic
python scripts/populate_corpus_extended.py     # 100+ animals, policies, state regs

# Option B: Rebuild FAISS index after adding documents
python scripts/run_phase1.py
```

### 3. Start Backend API

```bash
python scripts/run_api.py
# API runs on http://127.0.0.1:8000
```

### 4. Start Frontend

In another terminal:
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://127.0.0.1:5173
```

### 5. Query via UI or API

**UI**: Open http://127.0.0.1:5173
- Type queries like "endangered tigers", "forest policy" 
- Click "Rebuild Index" to refresh after adding documents

**Direct API**:
```bash
curl -X POST http://127.0.0.1:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "wildlife protection laws", "top_k": 5}'
```

## 📚 Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/populate_corpus.py` | Download ~15 policy/legal docs + 5 species |
| `scripts/populate_corpus_extended.py` | Download 100+ animals + comprehensive policies |
| `scripts/run_phase1.py` | Build FAISS index from dataset/ |
| `scripts/run_api.py` | Start FastAPI backend |
| `scripts/test_expanded_corpus.py` | Test retrieval with sample queries |
| `scripts/corpus_management.py` | View stats, clean old docs, verify integrity |

## 🎓 Learning Path

### Week 1-2: Data Collection
- Explore `populate_corpus_extended.py` for web scraping patterns
- Study `src/wildai_pipeline/extractors.py` for PDF/HTML/image extraction
- Understand cleaning and chunking in `src/wildai_pipeline/cleaning.py`

### Week 2-3: Embeddings & Indexing  
- Review `src/wildai_pipeline/rag_engine.py` for FAISS integration
- Experiment with different embedding models (all-MiniLM-L6-v2, all-mpnet-base-v2)
- Observe GPU memory management and batching strategies

### Week 3-4: API & UI
- Study FastAPI endpoints in `src/wildai_pipeline/api.py`
- Explore React components in `frontend/src/App.tsx`
- Try modifying the UI or adding new retrieval strategies

### Week 4+: Production & Scale
- Add state management (Redux/Zustand) for complex queries
- Implement LLM-based answer generation  
- Add user authentication and audit logging
- Deploy to cloud (Azure, AWS, GCP)

## 🔧 Configuration

Edit `src/wildai_pipeline/config.py`:

```python
@dataclass(slots=True)
class PipelineConfig:
    embedding_model_name: str = "sentence-transformers/all-mpnet-base-v2"  # Larger model (768-dim)
    chunk_target_words: int = 400  # Adaptive chunking target
    use_gpu: bool = True  # GPU for embeddings
    max_batch_size: int = 32  # Batch encoding
    aggressive_cleanup: bool = True  # GPU memory management
```

## 💾 Storage & Memory Management

**Storage Budget**: 10 GB
- **Current Usage**: 6.61 MB (140 documents)
- **Remaining**: 9.9 GB for expansion

**Memory Optimization**:
- ✅ Batched encoding (32 chunks per batch on GPU)
- ✅ Adaptive chunking (respects sentence boundaries)
- ✅ Aggressive GPU cache cleanup between batches
- ✅ Fallback to hashing when CUDA unavailable
- ✅ Index metadata stored separately (2.1 MB JSON)

## 📝 Example Document

```json
{
  "title": "Bengal Tiger",
  "year": 2024,
  "category": "species",
  "source": "Wikipedia",
  "type": "html",
  "content": "The Bengal tiger (Panthera tigris)...",
  "cleaned_content": "The Bengal tiger Panthera tigris...",
  "chunks": [
    "The Bengal tiger Panthera tigris is a tiger population in the Indian subcontinent...",
    "Bengal tigers are larger than other tiger subspecies...",
    "Conservation efforts have shown mixed success..."
  ],
  "tags": ["tiger", "endangered", "species", "wildlife"],
  "url": "https://en.wikipedia.org/wiki/Bengal_tiger",
  "extra": {
    "page_title": "Bengal_tiger",
    "thumbnail_source": "https://...",
    "wikidata_item": "Q4981"
  }
}
```

## 🌐 API Endpoints

```
GET  /api/health               # Health check
POST /api/query                # Search & retrieve
POST /api/index/rebuild        # Rebuild FAISS index
GET  /api/corpus/stats         # Corpus statistics
```

## 🛠️ Troubleshooting

**"ModuleNotFoundError: No module named 'wildai_pipeline'"**
→ Set `PYTHONPATH=./src` or run from project root

**"Torch not compiled with CUDA enabled"**  
→ Falls back to hashing embeddings; install `torch` with CUDA for GPU speedup

**"SslError: certificate verify failed"**  
→ Scripts set `verify=False` for development; use proper certs in production

**"FAISS IndexFlatIP dimension mismatch"**
→ Index was built with different embedding model; run `python scripts/run_phase1.py` to rebuild

## 📖 References

- FAISS: https://github.com/facebookresearch/faiss
- Sentence Transformers: https://huggingface.co/sentence-transformers
- FastAPI: https://fastapi.tiangolo.com/
- React: https://react.dev/

## 📄 License

Educational use—modify and extend freely for your project requirements.

---

**Status**: ✅ Full stack working | 96+ species | 140+ documents | 6.6 MB used | 9.9 GB available
