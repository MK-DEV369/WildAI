from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
VENV_SITES = ROOT / "venv" / "Lib" / "site-packages"

if VENV_SITES.exists() and str(VENV_SITES) not in sys.path:
    sys.path.insert(0, str(VENV_SITES))

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


import uvicorn


if __name__ == "__main__":
    uvicorn.run("wildai_pipeline.api:app", host="127.0.0.1", port=8000, reload=True)
