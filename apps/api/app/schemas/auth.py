import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9가-힣]{2,20}$")
PASSWORD_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9]")
PHONE_ALLOWED_PATTERN = re.compile(r"^[0-9\-\s]+$")


def validate_password_policy(value: str, *, field_label: str = "비밀번호") -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError(f"{field_label}는 UTF-8 기준 72바이트를 넘을 수 없습니다.")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError(f"{field_label}는 영문을 1자 이상 포함해야 합니다.")
    if not re.search(r"[0-9]", value):
        raise ValueError(f"{field_label}는 숫자를 1자 이상 포함해야 합니다.")
    if not PASSWORD_SPECIAL_PATTERN.search(value):
        raise ValueError(f"{field_label}는 특수문자를 1자 이상 포함해야 합니다.")
    return value


def validate_nickname(value: str) -> str:
    if not NICKNAME_PATTERN.match(value):
        raise ValueError("닉네임은 2~20자의 한글/영문/숫자만 사용할 수 있습니다.")
    return value


def normalize_phone_number(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("연락처를 입력해 주세요.")
    if not PHONE_ALLOWED_PATTERN.fullmatch(cleaned):
        raise ValueError("연락처는 숫자와 하이픈(-)만 입력할 수 있습니다.")

    digits = re.sub(r"[^0-9]", "", cleaned)
    if not re.fullmatch(r"[0-9]{9,11}", digits):
        raise ValueError("연락처는 9~11자리 숫자여야 합니다.")
    return digits


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=16)
    confirm_password: str = Field(min_length=8, max_length=16)
    full_name: str = Field(min_length=2, max_length=20)
    phone_number: str = Field(min_length=9, max_length=20)
    agreements: bool
    verification_id: str = Field(min_length=36, max_length=36)
    verification_code: str = Field(min_length=6, max_length=6)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return validate_nickname(value)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_phone_number(value)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        return validate_password_policy(value, field_label="비밀번호")

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("비밀번호 확인 값은 UTF-8 기준 72바이트를 넘을 수 없습니다.")
        return value

    @field_validator("verification_code")
    @classmethod
    def validate_verification_code(cls, value: str) -> str:
        if not re.fullmatch(r"[0-9]{6}", value or ""):
            raise ValueError("인증 코드는 6자리 숫자여야 합니다.")
        return value

    @model_validator(mode="after")
    def validate_register_fields(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("비밀번호와 비밀번호 확인이 일치하지 않습니다.")
        if self.agreements is not True:
            raise ValueError("필수 약관 동의가 필요합니다.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=16)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("비밀번호는 UTF-8 기준 72바이트를 넘을 수 없습니다.")
        return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None
    phone_number: str | None = None
    role: str
    auth_provider: str
    profile_image_url: str | None = None


class AuthResponse(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str | None = None


class EmailAvailabilityResponse(BaseModel):
    email: EmailStr
    available: bool


class TermsResponse(BaseModel):
    version: str
    content: str
    accepted_at: datetime | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=16)
    new_password: str = Field(min_length=8, max_length=16)
    confirm_new_password: str = Field(min_length=8, max_length=16)

    @field_validator("current_password")
    @classmethod
    def validate_current_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("기존 비밀번호는 UTF-8 기준 72바이트를 넘을 수 없습니다.")
        return value

    @field_validator("new_password")
    @classmethod
    def validate_new_password_policy(cls, value: str) -> str:
        return validate_password_policy(value, field_label="새 비밀번호")

    @field_validator("confirm_new_password")
    @classmethod
    def validate_confirm_new_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("새 비밀번호 확인 값은 UTF-8 기준 72바이트를 넘을 수 없습니다.")
        return value

    @model_validator(mode="after")
    def validate_change_fields(self) -> "PasswordChangeRequest":
        if self.new_password != self.confirm_new_password:
            raise ValueError("새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.")
        return self


class AccountDeleteRequest(BaseModel):
    confirmation_text: str = Field(min_length=1, max_length=100)


class RecoveryPurpose:
    SIGNUP = "signup"
    FIND_ID = "find_id"
    RESET_PASSWORD = "reset_password"


class RecoveryCodeSendRequest(BaseModel):
    purpose: str = Field(min_length=2, max_length=30)
    email: EmailStr
    full_name: str | None = Field(default=None, min_length=2, max_length=20)

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, value: str) -> str:
        allowed = {RecoveryPurpose.SIGNUP, RecoveryPurpose.FIND_ID, RecoveryPurpose.RESET_PASSWORD}
        if value not in allowed:
            raise ValueError("지원하지 않는 인증 목적입니다.")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_optional_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_nickname(value)


class RecoveryCodeSendResponse(BaseModel):
    verification_id: str
    expires_in_seconds: int
    message: str
    debug_code: str | None = None


class FindIdCompleteRequest(BaseModel):
    verification_id: str = Field(min_length=36, max_length=36)
    code: str = Field(min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not re.fullmatch(r"[0-9]{6}", value or ""):
            raise ValueError("인증 코드는 6자리 숫자여야 합니다.")
        return value


class FindIdCompleteResponse(BaseModel):
    email: EmailStr


class FindIdByProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=20)
    phone_number: str = Field(min_length=9, max_length=20)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return validate_nickname(value)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_phone_number(value)


class FindIdByProfileResponse(BaseModel):
    masked_email: str


class ResetPasswordByCodeRequest(BaseModel):
    email: EmailStr
    verification_id: str = Field(min_length=36, max_length=36)
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=16)
    confirm_new_password: str = Field(min_length=8, max_length=16)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not re.fullmatch(r"[0-9]{6}", value or ""):
            raise ValueError("인증 코드는 6자리 숫자여야 합니다.")
        return value

    @field_validator("new_password")
    @classmethod
    def validate_new_password_policy(cls, value: str) -> str:
        return validate_password_policy(value, field_label="새 비밀번호")

    @field_validator("confirm_new_password")
    @classmethod
    def validate_confirm_new_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("새 비밀번호 확인 값은 UTF-8 기준 72바이트를 넘을 수 없습니다.")
        return value

    @model_validator(mode="after")
    def validate_password_match(self) -> "ResetPasswordByCodeRequest":
        if self.new_password != self.confirm_new_password:
            raise ValueError("새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.")
        return self
