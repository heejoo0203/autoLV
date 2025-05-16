# autoLV (오토랜드밸류)

지번 리스트 또는 엑셀 파일을 입력하면 공시지가를 자동 조회해주는 웹 애플리케이션입니다.

---

## 🌟 주요 기능

- ✅ 텍스트 지번 입력 → 공시지가 자동 조회
- ✅ 엑셀 업로드 → 지번별 공시지가 일괄 조회
- ✅ 결과 텍스트/엑셀 다운로드 제공
- 🔜 지도 기반 시각화 (히트맵 형태)
- 🔜 재개발 구역 내 지번 일괄 조회

---

## 📁 프로젝트 구조
```
autoLV/
├── backend/ # FastAPI 백엔드 서버
│ ├── app/ # 실제 API 코드가 들어갈 위치
│ │ └── main.py
│ └── requirements.txt
├── frontend/ # 사용자 인터페이스 (HTML/JS)
│ └── index.html
├── crawler/ # 공시지가 수집 모듈
│ └── fetch_land_price.py
├── docs/ # 기획 문서, 명세서 등
│ └── feature-spec.md
├── .gitignore # Git 추적 제외 설정
└── README.md # 이 문서
```

---

## 🔧 기술 스택

- **백엔드**: Python, FastAPI
- **프론트엔드**: HTML, JavaScript (추후 React로 확장 가능)
- **크롤링/API**: Selenium or 국토부 공공데이터 API
- **지도 시각화**: Kakao Map API or Leaflet.js (확장 예정)
- **배포**: Render, Railway, GitHub Pages 등
- **협업**: Git + GitHub (Conventional Commit Style)

---

## 🛠 개발 상태

- [x] 프로젝트 구조 초기화
- [x] README.md 작성
- [x] .gitignore 생성
- [ ] FastAPI 기본 API 구성
- [ ] 크롤러 구현
- [ ] 프론트 UI 구성
- [ ] 지도 연동 및 고도화
