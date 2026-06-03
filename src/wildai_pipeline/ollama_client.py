"""Simple adapter to call a local Ollama model via HTTP or CLI as a fallback.

This module provides `generate(prompt, model, timeout)` which returns the model
text or raises RuntimeError on failure. It first attempts the local Ollama HTTP
API at http://localhost:11434/api/generate and, if unavailable, falls back to
calling the `ollama` CLI if present on PATH.
"""
from __future__ import annotations

import json
import subprocess
from typing import Optional, Sequence

try:
    import requests
except Exception:  # pragma: no cover - runtime environment may not have requests
    requests = None  # type: ignore


DEFAULT_CHAT_MODELS: tuple[str, ...] = ("llama3.2:3b",)


def _call_http_api(prompt: str, model: str = "ollama", timeout: int = 30) -> Optional[str]:
    if requests is None:
        return None
    url = f"http://localhost:11434/api/generate"
    payload = {"model": model, "prompt": prompt, "max_tokens": 1024}
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        r.raise_for_status()
        # Ollama may return JSON or plain text depending on server; attempt JSON
        try:
            data = r.json()
            # common fields: 'text' or 'completion' or 'result'
            if isinstance(data, dict):
                for key in ("text", "completion", "result", "output"):
                    if key in data and isinstance(data[key], str):
                        return data[key]
                # sometimes the API returns {'choices':[{'text':..}]}
                if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
                    first = data["choices"][0]
                    if isinstance(first, dict) and "text" in first:
                        return first["text"]
            # fallback: return raw text
            return r.text
        except Exception:
            return r.text
    except Exception:
        return None


def _call_cli(prompt: str, model: str = "ollama", timeout: int = 30) -> Optional[str]:
    # Use the `ollama` CLI if available: `ollama generate <model> --prompt '<prompt>'`
    try:
        cmd = ["ollama", "generate", model, "--json", "--prompt", prompt]
        # ensure proper quoting on Windows via list form
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if proc.returncode != 0:
            return None
        out = proc.stdout.strip()
        # try to parse json
        try:
            data = json.loads(out)
            if isinstance(data, dict):
                for key in ("text", "completion", "result", "output"):
                    if key in data and isinstance(data[key], str):
                        return data[key]
                if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
                    first = data["choices"][0]
                    if isinstance(first, dict) and "text" in first:
                        return first["text"]
            return out
        except Exception:
            return out
    except Exception:
        return None


def generate(prompt: str, model: str = "llama3.2:3b", timeout: int = 30) -> str:
    """Generate text from the local Ollama model.

    Tries HTTP API then CLI. Raises RuntimeError if both are unavailable.
    """
    candidate_models = [model]
    for fallback_model in DEFAULT_CHAT_MODELS:
        if fallback_model not in candidate_models:
            candidate_models.append(fallback_model)

    for candidate in candidate_models:
        out = _call_http_api(prompt, model=candidate, timeout=timeout)
        if out:
            return out

        out = _call_cli(prompt, model=candidate, timeout=timeout)
        if out:
            return out

    raise RuntimeError("Unable to contact local Ollama instance (HTTP or CLI)")
