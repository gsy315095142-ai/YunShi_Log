#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FunASR 常驻 HTTP 服务（ONNX 量化版，低内存）

背景：原 PyTorch 版 paraformer 大模型加载峰值内存 3.2G+，在 3.5G 内存的
阿里云 ECS 上必然触发 OOM。本版本改用 funasr-onnx + int8 量化模型，
常驻内存约 500~800MB，识别速度在 CPU 上也更快。

接口与原服务完全一致：POST /transcribe，multipart 字段 file，返回 {"text": ...}
依赖：pip install funasr-onnx flask librosa soundfile（另需系统 ffmpeg 用于 webm/m4a 转码）
运行：python funasr_server_onnx.py [--port 19528]
"""
import argparse
import os
import sys
import tempfile
import threading

try:
    from flask import Flask, jsonify, request
except ImportError:
    print("请先安装 Flask: pip install flask", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB

# Paraformer-large 官方 ONNX 仓库（含 model_quant.onnx 量化模型）
MODEL_DIR = "damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-onnx"
# 标点恢复模型（可选，加载失败则输出无标点文本）
PUNC_DIR = "damo/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"

_model = None
_punc_model = None  # False 表示加载失败，不再重试
# onnxruntime 多线程推理未必线程安全，串行化调用
_lock = threading.Lock()


def get_model():
    global _model
    if _model is None:
        from funasr_onnx import Paraformer

        print("正在加载 Paraformer ONNX 量化模型（首次需下载约 300MB）...", flush=True)
        _model = Paraformer(MODEL_DIR, batch_size=1, quantize=True)
        print("ASR 模型加载完成", flush=True)
    return _model


def get_punc_model():
    global _punc_model
    if _punc_model is None:
        try:
            from funasr_onnx import CT_Transformer

            print("正在加载标点模型...", flush=True)
            _punc_model = CT_Transformer(PUNC_DIR)
            print("标点模型加载完成", flush=True)
        except Exception as e:  # 标点模型是锦上添花，失败不阻断识别
            print(f"标点模型加载失败，将输出无标点文本: {e}", flush=True)
            _punc_model = False
    return _punc_model or None


def convert_to_wav_if_needed(audio_path):
    """webm/m4a/ogg/mp3 等转为 16k 单声道 wav（需系统装有 ffmpeg）"""
    ext = os.path.splitext(audio_path)[1].lower()
    if ext in (".webm", ".ogg", ".mp3", ".m4a"):
        import librosa
        import soundfile as sf

        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        fd, wav_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        sf.write(wav_path, y, sr)
        return wav_path
    return None


def extract_text(res):
    """兼容 funasr-onnx 各版本返回格式：[{'preds': ...}] / [text] / preds 为 (text, timestamps)"""
    if not res:
        return ""
    item = res[0]
    if isinstance(item, dict):
        v = item.get("preds") or item.get("text") or ""
    else:
        v = item
    if isinstance(v, (list, tuple)):
        v = v[0] if v else ""
    return str(v).strip()


def transcribe_audio(audio_path):
    work_path = audio_path
    converted = None
    try:
        converted = convert_to_wav_if_needed(audio_path)
        if converted:
            work_path = converted

        model = get_model()
        with _lock:
            text = extract_text(model(work_path))
            punc = get_punc_model()
            if punc and text:
                pr = punc(text)
                if pr:
                    t = pr[0] if isinstance(pr, list) else pr
                    # CT_Transformer 返回 ('文字', [标点位置编码])，只取文字部分
                    if isinstance(t, (list, tuple)):
                        t = t[0] if t else ""
                    if t:
                        text = str(t).strip()
        return text
    finally:
        if converted and os.path.exists(converted):
            try:
                os.unlink(converted)
            except Exception:
                pass


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "缺少 file 字段"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "未选择文件"}), 400

    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    try:
        file.save(tmp_path)
        try:
            text = transcribe_audio(tmp_path)
            return jsonify({"text": text})
        except Exception as e:
            return jsonify({"error": f"识别失败: {e}"}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model_loaded": _model is not None})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=19528)
    args = parser.parse_args()
    print(f"FunASR ONNX 服务启动中，端口 {args.port}...", flush=True)
    get_model()  # 启动时预加载模型，避免首次请求等待
    app.run(host="127.0.0.1", port=args.port, threaded=True)
