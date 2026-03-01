from __future__ import annotations

HEADER_ALIASES: dict[str, list[str]] = {
    "address_type": ["주소유형", "유형", "검색유형", "type", "address_type"],
    "sido": ["시도", "시/도", "시도명", "시"],
    "sigungu": ["시군구", "시/군/구", "시군구명", "구군", "시군"],
    "eupmyeondong": ["읍면동", "읍/면/동", "법정동", "동리", "동"],
    "san_type": ["산구분", "산", "산여부", "산여부(산/일반)"],
    "main_no": ["본번", "주번", "본번(주번)", "지번본번"],
    "sub_no": ["부번", "종번", "부번(종번)", "지번부번"],
    "road_name": ["도로명", "도로명주소", "도로명명", "도로"],
    "building_main_no": ["건물본번", "건물번호", "건물번호본번", "건물주번"],
    "building_sub_no": ["건물부번", "건물번호부번", "건물종번"],
    "full_address": ["주소", "전체주소", "원본주소", "소재지", "address"],
}

FIELD_KEYWORDS: dict[str, list[str]] = {
    "address_type": ["유형", "구분", "type", "address"],
    "sido": ["시도", "광역시", "특별시", "도"],
    "sigungu": ["시군구", "시군", "구군", "자치구"],
    "eupmyeondong": ["읍면동", "법정동", "동리", "행정동", "리"],
    "san_type": ["산구분", "산여부", "산"],
    "main_no": ["본번", "주번", "번지", "지번본"],
    "sub_no": ["부번", "종번", "지번부", "세번"],
    "road_name": ["도로명", "로명", "street", "road"],
    "building_main_no": ["건물본번", "건물번호", "건물주번"],
    "building_sub_no": ["건물부번", "건물종번", "건물번호부"],
    "full_address": ["주소", "소재지", "위치", "location"],
}

REQUIRED_COMMON = ["주소유형"]
RECOMMENDED_JIBUN = ["시도", "시군구", "읍면동", "산구분", "본번", "부번"]
RECOMMENDED_ROAD = ["시도", "시군구", "도로명", "건물본번", "건물부번"]
