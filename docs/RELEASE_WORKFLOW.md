# 출시와 업데이트 작업 순서

이 문서는 실제로 기능을 수정하고 GitHub를 통해 운영까지 반영하는 순서입니다.

## 1. 기능 작업 시작

항상 `feature/*` 브랜치에서 시작합니다.

```bash
git switch develop
git pull
git switch -c feature/center-search
```

Codex에게 작업을 맡길 때도 이렇게 말합니다.

```text
feature/center-search 브랜치에서 작업해줘.
웹, iOS, Android 공통 앱 기준으로 수정하고,
운영 DB나 운영 API에는 연결하지 마.
```

## 2. 로컬 확인

```bash
npm run server:test:security
npm run app:web
npm run app:ios
npm run app:android
```

로컬에서는 `.env.development`를 사용합니다.
이 파일은 GitHub에 올리지 않습니다.

## 3. GitHub에 올리기

```bash
git add .
git commit -m "Add center search"
git push origin feature/center-search
```

GitHub Desktop을 사용할 경우:

```text
1. 변경사항 확인
2. Commit summary 입력
3. Commit to feature/center-search
4. Push origin
```

## 4. Preview URL 확인

GitHub에 feature 브랜치를 올리면 배포 서비스가 preview URL을 만듭니다.

확인할 것:

- 화면이 깨지지 않는지
- preview URL이 운영 API를 호출하지 않는지
- 테스트 API와 테스트 DB만 사용하는지
- 로그인 없는 테스트 페이지가 외부에 노출되지 않는지
- 실제 개인정보가 들어가 있지 않은지

## 5. develop 병합

Preview에서 괜찮으면 Pull Request를 만들어 `develop`으로 병합합니다.

```text
feature/center-search
  → Pull Request
develop
```

`develop`은 staging 환경에 연결됩니다.

## 6. staging 확인

staging에서 확인합니다.

```text
staging web
staging API
staging DB
staging iOS 앱
staging Android 앱
```

여기서도 실제 개인정보는 사용하지 않습니다.

## 7. main 병합

최종 확인 후에만 `main`으로 병합합니다.

```text
develop
  → Pull Request
main
```

`main`은 운영 환경에 연결됩니다.

## 8. 운영 반영

웹과 서버:

```text
main에 병합
  → 운영 웹 자동 배포
  → 운영 API 서버 자동 배포
```

모바일 앱:

```text
main 기준 production 빌드
  → TestFlight / Google Play 내부 테스트
  → App Store / Google Play 제출
  → 심사 후 배포
```

## 9. 긴급 수정

운영 장애가 나면 `main`에서 hotfix 브랜치를 만듭니다.

```bash
git switch main
git pull
git switch -c hotfix/login-error
```

수정 후:

```text
hotfix/login-error
  → main
  → develop에도 다시 병합
```

운영 문제를 고친 내용이 테스트 브랜치에도 남아야 다음 개발 때 사라지지 않습니다.
