# 환경 분리 기준

| APP_ENV | 코드 위치 | 웹/API | 데이터 | 모바일 앱 |
|---|---|---|---|---|
| `development` | 개발자 PC | localhost | 로컬 JSON 또는 개발 Supabase | 무브맵 Dev |
| `staging` | `develop`, `feature/*` | 비밀번호 보호 Preview | 테스트 Supabase, 가짜 데이터만 | 무브맵 Test |
| `production` | `main` | 실제 서비스 | 운영 Supabase | 무브맵 |

실제 환경 파일은 커밋하지 않는다. 저장소에는 `.env.development.example`,
`.env.staging.example`, `.env.production.example`만 둔다. `EXPO_PUBLIC_*` 값은 앱에서
볼 수 있으므로 비밀번호, service-role key, DB URL을 넣지 않는다.

## 서버의 교차 연결 차단

서버 시작 시 다음 조건을 검사하고 하나라도 틀리면 즉시 종료한다.

- staging/production에서는 `APP_ENV`와 `DATA_ENVIRONMENT`가 같아야 한다.
- `SUPABASE_URL`의 project ref가 `EXPECTED_SUPABASE_PROJECT_REF`와 같아야 한다.
- production은 Supabase 설정 없이 시작할 수 없다.
- Supabase URL과 service-role key는 반드시 함께 설정해야 한다.

따라서 staging의 `.env.staging`에는 테스트 Supabase ref만, production의
`.env.production`에는 운영 Supabase ref만 기록한다. 두 서버에서 같은 env 파일이나
service-role key를 복사해 쓰지 않는다.

## 비밀정보 저장 위치

| 값 | 저장 위치 |
|---|---|
| 로컬 개발 값 | 개발자 PC의 `.env.development` |
| staging 값 | staging VPS `/opt/movemap-secrets/.env.staging` |
| production 값 | production VPS `/opt/movemap/.env.production` |
| CI 접속 키 | GitHub Environment secrets |
| EAS 빌드 값 | Expo EAS environment secrets |

각 파일은 `chmod 600`으로 제한한다. staging과 production은 서로 다른 관리자 세션
비밀값, 관리자 암호 해시, Supabase key를 사용한다.

## 모바일 식별자

`apps/app/app.config.js`와 `apps/app/eas.json`이 다음처럼 분리한다.

| 프로필 | 표시 이름 | iOS bundle ID | Android applicationId |
|---|---|---|---|
| development | 무브맵 Dev | `com.movemap.app.dev` | `com.movemap.app.dev` |
| staging | 무브맵 Test | `com.movemap.app.staging` | `com.movemap.app.staging` |
| production | 무브맵 | `com.movemap.app` | `com.movemap.app` |

staging/production의 `EXPO_PUBLIC_API_BASE_URL`은 EAS 환경별 변수로 등록한다.
