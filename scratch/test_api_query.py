import requests
import json

url = "http://127.0.0.1:8000/api/query"
payload = {
    "query": "What are the latest tiger conservation strategies in India?",
    "top_k": 4
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    print("Status Code:", response.status_code)
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error:", e)
