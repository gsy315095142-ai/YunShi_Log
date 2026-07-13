"""将搜索结果格式化为 AI 可读的参考文本。"""

SNIPPET_MAX_LEN = 300


def format_search_results(results: list[dict], max_items: int) -> str:
    if not results:
        return ""

    lines: list[str] = []
    for index, item in enumerate(results[:max_items], start=1):
        title = str(item.get("title") or "无标题").strip()
        content = str(item.get("content") or "").strip()
        url = str(item.get("url") or "").strip()
        engine = str(item.get("engine") or item.get("engines", "")).strip()

        if len(content) > SNIPPET_MAX_LEN:
            content = content[:SNIPPET_MAX_LEN] + "..."

        block = f"{index}. {title}"
        if content:
            block += f"\n   摘要：{content}"
        if url:
            block += f"\n   链接：{url}"
        if engine:
            block += f"\n   引擎：{engine}"
        lines.append(block)

    return "\n\n".join(lines)
