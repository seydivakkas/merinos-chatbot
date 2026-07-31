"""Single source demo repository shared with the frontend."""
from __future__ import annotations

import json
import math
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).resolve().parents[3] / "shared" / "demo-data.json"

def plain(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))

def normalize_size(value: str) -> str | None:
    match = re.search(r"\b(\d{2,3})\s*[x×]\s*(\d{2,3})\b", plain(value))
    return f"{int(match.group(1))}x{int(match.group(2))}" if match else None

@lru_cache(maxsize=1)
def data() -> dict[str, Any]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))

def facets() -> dict[str, list[str]]:
    products = data()["products"]
    return {key: sorted({item[field] for item in products}) for key, field in (("categories", "category"), ("colors", "color"), ("sizes", "size"), ("collections", "collection"))}

def search_products(*, query: str = "", categories: list[str] | None = None, colors: list[str] | None = None, sizes: list[str] | None = None, collections: list[str] | None = None, limit: int = 24) -> dict[str, Any]:
    categories_n = {plain(v) for v in categories or [] if v}
    colors_n = {plain(v) for v in colors or [] if v}
    sizes_n = {normalize_size(v) or plain(v) for v in sizes or [] if v}
    collections_n = {plain(v) for v in collections or [] if v}
    query_n = plain(query)
    explicit = bool(categories_n or colors_n or sizes_n or collections_n)
    ranked: list[tuple[int, int, dict[str, Any]]] = []
    for product in data()["products"]:
        if categories_n and plain(product["category"]) not in categories_n: continue
        if colors_n and plain(product["color"]) not in colors_n: continue
        if sizes_n and plain(product["size"]) not in sizes_n: continue
        if collections_n and plain(product["collection"]) not in collections_n: continue
        name, code, collection = plain(product["name"]), plain(product["code"]), plain(product["collection"])
        score = 0
        if query_n in {name, code}: score += 100
        if code and code in query_n: score += 80
        if name and name in query_n: score += 70
        if collection and collection in query_n: score += 20
        score += sum(5 for token in query_n.split() if len(token) >= 2 and token in name)
        if query_n and not explicit and score == 0: continue
        ranked.append((-score, product["price"], product))
    ranked.sort(key=lambda item: (item[0], item[1], item[2]["id"]))
    items = [item[2] for item in ranked[:max(1, min(limit, 50))]]
    suggestions = [] if items else [{"label": "Tüm ürünleri göster", "value": "Tüm halıları göster"}]
    return {"items": items, "total": len(ranked), "criteria": {"query": query, "categories": categories or [], "colors": colors or [], "sizes": sizes or [], "collections": collections or [], "limit": limit}, "suggestions": suggestions}

def get_order(order_number: str) -> dict[str, Any] | None:
    return next((item for item in data()["orders"] if item["number"] == order_number), None)

def mask_cargo(value: str) -> str:
    return f"{value[:7]}***" if len(value) > 5 else "***"

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def search_dealers(*, city: str | None = None, district: str | None = None, latitude: float | None = None, longitude: float | None = None, limit: int = 20) -> list[dict[str, Any]]:
    result = [dict(item) for item in data()["dealers"] if (not city or plain(item["city"]) == plain(city)) and (not district or plain(item["district"]) == plain(district))]
    if latitude is not None and longitude is not None:
        source = result or [dict(item) for item in data()["dealers"]]
        for item in source: item["approximateDistanceKm"] = round(haversine(latitude, longitude, item["latitude"], item["longitude"]), 1)
        result = sorted(source, key=lambda item: (item["approximateDistanceKm"], item["id"]))
    else:
        result.sort(key=lambda item: (plain(item["city"]), plain(item["district"]), item["id"]))
    return result[:max(1, min(limit, 50))]

def published_faqs() -> list[dict[str, Any]]:
    return [item for item in data()["faqs"] if item["status"] == "published"]

def match_faq(query: str, limit: int = 3) -> dict[str, Any]:
    normalized = plain(query)
    tokens = {token for token in normalized.split() if len(token) >= 2}
    ranked = []
    for faq in published_faqs():
        exact = any(plain(value) == normalized for value in [faq["question"], *faq["aliases"]])
        score = 100 if exact else 0
        for keyword in [*faq["keywords"], *faq["aliases"]]:
            key = plain(keyword)
            if key in normalized: score += 24 if " " in key else 14
        score += sum(3 for token in tokens if token in plain(faq["question"]))
        ranked.append((score, faq))
    ranked.sort(key=lambda item: (-item[0], item[1]["id"]))
    best = ranked[0] if ranked else None
    if not best or best[0] < 10: return {"match": None, "suggestions": [item[1] for item in ranked[:limit]], "confidence": "none"}
    if best[0] >= 90: return {"match": best[1], "suggestions": [], "confidence": "exact"}
    if best[0] >= 24 and (len(ranked) == 1 or best[0] - ranked[1][0] >= 5): return {"match": best[1], "suggestions": [], "confidence": "strong"}
    return {"match": None, "suggestions": [item[1] for item in ranked if item[0] > 0][:limit], "confidence": "suggested"}
