import os
import json
import math
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(BASE_DIR, "..", "JSON")
GPX_DIR = os.path.join(BASE_DIR, "..", "GPX")

def ensure_gpx_dir():
    os.makedirs(GPX_DIR, exist_ok=True)

def load_current_quests():
    today_str = datetime.now().strftime("%Y-%m-%d")
    json_path = os.path.join(JSON_DIR, f"quests_{today_str}.json")
    
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Active quests file not found: {json_path}")
        
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f).get("quests", []), today_str

def filter_quests(quests, filter_inputs):
    """
    filter_inputs format: ["level1,level2,level3,conditions_string"]
    e.g. ["7,366,1,Make 3 Great Throws", "3,0,1000,Catch 10 Pokemon"]
    """
    # Parse filter inputs into a set of tuples for fast matching
    active_filters = set()
    for item in filter_inputs:
        parts = [p.strip() for p in item.split(",", 3)]
        if len(parts) == 4:
            active_filters.add(tuple(parts))

    matched_coords = []
    
    for q in quests:
        l1 = str(q.get("rewards_types", "")).strip()
        l2 = str(q.get("rewards_ids", "0")).strip()
        l3 = str(q.get("rewards_amounts", "0")).strip()
        cond = str(q.get("conditions_string", "")).strip()
        
        # Check against active filters
        if (l1, l2, l3, cond) in active_filters:
            lat = float(q["lat"])
            lng = float(q["lng"])
            name = q.get("name", "Pokestop")
            matched_coords.append({"lat": lat, "lng": lng, "name": name})

    return matched_coords

# --- 2-OPT Optimization Logic ---

def haversine_distance(p1, p2):
    """Calculates distance between two lat/lng coordinates in meters."""
    R = 6371000  # Radius of Earth in meters
    phi1, phi2 = math.radians(p1['lat']), math.radians(p2['lat'])
    dphi = math.radians(p2['lat'] - p1['lat'])
    dlambda = math.radians(p2['lng'] - p1['lng'])

    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_total_distance(route):
    return sum(haversine_distance(route[i], route[i + 1]) for i in range(len(route) - 1))

def two_opt_optimize(points):
    """Applies the 2-Opt algorithm to optimize route sequence."""
    if len(points) <= 3:
        return points

    best_route = list(points)
    best_distance = calculate_total_distance(best_route)
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best_route) - 2):
            for j in range(i + 1, len(best_route)):
                if j - i == 1:
                    continue
                
                # Perform 2-opt swap
                new_route = best_route[:i] + best_route[i:j+1][::-1] + best_route[j+1:]
                new_distance = calculate_total_distance(new_route)

                if new_distance < best_distance:
                    best_route = new_route
                    best_distance = new_distance
                    improved = True

    return best_route

# --- GPX Generator ---

def export_gpx(coords, date_str):
    gpx = ET.Element("gpx", version="1.1", creator="PoGo-Route-Optimizer")
    trk = ET.SubElement(gpx, "trk")
    name = ET.SubElement(trk, "name")
    name.text = f"Optimized Quests Route {date_str}"
    trkseg = ET.SubElement(trk, "trkseg")

    for pt in coords:
        trkpt = ET.SubElement(trkseg, "trkpt", lat=str(pt['lat']), lon=str(pt['lng']))
        pt_name = ET.SubElement(trkpt, "name")
        pt_name.text = pt['name']

    # Prettify XML string
    xml_str = minidom.parseString(ET.tostring(gpx, 'utf-8')).toprettyxml(indent="  ")
    
    out_filename = f"{date_str}_sorted.gpx"
    out_path = os.path.join(GPX_DIR, out_filename)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(xml_str)

    print(f"Successfully generated GPX route: {out_path}")

def generate_route(filter_inputs):
    ensure_gpx_dir()
    quests, date_str = load_current_quests()
    
    matched_coords = filter_quests(quests, filter_inputs)
    print(f"Matched {len(matched_coords)} stops based on input filters.")

    if not matched_coords:
        print("No stops matched the selection. Skipping GPX creation.")
        return

    print("Running 2-Opt optimization...")
    optimized_coords = two_opt_optimize(matched_coords)
    
    export_gpx(optimized_coords, date_str)

if __name__ == "__main__":
    # Example Input Array
    sample_filters = [
        "3,0,1000,Catch 8 Pokémon"
    ]
    
    generate_route(sample_filters)