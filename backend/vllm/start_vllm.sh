#!/bin/bash
# EcoMind OS - vLLM 启动脚本

echo "=== EcoMind OS vLLM 部署 ==="

# 检查 GPU
if command -v nvidia-smi &> /dev/null; then
    echo "[OK] GPU 检测到，启动 GPU 模式..."
    docker compose up -d vllm
else
    echo "[WARN] 未检测到 GPU，启动 CPU 量化模式..."
    docker compose --profile cpu up -d vllm-cpu
fi

echo "等待 vLLM 服务就绪..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "[OK] vLLM 服务就绪! http://localhost:8000"
        echo "测试: curl http://localhost:8000/v1/models"
        exit 0
    fi
    echo "等待中... ($i/30)"
    sleep 5
done

echo "[FAIL] vLLM 启动超时"
exit 1
