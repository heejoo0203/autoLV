# apps/api

## 실행 방법
```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 환경변수
기본 템플릿: `apps/api/.env.example`  
실행 환경에서는 `apps/api/.env` 사용을 권장합니다.

주요 변수:
- `CORS_ORIGINS`: 허용할 웹 출처 목록(쉼표 구분)
- `DATABASE_URL`: DB 연결 문자열 (기본값 `sqlite:///./autolv.db`)
- `JWT_SECRET_KEY`: Access 토큰 서명 키
- `JWT_REFRESH_SECRET_KEY`: Refresh 토큰 서명 키
- `COOKIE_SECURE`: 운영 HTTPS 환경에서 `true` 권장
- `COOKIE_SAMESITE`: 크로스 도메인 배포 시 `none` 권장
- `VWORLD_API_BASE_URL`: VWorld API 기본 URL
- `VWORLD_API_KEY`: VWorld 인증키
- `VWORLD_API_DOMAIN`: 발급받은 키의 허용 도메인(예: `localhost`)
- `ROAD_NAME_FILE_PATH`: 도로명 파일 경로(미입력 시 `docs/TN_SPRD_RDNM.txt` 자동 탐색)
- `LD_CODE_FILE_PATH`: 법정동 코드 파일 경로(미입력 시 `apps/web/public/ld_codes.json` 자동 탐색)
- `BULK_STORAGE_DIR`: 파일조회 업로드/결과 파일 저장 경로
- `BULK_MAX_ROWS`: 파일조회 최대 허용 행 수 (기본 `10000`)

## 엔드포인트
- `GET /` : 서비스 상태
- `GET /health` : 헬스체크
- `POST /api/v1/auth/register` : 회원가입
- `POST /api/v1/auth/login` : 로그인(쿠키 발급)
- `POST /api/v1/auth/logout` : 로그아웃(쿠키 삭제)
- `GET /api/v1/auth/me` : 현재 로그인 사용자 조회
- `POST /api/v1/land/single` : 지번/도로명 단건 공시지가 조회
- `GET /api/v1/land/road-initials` : 지역별 사용 가능한 도로명 자음 목록
- `GET /api/v1/land/road-names` : 지역+자음 기반 도로명 목록
- `GET /api/v1/bulk/guide` : 파일조회 가이드
- `GET /api/v1/bulk/template` : 파일조회 표준 양식 다운로드
- `POST /api/v1/bulk/jobs` : 파일 업로드/작업 생성
- `GET /api/v1/bulk/jobs` : 작업 목록(페이지네이션)
- `GET /api/v1/bulk/jobs/{job_id}` : 단일 작업 상태 조회
- `GET /api/v1/bulk/jobs/{job_id}/download` : 결과 다운로드
- `POST /api/v1/bulk/jobs/delete` : 선택 작업 삭제

## DB 초기화 및 관리자 계정 생성
```bash
cd apps/api
python scripts/reset_db_and_seed_admin.py
```

생성 계정:
- 닉네임: `admin`
- 이메일: `admin@admin.com`
- 비밀번호: `admin1234`
