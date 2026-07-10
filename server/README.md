# server

로컬 MVP용 API 서버입니다.

현재 역할:

- 센터 목록 제공
- 센터 등록 데이터 저장
- 관리자 승인 흐름 테스트
- 이벤트 기록 테스트
- 접속기록 테스트
- `apps/admin`, `apps/register`, `apps/app/public/web` 정적 파일 제공

현재는 `server/data/db.example.json`을 샘플로 사용해 로컬 DB를 자동 생성합니다.
실제 로컬 데이터는 기본적으로 `server/data/db.local.json`에 저장되며 GitHub에 올리지 않습니다.

출시 단계에서는 Supabase 또는 별도 서버 DB로 옮기는 것을 추천합니다.
