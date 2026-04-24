# Project Update Log

## 2026-04-24

### Frontend UI and Navigation
- Initialized shadcn scaffold for frontend usage by adding `frontend/components.json`.
- Added path alias support (`@/*`) in:
  - `frontend/tsconfig.json`
  - `frontend/vite.config.ts`
- Added helper utility file `frontend/src/lib/utils.ts`.
- Implemented custom Dock navigation component:
  - `frontend/src/components/ui/dock.tsx`
- Replaced old Team/Research navbar buttons with Dock-based navigation and status block in:
  - `frontend/src/App.tsx`
- Added Dock and navbar styling updates in:
  - `frontend/src/styles.css`

### Team Section Enhancements
- Integrated Chroma Grid into Team page:
  - `frontend/src/components/ChromaGrid.tsx`
  - `frontend/src/components/ChromaGrid.css`
  - `frontend/src/App.tsx`
- Added team members and details:
  - L Moryakantha (1RV24AI406, lmoryakantha.ai24@rvce.edu.in)
  - Vineet Raj (1RV23AI132, vineetraj.ai23@rvce.edu.in)
  - Srihari S (1RV23AI106, sriharis.ai23@rvce.edu.in)
- Wired local team photos from `frontend/public`:
  - `/Morya.jpeg`
  - `/Vineet.jpeg`
  - `/Srihari.jpeg`
- Added extra Team panel spacing and stats panel padding tweaks to improve layout and border spacing.

### Query UX Improvements
- Converted "Top example queries" from a long vertical chip list to a compact dropdown selector with apply action and preview text in:
  - `frontend/src/App.tsx`
  - `frontend/src/styles.css`

### Answer Panel and Export Improvements
- Improved visual differentiation between answer heading and body text with typography and panel styling updates in:
  - `frontend/src/styles.css`
- Added `Download Summary` action in answer panel:
  - `frontend/src/App.tsx`
- Upgraded exported report from plain text to structured markdown (`.md`) including:
  - Query
  - Answer Summary
  - Retrieval Summary
  - References section generated from retrieved hits

### Highlighting and Regex Logic (Frontend + Backend)
- Replaced fragile frontend query regex highlighting with term-safe highlighting using escaped regex terms:
  - `frontend/src/App.tsx`
- Added backend highlight term extraction pipeline with safer tokenization, dedupe, and stopword filtering:
  - `src/wildai_pipeline/api.py`
- Extended API response model to include `highlight_terms`:
  - `src/wildai_pipeline/schemas.py`
- Updated frontend response type and rendering to use backend-provided `highlight_terms` for snippet highlighting.

### Dependencies Added
- Installed frontend dependency:
  - `gsap`

### Validation Runs Completed
- Multiple frontend builds executed successfully:
  - `npm run build` in `frontend`
- Backend syntax checks passed:
  - `python -m py_compile src/wildai_pipeline/api.py src/wildai_pipeline/schemas.py`

### Documentation/Reporting Output Added During Chat
- Provided an updated tools and techniques table (analysis tools, project tech stack, latest RAG/model direction, regex pipeline).

