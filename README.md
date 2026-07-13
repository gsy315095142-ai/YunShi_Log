# 苏运势 Log

手机优先的网页应用：个人信息管理、每日事件记录、AI 运势测算。

## 当前状态

- Phase 0～4 第一版骨架已搭建（后端 API + SQLite + 前端 SPA）
- 需求与设计见 [`docs/PROJECT_DESIGN.md`](docs/PROJECT_DESIGN.md)

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

## 默认管理员

- 用户名：`Guosy`
- 密码：`1234567890`

## 项目结构

```
backend/app/
  auth/       登录注册 JWT
  profile/    个人信息
  records/    每日记录
  fortune/    农历/星座/五行/生肖推算（纯函数）
  ai/         AI 配置与聊天
    providers/  DeepSeek、智谱独立适配
  search/     联网搜索占位（待对接）
  db/         SQLite 模型与初始化
frontend/src/
  pages/      各页面
  api/        按域拆分的 API 客户端
  components/ 布局、路由守卫
```

## 待完成

- 生产环境部署文档与配置

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
