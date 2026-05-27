#!/bin/bash
# ============================================================
# Ollama 模型安装脚本 — 国产化 ARM64 / LoongArch
# 
# 用法:
#   ./ollama-setup.sh              # 交互式选择平台
#   PLATFORM=kunpeng ./ollama-setup.sh   # 鲲鹏 920
#   PLATFORM=phytium ./ollama-setup.sh   # 飞腾 S2500
#   PLATFORM=loongson ./ollama-setup.sh  # 龙芯 3A6000
# ============================================================

set -euo pipefail

# 等待 Ollama 服务就绪
echo "[INFO] 等待 Ollama 服务启动..."
for i in $(seq 1 60); do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "[INFO] Ollama 服务就绪"
        break
    fi
    sleep 2
done

PLATFORM="${PLATFORM:-kunpeng}"

case "$PLATFORM" in
    kunpeng)
        echo "=========================================="
        echo "  鲲鹏 920 (ARM64) — 省级部署模型清单"
        echo "=========================================="
        # 主模型: Qwen2.5 14B (聊天/分析)
        echo "[INFO] 拉取 qwen2.5:14b ..."
        ollama pull qwen2.5:14b

        # 推理模型: DeepSeek-R1 14B (复杂推理)
        echo "[INFO] 拉取 deepseek-r1:14b ..."
        ollama pull deepseek-r1:14b

        # Code 模型: Qwen2.5-Coder 14B
        echo "[INFO] 拉取 qwen2.5-coder:14b ..."
        ollama pull qwen2.5-coder:14b

        # 嵌入模型
        echo "[INFO] 拉取 bge-m3:567m (向量嵌入) ..."
        ollama pull bge-m3:567m
        echo "[INFO] 拉取 gte-qwen2:1.5b (reranker) ..."
        ollama pull gte-qwen2:1.5b

        # 视觉模型 (Atlas 300I GPU 时使用)
        if ollama pull llava:13b 2>/dev/null; then
            echo "[INFO] llava:13b 多模态模型就绪 (需要 GPU)"
        else
            echo "[WARN] llava:13b 需要 GPU, 跳过"
        fi
        ;;

    phytium)
        echo "=========================================="
        echo "  飞腾 S2500 (ARM64) — 市州级部署模型清单"
        echo "=========================================="
        echo "[INFO] 拉取 qwen2.5:7b ..."
        ollama pull qwen2.5:7b
        echo "[INFO] 拉取 qwen2.5:3b (轻量模型) ..."
        ollama pull qwen2.5:3b
        echo "[INFO] 拉取 bge-m3:567m ..."
        ollama pull bge-m3:567m
        ;;

    loongson)
        echo "=========================================="
        echo "  龙芯 3A6000 (LoongArch) — 工作站模型清单"
        echo "=========================================="
        echo "[INFO] 龙芯平台使用 llama.cpp, 非 Ollama"
        echo ""
        echo "手动编译 llama.cpp:"
        echo "  git clone https://github.com/ggerganov/llama.cpp"
        echo "  cd llama.cpp && make -j4 LLAMA_LOONGARCH=1"
        echo ""
        echo "下载量化模型 (.gguf):"
        echo "  wget https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf"
        echo ""
        echo "运行推理:"
        echo "  ./llama-cli -m qwen2.5-7b-instruct-q4_k_m.gguf -n 4096 --temp 0.7"
        echo ""
        echo "[INFO] 龙芯模型需手动下载, 跳过自动拉取"
        ;;

    *)
        echo "[ERROR] 未知平台: $PLATFORM"
        echo "  支持: kunpeng | phytium | loongson"
        exit 1
        ;;
esac

echo ""
echo "[DONE] 模型安装完成 — 平台: $PLATFORM"
echo "[INFO] 验证: ollama list"
