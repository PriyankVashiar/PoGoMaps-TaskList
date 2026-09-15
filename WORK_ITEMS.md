# Work Items / Improvement Backlog

Derived from a full codebase analysis of the Pokémon GO Quest Route Generator.
Issues are currently **disabled** on this repository; this file tracks the recommended work until Issues (or a Project board) can be enabled.

**Suggested priority order** appears first. Each item includes context, acceptance criteria, and related files.

---

## P0 — Quick wins / bugs

### WI-01 — Fix undefined `handleDonate` (runtime error)

**Type:** Bug  
**Priority:** High

The Donate button in `index.html` calls `handleDonate()`, but the function is never defined in `script.js`. Clicking it throws a JavaScript error.

**Options:**
1. Implement a real handler (open Ko-fi / PayPal / GitHub Sponsors in a new tab), or
2. Remove the button until a donation channel exists.

**Suggested implementation:**
```js
function handleDonate() {
  window.open('https://ko-fi.com/YOUR_USERNAME', '_blank', 'noopener,noreferrer');
}
window.handleDonate = handleDonate;
```
Prefer moving from inline `onclick` to `addEventListener` when touching this area.

**Related files:** `index.html`, `script.js`

**Acceptance criteria:**
- [ ] Button no longer throws.
- [ ] Either opens a valid donation URL or is removed from the UI.

---

### WI-02 — Consistent Generate-button / Worker cleanup on all error paths

**Type:** Bug / UX  
**Priority:** High

Some early-return and error paths in `handleRouteGeneration` leave the button disabled or the Worker unterminated in edge cases. Audit every branch (fetch failure, zero matches, worker error, custom-start validation failure) and ensure `resetButton()` + `worker.terminate()` always run (prefer a single `finally`).

**Related files:** `script.js`

**Acceptance criteria:**
- [ ] Button always returns to enabled “Generate Route” state after success or any failure.
- [ ] Worker is always terminated.

---

## P1 — Reliability & data pipeline

### WI-03 — Scraper resilience: retries, exit codes, logging

**Type:** Enhancement  
**Priority:** High

`map_scraper.py` uses a single broad `try/except` that only prints the error. Transient network failures or rate limits fail the whole run with little signal to Actions.

**Work:**
- Add retries with exponential backoff on `requests.get` (manual loop or `tenacity`).
- Exit non-zero on unrecoverable errors so GitHub Actions marks the job failed.
- Structured logging (city, timestamp, error context).
- Optional: validate required keys / basic shape before overwriting city JSON.

**Related files:** `map_scraper.py`, `.github/workflows/run_scraper.yml`, `requirements.txt`

**Acceptance criteria:**
- [ ] Transient failures are retried (configurable max attempts).
- [ ] Unrecoverable failures produce non-zero exit code.
- [ ] Happy-path scrape for all cities still works.

---

### WI-04 — Multi-city aware Quest_List schema updates (stop Sydney-only pruning)

**Type:** Enhancement / Correctness  
**Priority:** High

`fetch_sydney_filters()` + `update_quest_list_structure()` drive pruning of `Quest_List.json` from Sydney only. Other cities can expose different active rewards; valid options for NYC / Singapore / etc. can be silently dropped.

**Work:**
- Merge filter sets from all cities (or at least from the cities being scraped in that run).
- Document the intended source-of-truth for the master list.

**Related files:** `map_scraper.py`, `JSON/Quest_List.json`

**Acceptance criteria:**
- [ ] Master list is not pruned solely from Sydney data.
- [ ] Active rewards present in any supported city remain available in the UI schema.

---

### WI-05 — Optional quest data history / archive

**Type:** Enhancement  
**Priority:** Medium

City quest JSON files are overwritten in place. There is no history of previous days.

**Work (optional):**
- Date-stamped copies under `JSON/archive/YYYY-MM-DD/` (or similar), with a retention policy (e.g. last 7 days).
- Or a simple “previous day” file kept alongside the current one.

**Related files:** `map_scraper.py`, `JSON/`

---

## P2 — Size, performance, and assets

### WI-06 — Reduce repo / GitHub Pages size (Pokémon artwork)

**Type:** Tech debt / Performance  
**Priority:** High

`assets/pokeapi-official-artwork/` ships thousands of high-resolution PNGs. This bloats clones, CI, and Pages bandwidth. Most users only need artwork for Pokémon that appear in current quests.

**Options:**
1. Load from a public CDN (PokeAPI sprites) with lazy loading + existing `onerror` fallback.
2. Keep only IDs present in `Quest_List.json` / city files; regenerate the subset when the master list changes.
3. Convert remaining local assets to WebP / lower resolution if local hosting is required.
4. Git LFS (less ideal for Pages).

**Related files:** `assets/pokeapi-official-artwork/`, `script.js`, `JSON/Quest_List.json`

**Acceptance criteria:**
- [ ] Repository size is materially smaller (or artwork is no longer committed).
- [ ] Encounter icons still render for active quest Pokémon.
- [ ] Missing artwork degrades gracefully.

---

## P3 — Frontend structure & UX

### WI-07 — Frontend hygiene: modules, event binding, status UI, a11y

**Type:** Refactor / UX  
**Priority:** Medium

**Current issues:**
- Functions attached to `window`; inline `onclick` handlers.
- Errors and progress almost exclusively via `alert()`.
- Custom multiselects / accordions lack ARIA and keyboard support.

**Work:**
1. Wrap logic in an IIFE or ES module; minimize globals.
2. Bind events with `addEventListener` in `init()`.
3. Add an inline status banner / toast for loading, optimizing, zero matches, and errors.
4. Basic ARIA (`aria-expanded`, `aria-haspopup`, focus management) for dropdowns and accordions.

**Related files:** `index.html`, `script.js`, `style.css`

**Acceptance criteria:**
- [ ] Primary interactions work without inline HTML handlers.
- [ ] User-visible feedback for loading / empty / error states without relying solely on `alert()`.
- [ ] Keyboard-operable filter controls (basic).

---

### WI-08 — Matched-stops preview before GPX download

**Type:** Feature  
**Priority:** Medium

After filtering and before (or after) optimization, show a short summary: count of matched stops, and optionally a simple list or rough map. Reduces “surprise” empty or huge routes.

**Related files:** `script.js`, `index.html`, `style.css`

---

### WI-09 — Filter presets (localStorage)

**Type:** Feature  
**Priority:** Low–Medium

Allow saving / loading named sets of checked conditions so frequent combinations (e.g. “Rare Candy + Stardust 1000+”) are one click.

**Related files:** `script.js`

---

## P4 — Route optimization improvements

### WI-10 — Document and optionally expose clustering / TSP parameters

**Type:** Docs / Enhancement  
**Priority:** Medium

Magic numbers in `worker.js` (`minPointsPerHex=3`, `minActiveNeighbors=2`, target ~71–250 points, hex size steps) drive behavior but are undocumented and hard-coded.

**Work:**
- Document rationale in README or a short `docs/routing.md`.
- Optionally expose a few parameters in the UI or via query string for power users.

**Related files:** `worker.js`, `README.md`

---

### WI-11 — Deterministic start selection inside hexes

**Type:** Enhancement  
**Priority:** Low–Medium

Random point selection inside each active hex makes routes non-reproducible. Prefer centroid, densest point, or a seeded RNG.

**Related files:** `worker.js`

---

### WI-12 — True polygonal geofences (replace simple bboxes)

**Type:** Enhancement  
**Priority:** Low–Medium

City configs use axis-aligned bounding boxes. Stops near borders can be incorrectly included or excluded. Prefer GeoJSON polygons (or simplified city outlines) and a point-in-polygon check.

**Related files:** `worker.js`

---

## P5 — Tooling, tests, CI

### WI-13 — Add basic tests and linting

**Type:** Tech debt  
**Priority:** Medium

No automated tests or lint config today.

**Suggested:**
- Python: `pytest` for scraper parsing / structure helpers; `ruff` or `black`.
- JS: unit tests for pure helpers (filter key building, GPX fragment generation, hex math if extracted); ESLint + Prettier (or Standard).
- Minimal CI job that runs lint + tests on push/PR.

**Related files:** new test dirs, `requirements.txt`, workflow files

---

### WI-14 — Harden GitHub Actions scraper workflow

**Type:** Enhancement  
**Priority:** Medium

**Improvements:**
- Cache pip dependencies.
- Fail the job clearly when the scraper exits non-zero (depends on WI-03).
- Optional validation step that checks JSON parses and has expected top-level keys.
- Consider staggered schedules already partially described in README; keep `workflow_dispatch` flexible.

**Related files:** `.github/workflows/run_scraper.yml`

---

## P6 — Product / longer-term ideas

| ID | Title | Notes |
|----|--------|--------|
| WI-15 | Light theme toggle | Dark AMOLED theme is strong; optional light theme for daytime use |
| WI-16 | CSV / GeoJSON export in addition to GPX | |
| WI-17 | Multi-city or custom region support | |
| WI-18 | PWA + offline cache of today’s JSON | |
| WI-19 | Countdown UI polish | Dedicated badge instead of appending to title; more frequent tick |
| WI-20 | Document ToS / scraping etiquette | Polite User-Agent, rate limits, thanks to map maintainers already present |

---

## How to use this backlog

1. **Enable Issues** on the repository (Settings → General → Features → Issues) if you want native GitHub issues and Project boards.
2. Until then, treat this file as the source of truth; open PRs that reference `WI-XX` in the title or description.
3. When Issues are enabled, these items can be copied into individual issues and this file can become a living roadmap or be retired.

---

*Generated from analysis of the codebase (scraper, frontend, worker, Actions, assets).*
