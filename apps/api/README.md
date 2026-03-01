# apps/api

## 실행 방법
```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 환경변수
- `CORS_ORIGINS`: 허용할 웹 출처 목록(쉼표 구분)
  - 기본값: `http://127.0.0.1:3000,http://localhost:3000`

## 엔드포인트
- `GET /` : 서비스 상태 확인
- `GET /health` : 헬스체크
