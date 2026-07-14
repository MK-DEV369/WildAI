import sys
import os
import requests

# Set PYTHONPATH to 'src' so that imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from fastapi.testclient import TestClient
from wildai_pipeline.api import app

client = TestClient(app)

def test_clipdrop_generation():
    print("Sending post request to /api/generate_ai_image...")
    payload = {"prompt": "A small cute tiger cub playing in the grass"}
    response = client.post("/api/generate_ai_image", json=payload)
    print("Status code:", response.status_code)
    try:
        data = response.json()
        if "image_base64" in data:
            print("Success! image_base64 is present in response.")
            print("Base64 preview:", data["image_base64"][:100])
            print("Credits remaining:", data.get("credits_remaining"))
        else:
            print("Error: No image_base64 in response.", data)
    except Exception as e:
        print("Failed to parse json:", e)
        print("Raw response:", response.text)

if __name__ == "__main__":
    test_clipdrop_generation()
