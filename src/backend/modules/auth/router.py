"""
Module: Auth (User Management)
Covers: UC_UI_1 (Đăng nhập / Đăng xuất), F-ADMIN-1 (Quản lý tài khoản)
        NF-SEC-0, NF-SEC-1, NF-SEC-2
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import User
from core.security import (
    hash_password, verify_password,
    create_access_token,
    get_current_user, require_admin,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ── UC_UI_1: Đăng nhập ───────────────────────────────────────────────────────
@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db:   Session = Depends(get_db),
):
    """
    NF-SEC-0: Xác thực bằng username + password.
    NF-SEC-1: Password được hash bằng bcrypt.
    Returns: JWT access token.
    """
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai tài khoản hoặc mật khẩu",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản bị khóa")

    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


# ── F-FARMER-0 / F-ADMIN-0: Thông tin user hiện tại ─────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":       current_user.id,
        "username": current_user.username,
        "role":     current_user.role,
    }


class PasswordChange(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    body: PasswordChange,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """F-FARMER-9 / F-ADMIN-7: Đổi mật khẩu cá nhân."""
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác")
        
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True, "message": "Đổi mật khẩu thành công"}

# ── F-ADMIN-1: Tạo tài khoản người dùng ─────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role:     str = "FARMER"   # FARMER | ADMIN


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body:         UserCreate,
    db:           Session = Depends(get_db),
    _admin:       User    = Depends(require_admin),   # NF-SEC-2
):
    """F-ADMIN-1: Chỉ Admin được tạo tài khoản mới."""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username đã tồn tại")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role.upper(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@router.get("/users")
def list_users(
    db:     Session = Depends(get_db),
    _admin: User    = Depends(require_admin),
):
    """F-ADMIN-1: Xem danh sách toàn bộ tài khoản."""
    return db.query(User).all()


@router.patch("/users/{user_id}/toggle")
def toggle_user(
    user_id: int,
    db:      Session = Depends(get_db),
    _admin:  User    = Depends(require_admin),
):
    """F-ADMIN-1: Khoá / Mở khoá tài khoản người dùng."""
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản của chính mình")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db:      Session = Depends(get_db),
    _admin:  User    = Depends(require_admin),
):
    """F-ADMIN-1: Xóa tài khoản người dùng."""
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản của chính mình")
        
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "User deleted"}
