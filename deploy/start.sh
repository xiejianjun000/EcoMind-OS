#!/bin/bash
# ============================================
# EcoMind OS Staging 一键部署脚本
# ============================================
# 使用方法:
#   chmod +x deploy/start.sh
#   ./deploy/start.sh
#
# 功能:
#   1. 检查 Docker 环境
#   2. 构建镜像
#   3. 启动容器
#   4. 健康检查
#   5. 显示状态
# ============================================

set -e  # 遇到错误立即退出

# ─── 颜色定义 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── 配置 ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env.staging"
DEPLOY_LOG="$SCRIPT_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"
}

# ─── 检查 Docker 是否安装和运行 ───
check_docker() {
    log_info "检查 Docker 环境..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装！请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker 未运行！请启动 Docker Desktop 或执行: sudo systemctl start docker"
        exit 1
    fi

    # 检查 Docker Compose (V2)
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose V2 未安装！请升级 Docker 到最新版本"
        exit 1
    fi

    log_success "Docker 环境检查通过 ✓"
    docker --version
    docker compose version
}

# ─── 检查环境变量文件 ───
check_env_file() {
    log_info "检查环境变量配置..."

    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env.staging 文件不存在，从模板创建..."
        cat > "$ENV_FILE" << 'EOF'
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
API_KEY=staging-api-key-please-change
LOG_LEVEL=INFO
DATABASE_URL=sqlite:///./data/ecomind_staging.db
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
EOF
        log_warning "请编辑 .env.staging 并填入实际值！"
        read -p "是否继续使用默认配置? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "已取消部署，请先配置环境变量"
            exit 0
        fi
    fi

    log_success "环境变量文件就绪 ✓"
}

# ─── 构建镜像 ───
build_images() {
    log_info "开始构建 Docker 镜像..."
    log_info "这可能需要几分钟时间，请耐心等待..."

    cd "$SCRIPT_DIR"

    # 构建 API 服务镜像
    if docker compose build api 2>&1 | tee -a "$DEPLOY_LOG"; then
        log_success "API 镜像构建完成 ✓"
    else
        log_error "API 镜像构建失败！请检查日志: $DEPLOY_LOG"
        exit 1
    fi

    # Nginx 使用官方镜像，无需构建
    log_success "Nginx 将使用官方镜像 nginx:1.25-alpine"
}

# ─── 启动容器 ───
start_containers() {
    log_info "启动服务容器..."

    cd "$SCRIPT_DIR"

    # 停止旧容器 (如果存在)
    if docker compose ps -q 2>/dev/null | grep -q .; then
        log_warning "检测到正在运行的容器，停止旧容器..."
        docker compose down 2>&1 | tee -a "$DEPLOY_LOG" || true
    fi

    # 启动新容器
    if docker compose up -d 2>&1 | tee -a "$DEPLOY_LOG"; then
        log_success "容器启动成功 ✓"
    else
        log_error "容器启动失败！请检查日志: $DEPLOY_LOG"
        exit 1
    fi
}

# ─── 等待健康检查 ───
wait_for_healthy() {
    log_info "等待服务启动并进行健康检查..."
    log_info "(最多等待 120 秒)"

    local max_attempts=24
    local attempt=1
    local wait_time=5

    while [ $attempt -le $max_attempts ]; do
        log_info "[$attempt/$max_attempts] 检查 API 服务状态..."

        # 检查 API 服务
        if curl -sf http://localhost:${PORT:-8000}/health > /dev/null 2>&1; then
            log_success "API 服务健康检查通过 ✓"
            return 0
        fi

        # 检查容器状态
        local api_status=$(docker inspect --format='{{.State.Status}}' ecomind-api-staging 2>/dev/null || echo "unknown")
        if [ "$api_status" = "exited" ] || [ "$api_status" = "dead" ]; then
            log_error "API 容器异常退出！状态: $api_status"
            log_error "查看日志: docker logs ecomind-api-staging"
            return 1
        fi

        sleep $wait_time
        ((attempt++))
    done

    log_error "健康检查超时！服务可能未正常启动"
    log_error "请手动检查: docker compose logs -f"
    return 1
}

# ─── 显示部署状态 ───
show_status() {
    echo ""
    echo "============================================"
    log_success "🚀 EcoMind OS Staging 部署完成!"
    echo "============================================"
    echo ""

    log_info "服务状态:"
    docker compose ps

    echo ""
    log_info "访问地址:"
    echo "  • API 服务:     http://localhost:${PORT:-8000}"
    echo "  • API 文档:      http://localhost:${PORT:-8000}/docs"
    echo "  • 前端页面:      http://localhost (通过 Nginx)"
    echo "  • 健康检查:      http://localhost:${PORT:-8000}/health"
    echo ""

    log_info "常用命令:"
    echo "  • 查看日志:     docker compose logs -f"
    echo "  • 重启服务:     docker compose restart"
    echo "  • 停止服务:     docker compose down"
    echo "  • 查看资源:     docker stats"
    echo ""
    log_info "部署日志: $DEPLOY_LOG"
}

# ─── 清理旧镜像 (可选) ───
cleanup_old_images() {
    log_info "清理悬空镜像以释放空间..."
    docker image prune -f 2>/dev/null || true
    log_success "清理完成 ✓"
}

# ─── 主流程 ───
main() {
    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║   🌱 EcoMind OS Staging 一键部署工具     ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""

    # 记录开始时间
    START_TIME=$(date +%s)

    # 执行部署步骤
    check_docker
    echo ""
    check_env_file
    echo ""
    build_images
    echo ""
    start_containers
    echo ""
    cleanup_old_images
    echo ""
    wait_for_healthy
    echo ""

    # 计算耗时
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    # 显示最终状态
    show_status

    log_success "⏱️  总耗时: ${DURATION} 秒"
    log_success "📝 完整日志: $DEPLOY_LOG"
    echo ""

    # 提示后续操作
    log_info "💡 提示:"
    echo "  1. 请编辑 .env.staging 配置实际的环境变量"
    echo "  2. 确保前端已构建: cd ../frontend && npm run build"
    echo "  3. 如需 HTTPS，请准备 SSL 证书并取消注释 nginx.conf 中的 HTTPS 配置"
    echo ""
}

# 执行主函数
main "$@"
