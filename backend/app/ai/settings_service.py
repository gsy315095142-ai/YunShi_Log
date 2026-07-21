from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.crypto import decrypt_api_key, encrypt_api_key, mask_api_key
from app.ai.providers.base import get_default_base_url, get_default_model, list_providers
from app.ai.schemas import AISettingsResponse, AISettingsUpdateRequest
from app.db.models import AISettings, User


def _get_or_create_settings(db: Session, user: User) -> AISettings:
    settings = db.query(AISettings).filter(AISettings.user_id == user.id).first()
    if settings is None:
        settings = AISettings(user_id=user.id, provider="deepseek")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def get_settings(db: Session, user: User) -> AISettingsResponse:
    settings = _get_or_create_settings(db, user)
    base_url = settings.api_base_url or get_default_base_url(settings.provider)
    masked = None
    if settings.api_key_encrypted:
        try:
            masked = mask_api_key(decrypt_api_key(settings.api_key_encrypted))
        except Exception:
            masked = "****"
    fallback_masked = None
    if settings.fallback_api_key_encrypted:
        try:
            fallback_masked = mask_api_key(decrypt_api_key(settings.fallback_api_key_encrypted))
        except Exception:
            fallback_masked = "****"
    fallback_base_url = None
    fallback_model = None
    if settings.fallback_provider:
        fallback_base_url = settings.fallback_api_base_url or get_default_base_url(settings.fallback_provider)
        fallback_model = settings.fallback_model or get_default_model(settings.fallback_provider)
    return AISettingsResponse(
        provider=settings.provider,
        api_base_url=base_url,
        api_key_masked=masked,
        model=settings.model or get_default_model(settings.provider),
        fallback_provider=settings.fallback_provider,
        fallback_api_base_url=fallback_base_url,
        fallback_api_key_masked=fallback_masked,
        fallback_model=fallback_model,
    )


def update_settings(db: Session, user: User, body: AISettingsUpdateRequest) -> AISettingsResponse:
    settings = _get_or_create_settings(db, user)
    settings.provider = body.provider
    if body.api_base_url:
        settings.api_base_url = body.api_base_url
    else:
        settings.api_base_url = get_default_base_url(body.provider)
    if body.model:
        settings.model = body.model
    else:
        settings.model = get_default_model(body.provider)
    if body.api_key:
        settings.api_key_encrypted = encrypt_api_key(body.api_key)
    if body.clear_fallback:
        settings.fallback_provider = None
        settings.fallback_api_key_encrypted = None
        settings.fallback_api_base_url = None
        settings.fallback_model = None
    elif body.fallback_provider:
        settings.fallback_provider = body.fallback_provider
        settings.fallback_api_base_url = body.fallback_api_base_url or get_default_base_url(body.fallback_provider)
        settings.fallback_model = body.fallback_model or get_default_model(body.fallback_provider)
        if body.fallback_api_key:
            settings.fallback_api_key_encrypted = encrypt_api_key(body.fallback_api_key)
    db.commit()
    db.refresh(settings)
    return get_settings(db, user)


def get_providers() -> list[dict]:
    return list_providers()


def require_chat_credentials(db: Session, user: User) -> tuple[str, str, str, str]:
    """返回 (provider, api_key, base_url, model)，供聊天模块调用。"""
    settings = _get_or_create_settings(db, user)
    if not settings.api_key_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先配置 API Key")
    api_key = decrypt_api_key(settings.api_key_encrypted)
    base_url = settings.api_base_url or get_default_base_url(settings.provider)
    model = settings.model or get_default_model(settings.provider)
    return settings.provider, api_key, base_url, model


def get_fallback_credentials(db: Session, user: User) -> tuple[str, str, str, str] | None:
    """返回备用厂商 (provider, api_key, base_url, model)；未配置或不完整时返回 None。"""
    settings = _get_or_create_settings(db, user)
    if not settings.fallback_provider or not settings.fallback_api_key_encrypted:
        return None
    try:
        api_key = decrypt_api_key(settings.fallback_api_key_encrypted)
    except Exception:
        return None
    base_url = settings.fallback_api_base_url or get_default_base_url(settings.fallback_provider)
    model = settings.fallback_model or get_default_model(settings.fallback_provider)
    return settings.fallback_provider, api_key, base_url, model
