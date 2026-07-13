# VPS + Docker + Nginx + Cloudflare 운영

## 구조

```text
사용자 / 모바일 앱
  -> Cloudflare DNS, CDN, DDoS 방어
  -> HTTPS 443
  -> VPS Nginx
  -> Docker 내부망의 Movemap Node 서버
  -> Supabase DB와 비공개 Storage

매일 Backup 컨테이너
  -> PostgreSQL dump + Supabase Storage 복사
  -> restic 암호화
  -> Cloudflare R2 비공개 버킷
```

## 서버 권장 사양

- Ubuntu 24.04 LTS
- 2 vCPU, RAM 4 GB, SSD 40 GB 이상
- 한국 사용자 기준 싱가포르 또는 가까운 지역
- SSH 키 로그인만 사용

## 최초 서버 보안

1. 일반 sudo 사용자를 만들고 root 및 비밀번호 SSH 로그인을 끕니다.
2. Hetzner Cloud Firewall은 SSH 22를 관리자 IP로 제한합니다.
3. 80/443은 Cloudflare 공식 IP 대역에서만 접근하도록 제한합니다.
4. Ubuntu `unattended-upgrades` 보안 업데이트를 활성화합니다.
5. Docker와 Compose 플러그인은 Docker 공식 저장소에서 설치합니다.
6. 매월 OS, Docker 이미지, Cloudflare IP 대역을 점검합니다.

Docker가 UFW를 우회할 수 있으므로 외부 방화벽인 Hetzner Cloud Firewall을 우선 사용합니다.

## 배포 파일

서버의 `/opt/movemap`에 저장소를 clone하고 운영 환경 파일을 만듭니다.

```bash
cp .env.production.example .env.production
chmod 600 .env.production
mkdir -p deploy/tls
chmod 700 deploy/tls
```

도메인과 인증서를 연결하기 전 개발 확인은 HTTP 부트스트랩 구성으로 실행합니다.

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.bootstrap.yml \
  up -d --build app nginx
```

이 구성은 공인 IP의 80 포트에서만 사용하며 로그인 정보가 암호화되지 않으므로
실데이터 입력이나 외부 공개용으로 사용하지 않습니다. 도메인 연결 후 아래 HTTPS
구성으로 즉시 교체합니다.

Cloudflare에서 Origin CA 인증서를 발급하여 다음 두 파일에 넣습니다.

```text
deploy/tls/origin.crt
deploy/tls/origin.key
```

키 파일은 절대 GitHub에 올리지 않습니다.

```bash
chmod 600 deploy/tls/origin.key
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## Cloudflare

1. 소유 도메인을 Cloudflare에 추가합니다.
2. A 레코드를 VPS 공인 IPv4로 연결하고 Proxy를 켭니다.
3. SSL/TLS 모드를 `Full (strict)`로 설정합니다.
4. Always Use HTTPS를 켭니다.
5. `/api/*`, `/admin/*`, `/register/*`는 캐시하지 않습니다.
6. CSS, JS, 일반 이미지만 캐시합니다. Supabase 서명 URL은 별도로 캐시하지 않습니다.

`movemap.vercel.app`은 Vercel 소유 주소이므로 이 서버로 이전할 수 없습니다. 사용자 소유 도메인이 필요합니다.

## 자동 백업

백업 컨테이너는 시작 즉시 한 번 실행한 뒤 기본 24시간마다 다음을 수행합니다.

- Supabase PostgreSQL 전체 dump
- `movemap-private` Storage 전체 복사
- restic으로 암호화하여 Cloudflare R2에 업로드
- 일간 7개, 주간 4개, 월간 6개 보존

R2 버킷과 API 토큰은 운영 앱과 분리하고, 해당 백업 버킷에만 접근하도록 권한을 제한합니다.
월 1회 임시 DB와 별도 폴더에 복원 테스트를 해야 백업이 실제로 유효한지 확인할 수 있습니다.

백업 자격 증명을 모두 입력한 뒤 백업 프로필을 켭니다.

```bash
docker compose --profile backup --env-file .env.production \
  -f docker-compose.prod.yml up -d --build
```

## 업데이트와 되돌리기

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200
```

배포 전 Git 태그를 만들고 문제가 있으면 이전 태그로 이동한 뒤 같은 명령으로 재빌드합니다.
