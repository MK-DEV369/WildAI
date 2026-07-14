import requests
from bs4 import BeautifulSoup
import urllib.parse
import logging

logger = logging.getLogger(__name__)

def search_wikipedia(query: str, max_results: int = 2) -> list[dict]:
    """Search Wikipedia and return page titles and extracts."""
    results = []
    headers = {"User-Agent": "WILDAI-SearchFallback/1.0"}
    search_url = "https://en.wikipedia.org/w/api.php"
    
    # 1. Search for pages
    search_params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "utf8": 1
    }
    try:
        r = requests.get(search_url, params=search_params, headers=headers, timeout=8)
        if r.ok:
            search_data = r.json()
            search_items = search_data.get("query", {}).get("search", [])
            for item in search_items[:max_results]:
                title = item.get("title")
                page_id = item.get("pageid")
                # 2. Get extract for the page
                extract_params = {
                    "action": "query",
                    "prop": "extracts",
                    "exintro": 1,
                    "explaintext": 1,
                    "pageids": page_id,
                    "format": "json"
                }
                er = requests.get(search_url, params=extract_params, headers=headers, timeout=8)
                if er.ok:
                    page_data = er.json().get("query", {}).get("pages", {}).get(str(page_id), {})
                    extract = page_data.get("extract", "")
                    if len(extract) > 100:
                        results.append({
                            "title": title,
                            "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}",
                            "text": extract
                        })
    except Exception as e:
        logger.error(f"Wikipedia search failed: {e}")
    return results

def scrape_webpage(url: str) -> str:
    """Fetch a webpage and return its cleaned text content."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.ok:
            soup = BeautifulSoup(r.content, "html.parser")
            for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                script.decompose()
            text = soup.get_text(separator=" ")
            cleaned = " ".join(text.split())
            return cleaned[:3000] # Return first 3000 characters
    except Exception as e:
        logger.error(f"Failed to scrape webpage {url}: {e}")
    return ""

def search_duckduckgo(query: str, max_results: int = 3) -> list[dict]:
    """Search DuckDuckGo HTML and return links with scraped content."""
    results = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    encoded_query = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.ok:
            soup = BeautifulSoup(r.content, "html.parser")
            result_body = soup.find_all("div", class_="result__body")
            for body in result_body[:max_results]:
                title_elem = body.find("a", class_="result__a")
                snippet_elem = body.find("a", class_="result__snippet")
                if title_elem:
                    href = title_elem.get("href")
                    # Handle DDG redirect links
                    parsed_href = urllib.parse.urlparse(href)
                    if parsed_href.netloc == "duckduckgo.com" and "uddg=" in parsed_href.query:
                        qs = urllib.parse.parse_qs(parsed_href.query)
                        actual_url = qs.get("uddg", [None])[0]
                    else:
                        actual_url = href
                        
                    if actual_url and actual_url.startswith("http"):
                        title = title_elem.text.strip()
                        snippet = snippet_elem.text.strip() if snippet_elem else ""
                        # Scrape actual webpage text
                        full_text = scrape_webpage(actual_url)
                        text_content = full_text if len(full_text) > 150 else snippet
                        if len(text_content) > 50:
                            results.append({
                                "title": title,
                                "url": actual_url,
                                "text": text_content
                            })
    except Exception as e:
        logger.error(f"DuckDuckGo search failed: {e}")
    return results

def get_dynamic_web_hits(query: str) -> list[dict]:
    """Search Wikipedia and DuckDuckGo and compile dynamic search hits."""
    raw_hits = []
    
    # Simplify query to extract core keywords for search engines
    q_clean = query.lower()
    fillers = [
        "what are the", "what are", "how to save them by", "how to save", "by 2030", "found in",
        "tell me the history of", "history of", "analyze the", "provisions on", "tell me",
        "and its", "and how to", "how to", "provisions of", "provisions on", "provisions related to",
        "some of the", "some of", "any of the", "any of", "provisions of the"
    ]
    for f in fillers:
        q_clean = q_clean.replace(f, "")
    q_clean = " ".join(q_clean.split())
    if not q_clean:
        q_clean = query

    # 1. Try Wikipedia
    wiki_results = search_wikipedia(q_clean, max_results=2)
    for res in wiki_results:
        raw_hits.append(res)
        
    # 2. Try DuckDuckGo
    ddg_results = search_duckduckgo(q_clean, max_results=3)
    for res in ddg_results:
        # Avoid duplicates
        if not any(h["url"] == res["url"] for h in raw_hits):
            raw_hits.append(res)
            
    # 3. Format as RAG hits
    hits = []
    for idx, hit in enumerate(raw_hits):
        import re
        # Try to extract year from text/title, default to 2026
        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", hit["title"] + " " + hit["text"][:100])
        year = int(year_match.group(1)) if year_match else 2026
        
        hits.append({
            "score": 0.85 - (idx * 0.05), # artificial relevance scores
            "chunk_id": f"web-{idx}-{hash(hit['url']) % 100000}",
            "title": hit["title"],
            "year": year,
            "category": "environmental-policy" if "policy" in query.lower() else "web-reference",
            "source": "Web Search (Live)",
            "document_type": "webpage",
            "url": hit["url"],
            "text": hit["text"],
            "tags": ["live", "web-scraped"],
            "extra": {
                "source_path": "",
                "record_index": 0,
            }
        })
    return hits
