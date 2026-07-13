from dataclasses import dataclass


@dataclass
class ProviderDefaults:
    id: str
    name: str
    default_base_url: str


PROVIDER_DEFAULTS: dict[str, ProviderDefaults] = {
    "deepseek": ProviderDefaults(
        id="deepseek",
        name="DeepSeek",
        default_base_url="https://api.deepseek.com",
    ),
    "zhipu": ProviderDefaults(
        id="zhipu",
        name="智谱",
        default_base_url="https://open.bigmodel.cn/api/paas/v4",
    ),
}


def get_default_base_url(provider: str) -> str:
    item = PROVIDER_DEFAULTS.get(provider)
    if item is None:
        raise ValueError(f"不支持的厂商: {provider}")
    return item.default_base_url


def list_providers() -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "default_base_url": p.default_base_url,
        }
        for p in PROVIDER_DEFAULTS.values()
    ]
