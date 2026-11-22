import functools
import json
from pathlib import Path

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

DATA_PATH = Path(__file__).resolve().parent.parent / "providers" / "catalog_data.json"
SITES: list[dict] = json.loads(DATA_PATH.read_text(encoding="utf-8"))


@functools.lru_cache(maxsize=1)
def _total_sites() -> int:
    from yt_dlp.extractor import gen_extractor_classes

    return len(gen_extractor_classes())


def total_sites() -> int:
    try:
        return _total_sites()
    except Exception:
        return len(SITES)


@router.get("/stats")
async def stats():
    categories = sorted({site["category"] for site in SITES})
    return {
        "total_sites": total_sites(),
        "curated_sites": len(SITES),
        "verified_curated": sum(1 for site in SITES if site["status"] == "verified"),
        "categories": categories,
    }


@router.get("/sites")
async def sites(
    q: str = Query(default="", max_length=100),
    category: str = Query(default="", max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
):
    query = q.strip().lower()
    items = SITES
    if query:
        items = [s for s in items if query in s["name"].lower() or query in s["domain"].lower()]
    if category:
        items = [s for s in items if s["category"].lower() == category.lower()]
    items = sorted(items, key=lambda s: s["name"].lower())
    total = len(items)
    start = (page - 1) * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "items": items[start : start + page_size],
    }
