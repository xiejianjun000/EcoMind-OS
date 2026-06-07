# ============================================
# EcoMind OS 后端 - 多阶段 Docker 构建
# ============================================
# 构建命令:
#   docker build -t ecomind-os/api:staging -f deploy/Dockerfile .
# 运行命令:
#   docker run -p 8000:8000 ecomind-os/api:staging
# ============================================

# ─── Stage 1: 构建阶段 — 安装依赖 ───
FROM python:3.11-slim AS builder

# 设置工作目录
WORKDIR /build

# 安装构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY pyproject.toml ./

# 创建虚拟环境并安装依赖 (优化: 仅安装生产依赖)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 安装 Python 依赖
# 使用 --no-cache-dir 减小镜像体积
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -e ".[production]" || \
    pip install --no-cache-dir fastapi uvicorn[standard] \
        python-multipart aiofiles python-jose[cryptography] \
        passlib[bcrypt] sqlalchemy psycopg2-binary \
        httpx websockets pydantic-settings

# ─── Stage 2: 运行时镜像 — 轻量化 ───
FROM python:3.11-slim AS runtime

# 元数据标签
LABEL maintainer="EcoMind OS Team"
LABEL description="EcoMind OS Backend API"
LABEL version="1.0.0-staging"

# 安装运行时依赖 (最小化)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tini \
    # 用于文件上传处理的工具
    file \
    && rm -rf /var/lib/apt/lists/* \
    # 清理 apt 缓存以减小镜像体积
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*

# 从构建阶段复制虚拟环境
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 设置工作目录
WORKDIR /app

# 创建非 root 用户 (安全最佳实践)
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser && \
    mkdir -p /app/data /app/data/uploads /app/logs && \
    chown -R appuser:appuser /app

# 复制应用代码
COPY --chown=appuser:appuser backend/ .

# 切换到非 root 用户
USER appuser

# 环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    HOST=0.0.0.0 \
    PORT=8000

# 暴露端口
EXPOSE 8000

# 健康检查 (Docker 内置)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令 — 使用 tini 作为 PID 1 进程 (正确处理信号)
ENTRYPOINT ["tini", "--"]

# 启动 uvicorn 服务器
CMD ["uvicorn", "api.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info", \
     "--access-log", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
