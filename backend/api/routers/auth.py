"""
/api/auth — 用户认证
"""
from __future__ import annotations
import uuid, hashlib, secrets, time
from fastapi import APIRouter, HTTPException
from api.schemas.platform import UserCreate, UserLogin, UserProfile, TokenResponse, UserRole

router = APIRouter()

_users: dict[str, dict] = {}
_tokens: dict[str, dict] = {}

@router.post("/register", response_model=TokenResponse)
def register(body: UserCreate):
    if body.username in _users:
        raise HTTPException(400, "用户名已存在")
    uid = str(uuid.uuid4())[:8]
    _users[body.username] = {
        "id": uid, "username": body.username, "email": body.email,
        "password": hashlib.sha256(body.password.encode()).hexdigest(),
        "display_name": body.display_name or body.username,
        "role": UserRole.EDITOR, "created_at": "", "last_login": "",
    }
    token = secrets.token_hex(32)
    _tokens[token] = {"username": body.username, "expires": time.time() + 3600}
    profile = UserProfile(id=uid, username=body.username, email=body.email,
                          display_name=body.display_name or body.username,
                          role=UserRole.EDITOR)
    return TokenResponse(access_token=token, user=profile)

@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin):
    user = _users.get(body.username)
    if not user or user["password"] != hashlib.sha256(body.password.encode()).hexdigest():
        raise HTTPException(401, "用户名或密码错误")
    user["last_login"] = ""
    token = secrets.token_hex(32)
    _tokens[token] = {"username": body.username, "expires": time.time() + 3600}
    profile = UserProfile(id=user["id"], username=body.username, email=user["email"],
                          display_name=user["display_name"], role=user["role"])
    return TokenResponse(access_token=token, user=profile)

@router.get("/profile", response_model=UserProfile)
def profile(token: str = ""):
    t = _tokens.get(token)
    if not t or t["expires"] < time.time():
        raise HTTPException(401, "未登录或Token已过期")
    u = _users.get(t["username"])
    return UserProfile(id=u["id"], username=u["username"], email=u["email"],
                       display_name=u["display_name"], role=u["role"])
