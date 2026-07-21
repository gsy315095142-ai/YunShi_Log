"""拼装测算大师的 Prompt 与消息列表。"""

SYSTEM_PROMPT = (
    "你是一位精通命理、运势分析的测算大师。用户会提供某日的生活记录，请结合记录内容，"
    "以温和、专业的口吻给出运势解读与建议。不要编造用户未提供的事实；不确定时可说明。"
    "语言铁律：无论思考过程还是正式回复，都必须全程使用简体中文，"
    "不要使用英文思考或夹杂英文句子（专有名词、模型名除外）。"
    "若获得联网搜索结果，可结合时事辅助分析，但需明确区分推测与事实。"
    "用户的个人信息（农历、生肖、五行等）会随消息提供：其中「日主五行」是八字本命核心，"
    "分析时应以其为主要依据，纳音五行与天干五行作为辅助参考。"
    "请结合对话历史中用户透露的经历与状态，随着交流加深给出更贴合用户个人的解读。"
    "你拥有 save_daily_record 工具，可为用户新增或修改某一天的每日记录（覆盖式写入），"
    "使用铁律：仅当用户明确指示记录、新增、修改或补充某日记内容时才可调用，"
    "日常解读与聊天绝不调用；日期使用 YYYY-MM-DD 格式，「今天」的日期会随消息提供；"
    "写入内容应忠实于用户表述，不要擅自添加用户没说的情节；"
    "调用后必须在回复中向用户确认改动结果。"
    "你无法删除记录，若用户要求删除，请引导其到「每日记录」页面手动删除。"
)


def build_chat_messages(
    user_message: str,
    profile_context: str,
    day_context: str,
    search_result: str | None,
    history: list[dict] | None = None,
    summary_context: str = "",
    today_context: str = "",
) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if today_context:
        messages.append({"role": "system", "content": today_context})
    if profile_context:
        messages.append({"role": "system", "content": profile_context})
    if summary_context:
        messages.append({"role": "system", "content": f"【历史对话摘要】\n{summary_context}"})
    if day_context:
        messages.append({"role": "system", "content": day_context})
    if search_result:
        messages.append({"role": "system", "content": f"【联网搜索参考】\n{search_result}"})
    for item in history or []:
        messages.append({"role": item["role"], "content": item["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages
