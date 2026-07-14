import os
import requests
import logging

logger = logging.getLogger(__name__)

def generate(prompt: str, model: str = "gemini-1.5-flash") -> str:
    """Generate content using the Gemini API.
    
    Looks for GEMINI_API_KEY or GOOGLE_API_KEY in the environment.
    Raises RuntimeError if no key is found or if the API call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Gemini API Key is not configured in the environment (GEMINI_API_KEY or GOOGLE_API_KEY)")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }
    headers = {"Content-Type": "application/json"}
    
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        
        # Parse standard Gemini API response structure
        candidates = data.get("candidates", [])
        if candidates:
            first_candidate = candidates[0]
            content = first_candidate.get("content", {})
            parts = content.get("parts", [])
            if parts:
                text = parts[0].get("text", "")
                if text:
                    return text
        raise RuntimeError("Invalid response structure received from Gemini API")
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        raise RuntimeError(f"Gemini API call failed: {e}")
