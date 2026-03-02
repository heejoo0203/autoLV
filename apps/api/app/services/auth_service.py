from __future__ import annotations

from pathlib import Path
import uuid

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.bulk_job_repository import delete_bulk_jobs_by_user, list_all_bulk_jobs_by_user
from app.repositories.query_log_repository import delete_query_logs_by_user
from app.repositories.user_repository import create_user, delete_user_by_id, get_user_by_email, get_user_by_id, save_user
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RegisterRequest, UserOut, validate_nickname, validate_password_policy


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 가입된 이메일입니다."},
        )
    password_hash = hash_password(payload.password)
    return create_user(
        db,
        email=payload.email,
        password_hash=password_hash,
        full_name=payload.full_name,
    )


def login_user(db: Session, payload: LoginRequest) -> User:
    user = get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 올바르지 않습니다."},
        )
    return user


def attach_auth_cookies(response: Response, user_id: str) -> None:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_exp_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_exp_days * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    # Match cookie options used in login to ensure browser-side deletion works reliably.
    for key in ("access_token", "refresh_token"):
        response.delete_cookie(
            key=key,
            path="/",
            secure=settings.cookie_secure,
            httponly=True,
            samesite=settings.cookie_samesite,
        )


def get_user_from_access_token(db: Session, token: str | None) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "로그인이 필요합니다."},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "유효하지 않은 토큰입니다."},
        )
    user = get_user_by_id(db, str(payload["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "사용자 정보를 찾을 수 없습니다."},
        )
    return user


def build_user_out(user: User) -> UserOut:
    profile_url = f"/media/profile/{user.profile_image_path}" if user.profile_image_path else None
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        auth_provider=user.auth_provider,
        profile_image_url=profile_url,
    )


def update_profile(
    db: Session,
    *,
    user: User,
    full_name: str | None,
    profile_image_filename: str | None,
    profile_image_bytes: bytes | None,
) -> User:
    changed = False
    if full_name is not None:
        cleaned_name = full_name.strip()
        validate_nickname(cleaned_name)
        user.full_name = cleaned_name
        changed = True

    if profile_image_filename is not None:
        if not profile_image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PROFILE_IMAGE_EMPTY", "message": "프로필 이미지 파일이 비어 있습니다."},
            )
        next_name = _save_profile_image(profile_image_filename, profile_image_bytes)
        old_name = user.profile_image_path
        user.profile_image_path = next_name
        changed = True
        if old_name and old_name != next_name:
            _safe_unlink(_profile_image_path(old_name))

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_UPDATE_EMPTY", "message": "수정할 항목이 없습니다."},
        )

    return save_user(db, user)


def change_password(db: Session, *, user: User, payload: PasswordChangeRequest) -> User:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PASSWORD_MISMATCH", "message": "기존 비밀번호가 일치하지 않습니다."},
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PASSWORD_SAME", "message": "새 비밀번호는 기존 비밀번호와 달라야 합니다."},
        )

    validate_password_policy(payload.new_password, field_label="새 비밀번호")
    user.password_hash = hash_password(payload.new_password)
    return save_user(db, user)


def delete_account(db: Session, *, user: User, confirmation_text: str) -> None:
    nickname = (user.full_name or user.email.split("@")[0]).strip()
    expected = f"{nickname} 탈퇴를 동의합니다"
    if confirmation_text.strip() != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "WITHDRAW_CONFIRM_INVALID",
                "message": f"확인 문구가 일치하지 않습니다. \"{expected}\"를 정확히 입력해 주세요.",
            },
        )

    user_jobs = list_all_bulk_jobs_by_user(db, user.id)
    cleanup_paths: list[Path] = []
    for job in user_jobs:
        if job.upload_path:
            cleanup_paths.append(Path(job.upload_path))
        if job.result_path:
            cleanup_paths.append(Path(job.result_path))
    if user.profile_image_path:
        cleanup_paths.append(_profile_image_path(user.profile_image_path))

    if user_jobs:
        delete_bulk_jobs_by_user(db, user_id=user.id)
    delete_query_logs_by_user(db, user_id=user.id)
    delete_user_by_id(db, user_id=user.id)

    for path in cleanup_paths:
        _safe_unlink(path)


def _profile_root() -> Path:
    root = Path(settings.profile_image_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _profile_image_path(name: str) -> Path:
    return _profile_root() / name


def _save_profile_image(file_name: str, file_bytes: bytes) -> str:
    max_bytes = 5 * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_IMAGE_TOO_LARGE", "message": "프로필 이미지는 최대 5MB까지 업로드할 수 있습니다."},
        )

    ext = Path(file_name).suffix.lower()
    allowed = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_IMAGE_INVALID", "message": "이미지는 png/jpg/jpeg/webp 형식만 지원합니다."},
        )

    saved_name = f"{uuid.uuid4().hex}{ext}"
    output_path = _profile_image_path(saved_name)
    output_path.write_bytes(file_bytes)
    return saved_name


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        return
