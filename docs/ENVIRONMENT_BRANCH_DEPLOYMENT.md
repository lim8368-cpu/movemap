# 운영/테스트 환경 분리 가이드

이 문서는 무브맵을 실제 서비스로 운영할 때 코드, 웹사이트, API 서버, 데이터베이스, 모바일 앱을 운영 환경과 테스트 환경으로 분리하는 기준입니다.

## 현재 프로젝트 분석

현재 저장소는 아래 구조입니다.

```text
movemap/
  apps/app
    Expo React Native + React Native Web 공통 앱
    iOS, Android, Web 사용자 앱
    app.config.js
      앱 이름, bundle identifier, Android applicationId를 환경별로 분리
    eas.json
      Expo EAS 빌드 프로필

  apps/admin
    관리자 웹

  apps/register
    센터장 등록 웹

  server
    로컬 MVP API 서버
    인증, 권한, 접속기록, 센터 등록/승인

  database
    운영 DB 구조 문서

  docs
    출시, 보안, 운영 문서
```

현재 서버는 로컬 MVP 단계라 JSON 파일을 임시 DB처럼 사용할 수 있습니다.
하지만 운영과 테스트가 시작되면 운영 DB와 테스트 DB는 반드시 별도로 만들어야 합니다.

## GitHub 브랜치 규칙

```text
main
  실제 사용자에게 배포되는 운영 코드

develop
  내가 수정사항을 확인하는 테스트 코드

feature/*
  개별 기능 작업 코드
```

브랜치 사용 흐름은 아래처럼 합니다.

```text
feature/기능명
  ↓ Pull Request
develop
  ↓ 테스트 환경 확인
main
  ↓ 운영 배포
```

규칙:

- `main`에는 바로 작업하지 않습니다.
- 모든 수정은 `feature/*` 브랜치에서 시작합니다.
- `develop`은 테스트 서버와 테스트 웹사이트에 연결합니다.
- `main`은 운영 서버와 운영 웹사이트에만 연결합니다.
- 운영 배포는 최종 확인 후에만 `main`으로 병합합니다.

## 웹 배포 구조

웹 배포는 브랜치에 따라 나눕니다.

```text
main
  → 운영 웹사이트
  → https://movemap.example

develop
  → 테스트 웹사이트
  → https://staging.movemap.example
  → 관리자 인증 또는 비밀번호 필요

feature/*
  → 기능별 preview URL
  → Pull Request에서만 확인
```

권장 설정:

- Vercel, Cloudflare Pages, Netlify 중 하나를 GitHub 저장소와 연결합니다.
- Production Branch는 `main`으로 설정합니다.
- Preview Branch는 `develop`, `feature/*`를 허용합니다.
- 테스트 웹사이트에는 비밀번호, Basic Auth, 또는 관리자 로그인 장벽을 둡니다.

테스트 웹사이트는 검색엔진에 노출되지 않게 합니다.

## 서버와 데이터베이스 분리

운영 환경:

```text
운영 웹사이트
  ↓ HTTPS
운영 API 서버
  ↓
운영 데이터베이스
```

테스트 환경:

```text
테스트 웹사이트
  ↓ HTTPS
테스트 API 서버
  ↓
테스트 데이터베이스
```

절대 금지:

- 테스트 API 서버가 운영 데이터베이스에 연결되는 것
- feature 브랜치 preview가 운영 API를 호출하는 것
- 개발/테스트 환경에 실제 환자 개인정보를 넣는 것
- 운영 DB 비밀번호를 GitHub에 올리는 것

테스트 DB에는 가짜 데이터만 넣습니다.

```text
환자 이름: 테스트환자01
전화번호: 010-0000-0000
주소: 사용하지 않음
진단명: 테스트 진단
치료 메모: 테스트 메모
```

## 환경변수 분리

환경은 세 개로 나눕니다.

```text
development
  내 맥북에서 로컬 개발

staging
  develop 브랜치와 preview 확인용 테스트 환경

production
  실제 사용자 운영 환경
```

GitHub에는 실제 값이 들어간 `.env` 파일을 올리지 않습니다.
GitHub에는 예시 파일만 올립니다.

```text
.env.development.example
.env.staging.example
.env.production.example
```

실제 값은 아래에 저장합니다.

```text
로컬 개발
  → 내 컴퓨터의 .env 파일

Vercel/Cloudflare/Render/Supabase/Expo
  → 각 서비스의 Environment Variables 또는 Secret Manager

GitHub Actions
  → GitHub Secrets
```

중요 환경변수:

```text
APP_ENV
NODE_ENV
EXPO_PUBLIC_API_BASE_URL
NAVER_MAP_NCP_KEY_ID
DATABASE_URL_SECRET_NAME
AES_256_GCM_KEY_SECRET_NAME
SESSION_SECRET_NAME
FILE_STORAGE_BUCKET_SECRET_NAME
ALLOWED_ORIGINS
REQUIRE_HTTPS
```

주의:

- `EXPO_PUBLIC_*` 값은 앱 번들에 포함될 수 있습니다.
- 비밀번호, DB 접속정보, Client Secret은 `EXPO_PUBLIC_*`로 만들면 안 됩니다.
- 네이버 지도 JavaScript SDK의 Client ID는 공개될 수 있지만, Client Secret은 절대 공개하면 안 됩니다.

## 모바일 앱 분리

iOS와 Android는 운영 앱과 테스트 앱을 동시에 설치할 수 있어야 합니다.

현재 `apps/app/app.config.js`에서 아래처럼 분리합니다.

| 환경 | 앱 이름 | iOS Bundle ID | Android applicationId |
|---|---|---|---|
| development | 무브맵 Dev | `com.movemap.app.dev` | `com.movemap.app.dev` |
| staging | 무브맵 Test | `com.movemap.app.staging` | `com.movemap.app.staging` |
| production | 무브맵 | `com.movemap.app` | `com.movemap.app` |

이렇게 하면 한 휴대폰에 아래 앱을 동시에 설치할 수 있습니다.

```text
무브맵
무브맵 Test
무브맵 Dev
```

## Expo EAS 빌드

`apps/app/eas.json`에 세 가지 빌드 프로필을 둡니다.

```text
development
  개발 클라이언트 또는 내부 테스트

staging
  내부 테스트용 앱

production
  App Store / Google Play 제출용 앱
```

예시 명령:

```bash
cd apps/app
eas build --profile staging --platform ios
eas build --profile staging --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

## 배포 절차

기능 수정:

```text
1. feature/기능명 브랜치 생성
2. Codex가 코드 수정
3. 로컬 테스트
4. GitHub에 push
5. Pull Request 생성
6. feature preview URL 확인
7. develop에 병합
8. staging 웹/API/DB에서 확인
9. main에 병합
10. production 웹/API 배포
11. 필요하면 production 모바일 앱 빌드 및 스토어 제출
```

운영 배포 전 체크:

- preview URL이 운영 DB를 호출하지 않는지 확인
- staging API가 staging DB만 보는지 확인
- production API가 production DB만 보는지 확인
- 실제 개인정보가 staging DB에 없는지 확인
- `.env`, DB 비밀번호, API Secret이 GitHub에 없는지 확인
- iOS/Android 앱의 API URL이 환경에 맞는지 확인

## 앞으로 해야 할 실제 연결 작업

아직 이 저장소 안에서 끝난 것은 “구조와 기준 설정”입니다.
실제 배포 서비스를 연결할 때 아래 작업이 필요합니다.

1. GitHub에 `develop` 브랜치 생성
2. Vercel 또는 Cloudflare Pages 연결
3. Production Branch를 `main`으로 설정
4. Preview Branch에 `develop`, `feature/*` 허용
5. staging API 서버 생성
6. production API 서버 생성
7. staging DB 생성
8. production DB 생성
9. staging/production 환경변수 각각 등록
10. Expo EAS 프로젝트 연결
11. iOS/Android staging 앱과 production 앱 빌드

## 핵심 원칙

테스트 환경은 운영 환경을 절대 건드리지 않습니다.

```text
feature/* → preview web → staging API 또는 preview API → staging DB
develop   → staging web → staging API → staging DB
main      → production web → production API → production DB
```

이 구조가 지켜지면 Codex로 계속 수정하더라도 운영 사용자와 운영 데이터가 바로 영향을 받지 않습니다.
