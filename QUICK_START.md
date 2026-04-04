# 🚀 WILDAI Quick Start Guide

## System Status
✅ **All Errors Fixed**
✅ **2.089 GB Corpus Ready**
✅ **FAISS Index Built (605.1 MB)**
✅ **Frontend Complete with Team Page**
✅ **Policy Year Sorting Enabled**
✅ **Query Highlighting Active**

---

## 📋 Prerequisites
- Python 3.11+
- Node.js 18+
- Dependencies already installed (requirements.txt, package.json)

---

## 🎯 Running the System

### Terminal 1: Start Backend (FastAPI)
```bash
cd "e:\6th SEM Data\Projects\WILDAI_NLP_GENAI"
.\venv\Scripts\python.exe -m uvicorn src.wildai_pipeline.api:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

### Terminal 2: Start Frontend (React + Vite)
```bash
cd "e:\6th SEM Data\Projects\WILDAI_NLP_GENAI\frontend"
npm run dev
```

**Expected Output:**
```
VITE v5.0.0  ready in 123 ms
➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Access the Application
Open your browser to: **http://localhost:5173**

---

## ✨ New Features to Try

### 1. Year-Sorted Results
- Query: "What are the latest wildlife policies?"
- Result: Newest policies (2026, 2025, 2024...) appear first
- Badge: 📅 Year shown on each policy

### 2. Query Highlighting
- Enter any multi-word query
- Watch keywords highlight in **yellow/amber** in results
- Example: "Tiger conservation policy" highlights all three words

### 3. Team Page
- Click "👥 Team" in navbar
- See 3 team member cards with avatars
- Scroll down for project statistics:
  - 364 Documents
  - 2.089 GB Corpus
  - 206,529 Chunks
  - 34 Categories
  - 1960-2026 Year Coverage
  - 21 Data Sources

### 4. Policy Filtering
- Filter by Year: Try "2023"
- Filter by Category: Try "policy"
- Filter by Source: Try "India"
- Combine filters for precise searches

---

## 🧪 Test Queries

### Query 1: Tiger Conservation
```
Q: "What are the latest tiger conservation strategies in India?"
Expected: 
- Results sorted by year (2024, 2023, 2022...)
- Year badges (📅) display
- "Tiger", "conservation", "strategies" highlighted in yellow
```

### Query 2: Biodiversity Protection
```
Q: "What international treaties protect biodiversity?"
Expected:
- Shows CITES, Ramsar, CBD documents
- Documents from 1971-2006
- International sources highlighted
```

### Query 3: Climate & Wetlands
```
Q: "How do forests and wetlands help climate change mitigation?"
Expected:
- Mix of policy and scientific docs
- Multiple year ranges
- Various source types (government, international, research)
```

### Query 4: Community Engagement
```
Q: "How can local communities participate in wildlife conservation?"
Expected:
- Results from community programs
- Multiple policy documents
- Local and national approaches mixed
```

---

## 🔍 Corpus Highlights

### High-Authority Sources Included
✅ National Wildlife Action Plan (2002-2031, 2017-2031)
✅ Wildlife Protection Act (1972 - full text)
✅ Forest Rights Act (2006 - full implementation)
✅ Project Tiger, Project Elephant, Rhino Strategy
✅ CITES & Ramsar Conventions (full texts)
✅ State policies (Karnataka, MP, Uttarakhand)
✅ Protected area management plans (Kaziranga, Sundarbans)
✅ 364 documents across 34 categories
✅ Temporal coverage: 1960-2026 (66+ years)

---

## 🎨 UI Features

### Right-Side Panel (Research Console)
- Title, query input, filters
- Category dropdown (Policy, Species, Ecosystems, Legal)
- Source dropdown (India, Global, etc.)
- Year input field
- Top K slider (1-8 results)
- Primary button: "Run RAG Search"
- Secondary button: "Load Example"

### Left-Side Panel (Results)
- Answer synthesis at the top
- Retrieved sources below with:
  - Category badge (green)
  - Year badge (orange) 📅
  - Relevance score (%)
  - Document title
  - Excerpt with keyword highlighting
  - Source, type, external link info
  - Tags (first 4 + counter for more)

### Navigation Bar
- Sticky at top
- WILDAI logo on left
- Two nav buttons: "🏠 Research Console" | "👥 Team"
- Active state shows green highlight

---

## 📊 Index Statistics

**FAISS Index:**
- Size: 605.1 MB
- Chunks: 206,529
- Embedding Model: sentence-transformers/all-mpnet-base-v2
- Dimensions: 768-d vectors
- Backend: FAISS with AVX2 support

**Dataset:**
- Total Size: 2.089 GB (2,139.6 MB)
- Documents: 364
- Metadata Complete: 98.9% (360/364)
- Categories: 34
- Sources: 21
- Temporal Span: 1960-2026

---

## ⚡ Performance Notes

### First Run
- Index rebuild: ~30-60 seconds (depends on GPU/CPU)
- First query: ~2-5 seconds (model loading + inference)
- Subsequent queries: ~1-2 seconds

### Optimization Tips
- Check "Status" metric in top-right (should be "ok")
- Check "Index" metric (should be "ready")
- If index not ready, click "Rebuild FAISS Index" button
- CUDA not required (works on CPU with AVX2)

---

## 🐛 Troubleshooting

### "Backend query failed" Error
1. Check backend terminal for errors
2. Verify backend is running on port 8000
3. Try refreshing the page
4. Click "Rebuild FAISS Index" button

### No Results Returned
1. Try without filters (set to default)
2. Try a shorter, simpler query
3. Check Year field is empty (not a specific year)
4. Click "Load Example" for a working query

### Slow Performance
1. First query is slower (model loads)
2. Subsequent queries are faster
3. Increase Top K value = slightly slower
4. Reduce Top K value = faster

### Index Not Ready
1. Click "Rebuild FAISS Index" button
2. Wait for completion (~60 seconds)
3. Status should change to "ready"

---

## 📡 API Endpoints

### Health Check
```
GET http://localhost:8000/api/health

Response:
{
  "status": "ok",
  "index_ready": true
}
```

### Run Query
```
POST http://localhost:8000/api/query

Request:
{
  "query": "What policies protect wildlife?",
  "top_k": 4,
  "category": "policy",
  "source": "India",
  "year": 2023
}

Response:
{
  "query": "...",
  "answer": "...",
  "total_hits": 4,
  "hits": [...]
}
```

### Rebuild Index
```
POST http://localhost:8000/api/index/rebuild

Response:
{
  "total_documents": 364,
  "total_chunks": 206529,
  "index_path": "..."
}
```

---

## 🎓 What You're Looking At

This is a **Retrieval-Augmented Generation (RAG)** system for wildlife conservation:

1. **Frontend** (React + Vite)
   - Beautiful research console interface
   - Real-time query execution
   - Result sorting by policy year
   - Query keyword highlighting

2. **Backend** (FastAPI)
   - Query processing and embedding
   - FAISS vector search (semantic)
   - Result ranking and filtering
   - Answer synthesis from top results

3. **Knowledge Base** (FAISS + 2GB Corpus)
   - 364 high-authority wildlife documents
   - Government policies, legal acts, treaties
   - Indexed as 206,529 semantic chunks
   - 66+ years of temporal coverage (1960-2026)

4. **Semantic Search**
   - Questions answered by finding similar documents
   - Not keyword-based, but meaning-based
   - Uses sentence-transformers embeddings (768-d)
   - Ranks results by relevance score

---

## 📞 Support

All errors have been fixed:
- ✅ RAGEngine `.retrieve()` → `.search()` (Fixed)
- ✅ Team page with 3 placeholders (Added)
- ✅ Multi-page navigation (Added)
- ✅ Year sorting for policies (Added)
- ✅ Query highlighting like PDF (Added)

System is **production-ready** for demonstrations!

---

**Last Updated:** April 4, 2026
**Corpus Version:** v4.1 (2.089 GB)
**System Status:** ✅ Operational
