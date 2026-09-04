import os
import json
from datetime import date

# Get the directory where this script lives (/PoGoMaps-TaskList/Scripts)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Move up one level to the project root (/PoGoMaps-TaskList)
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

def transform_quests(input_file_path, output_file_path):
    # Ensure the output directory exists
    output_dir = os.path.dirname(output_file_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Load source JSON data
    with open(input_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    transformed = {"categories": {}}

    # Process each quest entry
    for quest in data.get("quests", []):
        reward_type = str(quest.get("rewards_types"))
        reward_id = str(quest.get("rewards_ids"))
        reward_amount = str(quest.get("rewards_amounts"))
        condition = quest.get("conditions_string")

        # Skip incomplete entries
        if not all([reward_type, reward_id, reward_amount, condition]):
            continue

        # Build nested structure
        categories = transformed["categories"]
        if reward_type not in categories:
            categories[reward_type] = {}
        
        type_group = categories[reward_type]
        if reward_id not in type_group:
            type_group[reward_id] = {}
            
        id_group = type_group[reward_id]
        if reward_amount not in id_group:
            id_group[reward_amount] = []

        # Append condition without duplicates
        if condition not in id_group[reward_amount]:
            id_group[reward_amount].append(condition)

    # Save to output JSON file
    with open(output_file_path, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # Get current date in YYYY-MM-DD format
    today_str = date.today().strftime('%Y-%m-%d')
    input_filename = f"quests_{today_str}.json"

    # Points to /PoGoMaps-TaskList/JSON/quests_YYYY-MM-DD.json
    input_path = os.path.join(PROJECT_ROOT, 'JSON', input_filename)
    
    # Points to /PoGoMaps-TaskList/JSON/response.json
    output_path = os.path.join(PROJECT_ROOT, 'JSON', 'response.json')

    transform_quests(input_path, output_path)