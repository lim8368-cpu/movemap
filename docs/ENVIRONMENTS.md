# 무브맵 환경 분리

| 환경 | 용도 | Vercel 범위 | 데이터 원칙 |
|---|---|---|---|
| development | 개인 컴퓨터 개발 | Local | 샘플 데이터만 사용 |
| test | 기능 확인과 Preview 배포 | Preview | 테스트 센터·가짜 개인정보만 사용 |
| production | 실제 서비스 | Production | 운영 프로젝트만 연결 |

`VERCEL_ENV`가 `production`이면 앱은 production, `preview`이면 test로 판단합니다.
Supabase URL과 service-role key는 Vercel의 Production과 Preview에 각각 별도 항목으로 저장합니다.
한 Supabase 프로젝트의 키를 두 환경에 중복 입력하지 않습니다.

필수 환경변수:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=movemap-private
NAVER_MAP_NCP_KEY_ID
ADMIN_PASSWORD_SCRYPT
ADMIN_SESSION_SECRET
```

Expo 앱 공개 설정:

```text
# 로컬 테스트
EXPO_PUBLIC_API_BASE_URL=http://내컴퓨터IP:8090

# 운영 빌드
EXPO_PUBLIC_API_BASE_URL=https://movemap.vercel.app
```

`EXPO_PUBLIC_` 값은 앱 사용자에게 보일 수 있으므로 비밀번호나 service-role key를 넣으면 안 됩니다.

각 Supabase 프로젝트에는 `001`, `002`, `003` 마이그레이션을 순서대로 적용합니다.

## 비공개 파일 저장소

Supabase SQL Editor에서 환경별로 아래 마이그레이션을 실행합니다.

```text
database/migrations/002_private_storage.sql
```

버킷은 public이 아니며, 브라우저에는 저장 경로만 전달됩니다. 이미지를 볼 때 서버가 짧게 만료되는 signed URL을 발급합니다.

## 관리자 인증

관리자 비밀번호 원문은 저장하지 않습니다.

```bash
npm run admin:credentials
```

출력된 두 값을 Vercel 환경변수에 저장합니다. 로그인 후 세션은 `HttpOnly`, `Secure`, `SameSite=Strict` 쿠키로 15분 동안만 유지됩니다. 같은 접속지에서 15분 안에 비밀번호를 5회 틀리면 15분간 로그인을 잠급니다.
