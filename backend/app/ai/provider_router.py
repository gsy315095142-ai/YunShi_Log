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
        return await deepseek.chat_completion(api_key=api_key, messages=messages, base_url=base_url, model=model or "deepseek-v4-pro", tools=tools)
    if provider == "zhipu":
        return await zhipu.chat_completion(api_key=api_key, messages=messages, base_url=base_url, model=model or "glm-5.1", tools=tools)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的 AI 厂商")


async def call_with_fallback(
    primary: tuple[str, str, str | None, str],
    fallback: tuple[str, str, str | None, str] | None,
    messages: list[dict],
    tools: list[dict] | None = None,
) -> tuple[dict, str]:
    """优先调用主厂商；主厂商调用失败且配置了备用厂商时，自动切换备用厂商重试。

    返回 (回复, 实际使用的 provider)。主厂商失败但无备用时，原异常继续抛出。
    """
    provider, api_key, base_url, model = primary
    try:
        result = await call_provider(provider, api_key, base_url, messages, model=model, tools=tools)
        return result, provider
    except Exception:
        if fallback is None:
            raise
    f_provider, f_api_key, f_base_url, f_model = fallback
    result = await call_provider(f_provider, f_api_key, f_base_url, messages, model=f_model, tools=tools)
    return result, f_provider
