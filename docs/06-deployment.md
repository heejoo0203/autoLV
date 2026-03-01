# v1 배포 가이드

## 1. 배포 목표
v1 릴리스 범위(개별조회, 인증, 파일조회)를 운영 환경에서 안정적으로 서비스한다.

## 2. 배포 범위 (v1)
- 개별조회(지번/도로명)
- 회원가입/로그인/로그아웃/내 정보 조회
- 파일조회(양식 다운로드, 업로드, 비동기 처리, 이력, 결과 다운로드)
- 조회기록(localStorage)

제외:
- 지도조회(2단계)
- 폴리곤 집계(2단계)

## 3. 사전 준비 체크리스트
- VWorld API 키 발급 완료
- VWorld 키 허용 도메인에 운영 API 도메인 등록 완료
- 배포 도메인/서브도메인 확정
  - Web: 예) `https://autolv.example.com`
  - API: 예) `https://api.autolv.example.com`
- 운영 관리자 계정 정책 확정(초기 admin 계정 비밀번호 변경 포함)

## 4. 환경변수
### 4.1 API (`apps/api/.env`)
```env
CORS_ORIGINS=https://autolv.example.com
DATABASE_URL=sqlite:///./autolv.db
JWT_SECRET_KEY=replace-with-strong-secret
JWT_REFRESH_SECRET_KEY=replace-with-strong-refresh-secret
ACCESS_TOKEN_EXP_MINUTES=60
REFRESH_TOKEN_EXP_DAYS=14
COOKIE_SECURE=true
COOKIE_SAMESITE=none
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_API_DOMAIN=api.autolv.example.com
VWORLD_TIMEOUT_SECONDS=15
VWORLD_API_KEY=your-real-key
ROAD_NAME_FILE_PATH=
LD_CODE_FILE_PATH=
BULK_STORAGE_DIR=./storage/bulk
BULK_MAX_ROWS=10000
```

### 4.2 Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_BASE_URL=https://api.autolv.example.com
```

## 5. 권장 배포 구성
### 5.1 Web: Vercel
1. Vercel 프로젝트 생성 후 `apps/web`를 루트로 지정
2. Build Command: `npm run build`
3. Output: Next.js 기본 설정 사용
4. 환경변수 `NEXT_PUBLIC_API_BASE_URL` 설정

### 5.2 API: Linux 서버(EC2/Lightsail 등)
현재 API는 SQLite 파일과 업로드 결과 파일을 로컬 디스크에 저장하므로, 쓰기 가능한 영속 디스크가 필요하다.

권장 절차:
1. 서버에 코드 배포
2. Python 가상환경 생성
3. `pip install -r apps/api/requirements.txt`
4. `apps/api/.env` 배치
5. systemd로 Uvicorn 서비스 등록
6. Nginx 리버스 프록시 구성(HTTPS)

예시 실행 명령:
```bash
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 6. 운영 점검 절차 (배포 직후)
1. `GET /health`가 200인지 확인
2. 회원가입/로그인/로그아웃 동작 확인
3. 개별조회(지번/도로명) 실데이터 응답 확인
4. 파일조회 테스트
  - 템플릿 다운로드
  - 샘플 업로드
  - 진행률 폴링
  - 결과 다운로드
  - 작업 삭제
5. CORS/쿠키 확인
  - Web 도메인에서 로그인 유지
  - `HttpOnly`, `Secure`, `SameSite=None` 적용 여부

## 7. 데이터 백업/복구
v1 기준 핵심 보존 대상:
- `apps/api/autolv.db`
- `apps/api/storage/bulk/` 전체

백업 권장:
- 일 1회 스냅샷
- 배포 직전 수동 백업 1회

## 8. 롤백 전략
1. 직전 배포 태그로 API/Web 각각 롤백
2. 필요 시 `autolv.db`와 `storage/bulk`를 직전 백업으로 복구
3. `/health`, 로그인, 개별조회, 파일조회 최소 시나리오 재검증

## 9. v2 진입 전 준비
- PostgreSQL/PostGIS 전환 계획 수립
- Redis 캐시 인프라 준비
- 마이그레이션 도구(Alembic 등) 도입 검토
