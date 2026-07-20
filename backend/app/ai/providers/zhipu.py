import httpx

from app.ai.providers.base import get_default_base_url


async def chat_completion(
    *,
    api_key: str,
    messages: list[dict],
    base_url: str | None = None,
    model: str = "glm-4-flash",
) -> dict:
    """返回 {"content": 回复正文, "reasoning": 思考内容或 None}。

    默认请求开启思考模式（thinking.enabled）；支持思考的 GLM 模型
    会返回 reasoning_content，不支持的模型忽略该参数，reasoning 为 None。
    """
    root = (base_url or get_default_base_url("zhipu")).rstrip("/")
    url = f"{root}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "thinking": {"type": "enabled"},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    message = data["choices"][0]["message"]
    return {
        "content": message["content"],
        "reasoning": message.get("reasoning_content"),
    }
