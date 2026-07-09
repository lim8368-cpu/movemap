# Movemap Security Architecture

이 문서는 환자 개인정보와 건강정보를 다루는 운영 버전을 만들 때 지켜야 할 기준입니다.
현재 저장소의 로컬 MVP는 실제 환자정보 저장용이 아닙니다.

## 핵심 구조

```text
iOS / Android / Web
  -> HTTPS
  -> Authenticated API Server
  -> Authorization + Object-level Access Check
  -> Application-level Encryption
  -> Production Database / Private File Storage
```

앱은 운영 데이터베이스에 직접 접속하지 않습니다. 모든 개인정보 접근은 API 서버를 거칩니다.

## 역할

- `admin`: 조직 관리, 권한 관리, 환자 데이터 관리
- `therapist`: 본인이 담당하는 환자 조회 및 치료 메모 작성
- `front_desk`: 접수와 예약에 필요한 최소 환자정보만 접근
- `read_only`: 허용된 범위의 조회만 가능

서버는 인증과 권한을 분리해서 검사합니다.

## 환자 접근 규칙

환자 데이터 접근은 환자 UUID만으로 허용하지 않습니다.
서버는 항상 다음 값을 함께 확인해야 합니다.

- 현재 사용자 ID
- 현재 사용자의 `organizationId`
- 현재 사용자의 역할
- 현재 사용자와 환자의 담당 관계
- 요청한 작업의 권한

다른 환자의 UUID를 URL에 넣어도 조회, 수정, 삭제가 되면 안 됩니다.

## 암호화 대상

다음 필드는 애플리케이션 수준에서 AES-256-GCM으로 암호화합니다.

- 환자 이름
- 연락처
- 생년월일
- 진단명
- 치료 메모

암호화 키는 `.env`, 앱 번들, Git 저장소에 넣지 않습니다.
AWS Secrets Manager, GCP Secret Manager, Naver Cloud Secret Manager 같은 클라우드 비밀관리 서비스에 저장합니다.

## 파일 저장

환자 파일과 사진은 공개 URL로 저장하지 않습니다.

- 비공개 버킷 사용
- 짧은 유효기간의 signed URL 발급
- 확장자, MIME type, 파일 크기 검증
- 무작위 파일명 사용
- 환자/계정 삭제 시 관련 파일 함께 삭제

## 로컬 MVP 제한

현재 `server/data/db.json`은 로컬 테스트용입니다.
운영에서는 실제 환자정보, 면허증 이미지, 연락처, 건강정보를 이 파일에 저장하면 안 됩니다.

운영 전환 시 필수 변경:

1. 운영 DB로 이전
2. 비밀관리 서비스 연결
3. HTTPS 배포
4. 인증 공급자 또는 Argon2id/bcrypt 기반 비밀번호 저장
5. 파일 비공개 저장소 연결
6. 권한 우회 및 ID 조작 테스트 통과
