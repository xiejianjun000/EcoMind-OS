"""
EcoMind 学习与反馈 API — 让 Agent "越用越懂人"

端点:
  POST   /api/learning/feedback          — 记录用户反馈
  GET    /api/learning/insights          — 获取反思洞察
  GET    /api/learning/profile           — 获取用户画像
  PUT    /api/learning/profile           — 更新用户偏好
  DELETE /api/learning/profile           — 删除用户画像(隐私)
  POST   /api/learning/session/{id}/end  — 结束会话并生成总结
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(tags=["Learning"])


# ── Schema ──

class FeedbackRequest(BaseModel):
    session_id: str = Field(..., description="会话 ID")
    question: str = Field(..., description="用户问题")
    answer: str = Field(..., description="Agent 回答")
    rating: int = Field(default=0, ge=0, le=5, description="评分 0-5")
    correction: str = Field(default="", description="用户纠正")
    expert_id: str = Field(default="", description="专家 ID")
    tags: list[str] = Field(default_factory=list, description="标签")


class FeedbackResponse(BaseModel):
    feedback_id: int
    message: str


class InsightResponse(BaseModel):
    patterns: list[dict]
    feedback_trend: str
    recommendations: list[str]


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    primary_domain: Optional[str] = None
    jurisdiction: Optional[str] = None
    detail_level: Optional[str] = None
    citation_style: Optional[str] = None
    language: Optional[str] = None


# ── 端点 ──

@router.post("/feedback", response_model=FeedbackResponse)
async def record_feedback(req: FeedbackRequest):
    """用户对 Agent 回答评分/纠正。Agent 会从中学习。"""
    try:
        from engine.learning_loop import FeedbackRecord, LearningLoop
    except ImportError:
        raise HTTPException(500, "学习引擎未初始化")

    loop = LearningLoop()
    fid = loop.record_feedback(FeedbackRecord(
        session_id=req.session_id,
        question=req.question,
        answer=req.answer,
        rating=req.rating,
        correction=req.correction,
        expert_id=req.expert_id,
        tags=req.tags,
    ))
    return FeedbackResponse(feedback_id=fid, message="反馈已记录，Agent 将持续学习")


@router.get("/insights")
async def get_insights(expert_id: str = "", days: int = 1):
    """获取最近 N 天的学习洞察"""
    try:
        from engine.learning_loop import LearningLoop
    except ImportError:
        raise HTTPException(500, "学习引擎未初始化")

    loop = LearningLoop()
    insights = loop.nightly_discovery(days_back=days)
    return {
        "patterns": insights.get("patterns_found", []),
        "feedback_trend": insights.get("feedback_trend", ""),
        "recommendations": insights.get("recommendations", []),
    }


@router.get("/profile")
async def get_profile(user_id: str = Query(..., description="用户 ID")):
    """获取用户画像及偏好"""
    try:
        from engine.user_profile import get_user_profile
    except ImportError:
        raise HTTPException(500, "用户画像引擎未初始化")

    engine = get_user_profile()
    return engine.export_profile(user_id)


@router.put("/profile")
async def update_profile(user_id: str = Query(...), update: ProfileUpdate = None):
    """更新用户画像偏好"""
    try:
        from engine.user_profile import get_user_profile, UserPreferences
    except ImportError:
        raise HTTPException(500, "用户画像引擎未初始化")

    engine = get_user_profile()
    profile = engine.get_or_create(user_id)

    if update.detail_level:
        prefs = engine.get_preferences(user_id)
        prefs.detail_level = update.detail_level
        engine.set_preferences(user_id, prefs)

    kwargs = {k: v for k, v in update.model_dump().items() if v is not None and k != "detail_level"}
    if kwargs:
        engine.update_profile(user_id, **kwargs)

    return {"message": "画像已更新", "profile": engine.export_profile(user_id)}


@router.delete("/profile")
async def delete_profile(user_id: str = Query(...)):
    """删除用户画像（用户主动请求——隐私权）"""
    try:
        from engine.user_profile import get_user_profile
    except ImportError:
        raise HTTPException(500, "用户画像引擎未初始化")

    engine = get_user_profile()
    engine.delete_profile(user_id)
    return {"message": f"用户 {user_id} 的画像已永久删除"}


@router.post("/session/{session_id}/end")
async def end_session(session_id: str, user_id: str = Query(...), expert_id: str = ""):
    """结束一个会话并生成学习总结"""
    try:
        from engine.learning_loop import LearningLoop
        from engine.user_profile import get_user_profile
    except ImportError:
        raise HTTPException(500, "学习引擎未初始化")

    loop = LearningLoop()
    digest = loop.session_digest(session_id, expert_id=expert_id)

    try:
        profile_engine = get_user_profile()
        profile_engine.end_session(session_id)
        profile_engine.record_session(user_id, session_id, domain=expert_id)
    except Exception:
        pass

    return {
        "digest": {
            "summary": digest.summary,
            "key_decisions": digest.key_decisions,
            "lessons_learned": digest.lessons_learned,
            "errors_made": digest.errors_made,
        }
    }


@router.get("/health")
async def learning_health():
    """学习系统状态"""
    try:
        from engine.learning_loop import LearningLoop
        from engine.memory_evolution import MemoryEvolution
        from engine.user_profile import get_user_profile

        loop = LearningLoop()
        stats = loop.get_feedback_stats()

        return {
            "status": "ok",
            "feedback_count": stats["total_feedback"],
            "avg_rating": stats["avg_rating"],
            "modules": ["learning_loop", "memory_evolution", "user_profile"],
        }
    except Exception as e:
        return {"status": "degraded", "error": str(e)}
