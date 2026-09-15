# 🗺️ [Pokémon GO Quest Route Generator](https://priyankvashiar.github.io/PoGoMaps-TaskList/)

An automated web application and background scraper that extracts daily Pokémon GO Field Research quests across major cities, filters them by custom criteria, and calculates optimized `.gpx` routes for GPS joystick navigation.

---

## ✨ Features

* 🎯 **Granular Quest Filtering**
  * **Items**: Poké Balls, Berries, Rare Candies, Poffins, Mega Energy, etc.
  * **Stardust**: Filter by specific stardust reward tiers.
  * **Encounters**: Filter by target Pokémon encounter rewards.
  * **Task Conditions**: Matches exact quest conditions (e.g., *"Make 3 Great Throws in a row"*).
  * **Filter Presets**: Save and load custom filter combinations using `localStorage`.

* ⚡ **High-Performance TSP & Cluster Optimization**
  * **Explicit $O(1)$ Geofence Bounds**: Fast coordinate bounding box filtering eliminates unnecessary point-in-polygon checks.
  * **Zero-Allocation Axial Hex Binning**: Maps spatial points to axial coordinates using 32-bit integer keys to eliminate string memory allocations and garbage collection pauses.
  * **Connected Component Clustering**: Retains dense, walkable PokéStop clusters by extracting the largest connected component from active hex grids.
  * **Pre-Computed Distance Matrix**: Pre-calculates an $N \times N$ `Float64Array` distance matrix for instant $O(1)$ distance lookups during local search passes.
  * **Index-Based Local Search**: Runs 2-Opt (edge uncrossing) and Or-Opt (1–3 node segment relocations) on raw `Int32Array` index arrays for fast execution.
  * **Auto-Tuning Density**: Automatically scales hex cell size to hit optimal route point counts (~70 to 250 points).

* 📍 **Custom Starting Point Support**
  * Anchor route calculations to specific user coordinates (`lat, lng`) for direct start-from-current-position routing.

* 🧵 **Non-Blocking UI**
  * All distance matrix construction, hex binning, and local search routines are offloaded to a background Web Worker (`worker.js`).

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
│       └── run_scraper.yml        # Daily automated scraper workflow
├── assets/
│   ├── icons/                     # Small set of item icons (local)
│   └── pokeapi-official-artwork/  # Not vendored — loaded via CDN
├── JSON/
│   ├── archive/                   # Dated quest snapshots (scraper retention)
│   ├── Quest_List.json
│   ├── pokedex.json
│   └── <city>_quests.json
├── index.html
├── script.js
├── worker.js                      # High-performance matrix & local search solver
├── map_scraper.py
└── requirements.txt
```

### Artwork (CDN)

Pokémon encounter images are loaded directly from the [PokeAPI sprites](https://github.com/PokeAPI/sprites) CDN:

`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png`

Item icons are served locally under `assets/icons/`.

---

## ⚙️ How It Works

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  map_scraper.py  │───>│  <city>_quests   │───>│    script.js     │───>│    worker.js     │───> Download
│ (Pulls Map Data) │    │      (.json)     │    │  (Filters Items) │    │(Matrix + 2-Opt)  │     (.gpx)
└──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

1. **Scrape**: `map_scraper.py` queries live map endpoints for active Pokéstops, parses active rewards/conditions, and outputs `JSON/<city_slug>_quests.json`.
2. **Select**: Users load the web UI, choose city locations, apply task/reward filters (or load saved presets), and optionally input custom start coordinates.
3. **Optimize**: Upon clicking **Generate Route**, matching points pass to `worker.js`, which:
   * Projects lat/lng to 2D planar vectors (meters).
   * Bins points into axial hex cells using 32-bit integer keys.
   * Extracts the largest connected component of active hexes.
   * Constructs a symmetric $N \times N$ `Float64Array` distance matrix.
   * Solves TSP using Multi-Start Nearest Neighbor followed by 2-Opt and Or-Opt local search passes.
4. **Export**: Formats the final sequence into an XML `.gpx` route file and triggers browser download.

---

## 💻 Local Development

### 1. Web Application
Serve the root directory with any HTTP static file server:

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

Dated copies are stored under `JSON/archive/YYYY-MM-DD/` (7-day retention).

---

## 🚀 GitHub Actions Automation

Automated daily scraping is powered by `.github/workflows/run_scraper.yml`.

* **Schedules**: Runs automatically at staggered intervals throughout the day to mirror regional quest resets.
* **Manual Triggers**: Can be executed on demand via the **Actions** tab on GitHub using `workflow_dispatch`.

---

## 🙌 Special Thanks

* **Map Creators**: `nycpokemap.com`, `sgpokemap.com`, `sydneypogomap.com`, `vanpokemap.com`, and `londonpogomap.com` for public map endpoints.
* **[PokeAPI/sprites](https://github.com/PokeAPI/sprites)**: High-quality Pokémon artwork.
* **[Purukitto/pokemon-data.json](https://github.com/Purukitto/pokemon-data.json)**: Pokédex data structure and mappings.
* **[dextel2](https://github.com/dextel2)**: Contribution to this project