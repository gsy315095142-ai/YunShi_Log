import httpx

from app.ai.providers.base import get_default_base_url


async def chat_completion(
    *,
    api_key: str,
    messages: list[dict],
    base_url: str | None = None,
    model: str = "deepseek-v4-flash",
) -> dict:
    """返回 {"content": 回复正文, "reasoning": 思考内容或 None}。

    deepseek-reasoner 等思考型模型会返回 reasoning_content；
    非思考模型（如 deepseek-chat）不返回，reasoning 为 None。
    """
    root = (base_url or get_default_base_url("deepseek")).rstrip("/")
    url = f"{root}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
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
