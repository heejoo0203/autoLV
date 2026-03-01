from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from app.schemas.land import LandLookupRequest
from app.services.bulk.column_mapper import ColumnMapping
from app.services.ld_code_service import resolve_ld_code

AddressMode = Literal["auto", "jibun", "road"]

_NUMBER_PATTERN = re.compile(r"^\d+(?:-\d+)?$")
_JIBUN_PATTERN = re.compile(r"^산?\d+(?:-\d+)?$")
_ADDR_HINT_PATTERN = re.compile(r"(시|도|군|구).*(로|길|동|읍|면|리).*\d")


@dataclass(slots=True)
class NormalizedLookupRow:
    payload: LandLookupRequest
    summary: str
    cache_key: str


def normalize_lookup_row(
    *,
    row: list[str],
    mapping: ColumnMapping,
    address_mode: AddressMode,
) -> NormalizedLookupRow:
    address_type = mapping.get(row, "address_type")
    sido = mapping.get(row, "sido")
    sigungu = mapping.get(row, "sigungu")
    dong = mapping.get(row, "eupmyeondong")
    san_type = mapping.get(row, "san_type")
    main_no = mapping.get(row, "main_no")
    sub_no = mapping.get(row, "sub_no")
    road_name = mapping.get(row, "road_name")
    building_main_no = mapping.get(row, "building_main_no")
    building_sub_no = mapping.get(row, "building_sub_no")
    full_address = mapping.get(row, "full_address")

    if not full_address:
        full_address = _infer_full_address_from_row(row)
    if not address_type:
        address_type = _infer_address_type_from_row(row)

    mode = _resolve_mode(
        requested=address_mode,
        address_type=address_type,
        dong=dong,
        main_no=main_no,
        road_name=road_name,
        building_main_no=building_main_no,
        full_address=full_address,
    )

    if mode == "jibun":
        parsed = _parse_jibun(full_address)
        sido = sido or parsed.get("sido", "")
        sigungu = sigungu or parsed.get("sigungu", "")
        dong = dong or parsed.get("dong", "")

        parsed_main_no = main_no or parsed.get("main_no", "")
        parsed_sub_no = sub_no or parsed.get("sub_no", "")
        parsed_san = _normalize_san_type(san_type or parsed.get("san_type", "일반"))

        if not (sido and sigungu and dong and parsed_main_no):
            raise ValueError("지번 주소 필수값이 부족합니다. (시도/시군구/읍면동/본번)")

        ld_code = resolve_ld_code(sido=sido, sigungu=sigungu, eupmyeondong=dong)
        if not ld_code:
            raise ValueError(f"법정동 코드를 찾을 수 없습니다. ({sido} {sigungu} {dong})")

        payload = LandLookupRequest(
            search_type="jibun",
            ld_code=ld_code,
            san_type=parsed_san,
            main_no=_normalize_main_no(parsed_main_no),
            sub_no=_normalize_sub_no(parsed_sub_no),
        )
        summary = _compose_jibun_summary(sido, sigungu, dong, payload.san_type, payload.main_no, payload.sub_no)
        cache_key = f"jibun|{payload.ld_code}|{payload.san_type}|{payload.main_no}|{payload.sub_no}"
        return NormalizedLookupRow(payload=payload, summary=summary, cache_key=cache_key)

    parsed = _parse_road(full_address)
    sido = sido or parsed.get("sido", "")
    sigungu = sigungu or parsed.get("sigungu", "")
    road_name = road_name or parsed.get("road_name", "")
    building_main_no = building_main_no or parsed.get("building_main_no", "")
    building_sub_no = building_sub_no or parsed.get("building_sub_no", "")

    if not (sido and sigungu and road_name and building_main_no):
        raise ValueError("도로명 주소 필수값이 부족합니다. (시도/시군구/도로명/건물본번)")

    payload = LandLookupRequest(
        search_type="road",
        sido=sido,
        sigungu=sigungu,
        road_name=road_name,
        building_main_no=_normalize_main_no(building_main_no),
        building_sub_no=_normalize_sub_no(building_sub_no),
    )
    number = (
        payload.building_main_no
        if payload.building_sub_no in {"", "0"}
        else f"{payload.building_main_no}-{payload.building_sub_no}"
    )
    summary = f"{payload.sido} {payload.sigungu} {payload.road_name} {number}".strip()
    cache_key = f"road|{payload.sido}|{payload.sigungu}|{payload.road_name}|{payload.building_main_no}|{payload.building_sub_no}"
    return NormalizedLookupRow(payload=payload, summary=summary, cache_key=cache_key)


def _resolve_mode(
    *,
    requested: AddressMode,
    address_type: str,
    dong: str,
    main_no: str,
    road_name: str,
    building_main_no: str,
    full_address: str,
) -> Literal["jibun", "road"]:
    if requested in {"jibun", "road"}:
        return requested

    normalized_type = address_type.strip().lower()
    if "지번" in normalized_type:
        return "jibun"
    if "도로" in normalized_type:
        return "road"

    if road_name or building_main_no:
        return "road"
    if dong or main_no:
        return "jibun"

    if full_address:
        guessed = _guess_mode_from_address(full_address)
        if guessed:
            return guessed

    raise ValueError("주소유형을 판별할 수 없습니다. 주소유형 또는 주소 컬럼을 확인해 주세요.")


def _guess_mode_from_address(full_address: str) -> Literal["jibun", "road"] | None:
    tokens = _split_tokens(full_address)
    if len(tokens) < 4:
        return None
    number_token = tokens[-1]
    if not _NUMBER_PATTERN.fullmatch(number_token.replace("산", "")):
        return None
    name_token = tokens[-2]
    if any(suffix in name_token for suffix in ("로", "길")):
        return "road"
    return "jibun"


def _parse_jibun(full_address: str) -> dict[str, str]:
    tokens = _split_tokens(full_address)
    if len(tokens) < 4:
        return {}

    digit_index = _find_last_jibun_token(tokens)
    if digit_index < 3:
        return {}

    number_token = tokens[digit_index]
    dong_end = digit_index
    if number_token == "산":
        if digit_index + 1 >= len(tokens) or not _NUMBER_PATTERN.fullmatch(tokens[digit_index + 1]):
            return {}
        number_token = f"산{tokens[digit_index + 1]}"
    elif digit_index > 2 and tokens[digit_index - 1] == "산":
        number_token = f"산{number_token}"
        dong_end = digit_index - 1

    sido = tokens[0]
    sigungu = tokens[1]
    dong = " ".join(tokens[2:dong_end]).strip()
    if not dong:
        return {}

    is_san, main_no, sub_no = _split_jibun_token(number_token)
    return {
        "sido": sido,
        "sigungu": sigungu,
        "dong": dong,
        "san_type": "산" if is_san else "일반",
        "main_no": main_no,
        "sub_no": sub_no,
    }


def _parse_road(full_address: str) -> dict[str, str]:
    tokens = _split_tokens(full_address)
    if len(tokens) < 4:
        return {}

    number_idx = _find_last_number_token(tokens)
    if number_idx < 3:
        return {}

    sido = tokens[0]
    sigungu = tokens[1]
    road_name = " ".join(tokens[2:number_idx]).strip()
    if not road_name:
        return {}

    main_no, sub_no = _split_number_token(tokens[number_idx])
    return {
        "sido": sido,
        "sigungu": sigungu,
        "road_name": road_name,
        "building_main_no": main_no,
        "building_sub_no": sub_no,
    }


def _split_tokens(value: str) -> list[str]:
    return [token for token in str(value or "").strip().split() if token]


def _find_last_jibun_token(tokens: list[str]) -> int:
    for idx in range(len(tokens) - 1, -1, -1):
        token = tokens[idx]
        if _JIBUN_PATTERN.fullmatch(token):
            return idx
        if token == "산" and idx + 1 < len(tokens) and _NUMBER_PATTERN.fullmatch(tokens[idx + 1]):
            return idx
    return -1


def _find_last_number_token(tokens: list[str]) -> int:
    for idx in range(len(tokens) - 1, -1, -1):
        token = tokens[idx]
        if _NUMBER_PATTERN.fullmatch(token):
            return idx
    return -1


def _split_jibun_token(value: str) -> tuple[bool, str, str]:
    token = value.strip()
    is_san = token.startswith("산")
    token = token[1:] if is_san else token
    main_no, sub_no = _split_number_token(token)
    return is_san, main_no, sub_no


def _split_number_token(value: str) -> tuple[str, str]:
    token = value.strip()
    if "-" in token:
        main_no, sub_no = token.split("-", 1)
    else:
        main_no, sub_no = token, "0"
    return _normalize_main_no(main_no), _normalize_sub_no(sub_no)


def _normalize_san_type(value: str) -> str:
    text = str(value or "").strip().lower()
    if text in {"산", "y", "yes", "1", "true"}:
        return "산"
    return "일반"


def _normalize_main_no(value: str) -> str:
    text = re.sub(r"[^\d]", "", str(value or ""))
    if not text:
        raise ValueError("본번 값이 비어 있거나 숫자가 아닙니다.")
    return str(int(text))


def _normalize_sub_no(value: str) -> str:
    text = re.sub(r"[^\d]", "", str(value or ""))
    if not text:
        return "0"
    return str(int(text))


def _compose_jibun_summary(sido: str, sigungu: str, dong: str, san_type: str, main_no: str, sub_no: str) -> str:
    prefix = "산 " if san_type == "산" else ""
    jibun = f"{main_no}-{sub_no}" if sub_no != "0" else main_no
    return f"{sido} {sigungu} {dong} {prefix}{jibun}".strip()


def _infer_full_address_from_row(row: list[str]) -> str:
    for raw in row:
        text = " ".join(str(raw or "").strip().split())
        if len(text) < 8:
            continue
        if not _ADDR_HINT_PATTERN.search(text):
            continue
        return text
    return ""


def _infer_address_type_from_row(row: list[str]) -> str:
    for raw in row:
        token = str(raw or "").strip().lower()
        if token in {"지번", "parcel", "jibun"}:
            return "지번"
        if token in {"도로명", "road"}:
            return "도로명"
    return ""
