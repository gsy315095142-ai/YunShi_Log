"""调用 SearXNG JSON API。"""

import httpx

from app.config import SEARXNG_BASE_URL, SEARXNG_TIMEOUT_SEC


async def fetch_searxng_results(query: str) -> list[dict]:
    base = SEARXNG_BASE_URL.rstrip("/")
    url = f"{base}/search"
    params = {"q": query, "format": "json"}

    async with httpx.AsyncClient(timeout=SEARXNG_TIMEOUT_SEC) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results")
    if not isinstance(results, list):
        return []
    return results
