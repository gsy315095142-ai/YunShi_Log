"""联网搜索：对接阿里云 SearXNG。"""

import logging

from app.config import SEARXNG_ENABLED, SEARXNG_MAX_RESULTS
from app.search.formatter import format_search_results
from app.search.searxng_client import fetch_searxng_results

logger = logging.getLogger(__name__)


async def search_web(query: str) -> str | None:
    """搜索失败时返回 None，不影响 AI 基础聊天。"""
    text = query.strip()
    if not SEARXNG_ENABLED or not text:
        return None

    try:
        results = await fetch_searxng_results(text)
        formatted = format_search_results(results, SEARXNG_MAX_RESULTS)
        if not formatted:
            return None
        return formatted
    except Exception as exc:
        logger.warning("SearXNG 搜索失败: %s", exc)
        return None
