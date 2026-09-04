from datetime import datetime
import json
import math
import os
import random
import string

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
JSON_FILE = os.path.join(ROOT_DIR, "JSON", "response.json")
GPX_DIR = os.path.join(ROOT_DIR, "GPX")

MANHATTAN_BOUNDS = {
    "min_lat": 40.700, "max_lat": 40.880,
    "min_lng": -74.020, "max_lng": -73.910
}

def in_manhattan(lat, lng):
    return (MANHATTAN_BOUNDS["min_lat"] <= lat <= MANHATTAN_BOUNDS["max_lat"] and
            MANHATTAN_BOUNDS["min_lng"] <= lng <= MANHATTAN_BOUNDS["max_lng"])

def haversine(p1, p2):
    R = 6371.0
    dlat = math.radians(p2['lat'] - p1['lat'])
    dlng = math.radians(p2['lng'] - p1['lng'])
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(p1['lat'])) * math.cos(math.radians(p2['lat'])) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_total_distance(route):
    return sum(haversine(route[i], route[i + 1]) for i in range(len(route) - 1))

def two_opt(points):
    if len(points) <= 3:
        return points

    best_route = list(points)
    best_dist = calculate_total_distance(best_route)
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best_route) - 2):
            for j in range(i + 1, len(best_route) - 1):
                new_route = best_route[:i] + best_route[i:j + 1][::-1] + best_route[j + 1:]
                new_dist = calculate_total_distance(new_route)

                if new_dist < best_dist:
                    best_dist = new_dist
                    best_route = new_route
                    improved = True
    return best_route

def generate_gpx(target_type="3", target_amount="1500", target_id="0", target_condition="make 3 great curveball throws in a row"):
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found.")
        return None

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    quests = data.get("quests", [])
    filtered = []

    for q in quests:
        lat = float(q.get("lat", 0))
        lng = float(q.get("lng", 0))
        cond = q.get("conditions_string", "").lower()

        if (in_manhattan(lat, lng) and
            str(q.get("rewards_types")) == str(target_type) and
            str(q.get("rewards_amounts")) == str(target_amount) and
            str(q.get("rewards_ids")) == str(target_id) and
            target_condition.lower() in cond):
            
            filtered.append({
                "name": q.get("name"),
                "lat": lat,
                "lng": lng,
                "reward": q.get("rewards_string"),
                "condition": q.get("conditions_string")
            })

    print(f"Filtered {len(filtered)} matching quests in Manhattan.")

    if not filtered:
        print("No matching quests found. GPX generation skipped.")
        return None

    optimized_route = two_opt(filtered)
    total_km = calculate_total_distance(optimized_route)

    # Build GPX XML String
    gpx_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="PoGo-Task-Filter" xmlns="http://www.topografix.com/GPX/1/1">',
        '  <trk>',
        '    <name>Manhattan Quests Route</name>',
        '    <trkseg>'
    ]

    for pt in optimized_route:
        name_esc = pt['name'].replace('&', '&amp;')
        cond_esc = pt['condition'].replace('&', '&amp;')
        rew_esc = pt['reward'].replace('&', '&amp;')
        gpx_lines.append(f'      <trkpt lat="{pt["lat"]}" lon="{pt["lng"]}">')
        gpx_lines.append(f'        <name>{name_esc}</name>')
        gpx_lines.append(f'        <desc>Task: {cond_esc} | Reward: {rew_esc}</desc>')
        gpx_lines.append('      </trkpt>')

    gpx_lines.extend(['    </trkseg>', '  </trk>', '</gpx>'])

    # Save to GPX directory as YYYY-MM-DD_random.gpx
    os.makedirs(GPX_DIR, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    file_name = f"{date_str}_{rand_str}.gpx"
    file_path = os.path.join(GPX_DIR, file_name)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(gpx_lines))

    print(f"Successfully generated GPX: '{file_path}' ({total_km:.2f} km total).")
    return file_name

if __name__ == "__main__":
    generate_gpx()