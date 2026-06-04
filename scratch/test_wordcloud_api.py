import requests

url = "http://127.0.0.1:8000/api/analytics/wordcloud_image"
params = {
    "q": "tiger conservation strategies",
    "top_n": 80
}

try:
    response = requests.get(url, params=params)
    print("Status Code:", response.status_code)
    print("Content-Type:", response.headers.get("Content-Type"))
    print("Byte size of image:", len(response.content))
except Exception as e:
    print("Error:", e)
