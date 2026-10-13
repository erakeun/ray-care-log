# 공통 공유 장부 어댑터 · 2026-10-13

사용자 승인 구조: 로그인 없이 차량 링크 방문자가 같은 차량의 장부를 조회·변경합니다. 저장과 과거 로그는 원본 소유자 비공개 Google Sheet에 보존합니다. 원본 행 삭제 API는 없습니다. 별도 서버/Script/Sheet/OAuth는 만들지 않습니다.

참고한 서버 소스는 car-care-guide/shared-server/Code.gs 및 Core.gs이며 수정하지 않았습니다. shared.mjs는 읽어 확인한 공통 postMessage 규격을 위한 새 프런트엔드 구현입니다. 원본 코드 복사본을 공개 게시하지 않습니다. tests/fixtures/shared-server-Core.gs는 서버 스키마 호환 검증용 로컬 전용 복사본이며 gitignore로 제외합니다. 공개 저장소와 사이트에는 원본 서버 코드를 업로드하지 않습니다. 공개 테스트는 직접 작성한 v1 필드 규격 검사와 앱 검증을 사용하고, 로컬 복사본이 있을 때만 실제 CareCore 검사도 수행합니다.

호출: iframe exec?appId=k3|ray&parentOrigin=https://erakeun.github.io&channel=UUID. google.script.run 중계 후 load -> {revision,snapshot}; save -> {revision,snapshot} 또는 {conflict:true,revision,snapshot}. save 요청에는 expectedRevision, mutationId, snapshot을 보냅니다. 원본 브리지가 appId를 해당 차량으로 고정합니다. 클라이언트도 각각 k3/ray로 분리합니다.

서버 v1 ↔ 앱 v2: 연식·엔진·변속기·환경·앱ID를 관리 항목 1개의 JSON 사양 메타데이터로 보존합니다. 차 이름은 빈 문자열. 사용자 항목 최대 99개 + 메타데이터 1개. 화면에는 메타데이터를 노출하지 않습니다. 기록 ID·계산 기준·공식 프리셋 메모·최초/반복 기준은 그대로 보존합니다. metadata 앱ID 불일치/없음·잘못된 차종은 거절합니다.

저장 응답의 버전과 스냅샷 내용이 요청과 일치하기 전에는 성공 표시 안 함. 실패 시 동일 mutationId 재시도, 미확인 저장을 차량별 로컬 pending 키에 보존. 충돌 시 자동 덮어쓰기 없이 최신 장부 확인 요구. 입력 임시본은 shared-draft 키에 보존하고 JSON 백업 버튼으로 가져올 수 있습니다. 이전 로컬 기록은 자동 업로드하지 않으며 확인한 JSON 복원만 새 버전으로 저장합니다. 폼 작성 중/focus 갱신은 화면을 덮어쓰지 않습니다.

현재 shared-config.mjs: enabled=false, endpoint=''. 실제 exec 주소 발급과 아베오 실연결 검증 전 활성화하지 않습니다. 실제 호출·Google 동의·두 실제 기기의 저장/재조회는 아직 미검증입니다. 합성 2세션·충돌·중복 mutation·기기 재시작·앱 분리·원본 로그 보존 시험만 완료했습니다.

staging은 활성화 시 확인한 script.google.com exec 주소만 허용하며 frame-src를 Google 브리지 origin으로 제한합니다. 직접 fetch/CORS·비밀·방문자 로그인 추가 없음. 이전 계정/Supabase/Drive 초안은 공유 모드에서 실행하지 않으며 서비스 동시 활성화를 거부합니다.
