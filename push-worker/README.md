# 무료 Web Push 발송 서버

앱은 Firebase Hosting에 그대로 두고 이 Worker만 Cloudflare Workers Free에 배포합니다. Workers Paid, R2, D1, KV, Cloud Functions, 결제 계정은 사용하지 않습니다. 발송 서버가 외부 사이트로 임의 요청을 보내지 않도록 Chrome/Firefox/Edge/Safari의 실제 푸시 서비스만 허용합니다.

## 처음 연결

1. 이메일 인증을 완료한 Cloudflare 무료 계정을 사용합니다.
2. 이 폴더에서 `npm ci` 후 `wrangler.jsonc`의 `account_id`, Firebase 프로젝트 ID, 앱 주소를 확인합니다.
3. `node scripts/generate-keys.mjs`로 키를 만듭니다. 개인키는 상위 앱의 무시된 `work/push-keys.json`에만 보관됩니다. 기존 키가 있으면 재사용합니다. 키를 바꾸면 학생들이 알림을 다시 켜야 합니다.
4. 원하는 로컬 설정 폴더를 `XDG_CONFIG_HOME` 환경 변수에 지정하고 로그인합니다. `npx wrangler login --config wrangler.jsonc --device --scopes account:read user:read workers_scripts:write`
5. `npm run deploy`로 검증·번들 생성 후 Cloudflare 공식 API에 배포합니다. 개인키는 `secret_text` 바인딩으로 저장합니다. 배포 도구의 esbuild가 Windows 폴더 접근 제한에 걸리는 환경에서도 독립 번들을 업로드할 수 있도록 API 배포 스크립트를 제공합니다. Cloudflare 계정의 요금제·결제 설정을 수정하는 API는 호출하지 않습니다.
6. `lib/push-config.json`에 실제 서버 URL과 공개키가 기록됐는지 확인하고 앱 폴더에서 `npm run deploy`로 Firestore 규칙과 Hosting을 배포합니다.

로그인 토큰과 개인키를 터미널에 출력하거나 GitHub에 넣지 마세요. 배포 스크립트는 `CLOUDFLARE_API_TOKEN`이 있으면 이를 사용하고, 없으면 지정한 `XDG_CONFIG_HOME`의 Wrangler 로그인 설정을 읽습니다. 로그인 만료 시 다시 로그인합니다.

## 발송 흐름과 제한

- 학생이 직접 허용한 브라우저 구독을 자신의 Firebase 익명 UID 문서에 저장합니다.
- 교사가 안내를 Firestore에 먼저 저장한 다음 ID 토큰과 반 코드·안내 ID만 서버에 보냅니다.
- Worker는 Firebase 공개 서명키로 토큰을 검증하고 반 소유자를 검사한 후 저장된 안내와 구독만 사용합니다. 학생·다른 반 교사·임의 내용을 전달하는 호출은 발송할 수 없습니다.
- 다섯 구독씩 처리하고 발송 기록을 조건부 쓰기로 잠급니다. 이미 수락된 발송은 재시도 시 제외하고, 만료된 구독은 정리합니다. 10분이 지난 안내는 새 안내로 보내야 합니다.
- 구독자는 발송 시점에도 반 참여자여야 합니다. 로그아웃 시 구독을 삭제하고 브라우저 구독도 취소합니다.
- 잠금 화면에는 장소·시간·글을 표시합니다. 보호된 장소 사진은 알림을 누른 뒤 로그인된 앱에서 읽습니다.
- 푸시 서비스의 수락은 기기 도착·확인을 보장하지 않습니다. 실제 확인은 별도의 학생 확인 표시를 사용합니다.

Workers Free는 일 100,000 요청과 요청당 CPU 10ms 제한이 적용됩니다. Firebase에도 무료 읽기·쓰기·저장 한도가 적용됩니다. 한도 초과 시 기능이 제한될 수 있으며 이 구성은 요금제를 자동 업그레이드하지 않습니다.

## 검사

`npm run check`는 TypeScript, 인증·권한·수신자·중복·만료 테스트, 실제 WebCrypto 암호화/VAPID 서명 검증과 독립 번들 생성을 실행합니다. 앱의 `scripts/test-push-sw.mjs`는 백그라운드 알림과 알림 클릭 경로를 검사합니다. `scripts/test-free.mjs`는 에뮬레이터에서 구독·발송 기록의 Firestore 권한도 검사합니다.
