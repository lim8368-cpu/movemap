# Movemap GitHub 업로드 안내

이 폴더가 GitHub에 올릴 실제 무브맵 원본입니다.

```text
outputs/movemap-github-ready/
```

GitHub에는 이 폴더 안의 내용만 올리면 됩니다. 이 폴더 밖에 있는 테스트 폴더는 올리지 않습니다.

## 1. GitHub에 올라갈 폴더 구조

GitHub 저장소에는 아래 구조 그대로 올라가면 됩니다.

```text
movemap/
  README.md
  UPLOAD_THIS_TO_GITHUB.md
  .gitignore
  .env.example

  web/
    사용자 웹사이트
    네이버 지도 기반 메인 화면
    모바일 WebView용 지도 HTML

  mobile/
    Expo 기반 iOS/Android 앱
    웹과 같은 센터 지도 UX를 모바일에서 확인하는 앱

  admin/
    관리자 페이지
    센터 등록 신청 확인
    승인 후 메인 웹/앱에 센터 노출

  register/
    센터장용 등록 페이지
    센터 정보, 사진, 면허 인증 자료 입력

  server/
    로컬 API 서버
    센터 목록, 등록 신청, 승인, 통계 API
    보안 기본장치와 테스트 코드

  server/data/
    로컬 MVP 테스트 DB
    실제 환자정보 저장 금지

  shared/
    앞으로 웹/모바일/서버가 같이 쓸 공통 코드 자리

  database/
    운영 DB 설계 문서
    보안 스키마 초안

  docs/
    출시 가이드
    업데이트 가이드
    보안 아키텍처
    보안 체크리스트
    Notion 정리용 문서
```

## 2. 올리지 말아야 하는 테스트 폴더

아래 폴더들은 이 폴더 밖에 있는 로컬 테스트용입니다.

```text
outputs/web-browser/
outputs/mobile-ios-android/
outputs/backend-server/
outputs/admin-dashboard/
outputs/center-registration/
outputs/movemap-mobile/
```

위 폴더들은 GitHub에 직접 올리지 마세요.

## 3. GitHub 업로드 순서

GitHub에서 새 저장소를 먼저 만듭니다.

추천 저장소 이름:

```text
movemap
```

그 다음 터미널에서 아래 명령어를 실행합니다.

```bash
cd /Users/seokjoonlim/Documents/Codex/2026-07-05/durl/outputs/movemap-github-ready
git remote add origin <GitHub 저장소 주소>
git branch -M main
git push -u origin main
```

예시:

```bash
cd /Users/seokjoonlim/Documents/Codex/2026-07-05/durl/outputs/movemap-github-ready
git remote add origin https://github.com/내아이디/movemap.git
git branch -M main
git push -u origin main
```

## 4. 이미 remote를 잘못 넣었을 때

GitHub 주소를 잘못 넣었다면 아래처럼 바꿉니다.

```bash
git remote set-url origin https://github.com/내아이디/movemap.git
git push -u origin main
```

## 5. 앞으로 수정 기준

앞으로 Codex와 작업할 때는 이 폴더 안에서 수정합니다.

```text
web/
mobile/
admin/
register/
server/
shared/
database/
docs/
```

수정 후 GitHub에 다시 올릴 때는 아래 순서로 진행합니다.

```bash
git status
git add .
git commit -m "수정 내용 요약"
git push
```

## 6. 보안 주의

GitHub에 올리면 안 되는 것:

```text
.env
인증서
서비스 계정 키
API 비밀키
실제 환자정보
실제 치료 기록
실제 면허증 이미지
실제 환자 사진
```

현재 저장소에는 보안 기본장치와 체크리스트가 들어 있습니다.
실제 환자정보를 운영 저장하기 전에는 아래 문서를 먼저 확인해야 합니다.

```text
docs/SECURITY_ARCHITECTURE.md
docs/SECURITY_CHECKLIST.md
database/SECURITY_SCHEMA.md
```
