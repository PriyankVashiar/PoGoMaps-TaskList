#!/usr/bin/env python3
"""Scrape daily Pokémon GO field research quests from regional map endpoints."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
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
# Quest list structure
# ---------------------------------------------------------------------------

def ensure_json_dir() -> None:
    os.makedirs(JSON_DIR, exist_ok=True)


def load_or_init_quest_list() -> dict:
    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    if os.path.exists(quest_list_path):
        try:
            with open(quest_list_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("Could not load existing Quest_List.json: %s", exc)
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

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(current_quests_data, f, indent=2, ensure_ascii=False)

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

    # WI-04: collect filters from every city we will scrape (or all cities for "all")
    filter_source_keys = city_keys if target != "all" else list(CITIES.keys())
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
        except Exception as exc:  # noqa: BLE001 — collect and continue
            filter_errors.append(f"{key}: {exc}")
            log.error("Failed to fetch filters for %s: %s", key, exc)

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
        except Exception as exc:  # noqa: BLE001
            scrape_errors.append(f"{city_key}: {exc}")
            log.error("Scrape failed for %s: %s", city_key, exc)

    quest_list_path = os.path.join(JSON_DIR, "Quest_List.json")
    with open(quest_list_path, "w", encoding="utf-8") as f:
        json.dump(quest_list, f, indent=2, ensure_ascii=False)
    log.info("Updated master list: %s", quest_list_path)

    if scrape_errors:
        log.error("Pipeline finished with %s city failure(s):", len(scrape_errors))
        for msg in scrape_errors:
            log.error("  %s", msg)
        # Partial success still updates Quest_List; fail the job so Actions notice
        return 1

    log.info("Pipeline finished successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
