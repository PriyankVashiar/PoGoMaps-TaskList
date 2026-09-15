# Route optimization parameters (WI-10)

This document describes the Web Worker pipeline in `worker.js`: geofence → hexagonal clustering → TSP construction → local search.

## Message contract (`postMessage` → worker)

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `points` | `{lat,lng,name}[]` | required | Matched Pokéstops (+ optional start) |
| `city` | string | `"nyc"` | Key into `CITY_CONFIGS` (`nyc`, `uk`, `sg`, `syd`, `vc`) |
| `isCustom` | boolean | `false` | If true, skip hex clustering; fix start at index `0` |
| `timeLimitMs` | number | `8000` | Wall-clock budget for NN + 2-opt + Or-opt across starts |
| `minPointsPerHex` | number | `3` | Hex must contain at least this many stops to be “active” |
| `minActiveNeighbors` | number | `2` | Active hex needs this many active neighbors |
| `hexGrid` | object | — | Optional override of grid origin / size |

## City grid (`CITY_CONFIGS`)

Each city defines:

- **`hexSizeMeters`** — initial hex radius used for axial binning (adjusted dynamically).
- **`bbox`** — closed ring of `[lng, lat]` vertices. Used as a **polygon geofence** (WI-12): points outside the ring are dropped before binning. Rings are currently rectangular but the filter is general (ray casting).

Grid origin is the SW corner of the ring’s axis-aligned bounds; `refLat` is the mid-latitude for planar scaling.

## Hex pipeline (non-custom routes)

1. **Geofence** — keep points inside the city polygon.
2. **Bin** — project to meters relative to origin; map to axial hex `(q,r)`.
3. **Active hexes** — ≥ `minPointsPerHex` stops and ≥ `minActiveNeighbors` active neighbors.
4. **Largest component** — BFS on the hex adjacency graph; keep the biggest connected set.
5. **Representatives / starts (WI-11)** — for each kept hex, choose the stop **closest to the hex’s geographic centroid** (deterministic). That index is a TSP seed; all stops in the component remain in the tour set.
6. **Size steering** — if the resulting tour length (stop count) is outside **71…250**, adjust `hexSizeMeters` (+200 if too few, −100 if too many) and retry until the size is acceptable, the budget is exhausted, or sizes repeat. Fallback: route whose count is closest to **250**.

Custom start mode skips steps 1–6 clustering and forces start index `0`.

## TSP construction

1. **Nearest-neighbor** from each candidate start index.
2. **Local search** until the per-start deadline:
   - **2-opt** edge swaps
   - **Or-opt** segment relocates for segment lengths 1–3
3. Keep the shortest route among starts that finish within `timeLimitMs`.

Distances use a local equirectangular projection (`METERS_PER_LAT` / `METERS_PER_LNG`).

## Frontend defaults (`script.js`)

Generate Route currently posts:

```js
{
  points, city: city.cityKey, isCustom,
  timeLimitMs: 8000
}
```

Override worker knobs by extending that payload if needed.

## Reproducibility

With WI-11, identical input points + city + parameters yield the same hex representatives and start index set (modulo floating-point). Wall-clock cutoffs can still change which local-search improvements finish in time on a busy machine.
