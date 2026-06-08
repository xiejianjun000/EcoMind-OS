"""
/api/reviews — Agent 间评审 API
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.schemas.expert_v2 import (
    ReviewCommentCreate, ReviewCommentResponse, ReviewSessionResponse,
    ReviewVerdict, ReviewType,
)
from api.services.review_system import (
    ReviewComment, ReviewType as RSReviewType, ReviewVerdict as RSVerdict,
    get_review_system, AgentReviewSystem,
)

router = APIRouter()


def _get_rs() -> AgentReviewSystem:
    return get_review_system()


def _to_comment_response(c: ReviewComment) -> ReviewCommentResponse:
    return ReviewCommentResponse(
        id=c.id, reviewer_id=c.reviewer_id, reviewee_id=c.reviewee_id,
        task_id=c.task_id, review_type=ReviewType(c.review_type.value),
        verdict=ReviewVerdict(c.verdict.value), confidence=c.confidence,
        issues=c.issues, suggestions=c.suggestions, agreements=c.agreements,
        data_challenge=c.data_challenge, law_challenge=c.law_challenge,
        created_at=c.created_at,
    )


@router.post("/sessions", response_model=ReviewSessionResponse)
def start_review_session(task_id: str = Query(...), reviewer_ids: str = Query(...), reviewee_id: str = Query(...)):
    """启动评审会话"""
    rs = _get_rs()
    ids = [r.strip() for r in reviewer_ids.split(",")]
    session = rs.start_review(task_id, ids, reviewee_id)
    return ReviewSessionResponse(
        id=session.id, task_id=session.task_id, round=session.round,
        comments=[], consensus_reached=False, final_confidence=0.0,
        rounds_max=session.rounds_max, disagreements=[],
    )


@router.post("/sessions/{session_id}/comments", response_model=ReviewSessionResponse)
def add_review_comment(session_id: str, body: ReviewCommentCreate):
    """添加评审意见"""
    rs = _get_rs()
    comment = ReviewComment(
        reviewer_id=body.reviewer_id, reviewee_id=body.reviewee_id,
        task_id=body.task_id, review_type=RSReviewType(body.review_type.value),
        verdict=RSVerdict(body.verdict.value), confidence=body.confidence,
        issues=body.issues, suggestions=body.suggestions, agreements=body.agreements,
        data_challenge=body.data_challenge, law_challenge=body.law_challenge,
    )
    session = rs.add_comment(session_id, comment)
    disagreements = rs.get_disagreements(session_id)
    return ReviewSessionResponse(
        id=session.id, task_id=session.task_id, round=session.round,
        comments=[_to_comment_response(c) for c in session.comments],
        consensus_reached=session.consensus_reached,
        final_confidence=session.final_confidence if session.consensus_reached else 0.0,
        rounds_max=session.rounds_max, disagreements=disagreements,
    )


@router.get("/sessions/{session_id}", response_model=ReviewSessionResponse)
def get_review_session(session_id: str):
    """查看评审会话"""
    rs = _get_rs()
    session = rs.get_session(session_id)
    if not session:
        raise HTTPException(404, "评审会话不存在")
    disagreements = rs.get_disagreements(session_id)
    return ReviewSessionResponse(
        id=session.id, task_id=session.task_id, round=session.round,
        comments=[_to_comment_response(c) for c in session.comments],
        consensus_reached=session.consensus_reached,
        final_confidence=session.final_confidence if session.consensus_reached else 0.0,
        rounds_max=session.rounds_max, disagreements=disagreements,
    )
