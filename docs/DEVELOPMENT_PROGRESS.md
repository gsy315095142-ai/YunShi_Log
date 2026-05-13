# Marketing Materials — 开发进展

> 与 `docs/PROJECT_SPEC.md` 配套：**记录当前做到哪一步、如何本地运行**。阶段划分见规范的 §17。

---

## 当前阶段

| 阶段 | 状态 | 备注 |
|------|------|------|
| P0 — 脚手架与数据底座 | **已完成** | FastAPI、Vite/React/TS、`skills/`、`data/` |
| P1 — 配置与 Skill | **已完成** | `user_settings.json`、AI 双配置、Skill 勾选与合并预览 |
| P2 — 素材模块 | **已完成** | `assets_library.json`、`/api/library/*`、前端素材库 |
| P3 — 对话工作台 | **已完成** | `chat_index.json` + `data/chats/{id}.json`；7×24h 滚动清理；`/api/chat/*`；主力 AI 同步 `chat/completions`（可注入已选 Skill）；前端「对话」页签 |
| P4 — 生成链路 | **已完成** | `POST /api/generate/xiaohongshu`；成稿 JSON（配图 id 仅能来自素材库）；Skill/清单截断；前端「成稿」页签 |
| P5 — 识图编排 | **已完成** | `chat_llm.orchestrate_primary_chat_reply`：工具 `analyze_material_image` → 读素材二进制 → **识图 AI**（data URL）→ 回注主力；识图单次失败可提示；网关拒 `tools` 时降级无工具回合 |
| P6 — 打磨 | 未开始 | |

**下一步**：**P6 — 打磨**（错误处理与加载体验、文案统一等）。

---

## API 速查（已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 路径约定（含 `settings_file`、`library_manifest_file`、`chat_index_file`、`chat_dir`） |
| GET | `/api/settings` | 读取用户配置 |
| PATCH | `/api/settings` | 更新配置 |
| GET | `/api/skills` | Skill 列表（含勾选摘要） |
| PUT | `/api/skills/selection` | 勾选持久化 |
| GET | `/api/skills/bundled` | Skill 合并正文 |
| GET | `/api/library/overview` | 素材库汇总 |
| POST | `/api/library/categories` | 新建分类 |
| PATCH | `/api/library/categories/{id}` | 重命名分类 |
| DELETE | `/api/library/categories/{id}` | 删除空分类 |
| POST | `/api/library/assets` | 上传图片 |
| PATCH | `/api/library/assets/{id}` | 编辑素材元数据 |
| DELETE | `/api/library/assets/{id}` | 删除素材与文件 |
| GET | `/api/library/assets/{id}/file` | 读取图片二进制 |
| GET | `/api/chat/sessions` | 会话列表，`retention_ms` = 7×24h |
| POST | `/api/chat/sessions` | 新建会话（`{ title? }`） |
| GET | `/api/chat/sessions/{id}` | 会话详情 + 消息 |
| PATCH | `/api/chat/sessions/{id}` | 重命名会话 |
| DELETE | `/api/chat/sessions/{id}` | 删除会话与消息文件 |
| POST | `/api/generate/xiaohongshu` | 根据 Brief 调用主力 AI 生成小红书成稿（`brief`, `with_skills`, `max_recommended_assets`）；`recommended_asset_ids` 仅能为素材库中存在的 id |
| POST | `/api/chat/sessions/{id}/messages` | 发送用户消息；主力 AI 支持 **OpenAI tools**：`analyze_material_image`（按需识图，`asset_id` 须存在于素材库）。成功触发并跑通识图模型时响应 `used_vision: true`。若网关明确拒绝 `tools`，自动降级为无工具对话（无法再自动识图）。 |

---

## 持久化文件（默认均在 `data/` 下）

| 文件/目录 | 用途 |
|-----------|------|
| `user_settings.json` | AI 与素材根等（见 `.gitignore`） |
| `assets_library.json` | 素材清单 |
| `chat_index.json` | 会话索引 |
| `chats/{session_id}.json` | 各会话消息数组 |

---

## 本地运行

**后端**（需 `httpx`、`python-multipart` 等，见 `requirements.txt`）：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**前端**：

```bash
cd frontend
npm install
npm run dev
```

---

## 会话日志

| 日期 | 内容 |
|------|------|
| 2026-05-13 | P0–P2 交付（见历史版本）。 |
| 2026-05-13 | 完成 **P4**：`generate_service`、`routes_generate`（小红书成稿）、前端「成稿」页签。 |
| 2026-05-13 | 完成 **P5**：按需识图工具链、`format_asset_catalog_for_llm_prompt`、对话接口 `used_vision`、前端提示。 |

---

*最后更新：2026-05-13*
