# EC2 VWorld Proxy (고정 IP)

`infra/vworld-proxy`는 Railway/Vercel 환경에서 VWorld 직접 호출이 불안정할 때 사용할 고정 IP 프록시 서버입니다.

## 1. 서버 준비
권장:
- AWS EC2 (Seoul `ap-northeast-2`)
- Ubuntu 22.04+
- Elastic IP 연결
- 보안그룹 Inbound: `8080/tcp` (최소한 Railway 호출 대역만 허용)

## 2. 코드 배치
```bash
sudo mkdir -p /opt/autolv-vworld-proxy
sudo chown -R ubuntu:ubuntu /opt/autolv-vworld-proxy
cd /opt/autolv-vworld-proxy

# 이 폴더 내용(app/, requirements.txt, .env)을 복사
```

## 3. 파이썬 환경
```bash
cd /opt/autolv-vworld-proxy
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 4. 환경변수
`.env.example`를 복사해 `.env` 생성:
```bash
cp .env.example .env
```

필수:
- `VWORLD_API_KEY`
- `VWORLD_API_DOMAIN` (VWorld 등록값과 동일)
- `PROXY_TOKEN` (Railway와 동일한 공유 토큰)
- `ALLOWED_PATH_PREFIXES` (`/ned,/req/address,/req/data` 권장)

## 5. 수동 실행
```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

헬스체크:
```bash
curl http://127.0.0.1:8080/health
```

프록시 확인:
```bash
curl -X POST http://127.0.0.1:8080/vworld-proxy \
  -H "content-type: application/json" \
  -H "x-vworld-proxy-token: <PROXY_TOKEN>" \
  -d '{"path":"/ned/data/getIndvdLandPriceAttr","params":{"pnu":"1111010100100010000","format":"json","numOfRows":"10","pageNo":"1"}}'
```

구역조회용 추가 확인:
```bash
curl -X POST http://127.0.0.1:8080/vworld-proxy \
  -H "content-type: application/json" \
  -H "x-vworld-proxy-token: <PROXY_TOKEN>" \
  -d '{"path":"/req/data","params":{"service":"data","request":"GetFeature","data":"LP_PA_CBND_BUBUN","version":"2.0","format":"json","geomFilter":"BOX(126.9761,37.5642,126.9770,37.5649)","size":"10","page":"1"}}'
```

위 요청이 400으로 떨어지면 `.env`의 `ALLOWED_PATH_PREFIXES`에 `/req/data`가 빠진 상태다.

## 6. systemd 등록
```bash
sudo cp deploy/autolv-vworld-proxy.service /etc/systemd/system/autolv-vworld-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable autolv-vworld-proxy
sudo systemctl start autolv-vworld-proxy
sudo systemctl status autolv-vworld-proxy
```

로그:
```bash
sudo journalctl -u autolv-vworld-proxy -f
```

## 7. Railway 연결
Railway API env:
```env
VWORLD_PROXY_URL=http://<EC2_ELASTIC_IP>:8080/vworld-proxy
VWORLD_PROXY_TOKEN=<PROXY_TOKEN>
```

설정 후 Railway API를 재배포합니다.

## 8. 화이트리스트 요청
VWorld에 고정 IP 화이트리스트를 요청할 때 아래 정보 전달:
- 서비스 도메인: `https://auto-lv.vercel.app`
- 서버 고정 IP: `<EC2 Elastic IP>`
- 호출 URL: `https://api.vworld.kr/ned/data/getIndvdLandPriceAttr`
- 장애 시간대/오류 메시지
