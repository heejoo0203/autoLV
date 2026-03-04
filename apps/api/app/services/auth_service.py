from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

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
from app.models.email_verification import EmailVerification
from app.models.user import User
from app.repositories.bulk_job_repository import delete_bulk_jobs_by_user, list_all_bulk_jobs_by_user
from app.repositories.email_verification_repository import (
    create_email_verification,
    get_email_verification_by_id,
    invalidate_pending_verifications,
    save_email_verification,
)
from app.repositories.query_log_repository import delete_query_logs_by_user
from app.repositories.user_repository import (
    create_user,
    delete_user_by_id,
    get_user_by_email,
    get_user_by_id,
    get_user_by_profile,
    save_user,
)
from app.schemas.auth import (
    FindIdByProfileRequest,
    FindIdCompleteRequest,
    LoginRequest,
    PasswordChangeRequest,
    RecoveryCodeSendRequest,
    RecoveryCodeSendResponse,
    RecoveryPurpose,
    RegisterRequest,
    ResetPasswordByCodeRequest,
    TermsResponse,
    UserOut,
    validate_nickname,
    validate_password_policy,
)
from app.services.email_service import send_email
from app.services.terms_service import get_current_terms


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 가입된 이메일입니다."},
        )

    verification = verify_recovery_code(
        db,
        verification_id=payload.verification_id,
        code=payload.verification_code,
        purpose=RecoveryPurpose.SIGNUP,
        expected_email=str(payload.email),
    )

    password_hash = hash_password(payload.password)
    terms_version, terms_snapshot = get_current_terms()
    user = create_user(
        db,
        email=payload.email,
        password_hash=password_hash,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        terms_version=terms_version,
        terms_snapshot=terms_snapshot,
        terms_accepted_at=_now_utc(),
    )
    consume_verification(db, verification)
    return user


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
        phone_number=user.phone_number,
        role=user.role,
        auth_provider=user.auth_provider,
        profile_image_url=profile_url,
    )


def get_terms_for_user(user: User) -> TermsResponse:
    fallback_version, fallback_terms = get_current_terms()
    return TermsResponse(
        version=user.terms_version or fallback_version,
        content=user.terms_snapshot or fallback_terms,
        accepted_at=user.terms_accepted_at,
    )


def get_terms_for_user_public() -> TermsResponse:
    version, content = get_current_terms()
    return TermsResponse(version=version, content=content, accepted_at=None)


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


def send_recovery_code(db: Session, payload: RecoveryCodeSendRequest) -> RecoveryCodeSendResponse:
    email = str(payload.email).strip().lower()
    full_name = (payload.full_name or "").strip() or None

    if payload.purpose == RecoveryPurpose.SIGNUP:
        _assert_signup_email_available(db, email)
    elif payload.purpose == RecoveryPurpose.FIND_ID:
        _assert_find_id_target_exists(db, email=email, full_name=full_name)
    elif payload.purpose == RecoveryPurpose.RESET_PASSWORD:
        _assert_reset_target_exists(db, email)

    now = _now_utc()
    invalidate_pending_verifications(db, purpose=payload.purpose, email=email, now=now)

    code = _generate_verification_code()
    expires_at = now + timedelta(minutes=settings.email_verification_exp_minutes)
    verification = create_email_verification(
        db,
        purpose=payload.purpose,
        email=email,
        full_name=full_name,
        code_hash=_hash_verification_code(code),
        expires_at=expires_at,
        max_attempts=settings.email_verification_max_attempts,
        meta_json=json.dumps({"request_id": str(uuid.uuid4())}, ensure_ascii=False),
    )

    send_email(
        to_email=email,
        subject=_build_mail_subject(payload.purpose),
        body=_build_mail_body(payload.purpose, code, settings.email_verification_exp_minutes),
    )

    return RecoveryCodeSendResponse(
        verification_id=verification.id,
        expires_in_seconds=settings.email_verification_exp_minutes * 60,
        message="인증 코드가 발송되었습니다.",
        debug_code=code if settings.email_debug_return_code else None,
    )


def find_id_by_code(db: Session, payload: FindIdCompleteRequest) -> str:
    verification = verify_recovery_code(
        db,
        verification_id=payload.verification_id,
        code=payload.code,
        purpose=RecoveryPurpose.FIND_ID,
    )
    email = verification.email
    consume_verification(db, verification)
    return email


def find_id_by_profile(db: Session, payload: FindIdByProfileRequest) -> str:
    user = get_user_by_profile(
        db,
        full_name=payload.full_name.strip(),
        phone_number=payload.phone_number,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ACCOUNT_NOT_FOUND", "message": "일치하는 회원 정보를 찾을 수 없습니다."},
        )
    return mask_email(user.email)


def check_email_available(db: Session, email: str) -> bool:
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMAIL_REQUIRED", "message": "이메일을 입력해 주세요."},
        )
    return get_user_by_email(db, normalized) is None


def reset_password_by_code(db: Session, payload: ResetPasswordByCodeRequest) -> None:
    verification = verify_recovery_code(
        db,
        verification_id=payload.verification_id,
        code=payload.code,
        purpose=RecoveryPurpose.RESET_PASSWORD,
        expected_email=str(payload.email),
    )
    user = get_user_by_email(db, str(payload.email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "가입된 계정을 찾을 수 없습니다."},
        )

    validate_password_policy(payload.new_password, field_label="새 비밀번호")
    user.password_hash = hash_password(payload.new_password)
    save_user(db, user)
    consume_verification(db, verification)


def verify_recovery_code(
    db: Session,
    *,
    verification_id: str,
    code: str,
    purpose: str,
    expected_email: str | None = None,
) -> EmailVerification:
    verification = get_email_verification_by_id(db, verification_id)
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VERIFICATION_NOT_FOUND", "message": "인증 요청 정보를 찾을 수 없습니다."},
        )
    if verification.purpose != purpose:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_PURPOSE_MISMATCH", "message": "인증 목적이 일치하지 않습니다."},
        )
    if expected_email and verification.email.lower() != expected_email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_EMAIL_MISMATCH", "message": "인증 이메일이 일치하지 않습니다."},
        )

    now = _now_utc()
    if verification.consumed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_USED", "message": "이미 사용된 인증 코드입니다."},
        )
    if verification.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_EXPIRED", "message": "인증 코드 유효기간이 만료되었습니다."},
        )
    if verification.attempt_count >= verification.max_attempts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_ATTEMPTS_EXCEEDED", "message": "인증 시도 횟수를 초과했습니다."},
        )

    if verification.code_hash != _hash_verification_code(code):
        verification.attempt_count += 1
        save_email_verification(db, verification)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VERIFICATION_CODE_INVALID", "message": "인증 코드가 올바르지 않습니다."},
        )

    verification.verified_at = now
    verification.attempt_count += 1
    return save_email_verification(db, verification)


def consume_verification(db: Session, verification: EmailVerification) -> EmailVerification:
    verification.consumed_at = _now_utc()
    return save_email_verification(db, verification)


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


def _assert_signup_email_available(db: Session, email: str) -> None:
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 가입된 이메일입니다."},
        )


def _assert_find_id_target_exists(db: Session, *, email: str, full_name: str | None) -> None:
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FULL_NAME_REQUIRED", "message": "아이디 찾기에는 닉네임이 필요합니다."},
        )
    user = get_user_by_email(db, email)
    if not user or (user.full_name or "").strip() != full_name.strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ACCOUNT_NOT_FOUND", "message": "일치하는 회원 정보를 찾을 수 없습니다."},
        )


def _assert_reset_target_exists(db: Session, email: str) -> None:
    if not get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "가입된 계정을 찾을 수 없습니다."},
        )


def _build_mail_subject(purpose: str) -> str:
    if purpose == RecoveryPurpose.SIGNUP:
        return "[autoLV] 회원가입 이메일 인증 코드"
    if purpose == RecoveryPurpose.FIND_ID:
        return "[autoLV] 아이디 찾기 인증 코드"
    return "[autoLV] 비밀번호 재설정 인증 코드"


def _build_mail_body(purpose: str, code: str, expire_minutes: int) -> str:
    if purpose == RecoveryPurpose.SIGNUP:
        title = "회원가입 인증"
    elif purpose == RecoveryPurpose.FIND_ID:
        title = "아이디 찾기 인증"
    else:
        title = "비밀번호 재설정 인증"

    return (
        f"autoLV {title} 코드 안내\n\n"
        f"인증 코드: {code}\n"
        f"유효시간: {expire_minutes}분\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시해 주세요."
    )


def _hash_verification_code(code: str) -> str:
    seed = f"{settings.jwt_secret_key}:{code}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def _generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def mask_email(email: str) -> str:
    local_part, _, domain = email.partition("@")
    if not domain:
        return "***"

    prefix = local_part[:2]
    suffix = local_part[-2:] if len(local_part) > 2 else local_part
    return f"{prefix}***{suffix}@{domain}"
