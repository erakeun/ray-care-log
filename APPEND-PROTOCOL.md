# 추가 전용 로그 연결 준비

원격 수신 규격 도착 전 초안입니다. endpoint/OAuth/Google 설정은 없고 네트워크 전송하지 않습니다.

append-log.mjs: format=1, appId, eventId, at, action, payload. 변경된 기록만 추가 이벤트로 남김; 수정/삭제도 새 이벤트로 기록하며 원격 수정/삭제 API 없음. JSON 복원은 복원 이벤트만 남기고 기존 기록을 자동 이관하지 않음. 차 이름/차량등록번호/연락처는 기본 수집 필드 없음. 차주가 작성한 항목·메모는 변경 기록 데이터에 포함되므로 실제 연결 전에 수신 규격·표시 문구를 맞춰야 함.

각 앱 KEY:append-outbox의 로컬 대기열. 동일 eventId 재시도 및 수신 ok/eventId 확인 후 대기열 제거. transport 미지정: 미연결, 실패/확인 불가: 대기열 유지. 실제 수신 서버는 중복 eventId 처리·공개 조회 금지·입력 검증을 구현해야 함. 원격 규격 확정 후 transport 어댑터와 CSP 허용 대상 설정 필요.
