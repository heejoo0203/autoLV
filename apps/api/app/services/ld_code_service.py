from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from app.core.config import settings

_ld_code_map: dict[tuple[str, str, str], str] | None = None
_ld_code_lock = Lock()

_SIDO_ALIAS_MAP: dict[str, list[str]] = {
    "서울": ["서울특별시"],
    "부산": ["부산광역시"],
    "대구": ["대구광역시"],
    "인천": ["인천광역시"],
    "광주": ["광주광역시"],
    "대전": ["대전광역시"],
    "울산": ["울산광역시"],
    "세종": ["세종특별자치시"],
    "경기": ["경기도"],
    "강원": ["강원특별자치도", "강원도"],
    "충북": ["충청북도"],
    "충남": ["충청남도"],
    "전북": ["전북특별자치도", "전라북도"],
    "전남": ["전라남도"],
    "경북": ["경상북도"],
    "경남": ["경상남도"],
    "제주": ["제주특별자치도", "제주도"],
}


def resolve_ld_code(sido: str, sigungu: str, eupmyeondong: str) -> str | None:
    mapping = _get_ld_code_map()
    if not (sido and sigungu and eupmyeondong):
        return None

    sido_candidates = _expand_sido_candidates(sido)
    sigungu_candidates = _expand_sigungu_candidates(sigungu)
    dong_candidates = _expand_dong_candidates(eupmyeondong)

    for s in sido_candidates:
        for g in sigungu_candidates:
            for d in dong_candidates:
                code = mapping.get((s, g, d))
                if code:
                    return code
    return None


def _get_ld_code_map() -> dict[tuple[str, str, str], str]:
    global _ld_code_map
    if _ld_code_map is not None:
        return _ld_code_map

    with _ld_code_lock:
        if _ld_code_map is not None:
            return _ld_code_map
        _ld_code_map = _load_ld_code_map(Path(settings.ld_code_file_path))
    return _ld_code_map


def _load_ld_code_map(file_path: Path) -> dict[tuple[str, str, str], str]:
    if not file_path.exists():
        return {}

    with file_path.open("r", encoding="utf-8") as fp:
        payload = json.load(fp)

    result: dict[tuple[str, str, str], str] = {}
    if not isinstance(payload, dict):
        return result

    for sido, sigungu_map in payload.items():
        if not isinstance(sigungu_map, dict):
            continue
        for sigungu, dong_map in sigungu_map.items():
            if not isinstance(dong_map, dict):
                continue
            for dong, code in dong_map.items():
                code_text = str(code).strip()
                if len(code_text) != 10 or not code_text.isdigit():
                    continue
                key = (_normalize_token(str(sido)), _normalize_token(str(sigungu)), _normalize_token(str(dong)))
                result[key] = code_text
    return result


def _normalize_token(value: str) -> str:
    return "".join(str(value or "").strip().split())


def _expand_sido_candidates(sido: str) -> list[str]:
    normalized = _normalize_token(sido)
    if not normalized:
        return []

    candidates: list[str] = [normalized]
    for short_name, full_names in _SIDO_ALIAS_MAP.items():
        if normalized == _normalize_token(short_name):
            candidates.extend(_normalize_token(name) for name in full_names)
            break
        if normalized in {_normalize_token(name) for name in full_names}:
            candidates.append(_normalize_token(short_name))
            break
    return list(dict.fromkeys(candidates))


def _expand_sigungu_candidates(sigungu: str) -> list[str]:
    normalized = _normalize_token(sigungu)
    if not normalized:
        return []
    candidates = [normalized]

    # 흔한 오타/축약 보정: 접미사 누락 시 후보를 확장.
    if not normalized.endswith(("시", "군", "구")):
        candidates.extend([f"{normalized}시", f"{normalized}군", f"{normalized}구"])
    return list(dict.fromkeys(candidates))


def _expand_dong_candidates(dong: str) -> list[str]:
    normalized = _normalize_token(dong)
    if not normalized:
        return []

    candidates = [normalized]
    if normalized.endswith(("동", "읍", "면", "리")):
        candidates.append(normalized[:-1])
    else:
        candidates.extend([f"{normalized}동", f"{normalized}읍", f"{normalized}면", f"{normalized}리"])
    return [item for item in dict.fromkeys(candidates) if item]
