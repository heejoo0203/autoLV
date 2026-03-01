# apps/web

## 실행 방법
```bash
cd apps/web
npm install
npm run dev
```

기본 URL: `http://127.0.0.1:3000`

## 환경변수
- `NEXT_PUBLIC_API_BASE_URL` (기본값: `http://127.0.0.1:8000`)
- `VWORLD_API_BASE_URL` (기본값: `https://api.vworld.kr`)
- `VWORLD_API_DOMAIN` (VWorld 등록 서비스 URL과 동일)
- `VWORLD_API_KEY` (VWorld 인증키)
- `VWORLD_PROXY_TOKEN` (`/api/vworld-proxy` 보호 토큰)

예시:
```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
VWORLD_API_BASE_URL=https://api.vworld.kr
VWORLD_API_DOMAIN=https://auto-lv.vercel.app
VWORLD_API_KEY=your-vworld-api-key
VWORLD_PROXY_TOKEN=change-me-vworld-proxy-token
```
