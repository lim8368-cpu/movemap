# 무브맵 진행 상황 정리

## 1. 프로젝트 한 줄 요약

무브맵은 물리치료사가 운영하는 운동센터를 지도에서 찾을 수 있는 서비스입니다.
웹, iOS, Android를 같이 출시하기 위해 Expo React Native + React Native Web 중심 구조로 정리했습니다.

## 2. 현재 저장소 위치

GitHub에 올릴 실제 원본 폴더:

```text
/Users/seokjoonlim/Documents/Codex/2026-07-05/durl/outputs/movemap-github-ready
```

이 폴더 밖의 기존 테스트 폴더는 GitHub에 올리지 않습니다.

## 3. 현재 폴더 구조

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
      앞으로 앱, 관리자, 등록 페이지, 서버가 같이 쓸 공통 코드

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

## 4. 현재 구현된 기능

### 사용자 앱

- Expo React Native 기반 앱
- iOS, Android, Web 공통 앱 구조
- 센터 검색
- 지역/목적 필터
- 센터 지도
- 네이버 지도 WebView 연결
- 센터 상세 카드
- 센터 사진 표시
- 추천 센터 목록
- 최고관리자 접속기록 확인 화면

### 센터장 등록 페이지

- 센터명 입력
- 지역/상세 주소 입력
- 네이버 지도 검색 링크 연결
- 센터 사진 입력
- 물리치료사 면허 인증 입력
- 등록 신청 제출

### 관리자 페이지

- 관리자 로그인
- 센터 등록 신청 확인
- 센터 승인
- 승인 후 지도/앱에 자동 노출
- 센터 좌표 수정
- 조회/상담 클릭 통계 확인
- 최고관리자 접속기록 확인

### 서버

- 센터 목록 API
- 센터 등록 신청 API
- 센터 승인 API
- 통계 API
- 접속기록 API
- 로그인/로그아웃 API
- 보안 헤더
- rate limiting
- 운영 모드 HTTPS 강제
- 권한 검사
- 감사 로그
- AES-256-GCM 암호화 유틸

## 5. 보안 설계

운영 기준 구조:

```text
iPhone 앱 / Android 앱 / Web
   │ HTTPS
   ▼
API 서버
   │
   ├─ 인증·권한 검사
   ├─ 요청 검증
   ├─ 접속기록 저장
   └─ 암호화·복호화
          │
          ▼
     암호화된 데이터베이스

사진·문서 → 비공개 파일 저장소
암호화 키 → 별도 비밀관리 서비스
```

보안 원칙:

- 앱은 운영 DB에 직접 접속하지 않습니다.
- 모든 개인정보 접근은 API 서버를 거칩니다.
- 환자 UUID만으로 조회하지 않고 organizationId, 역할, 담당 관계를 함께 확인합니다.
- 환자 이름, 연락처, 생년월일, 진단명, 치료 메모는 AES-256-GCM으로 암호화합니다.
- 파일은 공개 URL이 아니라 비공개 저장소와 signed URL을 사용합니다.
- 암호화 키와 DB 비밀번호는 GitHub, 앱 번들, `.env`에 넣지 않습니다.
- 접속기록은 최고관리자만 볼 수 있습니다.

## 6. 접속기록 기능

서버는 주요 API와 페이지 접속을 기록합니다.

기록 항목:

- 시간
- 사용자 ID
- 역할
- 접속 출처
- 요청 경로
- 응답 상태
- IP
- 기기/브라우저

출처 구분:

```text
web
mobile-app
mobile-map
admin
register
```

최고관리자 `super_admin`만 접속기록을 볼 수 있습니다.

## 7. GitHub 업로드 준비 상태

현재 Git 상태는 깨끗합니다.
최신 커밋:

```text
87baf1c Reorganize for Expo web native workspace
e36c40d Add mobile super admin access logs
fe5dcc6 Add super admin access logs
7208494 Document API-first secure architecture
8ab3bff Document GitHub upload structure
2917001 Add security baseline for patient data
3f95726 Add GitHub upload guide
80cb265 Initial Movemap MVP structure
```

보안 테스트:

```bash
node --check server/server.js
node --check server/security.js
node server/security.test.js
```

결과:

```text
Security tests passed
```

## 8. GitHub 업로드 방법

GitHub에서 새 저장소를 만든 뒤 아래 명령어를 실행합니다.

```bash
cd /Users/seokjoonlim/Documents/Codex/2026-07-05/durl/outputs/movemap-github-ready
git remote add origin https://github.com/내아이디/movemap.git
git branch -M main
git push -u origin main
```

GitHub 주소를 잘못 넣었다면:

```bash
git remote set-url origin https://github.com/내아이디/movemap.git
git push -u origin main
```

## 9. 앞으로 해야 할 일

### 출시 전 필수

- 운영 도메인 결정
- API 서버 운영 배포
- 운영 DB 연결
- 개발/테스트/운영 DB 분리
- 비밀관리 서비스 연결
- 파일 비공개 저장소 연결
- 환자정보 암호화 저장 구현
- iOS 토큰 Keychain 저장
- 권한 우회 테스트
- ID 조작 테스트
- 로그 개인정보 노출 테스트
- 네이버 지도 운영 도메인 등록

### 제품 기능

- 센터장 계정
- 결제/유료 노출 플랜
- 환자 관리 기능
- 예약/상담 기능
- 후기 기능
- 센터별 관리자 대시보드

## 10. 앞으로 Codex 작업 규칙

사용자 앱 기능은 `apps/app`에서 수정합니다.

관리자 기능은 `apps/admin`에서 수정합니다.

센터장 등록 기능은 `apps/register`에서 수정합니다.

서버 API, 보안, 권한, 접속기록은 `server`에서 수정합니다.

공통 타입, API 함수, 필터 로직은 `packages/shared`로 옮겨갑니다.

기능 수정 시 항상 iOS, Android, Web을 같이 고려합니다.
