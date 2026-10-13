# 상태 변경 · 2026-10-13

사용자 최신 방향은 로그인 없는 차량별 공유 장부입니다. 아래 인증 어댑터 초안은 보류/비활성입니다. sharedSheetAdapter=null이며 새 로그인/OAuth/외부 자원은 없습니다. 공유 범위 확인 전 공개 endpoint를 만들지 않습니다. 공통 서버 담당의 확정 규격을 기다립니다.

# 로그인 차주별 공통 인증서버 연결 계약 초안

로그인 차주가 폰·PC에서 같은 계정의 기록을 조회/저장/동기화하고 변경 이력을 남기는 것이 최종 요구입니다. append-only는 변경 로그의 성질이며 사용자 조회 기능을 제거하는 뜻이 아닙니다.

백엔드는 아베오 담당의 공통 서버를 사용합니다. 중복 서버/Sheet/OAuth 설정 없음. shared-sheet-config.mjs의 sharedSheetAdapter=null이므로 현재 미연결·로컬 저장뿐입니다.

어댑터 함수: login(credentials) -> {id,email}; logout(); read({appId}); save({appId,payload,expectedRevision,mutationId,reason}); history({appId}); version({appId,revision}). 세션 토큰·주체는 어댑터/서버가 관리합니다. 차주 ID를 클라이언트 요청 파라미터로 정해 접근을 허용하면 안 됩니다. 로그인 UI 방식은 최종 공통 서버 계약 도착 후 맞춥니다. 현재 이메일/비밀번호 기존 UI는 활성화되지 않음.

snapshot 반환: {appId,revision,payload,updated_at,mutationId?}. save 응답은 요청 mutationId와 같은 ID가 필수. payload 앱ID 검증, 충돌은 error.code=conflict. 검증된 응답 전 서버 저장 완료 표시 없음. 동일 mutationId 재시도, revision 경쟁 방지, 기존 브라우저 이관 별도 검토, 계정 전환 후 늦은 응답 차단은 기존 CloudStore 흐름 재사용.

실제 서버에서 인증 주체+appId 격리, 차주 전용 조회/변경 이력·복구 권한, 공개 조회 금지, Sheet 비공개 소유, 원격 저장 실패 시 입력 유지, CSP 서버 origin 제한 검증이 필요합니다. 서버 연결·네트워크 성공·계정간 격리는 현재 미검증입니다.
