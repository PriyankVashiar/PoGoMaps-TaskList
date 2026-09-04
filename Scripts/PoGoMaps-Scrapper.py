from datetime import datetime
import json
import os
import time
import requests

# Resolve root directory (/home/priyank/PoGoMaps-TaskList)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
JSON_DIR = os.path.join(ROOT_DIR, "JSON")

# Output files
static_json = os.path.join(JSON_DIR, "response.json")
date_str = datetime.now().strftime("%Y-%m-%d")
dated_json = os.path.join(JSON_DIR, f"quests_{date_str}.json")

API_URL = "https://nycpokemap.com/quests.php"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0",
    "Referer": "https://nycpokemap.com/quest.html",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Connection": "keep-alive"
}

PARAMS = {
    "time": int(time.time() * 1000),
    "quests[]": [
        "3,200,0", "3,500,0", "3,1000,0", "3,1500,0",
        "12,0,3", "12,0,6", "12,0,9", "12,0,15", "12,0,18", "12,0,254", "12,0,257", "12,0,260", "12,0,306", "12,0,310",
        "7,0,1", "7,0,4", "7,0,7", "7,0,19", "7,0,27", "7,0,35", "7,0,37", "7,0,39", "7,0,46", "7,0,50", "7,0,52",
        "7,0,54", "7,0,56", "7,0,58-2792", "7,0,58", "7,0,60", "7,0,61", "7,0,66", "7,0,67", "7,0,74", "7,0,77",
        "7,0,79-g", "7,0,79", "7,0,84", "7,0,93", "7,0,95", "7,0,103", "7,0,105", "7,0,117", "7,0,119", "7,0,121",
        "7,0,123", "7,0,125", "7,0,126", "7,0,129", "7,0,131", "7,0,133", "7,0,134", "7,0,135", "7,0,136", "7,0,138",
        "7,0,140", "7,0,142", "7,0,143", "7,0,147", "7,0,152", "7,0,155", "7,0,158", "7,0,164", "7,0,176", "7,0,183",
        "7,0,185", "7,0,191", "7,0,202", "7,0,206", "7,0,215", "7,0,216", "7,0,219", "7,0,221", "7,0,223", "7,0,226",
        "7,0,228", "7,0,246", "7,0,252", "7,0,255", "7,0,258", "7,0,263", "7,0,271", "7,0,274", "7,0,278", "7,0,280",
        "7,0,290", "7,0,296", "7,0,303", "7,0,304", "7,0,320", "7,0,326", "7,0,327", "7,0,328", "7,0,333", "7,0,343",
        "7,0,345", "7,0,347", "7,0,349", "7,0,356", "7,0,361", "7,0,364", "7,0,366", "7,0,371", "7,0,374", "7,0,375",
        "7,0,387", "7,0,390", "7,0,393", "7,0,397", "7,0,399", "7,0,404", "7,0,415", "7,0,427", "7,0,431", "7,0,434",
        "7,0,443", "7,0,444", "7,0,449", "7,0,453", "7,0,459", "7,0,495", "7,0,498", "7,0,501", "7,0,507", "7,0,510",
        "7,0,524", "7,0,531", "7,0,544", "7,0,546", "7,0,554", "7,0,562", "7,0,564", "7,0,566", "7,0,568", "7,0,580",
        "7,0,582", "7,0,587", "7,0,588", "7,0,597", "7,0,603", "7,0,605", "7,0,608", "7,0,610", "7,0,613", "7,0,616",
        "7,0,618", "7,0,650", "7,0,653", "7,0,656", "7,0,659", "7,0,660", "7,0,662", "7,0,667", "7,0,688", "7,0,692",
        "7,0,696", "7,0,698", "7,0,702", "7,0,704", "7,0,722", "7,0,725", "7,0,728", "7,0,732", "7,0,742", "7,0,747",
        "7,0,751", "7,0,759", "7,0,767", "7,0,810", "7,0,813", "7,0,816", "7,0,819", "7,0,827", "7,0,831", "7,0,906",
        "7,0,909", "7,0,912", "7,0,915", "7,0,917", "7,0,919", "7,0,921", "7,0,928", "7,0,932",
        "2,0,1", "2,0,2", "2,0,3", "2,0,701", "2,0,705", "2,0,706", "2,0,708", "2,0,709", "2,0,1301"
    ]
}

def fetch_and_save_json():
    print(f"[{datetime.now()}] Requesting live data from nycpokemap.com...")
    try:
        response = requests.get(API_URL, headers=HEADERS, params=PARAMS, timeout=15)
        response.raise_for_status()
        data = response.json()

        os.makedirs(JSON_DIR, exist_ok=True)

        # Save static response.json
        with open(static_json, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        # Save dated quests_YYYY-MM-DD.json
        with open(dated_json, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        print(f"Saved live JSON data to '{JSON_DIR}'")

    except Exception as e:
        print(f"Error fetching or saving data: {e}")

if __name__ == "__main__":
    fetch_and_save_json()