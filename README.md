# 무브맵 Movemap

물리치료사가 운영하는 운동센터를 지도에서 찾을 수 있는 웹/모바일 MVP 프로젝트입니다.

## 현재 상태

이 저장소는 로컬에서 만든 MVP를 GitHub에 올릴 수 있도록 정리한 버전입니다.

현재 포함된 기능:

- Expo React Native + React Native Web 기반 사용자 앱
- iOS/Android/Web 공통 앱 구조
- 센터장 등록 페이지
- 관리자 페이지
- 로컬 API 서버
- 센터 승인/노출 테스트 데이터
- 출시 및 업데이트 가이드 문서

## 보안 기준

환자 개인정보와 건강정보는 민감정보입니다.
현재 로컬 MVP는 실제 환자정보 저장용이 아니며, 운영 출시 전에는 보안 문서의 `출시 전 필수` 항목을 완료해야 합니다.

운영 보안 구조:

```text
iPhone 앱 / Android 앱 / Web
  -> HTTPS
  -> API 서버
  -> 인증·권한 검사 / 요청 검증 / 접속기록 / 암호화·복호화
  -> 암호화된 데이터베이스
```

사진과 문서는 비공개 파일 저장소에 저장하고, 암호화 키는 별도 비밀관리 서비스에 저장합니다.

먼저 확인할 문서:

- `docs/SECURITY_ARCHITECTURE.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/ENVIRONMENTS.md`
- `database/SECURITY_SCHEMA.md`
- `docs/HETZNER_BRANCH_DEPLOYMENT.md`

## 폴더 구조

```text
movemap-github-ready/
  apps/
    app/
      Expo React Native + React Native Web 앱
      iOS / Android / Web 공통 사용자 화면
      public/web/
        네이버 지도 WebView와 기존 웹 MVP 자산

    admin/
      관리자 페이지
      센터 승인/관리 화면
      최고관리자 접속기록 화면

    register/
      센터장 등록 페이지

  server/
    로컬 API 서버
    테스트 DB JSON

  packages/
    shared/
      앞으로 앱/서버/관리자 페이지가 같이 쓸 공통 설정을 넣을 곳

  database/
    이전 수동 배포용 Supabase DB 마이그레이션 기록

  supabase/
    GitHub 연동으로 자동 배포되는 Supabase 마이그레이션

  docs/
    출시 가이드
    초보자용 설명
    Notion 정리 문서
```

## 로컬 실행 방법

### 1. API 서버 실행

처음 실행할 때는 `.env.development.example`을 참고해서 `.env.development`를 만들고 로컬 관리자 비밀번호를 넣습니다.

```text
LOCAL_ADMIN_PASSWORD=내가_정한_로컬_비밀번호
NAVER_MAP_NCP_KEY_ID=내_네이버_지도_Client_ID
MOVEMAP_DB_PATH=server/data/db.local.json
```

```bash
node server/server.js
```

기본 주소:

```text
http://localhost:8090
```

### 2. 공통 앱 실행

Expo 앱 하나로 iOS, Android, Web을 실행합니다.

```bash
npm --prefix apps/app install
npm run app:start
```

Web으로 볼 때:

```bash
npm run app:web
```

iOS/Android로 볼 때:

```bash
npm run app:ios
npm run app:android
```

Expo Go에서 표시되는 QR 또는 `exp://...` 주소로 접속합니다.

기존 네이버 지도 WebView HTML은 API 서버의 아래 경로로도 제공됩니다.

```text
http://localhost:8090/web/mobile-map.html
```

### 3. 관리자/등록 페이지 확인

API 서버를 실행한 상태에서 접속합니다.

```text
http://localhost:8090/admin/
http://localhost:8090/register/
```

### 4. 보안 단위 테스트

```bash
npm run server:test:security
```

## GitHub에 올릴 때 주의할 점

GitHub에 올리면 안 되는 것:

- `node_modules`
- `.expo`
- `.env`
- 인증서, 서비스 계정 키, API 비밀키
- 실제 환자정보, 면허증 이미지, 치료 기록
- `server/data/db.json`, `server/data/db.local.json` 같은 실제 로컬/운영 DB 파일
- `.DS_Store`

이 파일들은 `.gitignore`에 등록해두었습니다.

GitHub에는 `server/data/db.example.json`처럼 개인정보가 없는 샘플 DB만 올립니다.

## 출시 준비 다음 단계

1. Staging과 Production Supabase 프로젝트를 각각 연결
2. 각 Supabase에 비공개 저장소 마이그레이션 적용
3. Hetzner staging/production 서버에 서로 다른 관리자 해시와 세션 비밀값 설정
4. Expo EAS로 iOS/Android 빌드
5. 네이버 클라우드에 운영 도메인 등록

자세한 내용은 `docs/` 폴더의 가이드를 참고하세요.

## Hetzner + Docker + Nginx/Traefik + Cloudflare 운영

운영은 Nginx, staging/feature Preview는 Traefik을 앞단에 두고 Docker Compose로 웹과 API를 운영합니다.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

VPS, Cloudflare, 백업 설정은 `docs/VPS_DOCKER_NGINX_CLOUDFLARE.md`를 확인하세요.

## 앞으로 작업 규칙

앞으로 수정할 때는 웹과 모바일을 같이 고려합니다.

예:

```text
센터 상세 카드 디자인 변경
→ apps/app 수정
→ iOS / Android / Web 확인
→ 로컬 웹 테스트
→ Expo 테스트
→ GitHub 업로드
```
