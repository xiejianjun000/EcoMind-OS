"""文书生成 API"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/api/docgen", tags=["Document Generator"])


class GenerateRequest(BaseModel):
    doc_type: str = Field(..., description="文种: enforcement_case/eia_report/monitoring_daily/inspection_record/meeting_minutes/policy_brief")
    data: dict = Field(..., description="填充数据")
    format: str = Field(default="markdown", description="格式: markdown/html/pdf/docx")


@router.get("/templates")
async def list_templates():
    """列出所有支持的文种模板"""
    from docgen.generator import DocGenerator
    gen = DocGenerator()
    return {"templates": gen.list_templates()}


@router.post("/generate")
async def generate_doc(req: GenerateRequest):
    """生成文书"""
    from docgen.generator import DocGenerator
    gen = DocGenerator()
    result = await gen.generate(req.doc_type, req.data, req.format)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {
        "success": True,
        "doc_type": req.doc_type,
        "format": req.format,
        "path": result.get("path", ""),
        "preview": result.get("preview", "")[:500],
    }


@router.post("/generate/full")
async def generate_full_content(req: GenerateRequest):
    """生成并返回完整内容"""
    from docgen.generator import DocGenerator
    gen = DocGenerator()
    result = await gen.generate(req.doc_type, req.data, req.format)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result
