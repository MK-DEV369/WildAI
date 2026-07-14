import os
import requests
import json
from pathlib import Path
import time

SPECIES_LIST = [
    "King cobra", "Cobra", "Anaconda", "Python", "Viper", "Black mamba", "Rattlesnake", 
    "Lion", "Leopard", "Cheetah", "Jaguar", "Puma", "Cougar", "Lynx", "Ocelot", "Bobcat", "Caracal",
    "Gray wolf", "Red fox", "Dhole", "Coyote", "Jackal", "Fennec fox", "African wild dog",
    "Brown bear", "Grizzly bear", "Polar bear", "Sun bear",
    "Red panda", "Raccoon", "Meerkat", "Mongoose", "Civet", "Badger", "Wolverine", "Otter", "Sea otter",
    "African forest elephant", "Black rhinoceros", "White rhinoceros",
    "Pygmy hippopotamus", "Masai giraffe", "Okapi",
    "Plains zebra", "Mountain zebra", "Grevy's zebra",
    "Wild boar", "Warthog",
    "Kangaroo", "Wombat", "Tasmanian devil", "Sugar glider", "Opossum",
    "Chimpanzee", "Gorilla", "Orangutan", "Gibbon", "Baboon", "Mandrill", "Ring-tailed lemur",
    "Platypus", "Echidna",
    "Bald eagle", "Golden eagle", "Peregrine falcon", "Osprey", "Barn owl", "Great horned owl", "Snowy owl",
    "Emperor penguin", "King penguin", "Adélie penguin", "Chinstrap penguin", "Gentoo penguin",
    "Blue whale", "Humpback whale", "Killer whale", "Beluga whale", "Narwhal", "Bottlenose dolphin", "Harbor porpoise",
    "California sea lion", "Harbor seal", "Elephant seal", "Walrus",
    "West Indian manatee", "Dugong",
    "Komodo dragon", "Green iguana", "Gila monster", "Chameleon",
    "Green sea turtle", "Leatherback sea turtle", "Galapagos tortoise",
    "Saltwater crocodile", "Nile crocodile", "American alligator", "Gharial",
    "Great white shark", "Hammerhead shark", "Whale shark", "Tiger shark", "Manta ray",
    "Koala", "Wombat"
]

def download_image(url, save_path):
    headers = {
        "User-Agent": "WildAIApp/1.0 (contact@wildai.org)"
    }
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(r.content)
            return True
    except Exception as e:
        print(f"Failed to download from {url}: {e}")
    return False

def main():
    dest_dir = Path("data/dataset/images/species")
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Starting downloads of species images to {dest_dir.resolve()}")
    
    downloaded_count = 0
    for species in SPECIES_LIST:
        filename = species.lower().replace(" ", "-").replace("'", "") + ".jpg"
        save_path = dest_dir / filename
        
        if save_path.exists():
            print(f"Skipping {species} (already exists)")
            continue
            
        print(f"Fetching image URL for {species}...")
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "prop": "pageimages",
            "format": "json",
            "piprop": "original",
            "titles": species
        }
        headers = {
            "User-Agent": "WildAIApp/1.0 (contact@wildai.org)"
        }
        
        try:
            r = requests.get(url, params=params, headers=headers, timeout=10)
            if r.status_code == 200:
                data = r.json()
                pages = data.get("query", {}).get("pages", {})
                image_url = None
                for page_id, page in pages.items():
                    if "original" in page:
                        image_url = page['original']['source']
                        break
                
                if image_url:
                    print(f"Downloading {species} from {image_url}...")
                    if download_image(image_url, save_path):
                        print(f"Successfully saved {species} to {filename}")
                        downloaded_count += 1
                        time.sleep(0.5)  # Friendly rate-limiting
                    else:
                        print(f"Failed to download image for {species}")
                else:
                    print(f"No original image found on Wikipedia for {species}")
            else:
                print(f"Wikipedia query failed for {species} (status code {r.status_code})")
        except Exception as e:
            print(f"Error querying Wikipedia for {species}: {e}")
            
    print(f"Finished! Successfully downloaded {downloaded_count} new species images.")

if __name__ == "__main__":
    main()
