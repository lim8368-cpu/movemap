# 무브맵 Movemap

물리치료사가 운영하는 운동센터를 지도에서 찾을 수 있는 웹/모바일 MVP 프로젝트입니다.

## 현재 상태

이 저장소는 로컬에서 만든 MVP를 GitHub에 올릴 수 있도록 정리한 버전입니다.

현재 포함된 기능:

- 사용자 웹사이트
- iOS/Android Expo 앱
- 센터장 등록 페이지
- 관리자 페이지
- 로컬 API 서버
- 센터 승인/노출 테스트 데이터
- 출시 및 업데이트 가이드 문서

## 폴더 구조

```text
movemap-github-ready/
  web/
    사용자 웹사이트
    네이버 지도
    모바일 지도 WebView HTML

  mobile/
    Expo 기반 iOS/Android 앱

  admin/
    관리자 페이지
    센터 승인/관리 화면

  register/
    센터장 등록 페이지

  server/
    로컬 API 서버
    테스트 DB JSON

  shared/
    앞으로 웹/모바일/서버가 같이 쓸 공통 설정을 넣을 곳

  database/
    앞으로 Supabase DB 구조와 마이그레이션을 넣을 곳

  docs/
    출시 가이드
    초보자용 설명
    Notion 정리 문서
```

## 로컬 실행 방법

### 1. API 서버 실행

```bash
node server/server.js
```

기본 주소:

```text
http://localhost:8090
```

### 2. 웹사이트 실행

이 폴더에서 정적 서버를 실행합니다.

```bash
python3 -m http.server 8080
```

접속 주소:

```text
http://localhost:8080/web/
```

### 3. 모바일 앱 실행

```bash
cd mobile
npm install
npx expo start --lan
```

Expo Go에서 표시되는 QR 또는 `exp://...` 주소로 접속합니다.

## GitHub에 올릴 때 주의할 점

GitHub에 올리면 안 되는 것:

- `node_modules`
- `.expo`
- `.env`
- `.DS_Store`

이 파일들은 `.gitignore`에 등록해두었습니다.

## 출시 준비 다음 단계

1. 로컬 주소를 환경변수로 변경
2. Supabase 프로젝트 생성
3. 센터 데이터 저장을 JSON에서 Supabase로 변경
4. Vercel에 웹/등록/관리자 페이지 배포
5. Expo EAS로 iOS/Android 빌드
6. 네이버 클라우드에 운영 도메인 등록

자세한 내용은 `docs/` 폴더의 가이드를 참고하세요.

## 앞으로 작업 규칙

앞으로 수정할 때는 웹과 모바일을 같이 고려합니다.

예:

```text
센터 상세 카드 디자인 변경
→ web 수정
→ mobile 수정
→ 로컬 웹 테스트
→ Expo 테스트
→ GitHub 업로드
```

