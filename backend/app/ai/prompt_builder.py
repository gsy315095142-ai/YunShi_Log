"""拼装测算大师的 Prompt 与消息列表。"""

SYSTEM_PROMPT = (
    "你是一位精通命理、运势分析的测算大师。用户会提供某日的生活记录，请结合记录内容，"
    "以温和、专业的口吻给出运势解读与建议。不要编造用户未提供的事实；不确定时可说明。"
    "若获得联网搜索结果，可结合时事辅助分析，但需明确区分推测与事实。"
)


def build_chat_messages(
    user_message: str,
    day_context: str,
    search_result: str | None,
) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if day_context:
        messages.append({"role": "system", "content": day_context})
    if search_result:
        messages.append({"role": "system", "content": f"【联网搜索参考】\n{search_result}"})
    messages.append({"role": "user", "content": user_message})
    return messages
