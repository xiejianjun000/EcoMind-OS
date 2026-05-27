"""
EcoMind OS FastAPI 应用入口

配置 CORS、lifespan 事件、路由注册、WebSocket 端点。
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import agents, workflows, security, models, departments, environment, enforcement, approval, compliance, reports
from api.websocket.manager import WebSocketManager

logger = logging.getLogger(__name__)

# 全局 WebSocket 管理器实例
ws_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期管理：启动时初始化资源，关闭时清理资源。"""
    logger.info("EcoMind OS API 启动中...")
    # 启动时：初始化 EventBus 订阅、Agent 服务等
    ws_manager.start_background_broadcaster()
    logger.info("EcoMind OS API 已启动 ✓")
    yield
    # 关闭时：清理 WebSocket 连接
    await ws_manager.disconnect_all()
    logger.info("EcoMind OS API 已关闭")


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用实例。"""
    application = FastAPI(
        title="EcoMind OS API",
        description="EcoMind OS 后端服务 — Agent 管理、工作流、安全治理、模型路由",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS 配置 — 允许前端开发服务器跨域访问
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    application.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
    application.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
    application.include_router(security.router, prefix="/api/security", tags=["Security"])
    application.include_router(models.router, prefix="/api/models", tags=["Models"])

    # 🆕 部门智能体管理
    application.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
    # 🆕 环境数据对接
    application.include_router(environment.router, prefix="/api/environment", tags=["Environment"])
    # 🆕 执法办案管理
    application.include_router(enforcement.router)
    # 环评审批管理
    application.include_router(approval.router)
    # 合规检查管理
    application.include_router(compliance.router)
    # 报告生成管理
    application.include_router(reports.router)
    # 注册 WebSocket 端点
    from api.websocket.manager import websocket_endpoint
    application.websocket_route("/ws")(websocket_endpoint)

    # 健康检查
    @application.get("/health", tags=["System"])
    async def health_check() -> dict[str, str]:
        """系统健康检查端点。"""
        return {"status": "ok", "service": "EcoMind OS API", "version": "1.0.0"}

    return application


app = create_app()
