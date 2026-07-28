# DAIL 공통 앱

물리치료사 면허 보유자가 운영하는 운동센터 정보를 지도에서 찾는 Expo React Native + React Native Web 공통 앱입니다.

이 앱은 iOS, Android, Web을 같은 코드 흐름으로 관리하는 중심 앱입니다.

## 실행 방법

```bash
npm install
npm run start
```

iOS:

```bash
npm run ios
```

Xcode 네이티브 프로젝트를 생성하거나 실행할 때:

```bash
npm run ios:prebuild
npm run ios:native
```

USB로 연결한 실제 iPhone에 설치할 때:

```bash
npm run ios:device
```

실제 iPhone용 Debug 빌드는 `ios/.xcode.env.updates`에서 JavaScript 번들을
앱 내부에 포함하므로 Metro 연결이 잠시 끊겨도 시작 화면을 열 수 있습니다.

Android:

```bash
npm run android
```

Web:

```bash
npm run web
```

## 지금 들어간 화면

- 지역/증상/검색 필터
- 지도형 센터 핀
- Expo Go용 네이버 지도 WebView
- 센터 상세 정보
- 추천 센터 목록
- 최고관리자 접속기록 확인
- 상담 요청 버튼

## 참고

네이버 지도 WebView용 HTML은 `public/web/mobile-map.html`에 보관합니다.
API 서버를 실행하면 아래 주소로 접근할 수 있습니다.

```text
http://localhost:8090/web/mobile-map.html
```

Expo Go에서 네이버 지도를 보려면 네이버 Cloud Platform 콘솔의 `Web 서비스 URL`에 맥북 개발 서버 주소를 추가해야 합니다.

```text
http://내컴퓨터IP:8090
```

앱 실행 시 같은 주소를 공개 환경변수로 지정합니다.

```bash
EXPO_PUBLIC_API_BASE_URL=http://내컴퓨터IP:8090 npm run app:start
```

## 다음 구현 후보

- 실제 지도 SDK 연결: 네이버 지도, 카카오 지도, Google Maps 중 선택
- 센터장 회원가입/센터 등록
- 물리치료사 면허 확인 프로세스
- 상담 예약/문의 채팅
- 후기, 즐겨찾기, 위치 기반 추천
- 센터장용 홍보 대시보드
