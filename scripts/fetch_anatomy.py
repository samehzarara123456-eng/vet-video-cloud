#!/usr/bin/env python3
"""
Fetch scientifically accurate, open-access Veterinary Anatomy images
from the Wikimedia Commons MediaWiki API (100% free, no API key required).

Usage:
  python scripts/fetch_anatomy.py "ruminant stomach anatomy" --out lectures/demo/images --limit 4
  python scripts/fetch_anatomy.py --file "File:Abomasum_(PSF).png" --out lectures/demo/images --name ruminant_stomach.png
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

API_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "VetVideoCloudStudio/1.0 (https://github.com/vet-video-cloud; vet-anatomy-education@example.org) urllib/3"


def api_get(params: dict) -> dict:
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_url(url: str, dest: pathlib.Path) -> None:
    clean_url = url.split("?")[0]
    req = urllib.request.Request(clean_url, headers={"User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=40) as resp:
        dest.write_bytes(resp.read())


def sanitize_filename(name: str) -> str:
    base = re.sub(r"^File:", "", name, flags=re.IGNORECASE)
    base = re.sub(r"[^\w.\-]+", "_", base).strip("_")
    return base.lower()


def search_commons(query: str, limit: int = 8) -> list[dict]:
    data = api_get({
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap|drawing {query}",
        "gsrnamespace": 6,  # File namespace
        "gsrlimit": limit,
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": 1600,
    })
    pages = data.get("query", {}).get("pages", {})
    results = []
    for _, page in pages.items():
        infos = page.get("imageinfo", [])
        if not infos:
            continue
        info = infos[0]
        mime = info.get("mime", "")
        if not (mime.startswith("image/") and mime != "image/tiff"):
            continue
        meta = info.get("extmetadata", {})
        license_name = meta.get("LicenseShortName", {}).get("value", "Unknown")
        artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
        # Prefer direct original URL for raster PNG/JPEG (avoids thumb rate limits); use thumburl for SVG
        dl_url = info.get("thumburl") if mime == "image/svg+xml" else (info.get("url") or info.get("thumburl"))
        if mime == "image/svg+xml" and not info.get("thumburl"):
            continue
        results.append({
            "title": page.get("title", ""),
            "width": info.get("thumbwidth") or info.get("width", 0),
            "height": info.get("thumbheight") or info.get("height", 0),
            "mime": mime,
            "license": license_name,
            "artist": artist[:120],
            "download_url": dl_url,
            "page_url": info.get("descriptionurl", ""),
        })
    results.sort(key=lambda r: r["width"] * r["height"], reverse=True)
    return results


def fetch_specific_file(file_title: str) -> dict | None:
    if not file_title.lower().startswith("file:"):
        file_title = f"File:{file_title}"
    data = api_get({
        "action": "query",
        "format": "json",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": 1600,
    })
    pages = data.get("query", {}).get("pages", {})
    for _, page in pages.items():
        infos = page.get("imageinfo", [])
        if not infos:
            return None
        info = infos[0]
        meta = info.get("extmetadata", {})
        return {
            "title": page.get("title", file_title),
            "width": info.get("thumbwidth") or info.get("width", 0),
            "height": info.get("thumbheight") or info.get("height", 0),
            "mime": info.get("mime", ""),
            "license": meta.get("LicenseShortName", {}).get("value", "Unknown"),
            "artist": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()[:120],
            "download_url": info.get("thumburl") if info.get("mime") == "image/svg+xml" else (info.get("url") or info.get("thumburl")),
            "page_url": info.get("descriptionurl", ""),
        }
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch verified veterinary anatomy plates from Wikimedia Commons.")
    parser.add_argument("query", nargs="?", help="Search query, e.g. 'equine skeleton anatomy'")
    parser.add_argument("--file", dest="specific_file", help="Exact Wikimedia Commons file title")
    parser.add_argument("--out", required=True, help="Output directory for downloaded images")
    parser.add_argument("--name", help="Optional custom output filename (with --file)")
    parser.add_argument("--limit", type=int, default=3, help="Max images to download")
    parser.add_argument("--list-only", action="store_true", help="Only print candidate search results")
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    attr_path = out_dir / "attribution.json"
    attributions = json.loads(attr_path.read_text("utf-8")) if attr_path.exists() else {}

    if args.specific_file:
        item = fetch_specific_file(args.specific_file)
        if not item:
            print(f"File not found on Wikimedia Commons: {args.specific_file}", file=sys.stderr)
            return 1
        items = [item]
    elif args.query:
        items = search_commons(args.query, limit=max(args.limit * 2, 6))
        if args.list_only:
            print(json.dumps(items[: args.limit], indent=2, ensure_ascii=False))
            return 0
        items = items[: args.limit]
    else:
        parser.error("Provide either a search query or --file.")
        return 2

    downloaded = []
    for item in items:
        fname = args.name if (args.specific_file and args.name) else sanitize_filename(item["title"])
        if fname.endswith(".svg"):
            fname = fname[:-4] + ".png"
        dest = out_dir / fname
        download_url(item["download_url"], dest)
        attributions[fname] = {
            "title": item["title"],
            "license": item["license"],
            "artist": item["artist"],
            "source_url": item["page_url"],
        }
        downloaded.append(str(dest))
        print(f"Saved: {dest} ({item['width']}x{item['height']} | {item['license']})")

    attr_path.write_text(json.dumps(attributions, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
