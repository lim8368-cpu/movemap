# GitHub 업로드 안내

이 폴더가 GitHub에 올릴 실제 무브맵 원본입니다.

```text
outputs/movemap-github-ready/
```

GitHub에는 이 폴더 안의 내용만 올리면 됩니다.

## 올리지 말아야 하는 테스트 폴더

아래 폴더들은 이 폴더 밖에 있는 로컬 테스트용입니다.

```text
outputs/web-browser/
outputs/mobile-ios-android/
outputs/backend-server/
outputs/admin-dashboard/
outputs/center-registration/
outputs/movemap-mobile/
```

위 폴더들은 GitHub에 직접 올리지 마세요.

## 업로드 순서

GitHub에서 새 저장소를 만든 뒤:

```bash
cd outputs/movemap-github-ready
git remote add origin <GitHub 저장소 주소>
git push -u origin main
```

## 앞으로 수정 기준

앞으로 Codex와 작업할 때는 이 폴더 안에서 수정합니다.

```text
web/
mobile/
admin/
register/
server/
shared/
database/
docs/
```

