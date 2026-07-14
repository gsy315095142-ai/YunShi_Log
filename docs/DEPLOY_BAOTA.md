# 宝塔部署指南 — lumiclaw.top /sylog/

> 适用环境：宝塔面板、HTTP（无 SSL）、本机打包上传前端  
> 访问地址：`http://www.lumiclaw.top/sylog/`（首页不链接，知道地址才能进入）

---

## 部署架构

```
浏览器
  → http://www.lumiclaw.top/sylog/*     静态前端（dist 上传到网站目录/sylog/）
  → http://www.lumiclaw.top/api/v1/*    nginx 反代 → 127.0.0.1:8000 后端
  → 127.0.0.1:8888                      SearXNG（同机，已对接）
```

| 路径 | 说明 |
|------|------|
| 网站根目录 | `/www/wwwroot/lumiclaw.top` |
| 前端目录 | `/www/wwwroot/lumiclaw.top/sylog/` |
| 后端目录（建议） | `/www/server/su-yunshi-log/`（放在网站根外更安全） |
| 数据库 | `/www/server/su-yunshi-log/data/app.db` |

---

## 第 0 步：升级 Python（必做）

系统自带 **Python 3.6.8 无法运行本项目**，需要 **Python 3.10 或 3.11**。

### 方法 A：宝塔 Python 项目管理器（推荐）

1. 宝塔 → **软件商店** → 搜索 **Python项目管理器** → 安装  
2. 打开项目管理器 → **版本管理** → 安装 **3.10** 或 **3.11**  
3. 安装完成后，SSH 验证（路径以宝塔实际为准）：

```bash
/www/server/pyporject_evn/versions/3.11.*/bin/python3.11 --version
```

### 方法 B：SSH 查看系统后安装

先确认系统：

```bash
cat /etc/os-release
```

#### Alibaba Cloud Linux 3 / CentOS Stream 8+

```bash
sudo dnf install -y python3.11 python3.11-pip
python3.11 --version
```

#### CentOS 7 / Alibaba Cloud Linux 2（常见 3.6 环境）

```bash
sudo yum install -y gcc openssl-devel bzip2-devel libffi-devel zlib-devel wget make
cd /tmp
wget https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
tar -xf Python-3.11.9.tgz
cd Python-3.11.9
./configure --enable-optimizations --prefix=/usr/local/python311
make -j$(nproc)
sudo make altinstall
/usr/local/python311/bin/python3.11 --version
```

成功后用 **`python3.11`** 创建虚拟环境，不要用系统 `python3`。

---

## 第 1 步：本机打包前端

在 Windows 项目根目录：

```bat
build-frontend.bat
```

或：

```bat
cd frontend
npm install
npm run build
```

将 `frontend/dist/` **里面的所有文件**（不是 dist 文件夹本身）上传到服务器：

```
/www/wwwroot/lumiclaw.top/sylog/
```

上传后应有：

```
/www/wwwroot/lumiclaw.top/sylog/index.html
/www/wwwroot/lumiclaw.top/sylog/assets/...
```

---

## 第 2 步：上传后端

将以下内容打包上传到 `/www/server/su-yunshi-log/`：

```
backend/
  app/
  requirements.txt
  run-prod.sh
```

**不要上传**：`backend/.venv/`、`__pycache__/`、`data/app.db`（服务器上自动生成）

### 在服务器创建虚拟环境并安装依赖

SSH 登录后（把 `python3.11` 换成你实际的 3.10+ 路径）：

```bash
cd /www/server/su-yunshi-log/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
python -c "from app.main import app; print('backend ok')"
deactivate
```

---

## 第 3 步：配置环境变量

在 `/www/server/su-yunshi-log/backend/` 创建 `.env`（或写在宝塔 Python 项目环境变量里）：

```bash
JWT_SECRET=请换成一长串随机字符
APP_SECRET=同上或另设一串
CORS_ORIGINS=http://www.lumiclaw.top,http://lumiclaw.top
SEARXNG_BASE_URL=http://127.0.0.1:8888
SEARXNG_ENABLED=true
```

> 勿将 `.env` 提交到 Git。生产环境务必改掉默认管理员密码。

若用文件方式，需在启动前 `export $(cat .env | xargs)` 或由宝塔面板填写。

---

## 第 4 步：宝塔运行后端

### 方式 A：Python 项目管理器

1. **添加项目**  
   - 项目路径：`/www/server/su-yunshi-log/backend`  
   - Python 版本：3.10 / 3.11  
   - 启动方式：`uvicorn`  
   - 启动命令：`app.main:app`  
   - 绑定：`127.0.0.1:8000`  

2. 在项目中安装依赖（界面一般有「模块」或手动 `pip install -r requirements.txt`）

3. 环境变量填入第 3 步内容

### 方式 B：Supervisor（宝塔 → 软件商店 → Supervisor）

```ini
[program:su-yunshi-log]
directory=/www/server/su-yunshi-log/backend
command=/www/server/su-yunshi-log/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
autostart=true
autorestart=true
user=www
environment=JWT_SECRET="你的密钥",CORS_ORIGINS="http://www.lumiclaw.top,http://lumiclaw.top"
```

---

## 第 5 步：配置 nginx（宝塔网站设置）

网站 **lumiclaw.top** → **设置** → **配置文件**，在 `server { ... }` 内增加：

```nginx
# 苏运势 Log 前端（SPA）
location /sylog/ {
    root /www/wwwroot/lumiclaw.top;
    try_files $uri $uri/ /sylog/index.html;
}

# 无尾斜杠时跳转
location = /sylog {
    return 301 /sylog/;
}

# 后端 API 反代
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

保存后 **重载 nginx**。

---

## 第 6 步：自检

| 检查项 | 命令或地址 |
|--------|------------|
| 后端健康 | SSH：`curl -s http://127.0.0.1:8000/health` → `{"status":"ok"}` |
| API 反代 | 浏览器或 curl：`http://www.lumiclaw.top/api/v1/ai/providers` |
| 前端 | `http://www.lumiclaw.top/sylog/` → 登录页 |
| 登录 | `Guosy` / `1234567890`（部署后建议改密） |
| SearXNG | SSH：`curl -s "http://127.0.0.1:8888/search?q=test&format=json" \| head -c 200` |

---

## 常见问题

### 打开 /sylog/ 空白或 404

- 确认 `index.html` 在 `/www/wwwroot/lumiclaw.top/sylog/` 下  
- 确认 nginx 已加 `location /sylog/` 并重载  

### 登录提示网络错误

- 后端是否运行：`curl http://127.0.0.1:8000/health`  
- nginx 是否配置 `location /api/`  
- `CORS_ORIGINS` 是否包含 `http://www.lumiclaw.top`  

### AI 测算没有联网信息

- 后端与 SearXNG 须在同一台机  
- `SEARXNG_BASE_URL=http://127.0.0.1:8888`  

### pip 安装失败

- 确认用的是 **3.10+** 的 venv，不是系统 `python3`（3.6）  

---

## 访问地址（备忘）

- 项目入口：`http://www.lumiclaw.top/sylog/`  
- 现有首页：`http://www.lumiclaw.top/index.html`（无需修改、无需加链接）
