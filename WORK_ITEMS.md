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

**Done in:** `improvements/p0-p1-fixes`

- Encounter icons load from PokeAPI official-artwork CDN (`getPokemonArtworkUrl` in `script.js`)
- `loading="lazy"` + `onerror` hide for missing images
- `.gitignore` blocks `assets/pokeapi-official-artwork/`
- README + folder README document CDN and `git rm --cached` to drop tracked PNGs

**Follow-up (manual):** run `git rm -r --cached assets/pokeapi-official-artwork` (keep README if desired) so existing blobs stop being checked out. Full history rewrite is optional for max size savings.

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
| WI-15–20 | Product / polish ideas | 🔲 |

---

*Branch `improvements/p0-p1-fixes` implements WI-01 through WI-06.*
