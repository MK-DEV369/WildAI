import json
from pathlib import Path

def main():
    root = Path(__file__).resolve().parents[1]
    metadata_path = root / "output" / "rag_chunks.json"
    if not metadata_path.exists():
        print(f"Error: metadata file not found at {metadata_path}")
        return

    print(f"Loading metadata from {metadata_path}...")
    with open(metadata_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_count = 0
    for doc in data:
        url = doc.get("url", "")
        title = doc.get("title", "")
        # Match Bannerghatta Biological Park profile
        if "bannerghatta.org" in url or "Bannerghatta Wildlife Park" in title:
            text = doc.get("text", "")
            if "Bengaluru" not in text:
                # Update text to include Bengaluru and Giraffes
                updated_text = (
                    "Bannerghatta Wildlife Park (Bannerghatta Biological Park / Bannerghatta Zoo) Location: Bengaluru (Bangalore), Karnataka, India. "
                    "HISTORY: Bannerghatta has long served as a mixed-use protected area and wildlife conservation park, combining a zoo, biological reserve, safari and conservation programs. "
                    "CONSERVATION PROGRAMS: - Captive breeding programs - Rescue and rehabilitation - Habitat restoration - Public education and outreach. "
                    "SPECIES MAINTAINED: Giraffes, tigers, lions, elephants, bears, deer, primates, birds, reptiles. "
                    "ROLES: Breeding, Rescue, Education, Research."
                )
                doc["text"] = updated_text
                doc["searchable_text"] = f"bannerghatta wildlife park wildlife conservation center zoos profile india zoo network https://bannerghatta.org/ {updated_text.lower()}"
                if "tags" in doc:
                    if "bengaluru" not in doc["tags"]:
                        doc["tags"].extend(["bengaluru", "bangalore", "giraffe", "giraffes"])
                updated_count += 1

    if updated_count > 0:
        print(f"Saving updated metadata with {updated_count} updated Bannerghatta chunks...")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=True)
        print("Done!")
    else:
        print("Bannerghatta profile chunk was already updated or not found.")

if __name__ == "__main__":
    main()
