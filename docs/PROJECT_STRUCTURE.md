# DAIL Project Structure

DAIL은 웹, iOS, Android를 같이 출시하기 위해 Expo React Native + React Native Web 중심 구조로 정리합니다.

```text
movemap/
  apps/
    app/
      Expo React Native + React Native Web 공통 앱
      iOS / Android / Web 사용자 화면

      public/web/
        네이버 지도 WebView HTML
        기존 웹 MVP 자산

    admin/
      관리자 웹
      센터 승인
      통계 확인
      최고관리자 접속기록 확인

    register/
      센터장 등록 웹
      센터 정보 입력
      사진/면허 인증 입력

  packages/
    shared/
      앱, 관리자, 등록 페이지, 서버가 같이 쓸 공통 코드

  server/
    API 서버
    인증/권한
    접속기록
    센터 등록/조회/승인

  database/
    운영 DB 구조 문서
    보안 스키마

  docs/
    출시 가이드
    보안 문서
    운영 문서
```

## 수정 원칙

사용자 앱 기능은 먼저 `apps/app`에서 수정합니다.
이 앱은 iOS, Android, Web의 중심 코드입니다.

관리자 기능은 `apps/admin`에서 수정합니다.

센터장 등록 기능은 `apps/register`에서 수정합니다.

서버 API, 보안, 권한, 접속기록은 `server`에서 수정합니다.

공통 타입, 공통 필터, 공통 API 함수는 앞으로 `packages/shared`로 옮깁니다.

## 실행 명령

```bash
npm run server:start
npm run app:start
npm run app:web
npm run app:ios
npm run app:android
npm run server:test:security
```

## 현재 주의점

`apps/app/public/web`에는 기존 웹 MVP와 네이버 지도 HTML이 보관되어 있습니다.
완전한 React Native Web 전환이 끝나면 사용자 웹 화면은 `apps/app` 코드가 담당하고, `public/web`은 지도 WebView 자산 위주로 줄여갑니다.
