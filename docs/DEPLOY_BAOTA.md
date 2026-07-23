# 宝塔部署指南 — lumiclaw.top /sylog/

> ✅ 部署已于 2026-07-20 完成，本文档按**实际执行过程**记录，可用于重装/迁移/新机器复刻。
> 日常迭代更新请看 [`UPDATE_RUNBOOK.md`](UPDATE_RUNBOOK.md)。
> 访问地址：`http://www.lumiclaw.top/sylog/`（首页不链接，知道地址才能进入）

---

## 部署架构

```
浏览器
  → http://www.lumiclaw.top/sylog/*     静态前端（dist 上传到网站目录/sylog/）
  → http://www.lumiclaw.top/api/v1/*    nginx 反代 → 127.0.0.1:8000 后端（Supervisor 守护）
  → 127.0.0.1:8888                      SearXNG（同机，已对接）
```

| 路径 | 说明 |
|------|------|
| 网站根目录 | `/www/wwwroot/lumiclaw.top` |
| 前端目录 | `/www/wwwroot/lumiclaw.top/sylog/` |
| 代码目录 | `/www/server/su-yunshi-log/`（git 克隆，**root** 操作） |
| 数据库 | `/www/server/su-yunshi-log/data/app.db`（首次启动自动创建） |
| 后端进程 | Supervisor 程序 `su-yunshi-log`，启动命令 `bash backend/run-prod.sh` |
| Python | `/usr/bin/python3.11`（dnf 安装，与系统 3.6 共存）；venv 在 `backend/.venv/` |

---

## 第 0 步：Python 环境

系统自带 **Python 3.6.8 无法运行本项目**，服务器上已通过 dnf 安装 **Python 3.11**：

```bash
/usr/bin/python3.11 --version   # Python 3.11.x
```

若新机器没有：`sudo dnf install -y python3.11 python3.11-pip`（Alibaba Cloud Linux 3 / CentOS Stream 8+）；
CentOS 7 需源码编译，参见 git 历史版本文档。

## 第 1 步：服务器 git 拉取代码（一次性配置）

```bash
# 生成服务器自己的密钥（三个提示全部回车）
ssh-keygen -t ed25519 -C "aliyun-yunshi-log-root"
cat ~/.ssh/id_ed25519.pub
```

把公钥添加到 GitHub 仓库 **Settings → Deploy keys**（只读即可，可挂多把）。
⚠️ 注意操作用户：宝塔终端是 **root**，阿里云控制台终端是 **admin**，密钥各归各的用户，别混。

```bash
ssh -T git@github.com        # 看到 Hi ...! 即成功
mkdir -p /www/server
cd /www/server
git clone git@github.com:gsy315095142-ai/YunShi_Log.git su-yunshi-log
```

## 第 2 步：虚拟环境与依赖

```bash
cd /www/server/su-yunshi-log/backend
/usr/bin/python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
python -c "from app.main import app; print('backend ok')"
deactivate
```

## 第 3 步：环境变量 `.env`

```bash
printf 'JWT_SECRET=%s\nAPP_SECRET=%s\nCORS_ORIGINS=http://www.lumiclaw.top,http://lumiclaw.top\nSEARXNG_BASE_URL=http://127.0.0.1:8888\nSEARXNG_ENABLED=true\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > /www/server/su-yunshi-log/backend/.env
```

`run-prod.sh` 启动时自动加载该文件。`.env` 不入 git，`git pull` 永远不会覆盖它。

## 第 4 步：Supervisor 守护后端

宝塔 → 软件商店 → 安装 **Supervisor管理器** → 添加守护进程：

| 字段 | 值 |
|------|-----|
| 名称 | `su-yunshi-log` |
| 启动用户 | `root`（见下方权限坑） |
| 运行目录 | `/www/server/su-yunshi-log/backend` |
| 启动命令 | `bash /www/server/su-yunshi-log/backend/run-prod.sh` |
| 进程数量 | 1 |

> ⚠️ **权限坑（实际踩过）**：代码是 root 克隆的，若启动用户填 `www`，进程对 `data/` 目录无写权限——
> 症状是"页面能打开、但新增记录报请求失败"（SQLite 只读）。要么启动用户=root，要么 `chown -R www:www /www/server/su-yunshi-log`。

## 第 5 步：nginx 配置（已配置，无需改动）

网站 **lumiclaw.top** → 设置 → 配置文件，`server {}` 内已有：

```nginx
location /sylog/ {
    root /www/wwwroot/lumiclaw.top;
    try_files $uri $uri/ /sylog/index.html;
}
location = /sylog {
    return 301 /sylog/;
}
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

将来上 HTTPS 时建议补 `proxy_set_header X-Forwarded-Proto $scheme;`。

## 第 6 步：前端上传

本机执行 `build-frontend.bat` 打 zip，或直接压缩 `frontend/dist/` 内容；
宝塔 **文件** → 进入 `/www/wwwroot/lumiclaw.top/sylog/` → 清空旧文件 → 上传 zip → 解压到当前目录；
确认 `sylog/index.html` 与 `sylog/assets/` 就位。

> 注：这是**首次部署**的做法。2026-07-21 起服务器已装 Node.js，
> **日常更新**改为在服务器上 `git pull` 后执行 `bash scripts/deploy-frontend.sh` 直接构建同步，
> 详见 `UPDATE_RUNBOOK.md`「二、前端更新」。

## 第 7 步：自检

| 检查项 | 命令或地址 |
|--------|------------|
| 后端健康 | SSH：`curl -s http://127.0.0.1:8000/health` → `{"status":"ok"}` |
| 进程 | `supervisorctl status su-yunshi-log` → RUNNING |
| API 反代 | `http://www.lumiclaw.top/api/v1/ai/providers` |
| 前端 | `http://www.lumiclaw.top/sylog/` → 登录页 |
| 登录 | `guosy` / `1234567890`（**部署后尽快改密**） |

---

## 常见问题

### 页面能开，新增记录报"请求失败"

运行用户与文件属主不一致（见第 4 步权限坑）。查 `ps aux \| grep uvicorn` 看运行用户，
`supervisorctl tail su-yunshi-log stderr` 看真实报错。

### 打开 /sylog/ 空白或 404

确认 `index.html` 在 `/www/wwwroot/lumiclaw.top/sylog/` 下，且 nginx `location /sylog/` 存在。

### 登录提示网络错误

后端是否运行（`curl 127.0.0.1:8000/health`）；nginx 是否有 `location /api/`。

### AI 测算没有联网信息

后端与 SearXNG 须同机，`SEARXNG_BASE_URL=http://127.0.0.1:8888`。

### 遗留备份目录

首次部署前的旧文件备份在 `/www/server/su-yunshi-log.bak`，验证无误后可删除。

---

## 访问地址（备忘）

- 项目入口：`http://www.lumiclaw.top/sylog/`
- 现有首页：`http://www.lumiclaw.top/index.html`（无需修改、无需加链接）
