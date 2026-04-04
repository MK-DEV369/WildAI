from __future__ import annotations

from io import BytesIO
from pathlib import Path

from .cleaning import clean_text


def extract_pdf_text(pdf_path: str | Path) -> str:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("PyMuPDF is required for PDF extraction") from exc

    document = fitz.open(str(pdf_path))
    parts: list[str] = []
    for page in document:
        parts.append(str(page.get_text("text")))
    document.close()
    return clean_text("\n".join(parts))


def extract_pdf_text_from_bytes(pdf_bytes: bytes) -> str:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("PyMuPDF is required for PDF extraction") from exc

    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    parts: list[str] = []
    for page in document:
        parts.append(str(page.get_text("text")))
    document.close()
    return clean_text("\n".join(parts))


def extract_image_text(image_path: str | Path) -> str:
    try:
        from PIL import Image  # type: ignore
        import pytesseract  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("Pillow and pytesseract are required for OCR") from exc

    image = Image.open(str(image_path))
    text = pytesseract.image_to_string(image)
    return clean_text(text)


def extract_image_text_from_bytes(image_bytes: bytes) -> str:
    try:
        from PIL import Image  # type: ignore
        import pytesseract  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("Pillow and pytesseract are required for OCR") from exc

    image = Image.open(BytesIO(image_bytes))
    text = pytesseract.image_to_string(image)
    return clean_text(text)


def extract_html_text(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("beautifulsoup4 is required for HTML parsing") from exc

    soup = BeautifulSoup(html, "lxml")
    for element in soup(["script", "style", "noscript"]):
        element.decompose()
    return clean_text(soup.get_text(" "))
