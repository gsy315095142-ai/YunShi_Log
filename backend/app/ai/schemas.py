from datetime import date

from pydantic import BaseModel, Field


class AISettingsUpdateRequest(BaseModel):
    provider: str = Field(pattern="^(deepseek|zhipu)$")
    api_key: str | None = None
    api_base_url: str | None = None
    model: str | None = None
    fallback_provider: str | None = Field(default=None, pattern="^(deepseek|zhipu)$")
    fallback_api_key: str | None = None
    fallback_api_base_url: str | None = None
    fallback_model: str | None = None
    clear_fallback: bool = False


class AISettingsResponse(BaseModel):
    provider: str
    api_base_url: str
    api_key_masked: str | None
    model: str
    fallback_provider: str | None = None
    fallback_api_base_url: str | None = None
    fallback_api_key_masked: str | None = None
    fallback_model: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    linked_date: date | None = None


class RecordAction(BaseModel):
    """AI 通过工具对每日记录执行的一次写入操作回执。"""

    action: str  # "created" 新增 | "updated" 覆盖更新
    date: str  # YYYY-MM-DD
    preview: str  # 内容前 50 字预览


class ChatMessageItem(BaseModel):
    id: int
    role: str
    content: str
    reasoning: str | None = None
    linked_date: date | None
    created_at: str
    record_actions: list[RecordAction] | None = None
    used_fallback: bool | None = None  # 本条回复是否由备用厂商接手生成

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    reply: str
    message: ChatMessageItem
