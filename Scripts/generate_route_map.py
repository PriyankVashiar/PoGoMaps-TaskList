import json
import math
import os
import folium

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
JSON_FILE = os.path.join(ROOT_DIR, "JSON", "response.json")
OUTPUT_HTML = os.path.join(ROOT_DIR, "index.html")

MANHATTAN_BOUNDS = {
    "min_lat": 40.700,
    "max_lat": 40.880,
    "min_lng": -74.020,
    "max_lng": -73.910
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

def generate_map():
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found.")
        return

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    quests = data.get("quests", [])

    # Filter Criteria
    target_type = "3"
    target_amount = "1500"
    target_condition = "make 3 great curveball throws in a row"

    filtered = []
    for q in quests:
        lat = float(q.get("lat", 0))
        lng = float(q.get("lng", 0))
        cond = q.get("conditions_string", "").lower()

        if (in_manhattan(lat, lng) and 
            str(q.get("rewards_types")) == target_type and
            str(q.get("rewards_amounts")) == target_amount and
            target_condition in cond):
            
            filtered.append({
                "name": q.get("name"),
                "lat": lat,
                "lng": lng,
                "reward": q.get("rewards_string"),
                "condition": q.get("conditions_string")
            })

    print(f"Retained {len(filtered)} matching quests in Manhattan.")

    if not filtered:
        print("No matching quests found. Skipped index.html generation.")
        return

    optimized_route = two_opt(filtered)
    total_km = calculate_total_distance(optimized_route)

    # Initialize Folium Map
    m = folium.Map(location=[40.7831, -73.9712], zoom_start=13)

    route_coords = []
    for idx, pt in enumerate(optimized_route, start=1):
        coord = [pt["lat"], pt["lng"]]
        route_coords.append(coord)

        popup_html = (f"<b>#{idx}: {pt['name']}</b><br>"
                      f"<b>Task:</b> {pt['condition']}<br>"
                      f"<b>Reward:</b> {pt['reward']}")

        folium.Marker(
            location=coord,
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=f"#{idx}: {pt['name']}",
            icon=folium.Icon(color="blue", icon="info-sign")
        ).add_to(m)

    folium.PolyLine(
        locations=route_coords,
        color="#007bff",
        weight=4,
        opacity=0.8,
        tooltip=f"Total Distance: {total_km:.2f} km"
    ).add_to(m)

    m.save(OUTPUT_HTML)
    print(f"Generated map at '{OUTPUT_HTML}' ({total_km:.2f} km total).")

if __name__ == "__main__":
    generate_map()