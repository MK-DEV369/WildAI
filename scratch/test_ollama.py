import requests
import json

def test():
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3.2:3b",
        "prompt": "Say hello in exactly 3 words.",
        "stream": False
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        print("Status Code:", r.status_code)
        print("Raw Content type:", r.headers.get("content-type"))
        print("Parsed JSON:")
        data = r.json()
        print(json.dumps(data, indent=2))
        print("Response text field:", data.get("response"))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
