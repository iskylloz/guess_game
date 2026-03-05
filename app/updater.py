"""Auto-update checker — Queries GitHub Releases API."""

import json
import urllib.request
import urllib.error


GITHUB_REPO = "iskylloz/guess_game"


def check_for_update(current_version):
    """
    Check GitHub for a newer release.
    Returns dict { available, latest, url, notes } or None on error.
    """
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
    req = urllib.request.Request(api_url, headers={"Accept": "application/vnd.github.v3+json"})

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None

    tag = data.get("tag_name", "")
    latest = tag.lstrip("v")

    if not latest:
        return None

    if _parse_version(latest) > _parse_version(current_version):
        return {
            "available": True,
            "latest": latest,
            "url": data.get("html_url", ""),
            "notes": data.get("body", ""),
        }

    return {"available": False}


def _parse_version(v):
    """Parse '1.2.3' into (1, 2, 3) tuple for comparison."""
    try:
        return tuple(int(x) for x in v.split("."))
    except (ValueError, AttributeError):
        return (0,)
