from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.bulk.constants import FIELD_KEYWORDS, HEADER_ALIASES

_FIELD_ORDER = [
    "address_type",
    "full_address",
    "sido",
    "sigungu",
    "eupmyeondong",
    "road_name",
    "building_main_no",
    "building_sub_no",
    "san_type",
    "main_no",
    "sub_no",
]


@dataclass(slots=True)
class ColumnMapping:
    index_by_field: dict[str, int]

    def get(self, row: list[str], field: str) -> str:
        idx = self.index_by_field.get(field)
        if idx is None or idx >= len(row):
            return ""
        return str(row[idx]).strip()


def map_headers(headers: list[str]) -> ColumnMapping:
    normalized_headers = [_normalize_header(h) for h in headers]
    index_by_field: dict[str, int] = {}
    used_indexes: set[int] = set()

    alias_map = {field: {_normalize_header(alias) for alias in aliases} for field, aliases in HEADER_ALIASES.items()}

    # 1) Exact alias match (highest confidence)
    for field in _FIELD_ORDER:
        candidates = alias_map.get(field, set())
        if not candidates:
            continue
        for idx, normalized in enumerate(normalized_headers):
            if idx in used_indexes:
                continue
            if normalized in candidates:
                index_by_field[field] = idx
                used_indexes.add(idx)
                break

    # 2) Keyword-based fuzzy match
    scored_candidates: list[tuple[int, str, int]] = []
    for field in _FIELD_ORDER:
        if field in index_by_field:
            continue
        for idx, normalized in enumerate(normalized_headers):
            if idx in used_indexes:
                continue
            score = _score_header_for_field(field=field, normalized_header=normalized)
            if score > 0:
                scored_candidates.append((score, field, idx))

    for _, field, idx in sorted(scored_candidates, key=lambda item: item[0], reverse=True):
        if field in index_by_field or idx in used_indexes:
            continue
        if _looks_misaligned(field=field, normalized_header=normalized_headers[idx]):
            continue
        index_by_field[field] = idx
        used_indexes.add(idx)

    return ColumnMapping(index_by_field=index_by_field)


def _score_header_for_field(*, field: str, normalized_header: str) -> int:
    if not normalized_header:
        return 0

    score = 0
    for keyword in FIELD_KEYWORDS.get(field, []):
        keyword_norm = _normalize_header(keyword)
        if not keyword_norm:
            continue
        if keyword_norm in normalized_header:
            score = max(score, 10 + len(keyword_norm))

    # Field-specific bonus for common signals.
    if field == "full_address" and any(token in normalized_header for token in ("주소", "소재지", "location")):
        score += 8
    if field == "address_type" and any(token in normalized_header for token in ("유형", "구분", "type")):
        score += 6
    if field == "road_name" and "도로" in normalized_header:
        score += 4
    if field in {"main_no", "sub_no"} and "지번" in normalized_header:
        score += 4
    if field in {"building_main_no", "building_sub_no"} and "건물" in normalized_header:
        score += 4
    return score


def _looks_misaligned(*, field: str, normalized_header: str) -> bool:
    # Prevent clearly wrong fuzzy matches on generic headers.
    if field == "address_type" and any(token in normalized_header for token in ("본번", "부번", "번호")):
        return True
    if field == "full_address" and any(token in normalized_header for token in ("본번", "부번", "번호")):
        return True
    if field in {"main_no", "sub_no"} and "건물" in normalized_header:
        return True
    if field in {"building_main_no", "building_sub_no"} and "지번" in normalized_header:
        return True
    return False


def _normalize_header(value: str) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[\s\-_()/\[\]{}]+", "", text)
