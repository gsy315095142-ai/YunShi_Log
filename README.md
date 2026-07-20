# 运势 Log

手机优先的网页应用：个人信息管理、每日事件记录、AI 运势测算。

## 当前状态

- Phase 1～4 已完成（后端 API + SQLite + 前端 SPA），Phase 5 部署文档就绪、待服务器执行
- 当前版本 v0.1.26072001（登录页可查看版本更新说明）
- 需求与设计见 [`docs/PROJECT_DESIGN.md`](docs/PROJECT_DESIGN.md)

## 功能一览

- **个人信息**：姓名、公历生日、出生时间（可选）、MBTI；自动推算农历、星座、生肖、天干五行、纳音五行、日主五行（三种五行各配 ⓘ 说明弹窗）
- **每日记录**：月历视图，同日多条记录，底部弹层增删改
- **AI 测算**：「测算大师」聊天式解读，支持 DeepSeek / 智谱
  - 自动读取个人命理档案（以日主五行为本命核心）
  - 双层对话记忆：最近 20 条原文 + 更早对话滚动压缩为摘要
  - 思考模式默认开启，思考内容独立框展示
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

## 待完成

- 阿里云实际上线部署（步骤见 [`docs/DEPLOY_BAOTA.md`](docs/DEPLOY_BAOTA.md)）

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
