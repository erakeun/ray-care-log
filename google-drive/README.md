# Google Drive 개인 저장 우선안 · 로컬 초안

2~3주에 한 번 사용하는 목적에는 1주 미사용 중단이 있는 Supabase Free보다 개인 Google Drive 저장이 적합하다고 판단했습니다. Supabase 초안은 `server/`, `cloud.mjs`, `cloud-config.mjs`에 별도로 보존하며 활성화하지 않습니다.

## 최소 구성

- 기존 개인 Google 계정 + 사이트 전용 OAuth 웹 클라이언트.
- 범위는 `https://www.googleapis.com/auth/drive.file` 한 가지. 전체 Drive/Gmail/연락처/학교 시스템 권한이나 서비스 계정은 요청하지 않습니다.
- 사용자의 My Drive에 **‘아베오 케어 기록’** 비공개 앱 폴더와 매 저장의 JSON 스냅샷 파일을 생성합니다. 수동 다운로드/업로드 대신 사이트의 ‘저장’이 이 파일을 관리합니다.
- `drive.appdata` 숨김 폴더는 다른 범위가 필요하므로 사용하지 않습니다. Sheets도 생성하지 않습니다. 공유 Sheet의 셀/문서를 덮어쓰지 않고, 생성 ID를 미리 확보할 수 있는 일반 JSON 파일을 사용합니다.
- 현재 계정은 Drive `about.user`에서 확인하며 개인 Gmail 계정만 허용합니다. 학교·조직 계정은 연결하지 않습니다.
- 소유자가 본인이 아니거나 공유 상태인 폴더/버전 파일은 읽기·쓰기 대상으로 삼지 않습니다. 앱이 권한·공유 설정을 생성/변경하는 API는 없습니다.
- 토큰은 메모리에만 유지하고 Google 비밀번호·client secret·refresh token은 앱에 보관하지 않습니다. 새로고침/만료 후 사용자가 Google 연결을 다시 수행합니다. 로그아웃은 앱 메모리 세션을 지우며 OAuth 허용 자체를 철회하지는 않습니다.

## 원본 보존과 동시 수정

최초 연결은 조회만 합니다. 기존 브라우저 원본은 그대로 보존하고 계정·차량·기록 수를 미리 보여 준 뒤 확인된 최초 이관만 수행합니다. 서버 기록은 로컬 원본 키에 덮어쓰지 않습니다.

매 저장은 **새 파일 생성**입니다. 업데이트/삭제/휴지통 API를 호출하지 않으며 이전 파일은 그대로 남습니다. 파일 내부에 부모 버전 ID와 mutation ID를 저장합니다. 최신 버전이 하나면 해당 내용을 읽고, 둘 이상이면 자동으로 하나를 고르거나 덮어쓰지 않습니다.

Google Drive/Sheets에서 원자적 ‘현재 버전 비교 후 조건부 저장’은 이 구현이 보장하지 않습니다. 사전 확인을 통과한 두 기기가 동시에 저장하면 두 갈래가 생길 수 있습니다. 이 경우 **양쪽 파일을 모두 보존**하고 ‘동시 수정 기록 확인’에서 한 내용을 기준으로 선택·확인한 새 버전을 추가합니다. 선택하지 않은 내용도 이전 파일로 남으며 자동 병합하지 않습니다. 저장 직후 또는 다음 조회에서 충돌을 확인할 수 있으므로 실시간 단일 기준의 강한 일관성을 약속하지 않습니다.

재시도는 Google Drive가 미리 생성한 같은 파일 ID를 사용합니다. 업로드 결과가 불확실해도 다른 새 ID로 중복 저장하지 않습니다. 성공 후 재시도의 409 응답은 해당 파일의 계정·위치·내용을 확인합니다. 새로고침 전에 미확인 요청이 있으면 ‘미확인 저장 재시도’를 사용할 수 있습니다. 저장 실패 때 폼과 입력은 유지하고 기존 확정 화면/로컬 원본을 바꾸지 않습니다.

최근 50개 이력을 표시하고 복구는 새 자식 버전으로 저장합니다. 파일 자동 삭제는 없습니다. 목록 500개를 넘거나 부모 버전이 삭제·손상되면 자동 저장을 중단하고 보관 상태 확인을 요구합니다. 초기 폴더를 두 기기에서 동시에 만들면 중복 폴더도 보존하고 하나를 임의 선택하지 않습니다. 사용자가 Drive 원본/폴더를 삭제하는 경우와 계정/서비스 장애까지 복구를 보장하지 않습니다.

## 필요한 승인 단계

1. 기존 **개인 Google 계정**에서 전용 Cloud 프로젝트 `aveo-care-drive`와 OAuth 웹 클라이언트 생성, Drive API 활성화. 2026-10-13 사용자 승인 후 개인 계정의 정상 로그인 UI를 확인했습니다. 새 프로젝트 화면에서 결제 계정 선택이 필수이며 ‘결제 없이’ 옵션이 없어 결제 계정 연결 없이 중단했습니다. 아직 프로젝트·OAuth 클라이언트·Drive API는 생성/활성화하지 않았습니다. 결제 연결은 승인 범위 밖입니다.
2. Google Auth Platform: 앱 이름 ‘아베오 케어’, 실제 운영자가 선택한 지원 연락처, 홈페이지 `https://erakeun.github.io/car-care-log/`, 개인정보 안내 `/privacy.html`, `drive.file` 최소 범위. 초기에는 External/Testing과 확인된 운영자 테스트 계정만 사용합니다. 후배 이메일이 확인되기 전에는 테스트 사용자를 추정 등록하지 않습니다. Google이 요구하는 기본 앱/도메인 검증 절차는 실제 콘솔에서 확인해야 합니다.
3. Authorized JavaScript origin은 `https://erakeun.github.io` (경로 제외). 로컬 검증 때 승인된 `http://localhost` 및 `http://localhost:4173`를 추가합니다. 브라우저 token model이므로 앱에 client secret이나 리디렉션 서버가 필요하지 않습니다.
4. 공개 client ID를 `google-drive-config.mjs`에 넣고 Google 저장만 활성화하는 설정/운영 배포 승인. Google GIS·Drive API에 필요한 정확한 CSP origin을 빌드 산출물에만 추가합니다. 원래 Pages 주소와 차량 기록 기능은 유지합니다. client secret/접근 토큰을 채팅·공개 코드로 전달하지 않습니다.
5. 승인된 실제 계정으로 비공개 폴더·저장·로그아웃·다른 계정 분리·만료 재연결·동시 수정/재시도를 검증한 뒤 운영 반영합니다. 커밋/PR 및 main 자동 배포는 기존 승인 규칙을 따릅니다.

후배 이메일 없이 로컬 구축은 완료할 수 있습니다. 이 구조는 서버 회원 allowlist를 만들지 않고, 각 사용자의 본인 Drive만 사용합니다. 초기 OAuth Testing 사용자 등록은 신원 확인 후 별도 진행합니다. 공개 페이지 방문만으로 다른 사람의 파일에 접근할 수 없습니다.

## 비용과 현재 제한

새 Supabase/SMTP/별도 서버 계정·유료 서비스를 사용하지 않습니다. 기존 계정의 Drive 저장 용량과 API 할당량을 사용합니다. 공식 Drive 문서는 무료 일일 사용 임계치 안에서는 추가 요금이 없다고 설명하고, 추후 과금 상세 변경을 예고하므로 영구 무료/무제한으로 약속하지 않습니다. 카드 등록·결제 계정 연결·유료 전환·할당량 확대는 승인 범위에 넣지 않았으며 요구 시 중단합니다. 소규모·수주 간격 사용에는 자동 주기 실행이나 keep-alive가 필요 없습니다.

## 검증과 남은 확인

기존 49개 테스트 유지 + Drive 저장/경합/재시도/권한/기본 비활성화 8개 + Drive UI 이관/충돌 선택 2개 테스트를 추가했습니다. 실제 OAuth 클라이언트와 토큰을 만들지 않았으므로 Google 인증·실제 Drive 응답/목록 반영 시점·Google 개인정보 검증과 모바일 팝업은 미검증입니다. Google 토큰과 원격 전송은 기본 비활성화 상태입니다.

근거: [최소 범위](https://developers.google.com/workspace/sheets/api/scopes), [브라우저 token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [생성 ID 재시도](https://developers.google.com/workspace/drive/api/guides/manage-uploads#use_a_pre-generated_id_to_upload_files), [GIS/CSP 설정](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [현재 Drive 할당량·과금 임계치](https://developers.google.com/workspace/drive/api/guides/limits).
