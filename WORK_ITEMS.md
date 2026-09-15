# Work Items / Improvement Backlog

Derived from a full codebase analysis of the Pokémon GO Quest Route Generator.

**Status legend:** ✅ Done (this branch) · 🔲 Open

---

## P0 — Quick wins / bugs

### WI-01 — Fix undefined `handleDonate` (runtime error) ✅
### WI-02 — Consistent Generate-button / Worker cleanup ✅

---

## P1 — Reliability & data pipeline

### WI-03 — Scraper resilience: retries, exit codes, logging ✅
### WI-04 — Multi-city aware Quest_List schema updates ✅

### WI-05 — Optional quest data history / archive ✅

**Done in:** `improvements/p0-p1-fixes`

Layout:
```
JSON/archive/YYYY-MM-DD/
  nyc_quests.json
  vc_quests.json
  ...
  Quest_List.json
```

Behavior:
- Live files under `JSON/` remain the current snapshot used by the web app
- Each successful scrape also writes dated copies under `JSON/archive/YYYY-MM-DD/`
- On the first scrape of a new UTC day, the previous live file is preserved into that day folder before overwrite
- `prune_old_archives()` deletes dated folders older than `ARCHIVE_RETENTION_DAYS` (default **7**)
- Retention is configurable via `ARCHIVE_RETENTION_DAYS` in `map_scraper.py`

---

## P2 — Size, performance, and assets

### WI-06 — Reduce repo / GitHub Pages size (Pokémon artwork) 🔲

---

## P3 — Frontend structure & UX

### WI-07 — Frontend hygiene 🔲
### WI-08 — Matched-stops preview 🔲
### WI-09 — Filter presets 🔲

---

## P4 — Route optimization

### WI-10 — Document TSP parameters 🔲
### WI-11 — Deterministic hex starts 🔲
### WI-12 — Polygonal geofences 🔲

---

## P5 — Tooling, tests, CI

### WI-13 — Tests and linting 🔲
### WI-14 — Harden Actions workflow 🔲

---

## P6 — Longer-term

| ID | Title | Status |
|----|--------|--------|
| WI-15 | Light theme toggle | 🔲 |
| WI-16 | CSV / GeoJSON export | 🔲 |
| WI-17 | Multi-city / custom region | 🔲 |
| WI-18 | PWA + offline cache | 🔲 |
| WI-19 | Countdown UI polish | 🔲 |
| WI-20 | Document ToS / scraping etiquette | 🔲 |

---

*Branch `improvements/p0-p1-fixes` implements WI-01 through WI-05.*
