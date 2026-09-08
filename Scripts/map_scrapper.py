import os
import json
import requests
from datetime import datetime

# Configuration
BASE_URL = "https://nycpokemap.com/quests.php"
JSON_DIR = os.path.join(os.path.dirname(__file__), "..", "JSON")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://nycpokemap.com/"
}

def ensure_json_dir():
    os.makedirs(JSON_DIR, exist_ok=True)

def step1_fetch_filters():
    print("Step 1: Fetching initial filters & initializing Quest_List.json...")
    params = {
        "quests[]": "7,0,113",
        "time": int(datetime.now().timestamp() * 1000)
    }
    
    response = requests.get(BASE_URL, params=params, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    
    filters = data.get("filters", {})
    categories_to_keep = ["t2", "t3", "t7", "t12"]
    
    quest_list = {"categories": {}}

    for cat_key in categories_to_keep:
        clean_cat = cat_key.replace("t", "")
        quest_list["categories"][clean_cat] = {}

        if cat_key in filters and isinstance(filters[cat_key], list):
            if clean_cat == "3":
                # For t3 (Stardust): level1 -> "0" -> { level2_amount: [] }
                quest_list["categories"][clean_cat]["0"] = {}
                for amount in filters[cat_key]:
                    quest_list["categories"][clean_cat]["0"][str(amount)] = []
            else:
                # For t2, t7, t12: level1 -> level2_id -> {}
                for reward_id in filters[cat_key]:
                    quest_list["categories"][clean_cat][str(reward_id)] = {}

    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    with open(quest_list_path, "w", encoding="utf-8") as f:
        json.dump(quest_list, f, indent=2, ensure_ascii=False)
    
    print(f"Initialized: {quest_list_path}")
    return quest_list

def step2_fetch_current_quests(quest_list_structure):
    print("Step 2: Fetching active quest coordinates...")
    quest_params = []
    categories = quest_list_structure["categories"]

    for category, items in categories.items():
        if category == "3":
            # For t3 (Stardust): "3, amount, 0"
            for stardust_amount in items.get("0", {}).keys():
                quest_params.append(f"{category},{stardust_amount},0")
        else:
            # For t2, t7, t12: "category, 0, reward_id"
            for reward_id in items.keys():
                quest_params.append(f"{category},0,{reward_id}")

    payload = [("quests[]", param) for param in quest_params]
    payload.append(("time", int(datetime.now().timestamp() * 1000)))

    response = requests.get(BASE_URL, params=payload, headers=HEADERS)
    response.raise_for_status()
    response.encoding = 'utf-8'
    
    current_quests_data = response.json()

    today_str = datetime.now().strftime("%Y-%m-%d")
    out_filename = f"quests_{today_str}.json"
    out_path = os.path.join(JSON_DIR, out_filename)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(current_quests_data, f, indent=2, ensure_ascii=False)

    print(f"Saved: {out_path}")
    return current_quests_data

def step3_populate_quest_list(quest_list_structure, current_quests_data):
    print("Step 3: Populating Quest_List.json with amounts and conditions...")
    categories = quest_list_structure["categories"]
    quests = current_quests_data.get("quests", [])

    for q in quests:
        cat = str(q.get("rewards_types", ""))
        reward_id = str(q.get("rewards_ids", "0"))
        amount = str(q.get("rewards_amounts", "0"))
        condition = q.get("conditions_string", "").strip()

        if not cat or not condition:
            continue

        # Map to category structure
        if cat in categories:
            if cat == "3":
                # Stardust format: "3" -> "0" -> amount -> [conditions]
                stardust_dict = categories["3"].setdefault("0", {})
                if amount not in stardust_dict or isinstance(stardust_dict[amount], dict):
                    stardust_dict[amount] = []
                if condition not in stardust_dict[amount]:
                    stardust_dict[amount].append(condition)
            else:
                # Other format: cat -> reward_id -> amount -> [conditions]
                reward_dict = categories[cat].setdefault(reward_id, {})
                
                # If reward_dict was initialized as empty dict {}, prepare amount key as array
                if amount not in reward_dict:
                    reward_dict[amount] = []
                elif not isinstance(reward_dict[amount], list):
                    reward_dict[amount] = []

                if condition not in reward_dict[amount]:
                    reward_dict[amount].append(condition)

    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    with open(quest_list_path, "w", encoding="utf-8") as f:
        json.dump(quest_list_structure, f, indent=2, ensure_ascii=False)

    print(f"Updated with conditions: {quest_list_path}")

def main():
    try:
        ensure_json_dir()
        quest_list = step1_fetch_filters()
        current_quests = step2_fetch_current_quests(quest_list)
        step3_populate_quest_list(quest_list, current_quests)
        print("Pipeline finished successfully!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()