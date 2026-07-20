"""按厂商路由到独立 adapter。"""

from fastapi import HTTPException, status

from app.ai.providers import deepseek, zhipu


async def call_provider(
    provider: str,
    api_key: str,
    base_url: str | None,
    messages: list[dict],
    model: str | None = None,
    tools: list[dict] | None = None,
) -> dict:
    """路由到厂商 adapter，返回 {"content", "reasoning", "tool_calls"}。"""
    if provider == "deepseek":
        return await deepseek.chat_completion(api_key=api_key, messages=messages, base_url=base_url, model=model or "deepseek-v4-flash", tools=tools)
    if provider == "zhipu":
        return await zhipu.chat_completion(api_key=api_key, messages=messages, base_url=base_url, model=model or "glm-5.1", tools=tools)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的 AI 厂商")
