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
- `database/SECURITY_SCHEMA.md`

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

처음 실행할 때는 `.env.example`을 참고해서 `.env`를 만들고 로컬 관리자 비밀번호를 넣습니다.

```text
LOCAL_ADMIN_PASSWORD=내가_정한_로컬_비밀번호
```

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

### 4. 보안 단위 테스트

```bash
node server/security.test.js
```

## GitHub에 올릴 때 주의할 점

GitHub에 올리면 안 되는 것:

- `node_modules`
- `.expo`
- `.env`
- 인증서, 서비스 계정 키, API 비밀키
- 실제 환자정보, 면허증 이미지, 치료 기록
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
