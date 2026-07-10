# 네이버 지도 설정

웹 프로토타입은 네이버 지도 JavaScript SDK를 사용합니다.

## 현재 키 관리 방식

네이버 지도 JavaScript SDK의 `ncpKeyId`에는 `Client ID`를 넣습니다.
`Client Secret`은 브라우저 코드, 앱 번들, GitHub 저장소에 넣지 마세요.

로컬에서는 프로젝트 루트의 `.env` 파일에 아래처럼 넣습니다.

```text
NAVER_MAP_NCP_KEY_ID=내_네이버_지도_Client_ID
```

서버가 `/api/config`로 앱에 필요한 공개 설정만 내려줍니다.

## 네이버 콘솔에서 허용 URL

로컬에서 테스트하려면 네이버 Cloud Platform 콘솔의 `Web 서비스 URL`에 아래 주소를 추가하세요.

```text
http://localhost:8090
```

`file://`로 직접 열면 브라우저에서는 페이지가 보여도 네이버 지도 API의 도메인 검증에서 막힐 수 있습니다.

## 로컬 서버로 열기

프로젝트 루트에서 아래처럼 API 서버를 실행한 뒤 브라우저에서 `http://localhost:8090/web/`을 여세요.

```bash
npm run server:start
```

## 배포할 때

실제 도메인을 쓰게 되면 콘솔에 배포 도메인도 추가하세요.

```text
https://movemap.kr
```
