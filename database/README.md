# database

출시용 DB 구조와 Supabase 설정 파일을 넣는 폴더입니다.

현재 포함된 것:

- `migrations/001_movemap_core.sql`: 센터·등록 신청·이벤트 테이블
- `migrations/002_private_storage.sql`: 3MB 제한 비공개 이미지 버킷
- `migrations/003_admin_login_rate_limit.sql`: 관리자 로그인 5회 실패 잠금 기록
- `seeds/test_centers.sql`: 테스트 환경 전용 샘플 센터

예상 테이블:

```text
centers
center_applications
events
admin_users
```
