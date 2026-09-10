# 🗺️ Pokémon GO Quest Route Generator

An automated web application and background scraper that extracts daily Pokémon GO Field Research quests across major cities, filters them by custom criteria, and calculates optimized `.gpx` routes for GPS joystick navigation.

---

## ✨ Features

* 🎯 **Granular Quest Filtering**
  * **Items**: Poké Balls, Berries, Rare Candies, Poffins, Mega Energy, etc.
  * **Stardust**: Filter by specific stardust reward tiers.
  * **Encounters**: Filter by target Pokémon encounter rewards.
  * **Task Conditions**: Matches exact quest conditions (e.g., *"Make 3 Great Throws in a row"*).

* ⚡ **2-Opt Route Optimization**
  * **Geofence Validation**: Filters out Pokéstops outside official city bounding polygons.
  * **Planar Projection**: Translates geographic coordinates to 2D planar vectors for rapid distance math.
  * **Cluster Filtering**: Isolates dense PokéStop clusters to maximize efficiency.
  * **2-Opt TSP Solver**: Solves the Traveling Salesperson Problem via nearest-neighbor heuristics and 2-Opt path uncrossing.

* 🧵 **Non-Blocking UI**
  * Heavy distance calculations and route optimizations are offloaded to a background Web Worker (`worker.js`) to keep the interface smooth and responsive.

* 🤖 **Automated Scraping**
  * GitHub Actions automatically scrapes regional map data, formats payloads into standardized JSON, and updates the repository prior to local quest resets.

* 📱 **GPS Joystick Compatible**
  * Downloads standardized `.gpx` files containing `<rte>` and `<rtept>` tags, structured for direct import into GPS spoofing and routing software.

---

## 📂 Project Structure

```text
PoGoMaps-TaskList/
├── .github/
│   └── workflows/
│       └── run_scraper.yml    # Daily automated scraper workflow
├── assets/                    # Item icons & official Pokémon artwork
├── JSON/
│   ├── Quest_List.json        # Global quest categories & condition schema
│   ├── pokedex.json           # ID-to-English Pokémon name map
│   └── <city>_quests.json     # Daily city-specific quest datasets
├── index.html                 # Main interface and card layouts
├── script.js                  # UI logic, fetch handlers, and GPX builder
├── worker.js                  # Web Worker for geofencing & 2-Opt TSP optimization
├── map_scraper.py             # Python scraper for fetching regional map payloads
└── requirements.txt           # Python dependencies for scraper
```

---

## ⚙️ How It Works

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  map_scraper.py  │───>│  <city>_quests   │───>│    script.js     │───>│    worker.js     │───> Download
│ (Pulls Map Data) │    │      (.json)     │    │  (Filters Items) │    │  (2-Opt TSP Path)│     (.gpx)
└──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

1. **Scrape**: `map_scraper.py` queries live map endpoints for active Pokéstops, parses active rewards and conditions, and dumps structured data to `JSON/<city_slug>_quests.json`.
2. **Select**: Users load the web interface and select desired rewards or task conditions via multi-select dropdowns.
3. **Optimize**: Upon clicking **Generate & Download GPX**, matched coordinates are sent to `worker.js`. The worker eliminates out-of-bounds nodes, removes isolated points, and runs a 2-Opt TSP solver.
4. **Export**: An XML-formatted `.gpx` file containing the optimized sequence of Pokéstops is generated and downloaded to your browser.

---

## 💻 Local Development

### 1. Web Application
No build step or backend server is required. Serve the root directory with any HTTP static file server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .
```

Open `http://localhost:8000` in your web browser.

### 2. Running the Scraper Manually

```bash
# Install required Python packages
pip install -r requirements.txt

# Run scraper for a specific city (e.g., Sydney)
python map_scraper.py syd

# Run scraper for all supported cities
python map_scraper.py all
```

---

## 🚀 GitHub Actions Automation

Automated daily scraping is powered by `.github/workflows/run_scraper.yml`. 

* **Schedules**: Runs automatically at staggered intervals throughout the day to mirror regional quest resets.
* **Manual Triggers**: Can be executed on demand via the **Actions** tab on GitHub using the `workflow_dispatch` trigger to update quest data for specific cities at any time.

---

## 🙌 Special Thanks

* **Map Creators**: Creators of `nycpokemap.com`, `sgpokemap.com`, `sydneypogomap.com`, `vanpokemap.com`, and `londonpogomap.com` for providing public map endpoints and data feeds.
* **[PokeAPI/sprites](https://github.com/PokeAPI/sprites)**: For providing high-quality Pokémon artwork and item icons.
* **[Purukitto/pokemon-data.json](https://github.com/Purukitto/pokemon-data.json)**: For providing the Pokédex data structure and mappings.
``░