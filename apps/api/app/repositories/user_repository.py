from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    return db.scalar(stmt)


def get_user_by_profile(db: Session, *, full_name: str, phone_number: str) -> User | None:
    stmt = select(User).where(
        User.full_name == full_name,
        User.phone_number == phone_number,
    )
    return db.scalar(stmt)


def get_user_by_id(db: Session, user_id: str) -> User | None:
    stmt = select(User).where(User.id == user_id)
    return db.scalar(stmt)


def create_user(
    db: Session,
    *,
    email: str,
    password_hash: str,
    full_name: str | None,
    phone_number: str | None,
    terms_version: str,
    terms_snapshot: str,
    terms_accepted_at: datetime,
) -> User:
    user = User(
        email=email,
        password_hash=password_hash,
        full_name=full_name,
        phone_number=phone_number,
        terms_version=terms_version,
        terms_snapshot=terms_snapshot,
        terms_accepted_at=terms_accepted_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def save_user(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user_by_id(db: Session, user_id: str) -> int:
    stmt = delete(User).where(User.id == user_id)
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)
