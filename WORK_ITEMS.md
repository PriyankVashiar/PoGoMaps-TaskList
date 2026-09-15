# Work Items / Improvement Backlog

**Status legend:** ✅ Done (this branch) · 🔲 Open

---

## P0 — Quick wins / bugs

### WI-01 — Fix undefined `handleDonate` ✅
### WI-02 — Consistent Generate-button / Worker cleanup ✅

---

## P1 — Reliability & data pipeline

### WI-03 — Scraper resilience ✅
### WI-04 — Multi-city Quest_List schema updates ✅
### WI-05 — Quest data history / archive ✅

---

## P2 — Size, performance, and assets

### WI-06 — Reduce repo / GitHub Pages size (Pokémon artwork) ✅

---

## P3 — Frontend structure & UX

### WI-07 — Frontend hygiene ✅

- Status banner (`#status-bar`) for loading / success / errors
- `addEventListener` for city, Generate, Donate (no inline onclick)
- ARIA on multiselects and accordions; Enter/Space/Escape keyboard support

### WI-08 — Matched-stops preview ✅

- After filtering: status shows matched Pokéstop count + sample names
- After optimization: status shows optimized stop count and download confirmation

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
| WI-15–20 | Product / polish ideas | 🔲 |

---

*Branch `improvements/p0-p1-fixes` implements WI-01 through WI-08.*
