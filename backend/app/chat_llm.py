from __future__ import annotations

import asyncio
import base64
import json
import re
from typing import Any

import httpx

from app.chat_store import StoredMessage
from app.library_manifest import format_asset_catalog_for_llm_prompt
from app.library_manifest import media_type_for_path
from app.library_manifest import read_asset_disk_path
from app.skill_storage import MAX_SKILL_BYTES, write_skill_markdown
from app.user_settings import AIProfile, load_settings, read_selected_skill_text


PRIMARY_SYSTEM_PROMPT = """你是一个面向「小红书」的营销写作助手。
- 用中文与用户交流。
- 回答应围绕营销素材梳理、小红书笔记结构建议、文案思路与要素（标题钩子、段落、语气、话题标签等）。
- 「配图」若涉及具体图片，请告知用户只能使用素材库里真实存在的素材；不要随意编造图片网址。

## 按需识图（工具）
后端会为你在 OpenAI 兼容接口中注册函数工具 `analyze_material_image`。
- **仅当**需要从**画面层面**解读某张**素材库**里的图片时再调用（例如用户希望描述构图/主体/色系/质感、判断是否与文案匹配等）。
- **不要**在纯文字提纲、不涉及具体图片内容的讨论里调用，避免无谓开销。
- `asset_id` 必须取自系统消息中的「素材库清单」条目；不要随意编造 id。

## 写入 Skill 文档（工具 save_skill_document）
当用户明确要求**把约定、范例或写作规范写入 Skill 文档**并与你就文件名或主题达成一致（或用户使用「保存 Skill」「生成 skill 文件」等指令）时可调用，
将完整 Markdown **持久化到仓库 skills/ 目录**（UTF-8，扩展名必须为 .md，仅用文件名不要有路径）。
- **不要**在无人要求持久化的情况下静默写入文件。
- **不要**用这个工具改写用户正在讨论的普通聊天内容以外的敏感系统文件。
- `markdown_content` 单文件不超过约 1MiB。

## 小红书笔记正文版式（必须与对话说明分开）
当本轮回复里包含**一段可直接复制到小红书发布的完整笔记**（标题、分段正文、话题标签等）时：
- 必须将该段正文**单独**放在下列成对标签之间；**标签之外**只写说明、追问、修改建议等多轮对话内容。
- 标签内**只写笔记正文**（可含 `#标签`），不要写「如下」「供参考」等套话。
- 若本轮没有可发布的完整笔记，则**不要**输出此标签对（也不要留空标签）。

<xiaohongshu_note>
（此处仅笔记正文）
</xiaohongshu_note>
"""


TOOL_ANALYZE_MATERIAL_IMAGE = {
    "type": "function",
    "function": {
        "name": "analyze_material_image",
        "description": (
            "对素材库中一张真实图片做一次识图摘要，产出中文的画面描述与分析。"
            "仅当用户需求涉及理解图片内容时再调用。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "asset_id": {
                    "type": "string",
                    "description": "素材库条目 id（必须与清单中的 id 一致）",
                },
                "focus_question": {
                    "type": "string",
                    "description": "用户在意的识图侧重点（可为空）；例如：是否适合做封面、色系是否春日感等",
                },
            },
            "required": ["asset_id"],
        },
    },
}

TOOL_SAVE_SKILL_DOCUMENT = {
    "type": "function",
    "function": {
        "name": "save_skill_document",
        "description": (
            "在项目 skills/ 目录下创建或覆盖一个 Markdown（.md）Skill 文件；"
            "仅当用户明确要求把规则或范例写成 Skill、且已商定或给出合适文件名时使用。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": '仅文件名，必须以 .md 结尾，例如 "xiaohongshu_tone.md"，不得包含路径',
                },
                "markdown_content": {
                    "type": "string",
                    "description": "完整的 Markdown 正文（将被保存为 UTF-8）",
                },
            },
            "required": ["filename", "markdown_content"],
        },
    },
}


TOOLS_PRIMARY: list[dict[str, Any]] = [
    TOOL_ANALYZE_MATERIAL_IMAGE,
    TOOL_SAVE_SKILL_DOCUMENT,
]

PRIMARY_CHAT_TEMPERATURE = 0.65
MAX_TOOL_ROUND_TRIPS = 5
VISION_READ_TIMEOUT_SEC = 120.0
VISION_CONNECT_TIMEOUT_SEC = 30.0
PRIMARY_HTTP_POOL_SEC = 60.0
MAX_IMAGE_BYTES_FOR_VISION = 15 * 1024 * 1024


def build_endpoint(base_url: str) -> str:
    return base_url.strip().rstrip("/") + "/chat/completions"


def flatten_message_content(content: Any) -> str | None:
    """兼容部分厂商返回结构化 content。"""
    if content is None:
        return None
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for seg in content:
            if isinstance(seg, dict):
                if seg.get("type") == "text" and isinstance(seg.get("text"), str):
                    parts.append(seg["text"])
                elif isinstance(seg.get("content"), str):
                    parts.append(seg["content"])
        if parts:
            return "\n".join(parts).strip()
    return None


def build_primary_messages(
    *,
    history: list[StoredMessage],
    user_draft: str,
    with_skills: bool,
) -> list[dict[str, Any]]:
    system_parts = [PRIMARY_SYSTEM_PROMPT.strip()]
    if with_skills:
        skill_text, _files = read_selected_skill_text(load_settings())
        snippet = skill_text.strip()
        if snippet:
            system_parts.append(
                "\n\n## 已勾选 Skill 参考（请遵守但不要机械照抄范例）\n" + snippet
            )

    catalog = format_asset_catalog_for_llm_prompt()
    system_parts.append(
        "\n\n## 素材库清单（节选，用于指代与识图 tool 的 asset_id）\n" + catalog.strip()
    )

    merged_system = "\n".join(system_parts).strip()
    outbound: list[dict[str, Any]] = [{"role": "system", "content": merged_system}]
    tail = history[-52:]
    for m in tail:
        if m.role not in {"user", "assistant"}:
            continue
        outbound.append({"role": m.role, "content": m.content})
    outbound.append({"role": "user", "content": user_draft})
    return outbound


def _strip_assistant_for_replay(msg: dict[str, Any]) -> dict[str, Any]:
    """保留回传 API 所需字段，降低厂商多余键带来的兼容问题。"""
    out: dict[str, Any] = {"role": "assistant"}
    out["content"] = msg.get("content")
    if msg.get("tool_calls"):
        out["tool_calls"] = msg["tool_calls"]
    if msg.get("reasoning_content") is not None:
        out["reasoning_content"] = msg["reasoning_content"]
    return out


def _parse_tool_arguments(raw: str) -> dict[str, Any]:
    try:
        v = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return v if isinstance(v, dict) else {}


def _extract_choice_message(data: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None, "模型返回不包含 choices。"
    msg0 = choices[0]
    if not isinstance(msg0, dict):
        return None, "模型返回 choices 项格式异常。"
    cand = msg0.get("message")
    if not isinstance(cand, dict):
        return None, "模型返回缺少 message 对象。"
    return cand, None


def _looks_like_tooling_rejected(resp: httpx.Response, data: dict[str, Any]) -> bool:
    if resp.status_code < 400:
        return False
    err_obj: Any = data.get("error")
    blob = ""
    if isinstance(err_obj, dict) and isinstance(err_obj.get("message"), str):
        blob = err_obj["message"]
    elif isinstance(err_obj, str):
        blob = err_obj
    low = blob.lower()
    needles = ("tool", "function", "functions", "not support", "unsupported")
    return resp.status_code == 400 and any(n in low for n in needles)


async def _post_chat_completions(
    *,
    profile: AIProfile,
    payload: dict[str, Any],
    read_timeout: float,
) -> tuple[httpx.Response, dict[str, Any]]:
    api_key = profile.api_key.strip()
    base = profile.base_url.strip()
    model = profile.chat_model.strip()
    if not api_key:
        raise ValueError("未配置 API Key（请在右上角「设置」中保存密钥）。")
    if not base:
        raise ValueError("未配置 Base URL。")
    if not model:
        raise ValueError("未配置模型名称。")

    url = build_endpoint(base)
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {"model": model, **payload}

    timeout = httpx.Timeout(
        connect=VISION_CONNECT_TIMEOUT_SEC,
        read=read_timeout,
        write=180.0,
        pool=PRIMARY_HTTP_POOL_SEC,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=body)
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    return resp, data


def _http_error_detail(resp: httpx.Response, data: dict[str, Any]) -> str:
    err = ""
    err_payload = data.get("error")
    if isinstance(err_payload, dict) and isinstance(err_payload.get("message"), str):
        err = err_payload["message"]
    elif isinstance(err_payload, str):
        err = err_payload
    tail = resp.text.strip()[:800]
    if not err:
        err = tail or f"HTTP {resp.status_code}"
    elif tail:
        err = f"{err}｜详情：{tail}"
    return err or f"调用失败（HTTP {resp.status_code}）"


async def completion_chat(
    *,
    outbound_messages: list[dict[str, str]],
    temperature: float = 0.7,
) -> tuple[str | None, str | None]:
    """调用主力 AI（OpenAI 兼容 `/chat/completions`），只发纯文本 messages。返回 (text, error)。"""
    settings = load_settings()
    profile: AIProfile = settings.primary_ai
    try:
        resp, data = await _post_chat_completions(
            profile=profile,
            payload={"temperature": temperature, "messages": outbound_messages},
            read_timeout=180.0,
        )
    except ValueError as exc:
        return None, str(exc)
    except httpx.RequestError as exc:
        return None, f"网络请求失败：{exc}"

    if resp.status_code >= 400:
        return None, _http_error_detail(resp, data)

    cand, err = _extract_choice_message(data)
    if err or cand is None:
        return None, err or "模型响应异常。"
    txt = flatten_message_content(cand.get("content"))
    if txt is None or txt.strip() == "":
        return None, "模型返回内容为空。"
    return txt.strip(), None


async def completion_vision_with_image_bytes(
    *,
    image_bytes: bytes,
    mime: str | None,
    instruction: str,
    temperature: float = 0.35,
    read_timeout: float = VISION_READ_TIMEOUT_SEC,
) -> tuple[str | None, str | None]:
    """调用识图 AI；image 以 data URL 注入。返回 (text, error)。"""
    settings = load_settings()
    profile: AIProfile = settings.vision_ai
    if profile.capability != "text_vision":
        return None, "识图 AI 在设置中未标注为「文本 + 识图（多模态）」，请检查配置。"

    mt = (mime or "image/jpeg").strip() or "image/jpeg"
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mt};base64,{b64}"

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "你是营销素材场景的图像理解助手；用简体中文客观描述画面，"
                "可简要概括构图、主体、风格、色系与氛围；若与用户问题无关可说明。"
            ),
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": instruction.strip() or "请描述这张图片。"},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    last_err: str | None = None
    for attempt in range(2):
        try:
            resp, data = await _post_chat_completions(
                profile=profile,
                payload={"temperature": temperature, "messages": messages},
                read_timeout=read_timeout,
            )
        except ValueError as exc:
            return None, str(exc)
        except httpx.RequestError as exc:
            last_err = f"网络请求失败：{exc}"
            if attempt == 0:
                await asyncio.sleep(0.4)
                continue
            return None, last_err

        if resp.status_code >= 500 or resp.status_code == 429:
            last_err = _http_error_detail(resp, data)
            if attempt == 0:
                await asyncio.sleep(0.5 + attempt * 0.3)
                continue
            return None, last_err

        if resp.status_code >= 400:
            return None, _http_error_detail(resp, data)

        cand, ierr = _extract_choice_message(data)
        if ierr or cand is None:
            return None, ierr or "模型响应异常。"
        txt = flatten_message_content(cand.get("content"))
        if txt is None or txt.strip() == "":
            return None, "识图模型返回内容为空。"
        return txt.strip(), None

    return None, last_err or "识图调用失败。"


_HEX32 = re.compile(r"^[0-9a-f]{32}$", re.I)


async def analyze_material_image_for_tool(
    *,
    asset_id: str,
    focus_question: str | None,
) -> str:
    """供 tool_calls 执行的识图摘要；返回值直接作为 role=tool 的 content。"""
    aid = (asset_id or "").strip()
    if not aid:
        return "【识图失败】缺少 asset_id。"
    if not _HEX32.match(aid):
        return "【识图失败】asset_id 格式无效（应为 32 位十六进制字符串，与素材库清单一致）。"

    meta = (
        focus_question.strip()
        if isinstance(focus_question, str) and focus_question.strip()
        else "请客观描述画面主体、构图、风格、色系与氛围，并一句话说明可能的小红书配图用途。"
    )

    try:
        _st, path = read_asset_disk_path(aid)
    except FileNotFoundError:
        return f"【识图失败】素材 id 不存在：{aid}"

    if not path.is_file():
        return f"【识图失败】素材文件已缺失：{aid}"

    try:
        size = path.stat().st_size
    except OSError as exc:
        return f"【识图失败】无法读取文件信息：{exc}"

    if size <= 0:
        return f"【识图失败】素材文件为空：{aid}"
    if size > MAX_IMAGE_BYTES_FOR_VISION:
        return (
            f"【识图失败】图片过大（{size // (1024 * 1024)}MB），已超过当前上限 "
            f"{MAX_IMAGE_BYTES_FOR_VISION // (1024 * 1024)}MB，请先压缩或换新图。"
        )

    try:
        raw = path.read_bytes()
    except OSError as exc:
        return f"【识图失败】读取文件失败：{exc}"

    mime = media_type_for_path(path)
    intro = (
        f"以下为素材库 id={aid} 的图像理解结果。\n用户侧重点：{meta}\n\n"
        "图像描述：\n"
    )
    desc, err = await completion_vision_with_image_bytes(
        image_bytes=raw,
        mime=mime,
        instruction=meta,
    )
    if err:
        return f"【识图失败】{err}"
    return intro + desc


async def _primary_round_with_tools(
    *,
    messages: list[dict[str, Any]],
    temperature: float,
    include_tools: bool,
) -> tuple[dict[str, Any] | None, str | None, httpx.Response | None, dict[str, Any]]:
    """返回 (assistant_message_dict, error, raw_resp, raw_data)。"""
    settings = load_settings()
    profile = settings.primary_ai
    payload: dict[str, Any] = {"temperature": temperature, "messages": messages}
    if include_tools:
        payload["tools"] = TOOLS_PRIMARY
        payload["tool_choice"] = "auto"

    try:
        resp, data = await _post_chat_completions(
            profile=profile,
            payload=payload,
            read_timeout=180.0,
        )
    except ValueError as exc:
        return None, str(exc), None, {}
    except httpx.RequestError as exc:
        return None, f"网络请求失败：{exc}", None, {}

    if resp.status_code >= 400:
        return None, _http_error_detail(resp, data), resp, data

    cand, err = _extract_choice_message(data)
    if err or cand is None:
        return None, err or "模型响应异常。", resp, data
    return cand, None, resp, data


async def orchestrate_primary_chat_reply(
    *,
    history: list[StoredMessage],
    user_draft: str,
    with_skills: bool,
) -> tuple[str, str | None, bool]:
    """
    主力对话：支持 tool_calls → 识图 → 回注 → 再调主力，直到模型给出最终文本。
    返回 (assistant_text, primary_error_if_any, used_vision_successfully)。
    """
    work: list[dict[str, Any]] = build_primary_messages(
        history=history,
        user_draft=user_draft,
        with_skills=with_skills,
    )
    used_vision = False
    allow_tools = True

    for _round in range(MAX_TOOL_ROUND_TRIPS + 1):
        cand, err, resp, data = await _primary_round_with_tools(
            messages=work,
            temperature=PRIMARY_CHAT_TEMPERATURE,
            include_tools=allow_tools,
        )
        if err:
            should_drop_tools = allow_tools and resp is not None and _looks_like_tooling_rejected(
                resp, data
            )
            if should_drop_tools:
                allow_tools = False
                cand, err, resp, data = await _primary_round_with_tools(
                    messages=work,
                    temperature=PRIMARY_CHAT_TEMPERATURE,
                    include_tools=False,
                )
            if err:
                return "", err, used_vision

        assert cand is not None
        tcalls = cand.get("tool_calls")
        has_calls = isinstance(tcalls, list) and len(tcalls) > 0

        if not has_calls:
            txt = flatten_message_content(cand.get("content"))
            if txt and txt.strip():
                return txt.strip(), None, used_vision
            return "", "模型返回内容为空（可能未结束工具链路）。", used_vision

        if not allow_tools:
            part = flatten_message_content(cand.get("content"))
            if part and part.strip():
                return part.strip(), None, used_vision
            return "", "当前主力模型不支持函数工具，无法完成识图编排。", used_vision

        work.append(_strip_assistant_for_replay(cand))

        async def _run_one_call(tc: dict[str, Any]) -> tuple[str, str, bool]:
            """(tool_call_id, tool_message_content, vision_model_reached_ok)。"""
            tid = str(tc.get("id") or "")
            fn = tc.get("function")
            if not isinstance(fn, dict):
                return tid, "【工具失败】缺少 function 定义。", False
            name = str(fn.get("name") or "")
            args_raw = str(fn.get("arguments") or "")
            args = _parse_tool_arguments(args_raw)
            if name == "analyze_material_image":
                aid = str(args.get("asset_id") or "")
                fq_arg = args.get("focus_question")
                fq = str(fq_arg) if fq_arg is not None else ""
                body = await analyze_material_image_for_tool(asset_id=aid, focus_question=fq)
                ok_vis = not body.startswith("【识图失败】")
                return tid, body, ok_vis
            if name == "save_skill_document":
                fn = str(args.get("filename") or "").strip()
                md = args.get("markdown_content")
                content = md if isinstance(md, str) else ""
                err_pfx = "【写入 Skill 失败】"
                if len(content.encode("utf-8")) > MAX_SKILL_BYTES:
                    return tid, f"{err_pfx}正文超过上限。", False
                try:
                    basename = write_skill_markdown(fn, content)
                    return (
                        tid,
                        f"已写入 Skill：`{basename}`。"
                        "用户下次勾选该文件后即会注入上下文（默认新文件已被勾选生效）。",
                        False,
                    )
                except ValueError as exc:
                    return tid, f"{err_pfx}{exc}", False
                except OSError as exc:
                    return tid, f"{err_pfx}磁盘写入异常：{exc}", False
            return tid, f"【工具失败】未知工具：{name}", False

        call_dicts = [tc for tc in tcalls if isinstance(tc, dict)]
        if not call_dicts:
            for tc in tcalls:
                tid = str(tc.get("id") or "") if isinstance(tc, dict) else ""
                work.append(
                    {
                        "role": "tool",
                        "tool_call_id": tid,
                        "content": "【工具失败】无法解析该次工具调用格式。",
                    }
                )
            continue
        tool_rows = await asyncio.gather(*[_run_one_call(tc) for tc in call_dicts])
        for tid, body, vis_ok in tool_rows:
            if vis_ok:
                used_vision = True
            work.append({"role": "tool", "tool_call_id": tid, "content": body})

    return "", "识图编排达到最大轮次仍未得出最终回复，请缩短上下文或重试。", used_vision

