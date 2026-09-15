#!/usr/bin/env python3
"""Scrape daily Pokémon GO field research quests from regional map endpoints."""

from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CITIES = {
    "nyc": {"name": "New York", "url": "https://nycpokemap.com"},
    "vc": {"name": "Vancouver", "url": "https://vanpokemap.com"},
    "sg": {"name": "Singapore", "url": "https://sgpokemap.com"},
    "syd": {"name": "Sydney", "url": "https://sydneypogomap.com"},
    "uk": {"name": "London/UK", "url": "https://londonpogomap.com"},
}

JSON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "JSON")
ARCHIVE_DIR = os.path.join(JSON_DIR, "archive")
# Keep dated snapshots for this many days (WI-05)
ARCHIVE_RETENTION_DAYS = 7

# Categories we care about (items, stardust, encounters, mega energy)
CATEGORIES_TO_KEEP = ["t2", "t3", "t7", "t12"]

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

MAX_RETRIES = 4
BASE_BACKOFF_SECONDS = 1.5
REQUEST_TIMEOUT_SECONDS = 45

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("map_scraper")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def request_with_retries(
    url: str,
    *,
    params: Any = None,
    headers: dict | None = None,
    max_retries: int = MAX_RETRIES,
) -> requests.Response:
    """GET with exponential backoff. Raises on final failure."""
    last_error: Exception | None = None
    merged_headers = {**DEFAULT_HEADERS, **(headers or {})}

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(
                url,
                params=params,
                headers=merged_headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            response.encoding = "utf-8"
            return response
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt >= max_retries:
                break
            sleep_for = BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
            log.warning(
                "Request failed (attempt %s/%s) %s — retrying in %.1fs: %s",
                attempt,
                max_retries,
                url,
                sleep_for,
                exc,
            )
            time.sleep(sleep_for)

    raise RuntimeError(f"Failed after {max_retries} attempts for {url}: {last_error}") from last_error


# ---------------------------------------------------------------------------
# Archive helpers (WI-05)
# ---------------------------------------------------------------------------

def today_utc_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def archive_day_dir(date_str: str | None = None) -> str:
    day = date_str or today_utc_date_str()
    path = os.path.join(ARCHIVE_DIR, day)
    os.makedirs(path, exist_ok=True)
    return path


def write_json(path: str, data: Any) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def archive_snapshot(filename: str, data: Any, date_str: str | None = None) -> str:
    """
    Write a dated copy under JSON/archive/YYYY-MM-DD/.
    Overwrites the same-day file if the scraper runs multiple times.
    """
    dest = os.path.join(archive_day_dir(date_str), filename)
    write_json(dest, data)
    log.info("Archived %s", dest)
    return dest


def preserve_previous_live_file(live_path: str, filename: str) -> None:
    """
    If a live file already exists, copy it into today's archive only when
    there is not already an archive entry for this filename today.
    Preserves the previous snapshot on the first scrape of a new day without
    clobbering an earlier same-day archive of the new data.
    """
    if not os.path.isfile(live_path):
        return

    day_dir = archive_day_dir()
    archived_today = os.path.join(day_dir, filename)
    if os.path.isfile(archived_today):
        return

    try:
        shutil.copy2(live_path, archived_today)
        log.info("Preserved previous live file into archive: %s", archived_today)
    except OSError as exc:
        log.warning("Could not preserve previous live file %s: %s", live_path, exc)


def prune_old_archives(retention_days: int = ARCHIVE_RETENTION_DAYS) -> None:
    """Delete JSON/archive/YYYY-MM-DD folders older than retention_days."""
    if not os.path.isdir(ARCHIVE_DIR):
        return

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=retention_days)
    removed = 0

    for name in os.listdir(ARCHIVE_DIR):
        path = os.path.join(ARCHIVE_DIR, name)
        if not os.path.isdir(path):
            continue
        try:
            folder_date = datetime.strptime(name, "%Y-%m-%d").date()
        except ValueError:
            log.warning("Skipping non-dated archive entry: %s", name)
            continue
        if folder_date < cutoff:
            try:
                shutil.rmtree(path)
                removed += 1
                log.info("Pruned old archive folder: %s", name)
            except OSError as exc:
                log.warning("Failed to prune %s: %s", path, exc)

    if removed:
        log.info("Pruned %s archive folder(s) older than %s days", removed, retention_days)


# ---------------------------------------------------------------------------
# Quest list structure
# ---------------------------------------------------------------------------

def ensure_json_dir() -> None:
    os.makedirs(JSON_DIR, exist_ok=True)
    os.makedirs(ARCHIVE_DIR, exist_ok=True)


def load_or_init_quest_list() -> dict:
    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    if os.path.exists(quest_list_path):
        try:
            with open(quest_list_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("Could not load existing Quest_List.json: %s", exp if False else exc)
    return {"categories": {}}


def fetch_city_filters(city_key: str) -> dict:
    """Fetch the filters payload for a single city."""
    city_config = CITIES[city_key]
    base_url = f"{city_config['url']}/quests.php"
    headers = {"Referer": f"{city_config['url']}/"}
    params = {"time": int(datetime.now(timezone.utc).timestamp() * 1000)}

    response = request_with_retries(base_url, params=params, headers=headers)
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError(f"Unexpected filters response type from {city_key}")
    return payload.get("filters", {}) or {}


def merge_filter_sets(filter_maps: list[dict]) -> dict:
    """
    Union filter keys across cities so the master list is not pruned to a
    single region (WI-04). Values are sets of string IDs per category key.
    """
    merged: dict[str, set[str]] = {}
    for filters in filter_maps:
        for cat_key, raw in filters.items():
            if cat_key not in CATEGORIES_TO_KEEP:
                continue
            items = raw.keys() if isinstance(raw, dict) else (raw or [])
            bucket = merged.setdefault(cat_key, set())
            for item in items:
                bucket.add(str(item))
    return merged


def update_quest_list_structure(quest_list: dict, merged_filters: dict[str, set[str]]) -> None:
    """
    Align quest_list categories with the union of active filter IDs.
    Adds missing reward/stardust slots; removes IDs no longer seen anywhere.
    """
    categories = quest_list.setdefault("categories", {})

    for cat in list(categories.keys()):
        if f"t{cat}" not in CATEGORIES_TO_KEEP:
            del categories[cat]

    for cat_key in CATEGORIES_TO_KEEP:
        clean_cat = cat_key.replace("t", "")
        if clean_cat not in categories:
            categories[clean_cat] = {}

        valid_items = merged_filters.get(cat_key, set())

        if clean_cat == "3":
            stardust_dict = categories[clean_cat].setdefault("0", {})
            for old_amount in list(stardust_dict.keys()):
                if old_amount not in valid_items:
                    del stardust_dict[old_amount]
            for amount_str in valid_items:
                if amount_str not in stardust_dict or not isinstance(stardust_dict[amount_str], list):
                    stardust_dict[amount_str] = []
        else:
            for old_id in list(categories[clean_cat].keys()):
                if old_id not in valid_items:
                    del categories[clean_cat][old_id]
            for reward_str in valid_items:
                if reward_str not in categories[clean_cat]:
                    categories[clean_cat][reward_str] = {}


def fetch_current_quests(city_key: str, city_config: dict, quest_list: dict) -> dict:
    base_url = f"{city_config['url']}/quests.php"
    headers = {"Referer": f"{city_config['url']}/"}

    quest_params: list[str] = []
    categories = quest_list.get("categories", {})

    for category, items in categories.items():
        if category == "3":
            for stardust_amount in items.get("0", {}).keys():
                quest_params.append(f"{category},{stardust_amount},0")
        else:
            for reward_id in items.keys():
                quest_params.append(f"{category},0,{reward_id}")

    payload = [("quests[]", param) for param in quest_params]
    payload.append(("time", int(datetime.now(timezone.utc).timestamp() * 1000)))

    response = request_with_retries(base_url, params=payload, headers=headers)
    current_quests_data = response.json()

    if not isinstance(current_quests_data, dict):
        raise ValueError(f"Unexpected quest payload type for {city_key}")
    if "quests" not in current_quests_data:
        raise ValueError(f"Missing 'quests' key in payload for {city_key}")

    out_filename = f"{city_key}_quests.json"
    out_path = os.path.join(JSON_DIR, out_filename)

    # WI-05: keep history before overwriting the live file
    preserve_previous_live_file(out_path, out_filename)
    write_json(out_path, current_quests_data)
    archive_snapshot(out_filename, current_quests_data)

    log.info("Saved %s (%s quests)", out_path, len(current_quests_data.get("quests") or []))
    return current_quests_data


def populate_quest_list(quest_list: dict, current_quests_data: dict) -> None:
    categories = quest_list.get("categories", {})
    quests = current_quests_data.get("quests", []) or []

    for q in quests:
        cat = str(q.get("rewards_types", ""))
        reward_id = str(q.get("rewards_ids", "0"))
        amount = str(q.get("rewards_amounts", "0"))
        condition = (q.get("conditions_string") or "").strip()

        if not cat or not condition:
            continue

        if cat not in categories:
            continue

        if cat == "3":
            stardust_dict = categories["3"].setdefault("0", {})
            if amount not in stardust_dict or isinstance(stardust_dict[amount], dict):
                stardust_dict[amount] = []
            if condition not in stardust_dict[amount]:
                stardust_dict[amount].append(condition)
        else:
            reward_dict = categories[cat].setdefault(reward_id, {})
            if amount not in reward_dict or not isinstance(reward_dict[amount], list):
                reward_dict[amount] = []
            if condition not in reward_dict[amount]:
                reward_dict[amount].append(condition)


def scrape_city(city_key: str, quest_list: dict) -> None:
    if city_key not in CITIES:
        raise ValueError(f"Unknown city key: {city_key}")

    city_config = CITIES[city_key]
    log.info("--- Scraping %s (%s) ---", city_config["name"], city_key)
    current_quests = fetch_current_quests(city_key, city_config, quest_list)
    populate_quest_list(quest_list, current_quests)


def main() -> int:
    ensure_json_dir()
    quest_list = load_or_init_quest_list()

    target = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    city_keys = list(CITIES.keys()) if target == "all" else [target]

    if target != "all" and target not in CITIES:
        log.error("Unknown city key: %s (valid: %s, all)", target, ", ".join(CITIES))
        return 1

    # Always include all cities when building the master list so pruning is global
    filter_source_keys = list(CITIES.keys())

    log.info("--- Updating master list structure from multi-city filters ---")
    filter_maps: list[dict] = []
    filter_errors: list[str] = []
    for key in filter_source_keys:
        try:
            filters = fetch_city_filters(key)
            filter_maps.append(filters)
            log.info("Fetched filters for %s (%s category keys)", key, len(filters))
        except Exception as exp:
            filter_errors.append(f"{key}: {exp}")
            log.error("Failed to fetch filters for %s: %s", key, exp)

    if not filter_maps:
        log.error("Could not fetch filters from any city. Aborting.")
        for msg in filter_errors:
            log.error("  %s", msg)
        return 1

    merged = merge_filter_sets(filter_maps)
    update_quest_list_structure(quest_list, merged)

    scrape_errors: list[str] = []
    for city_key in city_keys:
        try:
            scrape_city(city_key, quest_list)
        except Exception as exp:
            scrape_errors.append(f"{city_key}: {exp}")
            log.error("Scrape failed for %s: %s", city_key, exp)

    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    preserve_previous_live_file(quest_list_path, "Quest_List.json")
    write_json(quest_list_path, quest_list)
    archive_snapshot("Quest_List.json", quest_list)
    log.info("Updated master list: %s", quest_list_path)

    prune_old_archives(ARCHIVE_RETENTION_DAYS)

    if scrape_errors:
        log.error("Pipeline finished with %s city failure(s):", len(scrape_errors))
        for msg in scrape_errors:
            log.error("  %s", msg)
        return 1

    log.info("Pipeline finished successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
