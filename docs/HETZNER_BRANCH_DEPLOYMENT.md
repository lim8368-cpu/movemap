# Hetzner 브랜치별 배포 절차

## 목표 구조

```text
main ─────────> production container ─> production Supabase
develop ──────> staging.<server-ip>.sslip.io ─┐
feature/* ────> <branch>.<server-ip>.sslip.io ─> staging Supabase
```

현재는 Hetzner VPS 한 대 안에서 운영과 테스트를 논리적으로 분리한다. 운영 Nginx는
80번 포트, Preview Traefik은 443번 포트를 사용하며 서로 다른 Docker network와 env
파일을 사용한다. Feature Preview는 production Docker network에 참여하지 않는다.

## 1. GitHub 브랜치와 보호 규칙

1. `main`과 `develop`을 보호 브랜치로 지정한다.
2. 직접 push를 막고 Pull Request와 `Validate / test` 성공을 요구한다.
3. `main` PR의 source branch는 원칙적으로 `develop`만 허용한다.
4. `feature/* -> develop -> main` 순서를 사용한다.
5. 긴급 수정은 `hotfix/* -> main` 후 같은 커밋을 `develop`에도 병합한다.

현재 작업을 시작하는 명령은 다음과 같다.

```bash
git switch develop
git pull --ff-only
git switch -c feature/기능명
```

## 2. Preview 주소와 TLS

도메인 구입 전에는 `sslip.io`의 자동 DNS를 사용한다. IP의 점을 하이픈으로 바꿔 다음
주소를 쓴다.

- develop: `https://staging.157-90-26-205.sslip.io`
- feature: `https://feature-name.157-90-26-205.sslip.io`

Traefik이 Let's Encrypt 인증서를 자동 발급하므로 Preview 비밀번호가 암호화되어 전송된다.
나중에 사용자 도메인을 연결하면 `PREVIEW_HOST` 값만 바꾼다.

## 3. 데이터베이스

Supabase 프로젝트를 두 개 만든다.

- `movemap-production`: 실제 데이터 전용
- `movemap-staging`: 테스트/Preview 전용

마이그레이션의 배포 기준 경로는 `supabase/migrations/`이다. GitHub와 연결된 운영
Supabase는 `main` 병합 시 이 폴더의 새 SQL만 순서대로 적용한다. 테스트 Supabase에는
같은 SQL을 먼저 적용해 검증한다. 기존 `database/migrations/`는 이전 수동 배포 기록으로
보존한다.
`database/seeds/test_centers.sql`은 staging에만 실행한다. staging에는 `테스트센터01`,
`010-0000-0000` 같은 가짜 값만 입력하며 실제 면허증·전화번호·환자정보를 복사하지 않는다.

## 4. 운영 배포

VPS의 `/opt/movemap/.env.production`에 운영 값만 저장한다.

```bash
cd /opt/movemap
git fetch origin main
git switch main
git pull --ff-only origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://운영도메인/healthz
```

`main` 병합만 이 절차를 실행한다. staging용 key를 운영 서버에 저장하지 않는다.

## 5. 같은 VPS의 staging 공용 라우터

운영 파일과 다른 `/opt/movemap-secrets`에 Basic Auth 파일과 staging env를 만든다.

```bash
sudo mkdir -p /opt/movemap-secrets
sudo htpasswd -cB /opt/movemap-secrets/staging.htpasswd movemap-tester
sudo chmod 600 /opt/movemap-secrets/staging.htpasswd
```

실제 `.env.staging`에는 `STAGING_HTPASSWD_FILE`, staging Supabase
URL/key와 staging project ref를 입력한다. 공용 라우터는 한 번만 시작한다. 기존 운영
Nginx가 사용하지 않는 443 포트를 Preview가 사용하도록 bootstrap Compose의 443 publish는
제거해야 한다.

```bash
docker compose --env-file /opt/movemap-secrets/.env.staging \
  -f docker-compose.preview-edge.yml up -d
```

라우터는 모든 Preview에 Basic Auth와 `X-Robots-Tag: noindex`를 적용한다.

## 6. develop과 feature Preview

브랜치별로 안전한 소문자 slug를 만든다. 예: `develop`, `feature-center-search`.
각 브랜치는 별도 디렉터리와 Compose project name을 사용한다.

```bash
export PREVIEW_SLUG=feature-center-search
export PREVIEW_HOST=feature-center-search.157-90-26-205.sslip.io
export COMPOSE_PROJECT_NAME=movemap-$PREVIEW_SLUG
docker compose --env-file /opt/movemap-secrets/.env.staging \
  -f docker-compose.preview.yml up -d --build
```

`develop`은 `PREVIEW_SLUG=develop`,
`PREVIEW_HOST=staging.157-90-26-205.sslip.io`로 배포한다.
PR을 닫거나 병합한 feature stack은 다음 명령으로 제거한다.

```bash
docker compose --env-file /opt/movemap-secrets/.env.staging \
  -f docker-compose.preview.yml down
```

모든 Preview API는 같은 staging Supabase만 사용한다. 운영 Supabase URL/key는 staging
VPS에 존재하지 않아야 한다. 동시에 실행되는 Preview의 데이터 충돌을 피하려면 테스트
레코드에 branch slug를 붙이거나 테스트 후 seed를 다시 적용한다.

## 7. GitHub Actions 연결

저장소의 `validate.yml`은 PR/브랜치에서 보안 테스트와 Docker build를 수행한다.
자동 배포를 추가할 때 GitHub Environments를 `staging`, `production`으로 나누고 다음
Secrets를 각각 등록한다.

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- staging과 production에 서로 다른 known-host fingerprint

Supabase service-role key와 앱 비밀값은 GitHub Actions로 전달하지 않고 VPS의 env 파일에
만 보관하는 방식을 권장한다. Actions는 SSH로 해당 브랜치 checkout 및 위 Compose 명령만
실행한다. `production` Environment에는 required reviewer를 설정해 main 병합 후에도 최종
승인 없이는 배포되지 않게 한다.

## 8. 배포 확인표

- Preview 접속 시 Basic Auth가 나타난다.
- `/api/config`의 environment가 `staging`이다.
- Preview Supabase project ref가 staging ref와 같다.
- 테스트 DB에 실제 개인정보가 없다.
- main 배포는 production container와 production Supabase만 사용한다.
- `.env*`, 인증서, key, DB dump가 `git ls-files`에 나타나지 않는다.
- staging/production 앱을 한 기기에 동시에 설치할 수 있다.
