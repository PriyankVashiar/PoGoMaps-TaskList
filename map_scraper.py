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
                exp if False else exc,
            )
            time.sleep(sleep_for)

    raise RuntimeError(f"Failed after {max_retries} attempts for {url}: {last_error}") from last_error
