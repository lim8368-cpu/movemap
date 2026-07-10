# Vercel Hobby 첫 배포 가이드

이 설정은 무브맵을 Vercel Hobby에서 먼저 테스트하기 위한 최소 배포 구성입니다.

## 현재 배포 방식

```text
Vercel
  ├─ 정적 웹: apps/app/public/web → dist
  └─ 서버리스 API
      ├─ /api/config
      ├─ /api/centers
      └─ /api/events
```

현재 Vercel API는 샘플 센터 데이터만 반환합니다.
실제 센터 등록, 관리자 승인, DB 저장은 아직 운영 API 서버와 DB를 따로 붙여야 합니다.

## Vercel import 화면 설정

Root Directory는 아래처럼 선택합니다.

```text
movemap (root)
```

Framework Preset은 자동 감지 또는 Other로 둡니다.

Build 설정은 `vercel.json`이 처리합니다.

```text
Build Command: npm run vercel:build
Output Directory: dist
```

## 환경변수

Vercel Project Settings → Environment Variables에 추가합니다.

```text
NAVER_MAP_NCP_KEY_ID=네이버지도_Client_ID
APP_ENV=production
NODE_ENV=production
```

네이버 지도 Client Secret은 넣지 않습니다.

## 네이버 지도 콘솔

Vercel 배포 후 생성된 주소를 네이버 Cloud Platform Maps의 Web 서비스 URL에 등록합니다.

```text
https://프로젝트명.vercel.app
```

Preview URL도 네이버 지도 테스트에 쓰려면 별도로 등록해야 합니다.

## 한계

이 배포는 첫 웹 테스트용입니다.

아직 포함하지 않는 것:

- 운영 DB
- 센터장 등록 저장
- 관리자 로그인/승인
- 환자 개인정보 저장
- 파일 업로드

다음 단계에서 API 서버와 DB를 staging/production으로 분리해 연결합니다.
