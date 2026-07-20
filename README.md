# 运势 Log

手机优先的网页应用：个人信息管理、每日事件记录、AI 运势测算。

## 当前状态

- Phase 1～5 已完成，**已上线**：`http://www.lumiclaw.top/sylog/`（阿里云 + 宝塔，HTTP 阶段）
- 当前版本 v0.1.26072001（登录页可查看版本更新说明）
- 需求与设计见 [`docs/PROJECT_DESIGN.md`](docs/PROJECT_DESIGN.md)
- 首次部署见 [`docs/DEPLOY_BAOTA.md`](docs/DEPLOY_BAOTA.md)；日常更新（发版/回滚）见 [`docs/UPDATE_RUNBOOK.md`](docs/UPDATE_RUNBOOK.md)

## 功能一览

- **个人信息**：姓名、公历生日、出生时间（可选）、MBTI（16 型下拉选择）；自动推算农历、星座、生肖、天干五行、纳音五行、日主五行（三种五行各配 ⓘ 说明弹窗）
- **每日记录**：月历视图，同日单条记录；今日卡片直接写/改/删，历史日期走底部弹层；「测算今日运势」一键跳 AI 页预填
- **AI 测算**：「测算大师」聊天式解读，支持 DeepSeek / 智谱（弹窗式配置）
  - 自动读取个人命理档案（以日主五行为本命核心）
  - 双层对话记忆：最近 20 条原文 + 更早对话滚动压缩为摘要
  - 思考模式默认开启，思考内容独立框展示
  - **工具调用**：用户明确指示时可直接写入/修改每日记录（只开放写、不开放删），聊天气泡显示操作回执
  - 输入 @ 关联某日记录；SearXNG 联网搜索辅助分析

## 本地启动

```bat
start-dev.bat
```

或分别启动：

```bat
# 后端
cd backend
run-backend.bat

# 前端
cd frontend
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173
- 后端：http://127.0.0.1:8000
- API 文档：http://127.0.0.1:8000/docs

## 局域网访问（手机真机调试）

`start-dev.bat` 启动完成后会在窗口中自动显示局域网访问地址，例如：

```
  Local:   http://127.0.0.1:5173/sylog/
  LAN:     http://192.168.1.52:5173/sylog/
```

同一 Wi-Fi 下的手机或其他设备，浏览器直接打开 **LAN** 那一行的地址即可访问。

- 原理：`vite.config.ts` 中已配置 `server.host: true`，Vite 与后端（uvicorn `--host 0.0.0.0`）均监听局域网；IP 由 `scripts/get-lan-ip.ps1` 自动探测（优先取有默认网关的网卡）。
- API 请求走 Vite 代理回本机后端，对访问设备全程同源，无跨域问题。
- 首次启动若 Windows 弹出防火墙提示，需允许 **Node.js 通过专用网络**，否则其他设备连不上 5173。
- 若 LAN 地址显示 "could not detect LAN IP"，请检查本机网络连接后重启脚本。

## 默认管理员

- 用户名：`Guosy`
- 密码：`1234567890`

## 项目结构

```
backend/app/
  auth/       登录注册 JWT
  profile/    个人信息
  records/    每日记录
  fortune/    农历/星座/生肖/三种五行推算（纯函数）
  ai/         AI 配置、聊天、上下文拼装、摘要压缩
    providers/  DeepSeek、智谱独立适配
  search/     SearXNG 联网搜索（已对接）
  db/         SQLite 模型、初始化与轻量列迁移
frontend/src/
  pages/      各页面
  api/        按域拆分的 API 客户端
  components/ 布局、路由守卫、日历格子、记录弹层、聊天窗口等
  hooks/      useMonthRecords、useAIChat
```

## 线上部署（已完成）

- 地址：`http://www.lumiclaw.top/sylog/`
- 架构：nginx 托管前端静态文件（`/sylog/`）+ 反代 API（`/api/` → `127.0.0.1:8000`）；后端由 Supervisor 常驻守护；数据库 SQLite 自动建表迁移
- 代码管理：服务器通过 git 克隆本仓库（GitHub Deploy Keys），更新只需 `git pull` + 重启
- 详细流程：[`docs/DEPLOY_BAOTA.md`](docs/DEPLOY_BAOTA.md)；日常更新：[`docs/UPDATE_RUNBOOK.md`](docs/UPDATE_RUNBOOK.md)

## 待完成（未来规划）

- HTTPS 证书（语音输入的前置条件，浏览器只对安全上下文开放麦克风）
- 语音输入（阿里服务器已有 ASR 服务，待 HTTPS 后接入）

## 联网搜索（SearXNG）

后端已对接阿里云同机 SearXNG，默认地址 `http://127.0.0.1:8888`。

环境变量（可选）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SEARXNG_BASE_URL` | `http://127.0.0.1:8888` | SearXNG 地址 |
| `SEARXNG_ENABLED` | `true` | 是否启用搜索 |
| `SEARXNG_MAX_RESULTS` | `5` | 注入 AI 的结果条数 |
| `SEARXNG_TIMEOUT_SEC` | `10` | 请求超时秒数 |

本地开发若无 SearXNG，搜索失败会自动跳过，不影响 AI 聊天。
