# DAIL 소셜 회원가입 설정

## 구현 범위

- 일반 사용자 계정은 Supabase Auth와 `public.user_profiles`를 사용한다.
- 관리자 로그인과 센터장 로그인은 기존 별도 인증 체계를 유지한다.
- 카카오와 Apple은 Supabase OAuth provider를 사용한다.
- 네이버는 DAIL 서버가 OAuth 응답을 검증한 뒤 Supabase 세션으로 교환한다.
- 운영과 테스트 Supabase 프로젝트에는 각각 별도의 앱·키·콜백 URL을 등록한다.

## 필수 환경변수

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
KAKAO_AUTH_ENABLED=false
APPLE_AUTH_ENABLED=false
NAVER_LOGIN_CLIENT_ID=
NAVER_LOGIN_CLIENT_SECRET=
USER_AUTH_STATE_SECRET=
```

`SUPABASE_ANON_KEY`는 브라우저가 Supabase Auth를 호출할 때 사용하는 공개 키다. `SUPABASE_SERVICE_ROLE_KEY`, 네이버 Client Secret, `USER_AUTH_STATE_SECRET`은 절대 브라우저나 GitHub에 노출하지 않는다.

## 테스트 환경 콜백 주소

- Supabase Site URL: 테스트 웹사이트 주소
- Supabase Redirect URL: `https://<테스트주소>/auth/callback/`
- 네이버 Callback URL: `https://<테스트주소>/api/auth/naver/callback`
- 카카오 Redirect URI: `https://<TEST_PROJECT_REF>.supabase.co/auth/v1/callback`
- Apple Return URL: `https://<TEST_PROJECT_REF>.supabase.co/auth/v1/callback`

운영 환경에서는 위 주소를 운영 도메인과 운영 Supabase 프로젝트 ref로 각각 다시 등록한다.

## 적용 순서

1. 테스트 Supabase 프로젝트에 `006_user_social_auth.sql`을 실행한다.
2. Supabase Authentication의 URL Configuration에 테스트 주소를 등록한다.
3. 카카오 Developers에서 테스트 앱을 만들고 Supabase Kakao provider에 REST API 키와 Client Secret을 입력한다.
4. 네이버 Developers에서 테스트 앱을 만들고 DAIL 서버 환경변수에 Client ID와 Client Secret을 저장한다.
5. Apple Developer에서 Services ID와 키를 만든 뒤 Supabase Apple provider를 설정한다.
6. 각 로그인을 최초 가입, 재로그인, 로그아웃, 탈퇴 순서로 확인한다.
7. 검증 후 운영용 앱과 키를 별도로 만들어 운영 환경에 적용한다.

Apple 웹 OAuth Client Secret은 만료 전에 교체해야 한다. 테스트 키와 운영 키를 공유하지 않는다.
