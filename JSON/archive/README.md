# Quest data archive

Daily snapshots written by `map_scraper.py` (WI-05).

## Layout

```
JSON/archive/YYYY-MM-DD/
  <city>_quests.json
  Quest_List.json
```

Dates use **UTC**. Same-day re-runs overwrite that day's files.

## Retention

Folders older than `ARCHIVE_RETENTION_DAYS` (default 7) are deleted at the end of each successful scraper run.

## Note for GitHub Actions

The existing workflow already runs `git add JSON/`, which includes `archive/`. Expect larger commits on days when many cities scrape successfully.
