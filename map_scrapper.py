import os
import sys
import json
import glob
import requests
from datetime import datetime

# Configured city endpoints and file prefixes
CITIES = {
    "nyc": {"name": "New York", "url": "https://nycpokemap.com"},
    "vc": {"name": "Vancouver", "url": "https://vanpokemap.com"},
    "sg": {"name": "Singapore", "url": "https://sgpokemap.com"},
    "syd": {"name": "Sydney", "url": "https://sydneypogomap.com"},
    "uk": {"name": "London/UK", "url": "https://londonpogomap.com"}
}

JSON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "JSON")

def ensure_json_dir():
    os.makedirs(JSON_DIR, exist_ok=True)

def load_or_init_quest_list():
    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    if os.path.exists(quest_list_path):
        try:
            with open(quest_list_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"categories": {}}

def fetch_filters(city_config):
    base_url = f"{city_config['url']}/quests.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"{city_config['url']}/"
    }
    params = {
        "quests[]": "7,0,113",
        "time": int(datetime.now().timestamp() * 1000)
    }
    
    response = requests.get(base_url, params=params, headers=headers)
    response.raise_for_status()
    return response.json().get("filters", {})

def update_quest_list_structure(quest_list, filters):
    categories_to_keep = ["t2", "t3", "t7", "t12"]
    categories = quest_list.setdefault("categories", {})

    for cat_key in categories_to_keep:
        clean_cat = cat_key.replace("t", "")
        if clean_cat not in categories:
            categories[clean_cat] = {}

        if cat_key in filters and isinstance(filters[cat_key], list):
            if clean_cat == "3":
                stardust_dict = categories[clean_cat].setdefault("0", {})
                for amount in filters[cat_key]:
                    amount_str = str(amount)
                    if amount_str not in stardust_dict:
                        stardust_dict[amount_str] = []
            else:
                for reward_id in filters[cat_key]:
                    reward_str = str(reward_id)
                    if reward_str not in categories[clean_cat]:
                        categories[clean_cat][reward_str] = {}

def fetch_current_quests(city_key, city_config, quest_list):
    base_url = f"{city_config['url']}/quests.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"{city_config['url']}/"
    }

    quest_params = []
    categories = quest_list.get("categories", {})

    for category, items in categories.items():
        if category == "3":
            for stardust_amount in items.get("0", {}).keys():
                quest_params.append(f"{category},{stardust_amount},0")
        else:
            for reward_id in items.keys():
                quest_params.append(f"{category},0,{reward_id}")

    payload = [("quests[]", param) for param in quest_params]
    payload.append(("time", int(datetime.now().timestamp() * 1000)))

    response = requests.get(base_url, params=payload, headers=headers)
    response.raise_for_status()
    response.encoding = 'utf-8'
    current_quests_data = response.json()

    # Clean up previous daily files for this specific city
    for old_file in glob.glob(os.path.join(JSON_DIR, f"{city_key}_*.json")):
        try:
            os.remove(old_file)
        except OSError:
            pass

    today_str = datetime.now().strftime("%Y-%m-%d")
    out_filename = f"{city_key}_{today_str}.json"
    out_path = os.path.join(JSON_DIR, out_filename)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(current_quests_data, f, indent=2, ensure_ascii=False)

    print(f"Saved: {out_path}")
    return current_quests_data

def populate_quest_list(quest_list, current_quests_data):
    categories = quest_list.get("categories", {})
    quests = current_quests_data.get("quests", [])

    for q in quests:
        cat = str(q.get("rewards_types", ""))
        reward_id = str(q.get("rewards_ids", "0"))
        amount = str(q.get("rewards_amounts", "0"))
        condition = q.get("conditions_string", "").strip()

        if not cat or not condition:
            continue

        if cat in categories:
            if cat == "3":
                stardust_dict = categories["3"].setdefault("0", {})
                if amount not in stardust_dict or isinstance(stardust_dict[amount], dict):
                    stardust_dict[amount] = []
                if condition not in stardust_dict[amount]:
                    stardust_dict[amount].append(condition)
            else:
                reward_dict = categories[cat].setdefault(reward_id, {})
                if amount not in reward_dict or not isinstance(reward_dict[amount], list):
                    reward_dict[amount] = []

                if condition not in reward_dict[amount]:
                    reward_dict[amount].append(condition)

def scrape_city(city_key, quest_list):
    if city_key not in CITIES:
        print(f"Unknown city key: {city_key}")
        return

    city_config = CITIES[city_key]
    print(f"\n--- Scraping {city_config['name']} ({city_key}) ---")
    
    filters = fetch_filters(city_config)
    update_quest_list_structure(quest_list, filters)
    
    current_quests = fetch_current_quests(city_key, city_config, quest_list)
    populate_quest_list(quest_list, current_quests)

def main():
    try:
        ensure_json_dir()
        quest_list = load_or_init_quest_list()

        target = sys.argv[1].lower() if len(sys.argv) > 1 else "all"

        if target == "all":
            for city_key in CITIES.keys():
                scrape_city(city_key, quest_list)
        else:
            scrape_city(target, quest_list)

        quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
        with open(quest_list_path, "w", encoding="utf-8") as f:
            json.dump(quest_list, f, indent=2, ensure_ascii=False)

        print(f"\nUpdated Master List: {quest_list_path}")
        print("Pipeline finished successfully!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()