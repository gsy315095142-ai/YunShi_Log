#!/bin/bash
# 生产环境启动（在 backend 目录下执行）
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
# 自动加载同目录 .env（JWT_SECRET、CORS_ORIGINS 等），勿将 .env 提交到 Git
set -a
[ -f .env ] && . ./.env
set +a
# 优先使用本目录 venv 中的 uvicorn（Supervisor 直接调用本脚本时无需先激活 venv）
if [ -x .venv/bin/uvicorn ]; then
  UVICORN=.venv/bin/uvicorn
else
  UVICORN=uvicorn
fi
exec "$UVICORN" app.main:app --host 127.0.0.1 --port 8000
