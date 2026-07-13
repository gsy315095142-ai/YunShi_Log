from datetime import date

from pydantic import BaseModel, Field


class AISettingsUpdateRequest(BaseModel):
    provider: str = Field(pattern="^(deepseek|zhipu)$")
    api_key: str | None = None
    api_base_url: str | None = None


class AISettingsResponse(BaseModel):
    provider: str
    api_base_url: str
    api_key_masked: str | None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    linked_date: date | None = None


class ChatMessageItem(BaseModel):
    id: int
    role: str
    content: str
    linked_date: date | None
    created_at: str

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    reply: str
    message: ChatMessageItem
