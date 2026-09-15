# Work Items / Improvement Backlog

Derived from a full codebase analysis of the Pokémon GO Quest Route Generator.

**Status legend:** ✅ Done (this branch) · 🔲 Open

---

## P0 — Quick wins / bugs

### WI-01 — Fix undefined `handleDonate` (runtime error) ✅

**Done in:** `improvements/p0-p1-fixes`

Implemented `handleDonate()` with a configurable `DONATE_URL` (defaults to the upstream repository). Maintainer can point it at Ko-fi / Sponsors later.

### WI-02 — Consistent Generate-button / Worker cleanup ✅

**Done in:** `improvements/p0-p1-fixes`

Refactored `handleRouteGeneration` to use async/await around the Worker, a single `finally` that always terminates the worker and resets the button, and `URL.revokeObjectURL` after download.

---

## P1 — Reliability & data pipeline

### WI-03 — Scraper resilience: retries, exit codes, logging ✅

**Done in:** `improvements/p0-p1-fixes`

- `request_with_retries` with exponential backoff
- Structured logging
- Non-zero exit codes on failure (Actions-friendly)
- Minimal payload validation before writing city JSON

### WI-04 — Multi-city aware Quest_List schema updates ✅

**Done in:** `improvements/p0-p1-fixes`

Master list structure is now built from the **union** of filter keys across all configured cities, not Sydney alone.

### WI-05 — Optional quest data history / archive 🔲

Date-stamped archives under `JSON/archive/` with retention — still open.

---

## P2 — Size, performance, and assets

### WI-06 — Reduce repo / GitHub Pages size (Pokémon artwork) 🔲

CDN or prune to active encounter IDs.

---

## P3 — Frontend structure & UX

### WI-07 — Frontend hygiene: modules, event binding, status UI, a11y 🔲
### WI-08 — Matched-stops preview before GPX download 🔲
### WI-09 — Filter presets (localStorage) 🔲

---

## P4 — Route optimization improvements

### WI-10 — Document and optionally expose clustering / TSP parameters 🔲
### WI-11 — Deterministic start selection inside hexes 🔲
### WI-12 — True polygonal geofences 🔲

---

## P5 — Tooling, tests, CI

### WI-13 — Add basic tests and linting 🔲
### WI-14 — Harden GitHub Actions scraper workflow 🔲

(Partial benefit from WI-03 exit codes already.)

---

## P6 — Product / longer-term ideas

| ID | Title | Status |
|----|--------|--------|
| WI-15 | Light theme toggle | 🔲 |
| WI-16 | CSV / GeoJSON export | 🔲 |
| WI-17 | Multi-city / custom region | 🔲 |
| WI-18 | PWA + offline cache | 🔲 |
| WI-19 | Countdown UI polish | 🔲 |
| WI-20 | Document ToS / scraping etiquette | 🔲 |

---

*Branch `improvements/p0-p1-fixes` implements WI-01 through WI-04.*
