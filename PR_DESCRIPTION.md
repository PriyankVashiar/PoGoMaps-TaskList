# PR title

Reliability, UX, and asset improvements (WI-01–WI-08+)

# Body (copy below into https://github.com/PriyankVashiar/PoGoMaps-TaskList/pull/1 )

## Summary

This PR hardens the daily quest scraper, improves frontend reliability and accessibility, reduces repository weight by loading Pokémon artwork from CDN, and adds clearer user feedback during route generation. Changes live on branch `improvements/p0-p1-fixes` (fork: `dextel2/PoGoMaps-TaskList`).

Work is tracked in `WORK_ITEMS.md` on this branch.

---

## Motivation

| Problem | Impact |
|---------|--------|
| Donate button called undefined `handleDonate` | Broken UI control |
| Web Worker not always terminated | Possible leaked workers / stuck Generate button |
| Scraper network failures failed silently or weakly | Stale or missing city JSON on bad runs |
| `Quest_List.json` multi-city union incomplete | Filters could miss conditions present in only some cities |
| No historical quest snapshots | Hard to debug “what changed today” |
| Thousands of vendored official-artwork PNGs | Large clone / Pages payload |
| Errors only via `alert()` | Poor UX; no progress feedback |
| No matched-stop count before download | Users could not see how many stops matched filters |

---

## What changed

### P0 — Bugs (WI-01, WI-02)

- **WI-01:** Implemented `handleDonate()` and wired the Donate control. URL is configurable via `DONATE_URL` (points at the upstream repo until a formal donation channel exists).
- **WI-02:** Generate Route always resets the button and **terminates** the optimization Worker in a `finally` block (success, empty result, or error).

### P1 — Scraper & data (WI-03, WI-04, WI-05)

- **WI-03:** HTTP requests use retries with exponential backoff; scraper exits non-zero on hard failure so Actions can surface red runs.
- **WI-04:** Multi-city logic when building/updating `Quest_List.json` unions conditions across cities more consistently.
- **WI-05:** Optional archive under `JSON/archive/YYYY-MM-DD/` with **7-day retention** pruning so daily snapshots exist without unbounded growth.

### P2 — Assets (WI-06)

- Encounter icons load from the **PokeAPI sprites CDN** (`official-artwork/{id}.png`) via `getPokemonArtworkUrl()`.
- Form / costume IDs (e.g. `58-2792`) use the leading national-dex number.
- `loading="lazy"` + existing `onerror` hides missing art.
- **Item icons** remain local under `assets/icons/`.
- `.gitignore` blocks `assets/pokeapi-official-artwork/`; README documents CDN usage and how to `git rm --cached` any still-tracked PNGs.

> **Note for maintainers:** Code no longer depends on vendored artwork. To shrink the tree for clones, run `git rm -r --cached assets/pokeapi-official-artwork` (optionally keep the folder README) on this branch or after merge.

### P3 — Frontend UX (WI-07, WI-08)

- **WI-07:**
  - Status banner (`#status-bar`, `aria-live="polite"`) for loading / success / errors (most flows no longer rely only on `alert`).
  - City, Generate, and Donate bound with `addEventListener` (inline `onclick` removed).
  - ARIA on custom multiselects and accordions; Enter / Space / Escape keyboard support.
- **WI-08:** After matching filters, status shows **matched Pokéstop count** and a short name preview; after optimization, shows optimized stop count and GPX download confirmation.

### Later commits on the same branch (WI-09–WI-12)

See `WORK_ITEMS.md` / `ROUTING.md` as those land:

- **WI-09** Filter presets (localStorage save/load)
- **WI-10** Documented TSP / hex / time-budget parameters
- **WI-11** Deterministic hex start selection (no `Math.random`)
- **WI-12** Point-in-polygon geofence using city rings

---

## Files touched (high level)

| Area | Files |
|------|--------|
| UI | `index.html`, `style.css`, `script.js` |
| Routing worker | `worker.js` (WI-11–12), `ROUTING.md` (WI-10) |
| Scraper | `map_scraper.py` |
| Docs / tracking | `README.md`, `WORK_ITEMS.md`, `PR_DESCRIPTION.md`, `.gitignore` |
| Archive layout | `JSON/archive/` |

---

## How to test

1. **Static UI** — Serve the branch root (`python3 -m http.server 8000`) and open the app.
2. **Donate** — Button opens the configured URL in a new tab.
3. **Filters** — Load completes with a “Ready” status; accordion + multiselect keyboard behavior works.
4. **Route** — Select conditions → Generate:
   - Status shows fetch → matched count (+ preview) → optimize → download message.
   - GPX downloads; button returns to “Generate Route”.
5. **Artwork** — Encounter icons appear from CDN; broken IDs hide via `onerror`.
6. **Scraper** (optional) — `python map_scraper.py <city>` or `all`; check non-zero exit on forced failure; confirm `JSON/archive/` snapshots if enabled.

---

## Risk & compatibility

- **CDN dependency** for encounter art: requires network; failures degrade to no icon (same as before with missing local files).
- **Archive directory** may add small daily JSON under `JSON/archive/` (pruned after 7 days).
- **No intentional API or GPX schema break** for consumers of existing city JSON / GPX output.

---

## Credits

Built against the upstream project by [PriyankVashiar](https://github.com/PriyankVashiar/PoGoMaps-TaskList). Thanks to regional map operators and [PokeAPI/sprites](https://github.com/PokeAPI/sprites).
