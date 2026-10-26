# 길주초 6학년, 여행중!

6학년 수학여행을 위한 교사·학생 웹 앱입니다. 일정, 미션 사진 제출, 사진과 시간이 담긴 소집 알림을 제공합니다.

## 구성

- 화면: React, TypeScript, Vite. 일정 / 미션 / 모여라! 3개 탭. 전체 Jua 글꼴.
- 서버: Firebase Hosting → 서울 리전 Cloud Functions 2세대 API → Cloud Firestore.
- 인증: 반 참여 코드, 교사용 비밀번호, HttpOnly `__session` 쿠키. 비밀번호는 PBKDF2로 보호합니다. Firebase Hosting의 쿠키 전달 제약을 반영했습니다.
- 사진: 브라우저에서 JPEG로 축소한 뒤 최대 600KB로 전송합니다. Firestore의 비공개 사진 문서에 바이너리로 보관하며 API가 접근 권한을 검사합니다. 학생 미션 사진은 해당 학생 세션과 교사만 열 수 있습니다.
- 소집: 안내를 먼저 Firestore에 저장한 뒤 Web Push를 보냅니다. 푸시 수신을 허용하지 않아도 모여라! 탭에서 안내를 확인할 수 있습니다.
- Firestore 직접 접근은 규칙으로 차단합니다. 서버의 기본 서비스 계정이 Admin SDK로 접근하며 서비스 계정 키를 배포 파일에 넣지 않습니다.

## 로컬 실행

Node.js 22, npm, Firebase CLI, Java 21 이상이 필요합니다.

```sh
npm ci
npm --prefix functions ci
npm run build
npm run emulators
```

다른 터미널에서 `npm run dev`를 실행하면 http://127.0.0.1:5173 에서 수정할 수 있습니다. 개발 서버의 API 요청은 Firebase 에뮬레이터로 연결됩니다. 에뮬레이터는 `demo-gilju-trip` 전용이며 실제 배포 데이터와 분리됩니다.

## 검증

에뮬레이터를 실행한 상태에서:

```sh
npm run test:local
```

일정·소집 장소 저장, 미션 자동 목록, 사진 제출/교체/삭제, 학생·교사 접근 권한, 다른 반·다른 학생 격리, 알림 저장·개별 조회·확인 표시와 과거 사진 보존을 검사합니다. 테스트는 로컬 주소에서만 실행됩니다.

## Firebase 배포

프로젝트: `gilju-grade6-trip-2026`

```sh
firebase login
npm run deploy
```

Cloud Functions를 배포하려면 해당 프로젝트에 Blaze(사용량 과금) 요금제와 결제 계정이 연결되어 있어야 합니다. 서버는 최소 인스턴스 0, 최대 인스턴스 3으로 설정했습니다. 사용량 요금은 Firebase 콘솔에서 확인하세요.

배포 후 예정 주소: https://gilju-grade6-trip-2026.web.app

Firebase 콘솔: https://console.firebase.google.com/project/gilju-grade6-trip-2026/overview

실제 배포 완료 여부는 Firebase Hosting의 배포 기록에서 확인하세요.

## 휴대폰 알림

학생은 실제 반에 참여한 뒤 앱의 알림 받기를 켭니다. HTTPS와 브라우저 알림 권한이 필요합니다. iPhone/iPad는 홈 화면에 추가한 웹 앱에서 알림을 허용해야 합니다. 기기의 절전·네트워크·브라우저 설정에 따라 표시 시점이 달라질 수 있습니다. 교사 화면은 푸시 서비스의 접수 건수를 표시하며 실제 학생이 읽은 수는 확인 버튼으로 집계합니다.

학생의 진행 상황과 사진은 기기 세션에 연결됩니다. 로그아웃하거나 브라우저 데이터를 지우면 같은 학생으로 자동 복구되지 않습니다. 반 코드와 교사용 비밀번호는 교사가 별도로 보관해 주세요.

환경 파일·키·로컬 업로드 사진·에뮬레이터 데이터·빌드 결과는 GitHub에 포함하지 않습니다.
