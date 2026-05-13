from __future__ import annotations

import json
from typing import Any

from app.chat_llm import completion_chat
from app.library_manifest import LIBRARY_MANIFEST_FILENAME, LibraryState, build_overview, load_state
from app.user_settings import load_settings, read_selected_skill_text

MAX_SKILL_CHARS = 28_000
MAX_ASSETS_IN_CATALOG = 140
MAX_CATALOG_CHARS = 14_000
GEN_TEMPERATURE = 0.45


GEN_SYSTEM_PROMPT = """你是一个「小红书笔记成稿生成器」，必须严格按用户给定的 Brief 产出**单条小红书笔记方案的 JSON**。

硬性规则：
1. 输出必须是 **一个合法 JSON 对象**（UTF-8 文本）。除 JSON 外不要输出其它字符（不要用 Markdown 围栏，不要前言后语）。
2. `recommended_asset_ids` 中出现的 **每一个** id 必须完全来自下文「素材库清单」中出现的 id；若没有合适素材填 `[]`。禁止编造素材 id。
3. **禁止**编造任何图片 URL / 文件名 / CDN 路径。若配图需落地，仅能引用素材库 id（由系统自动映射为真实文件）。
4. 文风与写法需优先遵循「Skill 正文」中与小红书相关的范例与禁区（若有）；不要机械抄写 Skill。
5. `body` 使用 `\\n` 表示段落换行，适合直接粘贴到小红书编辑区。


JSON 字段（键名保持一致）：
- `title`: string — 吸引眼球的标题。
- `hook`: string — 开头的 1～2 句钩子（可为空字符串）。
- `body`: string — 正文分段（段落间用 \\n）。
- `tags`: string[] — 3～10 个小红书标签，每项以 `#` 开头或可被用户手动加 `#`。
- `recommended_asset_ids`: string[] — 0～{max_pick} 个素材库 id。
- `asset_rationale`: string — 用一句话说明为什么选择这些配图（如不选则说明原因）。
"""


def _category_name_map(state: LibraryState) -> dict[str, str]:
    return {c.id: c.name for c in state.categories}


def _build_catalog_text(state: LibraryState) -> tuple[str, int, dict[str, dict[str, Any]]]:
    cmap = _category_name_map(state)
    assets_sorted = sorted(
        state.assets,
        key=lambda a: (-a.updated_at_ms, a.display_name),
    )

    truncated_note = ""
    if len(assets_sorted) > MAX_ASSETS_IN_CATALOG:
        truncated_note = (
            f"\n（清单仅收录最近更新的 {MAX_ASSETS_IN_CATALOG} 条；库内共 {len(assets_sorted)} 条）"
        )

    packed: list[tuple[str, dict[str, Any]]] = []
    for a in assets_sorted[:MAX_ASSETS_IN_CATALOG]:
        cn = cmap.get(a.category_id, "")
        note = (a.notes or "").replace("\r", "").replace("\n", " ").strip()
        if len(note) > 160:
            note = note[:160] + "…"
        line = f"- id={a.id}｜名称={a.display_name}｜分类={cn}｜备注={note or '—'}"
        meta: dict[str, Any] = {
            "id": a.id,
            "category_id": a.category_id,
            "category_name": cn,
            "display_name": a.display_name,
            "notes": a.notes,
        }
        packed.append((line, meta))

    if not packed:
        text_only = truncated_note.strip()
        return text_only, 0, {}

    suffix = truncated_note.strip()
    while packed:
        body = "\n".join(line for line, _ in packed).strip()
        candidate = body if not suffix else (body + "\n" + suffix).strip()
        if len(candidate) <= MAX_CATALOG_CHARS:
            by_id = {m["id"]: m for _, m in packed}
            return candidate, len(by_id), by_id
        packed.pop()

    if suffix:
        return suffix, 0, {}
    return "", 0, {}


def _truncate_skills(skill_text: str) -> tuple[str, bool]:
    t = skill_text.strip()
    if len(t) <= MAX_SKILL_CHARS:
        return t, False
    return t[:MAX_SKILL_CHARS] + "\n\n…（Skill 正文过长，已在服务端截断以控制上下文长度）", True


def extract_json_object(text: str) -> dict[str, Any] | None:
    s = text.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()

    try:
        data = json.loads(s)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    lpos = s.find("{")
    rpos = s.rfind("}")
    if lpos == -1 or rpos <= lpos:
        return None
    chunk = s[lpos : rpos + 1]
    try:
        data = json.loads(chunk)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _coerce_str(v: Any) -> str:
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, (int, float)):
        return str(v).strip()
    return ""


def _coerce_tags(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for it in v:
        s = _coerce_str(it)
        if not s:
            continue
        if not s.startswith("#"):
            s = "#" + s.lstrip("#")
        out.append(s)
    seen: set[str] = set()
    uniq: list[str] = []
    for t in out:
        if t not in seen:
            uniq.append(t)
            seen.add(t)
    return uniq[:14]


def _coerce_asset_ids(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    ids: list[str] = []
    for it in v:
        if isinstance(it, str) and it.strip():
            ids.append(it.strip())
        elif isinstance(it, (int, float)):
            ids.append(str(it).strip())
    return ids[:24]


async def generate_xhs_post(
    *,
    brief: str,
    with_skills: bool,
    max_recommended_assets: int,
) -> dict[str, Any]:
    warnings: list[str] = []
    brief_clean = brief.strip()
    if not brief_clean:
        raise ValueError("需求描述不能为空")

    cap = max(0, min(12, max_recommended_assets))

    state = load_state()
    catalog_text, _n, catalog_by_id = _build_catalog_text(state)
    if not catalog_text:
        warnings.append("素材库暂无条目：配图仅能返回空数组。")

    skill_block = ""
    if with_skills:
        txt, _files = read_selected_skill_text(load_settings())
        skill_block_raw = txt.strip()
        if not skill_block_raw:
            warnings.append("已开启 Skill 注入，但当前勾选内容为空或未读到文本。")
        else:
            skill_block, skill_truncated = _truncate_skills(skill_block_raw)
            if skill_truncated:
                warnings.append("Skill 上下文过长已截断。")

    ov = build_overview(state)

    schema_hint = GEN_SYSTEM_PROMPT.format(max_pick=cap)

    system_parts = [
        schema_hint,
        "\n\n## 当前素材清单（仅能使用其中的 id）\n",
        catalog_text if catalog_text else "（暂无素材）",
    ]
    if skill_block:
        system_parts.extend(
            [
                "\n\n## Skill（已勾选，作文风与硬性规则参考）\n",
                skill_block,
            ],
        )

    system_msg = "".join(system_parts).strip()

    user_msg = (
        "## Brief（用户本次需求）\n"
        f"{brief_clean}\n\n"
        f"请记住：`recommended_asset_ids` 至多 {cap} 个；必须使用清单中的合法 id。\n"
    )

    outbound: list[dict[str, str]] = [
        {"role": "system", "content": system_msg[:120_000]},
        {"role": "user", "content": user_msg[:24_000]},
    ]

    raw, err = await completion_chat(outbound_messages=outbound, temperature=GEN_TEMPERATURE)
    if raw is None:
        return {
            "ok": False,
            "llm_error": err,
            "parse_error": None,
            "parsed": False,
            "warnings": warnings,
            "raw_model_text": None,
            "generation_raw_preview": None,
            "draft": None,
            "recommended_assets": [],
        }

    blob = extract_json_object(raw)
    parsed_ok = blob is not None
    draft: dict[str, Any] | None = None
    dropped_invalid: list[str] = []

    if blob is None:
        warnings.append("模型输出不是可解析的单体 JSON；请重试或在 Brief 里要求「只输出 JSON」。")
    else:
        title = _coerce_str(blob.get("title")) or "未命名笔记"
        hook = _coerce_str(blob.get("hook"))
        body = _coerce_str(blob.get("body")) or _coerce_str(blob.get("content"))
        rationale = _coerce_str(blob.get("asset_rationale"))
        disclaim = _coerce_str(blob.get("disclaimer"))

        ids = _coerce_asset_ids(blob.get("recommended_asset_ids"))

        validated: list[str] = []
        for aid in ids:
            if aid in catalog_by_id:
                validated.append(aid)
            else:
                dropped_invalid.append(aid)
        if dropped_invalid:
            warnings.append(f"下列 id 不存在于素材库，已移除：{', '.join(dropped_invalid[:12])}")

        if len(validated) > cap:
            original_n = len(validated)
            validated = validated[:cap]
            warnings.append(f"模型推荐了 {original_n} 张配图，已按上限 {cap} 截取。")

        draft = {
            "title": title[:200],
            "hook": hook[:300],
            "body": body,
            "tags": _coerce_tags(blob.get("tags")),
            "recommended_asset_ids": validated,
            "asset_rationale": rationale[:600],
            "disclaimer": disclaim[:400],
        }

    enriched: list[dict[str, Any]] = []
    if draft:
        dto_assets = ov.assets if isinstance(ov.assets, list) else []
        by_full = {
            str(x.get("id")): x
            for x in dto_assets
            if isinstance(x, dict) and x.get("id") is not None
        }
        for aid in draft["recommended_asset_ids"]:
            meta = catalog_by_id.get(aid)
            overview_row = by_full.get(aid, {})
            disp = overview_row.get("display_name") if overview_row else None
            row: dict[str, Any] = {
                "id": aid,
                "display_name": (meta.get("display_name") if meta else None) or disp,
                "category_name": meta.get("category_name") if meta else None,
                "file_missing": overview_row.get("file_missing"),
                "file_url": overview_row.get("file_url"),
            }
            enriched.append(row)

    parse_error = None if parsed_ok else "模型响应不是可解析的单体 JSON。"

    return {
        "ok": parsed_ok,
        "llm_error": None,
        "parse_error": parse_error,
        "parsed": parsed_ok,
        "warnings": warnings,
        "manifest_hint": LIBRARY_MANIFEST_FILENAME,
        "effective_assets_root": ov.effective_root,
        "catalog_asset_count_returned": len(catalog_by_id),
        "raw_model_text": None if parsed_ok else raw,
        "generation_raw_preview": (raw[:28_000] + ("\n…(截断)" if len(raw) > 28_000 else ""))
        if parsed_ok
        else None,
        "draft": draft,
        "recommended_assets": enriched if draft else [],
    }
