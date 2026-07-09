# 무브맵 출시 및 업데이트 절차

## 1. 지금 상태

현재 무브맵은 로컬 MVP 상태다.

- 웹사이트: `http://localhost:8080/web/`
- 모바일 앱: Expo Go에서 테스트
- API 서버: `http://localhost:8090`
- 데이터 저장: 로컬 JSON 기반
- 지도: 네이버 지도 API
- 기능: 센터 조회, 지도 표시, 센터 상세, 센터 등록, 관리자 승인 흐름

이 상태는 테스트용이다. 실제 출시를 하려면 `localhost`, `192.168...` 같은 로컬 주소를 모두 실제 인터넷 주소로 바꿔야 한다.

## 2. 출시용 구조

추천 구조는 아래와 같다.

```text
GitHub
= 원본 코드 저장소

Vercel
= 웹사이트, 센터 등록 페이지, 관리자 페이지 배포

Supabase
= DB, 로그인, 사진 저장, 센터 데이터 저장

Expo / EAS
= iOS, Android 앱 빌드 및 업데이트

Naver Cloud
= 네이버 지도 API 운영 도메인 등록
```

폴더는 이렇게 정리하는 것이 좋다.

```text
movemap/
  web/
    사용자 웹사이트
    센터 검색 지도

  mobile/
    iOS / Android 앱

  admin/
    관리자 페이지
    센터 승인
    조회수 확인

  register/
    센터장 등록 페이지

  server/
    API 서버
    센터 등록/조회/승인
    이벤트 기록

  database/
    DB 구조
    초기 데이터
```

## 3. 로컬 MVP에서 출시 버전으로 가는 순서

### 1단계. 코드 정리

지금 만들어둔 로컬 파일들을 출시용 폴더 구조로 정리한다.

현재 로컬 주소:

```text
localhost:8080
localhost:8090
192.168.150.139
```

출시 후 주소 예시:

```text
https://movemap.kr
https://api.movemap.kr
https://admin.movemap.kr
https://register.movemap.kr
```

코드 안에 직접 주소를 박아두지 말고 환경변수로 바꾼다.

예:

```text
API_BASE_URL=https://api.movemap.kr
WEB_BASE_URL=https://movemap.kr
NAVER_MAP_CLIENT_ID=...
```

### 2단계. GitHub 저장소 만들기

GitHub는 서버가 아니라 원본 코드 보관소다.

역할:

- 코드 저장
- 수정 기록 관리
- 이전 버전 복구
- Codex가 수정한 코드 반영
- Vercel, Railway, Supabase, Expo 배포의 출발점

운영 서버에서 직접 코드를 고치는 방식은 피하는 게 좋다.  
항상 GitHub의 원본 코드를 수정하고, 테스트한 뒤 배포한다.

### 3단계. DB 만들기

로컬 JSON 데이터는 출시용으로 적합하지 않다.  
출시용 DB가 필요하다.

추천: Supabase

필요한 테이블:

```text
centers
- id
- name
- address
- lat
- lng
- description
- therapist_name
- license_file_url
- photo_url
- status
- rating
- created_at

center_applications
- id
- center_name
- owner_name
- phone
- address
- description
- license_file_url
- photo_url
- status
- created_at

events
- id
- center_id
- type
- source
- created_at

admin_users
- id
- email
- role
```

센터 등록 흐름:

```text
센터장 등록
→ center_applications에 저장
→ 관리자 확인
→ 승인
→ centers에 노출
→ 웹/앱 지도에 자동 표시
```

### 4단계. 사진 저장

센터 사진, 면허 인증 파일은 DB에 직접 넣지 않고 Storage에 저장한다.

추천:

- Supabase Storage
- Firebase Storage
- AWS S3

DB에는 파일 URL만 저장한다.

### 5단계. 웹사이트 배포

웹사이트는 Vercel에 배포하는 것이 편하다.

배포 대상:

```text
https://movemap.kr
https://movemap.kr/register
https://movemap.kr/admin
```

배포 흐름:

```text
GitHub에 코드 push
→ Vercel이 자동 감지
→ 웹사이트 자동 배포
```

### 6단계. API 서버 배포

API 서버는 아래 중 하나를 쓴다.

- Supabase Edge Functions
- Railway
- Render
- Fly.io
- AWS Lightsail

초기 MVP는 Supabase를 중심으로 가는 게 가장 쉽다.

서버가 담당하는 것:

- 센터 목록 제공
- 센터 등록 접수
- 관리자 승인
- 조회수/클릭 로그 기록
- 사진 URL 저장

### 7단계. 네이버 지도 API 설정

네이버 클라우드 콘솔에서 실제 서비스 환경을 등록해야 한다.

Web 서비스 URL:

```text
https://movemap.kr
https://admin.movemap.kr
https://register.movemap.kr
```

Android 패키지:

```text
com.movemap.app
```

iOS Bundle ID:

```text
com.movemap.app
```

로컬 테스트용 주소와 운영 주소를 모두 구분해서 관리한다.

### 8단계. 모바일 앱 출시

Expo Go는 테스트용이다. 실제 출시는 EAS Build를 사용한다.

필요한 계정:

- Apple Developer Program
- Google Play Console
- Expo 계정

빌드 결과:

```text
iOS: App Store용 빌드
Android: Play Store용 AAB 파일
```

출시 전 모바일 앱 안의 주소를 운영 주소로 바꾼다.

예:

```text
API_BASE_URL=https://api.movemap.kr
MOBILE_MAP_URL=https://movemap.kr/mobile-map.html
```

## 4. 출시 후 업데이트 방식

출시 후에는 서버에서 직접 코드를 고치지 않는다.

표준 흐름:

```text
1. Codex에게 수정 요청
2. 로컬 코드 수정
3. 로컬에서 테스트
4. GitHub에 변경사항 업로드
5. 자동 배포 또는 수동 배포
6. 운영 서비스 확인
```

## 5. 웹 업데이트

웹 수정 예:

- 버튼 문구 변경
- 센터 카드 디자인 변경
- 지도 UI 변경
- 등록 페이지 항목 추가
- 관리자 페이지 기능 추가

업데이트 흐름:

```text
Codex가 web/admin/register 코드 수정
→ 로컬에서 확인
→ GitHub push
→ Vercel 자동 배포
→ 실제 사이트 반영
```

웹은 보통 앱 심사가 없어서 빠르게 반영된다.

## 6. 서버/DB 업데이트

서버 수정 예:

- 승인 로직 변경
- 조회수 기록 추가
- 결제 기능 추가
- 센터장 계정 기능 추가
- 검색 필터 추가

업데이트 흐름:

```text
Codex가 server/database 코드 수정
→ 로컬 또는 테스트 DB에서 확인
→ GitHub push
→ 서버 배포
→ DB 마이그레이션 적용
→ 운영 확인
```

DB 구조 변경은 조심해야 한다.  
기존 운영 데이터가 있으므로 백업 후 진행하는 것이 좋다.

## 7. 모바일 앱 업데이트

모바일 업데이트는 두 종류가 있다.

### 빠른 업데이트

Expo Updates로 가능한 것:

- 화면 문구 변경
- UI 배치 변경
- 검색 로직 변경
- API 연결 주소 변경
- 센터 상세 카드 디자인 변경

앱스토어 심사 없이 비교적 빠르게 반영 가능하다.

### 앱스토어 재심사가 필요한 업데이트

새 빌드가 필요한 것:

- 카메라 권한 추가
- 위치 권한 정책 변경
- 네이티브 모듈 추가
- 앱 아이콘 변경
- 앱 이름 변경
- iOS/Android 설정 변경
- 결제/푸시 알림 같은 네이티브 기능 추가

이 경우:

```text
Codex가 mobile 코드 수정
→ EAS Build
→ TestFlight / 내부 테스트
→ App Store / Play Store 심사
→ 배포
```

## 8. Codex를 출시 후에도 사용하는 방법

출시 후에도 Codex는 계속 사용할 수 있다.

다만 방식은 지금과 조금 달라진다.

지금:

```text
로컬 파일 수정
→ 로컬 브라우저/Expo에서 바로 확인
```

출시 후:

```text
GitHub 원본 코드 수정
→ 로컬 또는 테스트 서버에서 확인
→ GitHub push
→ 배포
→ 운영 사이트/앱 확인
```

Codex에게 이렇게 요청하면 된다.

```text
센터 상세 카드 높이를 줄여줘.
웹/모바일 둘 다 반영해줘.
수정 후 로컬 테스트하고 배포 가능한 상태로 정리해줘.
```

또는:

```text
센터장 등록 페이지에 사업자등록증 업로드를 추가해줘.
관리자 승인 화면에도 파일 확인 버튼을 넣어줘.
DB 구조도 같이 수정해줘.
```

## 9. 안전한 운영 방식

운영 중에는 바로 실제 서비스에 적용하지 말고 단계별로 가는 게 좋다.

```text
local
→ staging
→ production
```

뜻:

```text
local: 내 컴퓨터 테스트
staging: 실제와 비슷한 테스트 서버
production: 실제 사용자 서비스
```

초기 MVP는 staging 없이 갈 수도 있지만, 센터와 사용자가 늘어나면 staging을 두는 게 좋다.

## 10. 현실적인 추천 MVP 출시 조합

처음 출시라면 아래 조합을 추천한다.

```text
GitHub
= 코드 저장

Vercel
= 웹사이트, 등록 페이지, 관리자 페이지

Supabase
= DB, 로그인, 사진 저장

Expo / EAS
= iOS, Android 앱

Naver Cloud
= 지도 API
```

이 조합은 비용이 낮고 관리가 쉽다.

## 11. 출시 전 체크리스트

- GitHub 저장소 생성
- 폴더 구조 정리
- 로컬 주소 제거
- 환경변수 적용
- Supabase DB 생성
- 사진 저장소 생성
- 관리자 로그인 추가
- 센터 등록/승인 실제 DB 연결
- 네이버 지도 운영 도메인 등록
- 웹 도메인 연결
- 모바일 운영 API 주소 적용
- iOS/Android 앱 아이콘 준비
- 개인정보처리방침 준비
- 이용약관 준비
- 위치정보 관련 고지 확인
- App Store / Play Store 개발자 계정 준비
- TestFlight / 내부 테스트 진행

## 12. 출시 후 운영 체크리스트

- 센터 등록 신청 확인
- 면허 인증 확인
- 승인/반려 처리
- 조회수/상담 클릭 확인
- 오류 로그 확인
- 지도 API 사용량 확인
- DB 백업
- 사용자 피드백 기록
- 다음 업데이트 계획 정리

## 13. 결론

지금 만든 로컬 MVP는 출시의 출발점이다.

바로 앱스토어에 올리는 형태는 아니지만, 아래 작업을 거치면 실제 서비스로 이어갈 수 있다.

```text
로컬 MVP
→ 코드 정리
→ GitHub 저장
→ Supabase DB 연결
→ Vercel 웹 배포
→ Expo 앱 빌드
→ 스토어 출시
→ GitHub/Codex 기반 지속 업데이트
```

출시 후에도 Codex를 사용할 수 있다.  
운영 서버를 직접 수정하는 것이 아니라, GitHub의 원본 코드를 수정하고 테스트한 뒤 배포하는 방식으로 계속 개발하면 된다.
