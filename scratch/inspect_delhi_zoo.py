import json
from pathlib import Path

chunks_path = Path("output/rag_chunks.json")
if chunks_path.exists():
    print("Chunks file exists!")
    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    
    print(f"Total chunks in JSON: {len(chunks)}")
    
    # Let's search for "Delhi Zoo" in the title
    delhi_zoo_chunks = [c for c in chunks if "delhi zoo" in c.get("title", "").lower()]
    print(f"Found {len(delhi_zoo_chunks)} chunks for Delhi Zoo:")
    for idx, c in enumerate(delhi_zoo_chunks[:3]):
        print(f"\nChunk {idx+1}:")
        print(f"  Title: {c.get('title')}")
        print(f"  Source: {c.get('source')}")
        print(f"  Category: {c.get('category')}")
        print(f"  URL: {c.get('url')}")
        print(f"  Extra: {c.get('extra')}")
else:
    print("Chunks file does not exist at output/rag_chunks.json")
