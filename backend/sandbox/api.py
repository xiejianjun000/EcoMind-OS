"""沙箱代码执行 API"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/sandbox", tags=["Code Sandbox"])


class SandboxRequest(BaseModel):
    code: str = Field(..., description="Python 代码")
    data: dict = Field(default_factory=dict, description="预置数据 (可选)")


@router.post("/run")
async def run_code(req: SandboxRequest):
    """在安全沙箱中执行 Python 代码"""
    from sandbox.executor import SandboxExecutor

    exec = SandboxExecutor()
    namespace = req.data if req.data else None
    result = await exec.run(req.code, namespace)
    return {
        "output": result.output,
        "error": result.error,
        "duration_ms": result.duration_ms,
        "truncated": result.truncated,
    }


@router.post("/analyze")
async def quick_analyze(req: SandboxRequest):
    """快速数据分析（单行表达式）"""
    from sandbox.executor import SandboxExecutor

    exec = SandboxExecutor()
    result = exec.quick_analysis(req.code, req.data)
    return {"result": result}
