# 日常更新手册 — 运势 Log（阿里云 / 宝塔）

> 前提：已按 `DEPLOY_BAOTA.md` 完成首次部署，服务器通过 git 管理代码。
> 代码在服务器的位置：`/www/server/su-yunshi-log/`（即仓库克隆目录）。

---

## 一、后端代码更新（每次迭代）

本地 `git push` 之后，在**宝塔网页终端**执行：

```bash
cd /www/server/su-yunshi-log
git pull
```

然后**重启后端**（二选一）：

- 宝塔面板 → **Supervisor** → `su-yunshi-log` → 点「重启」；
- 或终端执行：`supervisorctl restart su-yunshi-log`

重启仅需 1~3 秒，期间请求会短暂失败，属正常现象。

### 依赖有变化时（requirements.txt 改了才需要）

```bash
cd /www/server/su-yunshi-log/backend
source .venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
deactivate
# 然后再重启后端
```

### 数据库：不用动

启动时会自动建表、自动补新列（见 `backend/app/db/init_db.py` 的 `_COLUMN_MIGRATIONS`）。
**千万不要**把本地 `backend/data/app.db` 上传到服务器，会覆盖线上数据。

---

## 二、前端更新

本地项目根目录执行 `build-frontend.bat`（或 `cd frontend && npm run build`），
把 `frontend/dist/` **里面的所有文件**上传覆盖到服务器：

```
/www/wwwroot/lumiclaw.top/sylog/
```

纯静态文件，上传即生效，**不需要重启任何服务**；用户刷新页面即可看到新版。

---

## 三、回滚（出问题时）

```bash
cd /www/server/su-yunshi-log
git log --oneline -5            # 找到上一个正常版本的 commit 号
git checkout <commit号>          # 切回旧代码
# 重启后端（Supervisor 点重启）
# 排查完后切回主分支：git checkout master && git pull
```

前端回滚同理：重新构建旧版本 dist 上传，或保留每次上传前的旧 dist 备份。

---

## 四、自检三连

```bash
curl -s http://127.0.0.1:8000/health          # {"status":"ok"} 即后端正常
supervisorctl status su-yunshi-log            # RUNNING 即进程正常
```

浏览器打开 `http://www.lumiclaw.top/sylog/` 能登录即全链路正常。
