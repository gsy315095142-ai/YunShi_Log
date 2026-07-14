#!/bin/bash
# 生产环境启动（在 backend 目录下执行）
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
# 生产环境请在同目录 .env 或宝塔环境中设置 JWT_SECRET、CORS_ORIGINS 等
exec uvicorn app.main:app --host 127.0.0.1 --port 8000
