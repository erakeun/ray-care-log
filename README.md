# 기아 레이 정비수첩

차량별 독립 사이트. 주행거리·점검·교체·수리 기록, 다음 관리 안내, 선택형 기아 공식 사양 프리셋, JSON/CSV 백업을 제공합니다. 개인 식별정보 없이 시작합니다.

로그인 없이 같은 차량 링크로 들어오는 폰·PC는 소유자 Sheet의 차량별 공유 장부를 조회·저장합니다. 서버 수신 확인 전에는 저장 완료로 표시하지 않습니다. 기존 로컬 기록은 자동 업로드하지 않고 JSON 복원 검토·확인으로 가져옵니다. 변경 로그는 추가 전용, 원본 시트 관리는 소유자가 담당합니다. 비활성 로그인/Drive 어댑터는 과거 방향의 초안이며 사용하지 않습니다.

`npm ci --ignore-scripts`, `npm test`, `npm run build:cloud`, `npm run stage:pages`로 검증/정적 파일 준비. `npm start`로 로컬 미리보기. 현재 토큰에는 workflow 권한이 없어 CI 템플릿은 scripts에 보관합니다. 로컬 테스트 후 public 정적 파일만 gh-pages 브랜치로 게시합니다. 공유 설정/endpoint/비밀을 이 저장소에 임의로 넣지 않습니다.

검증 범위는 VERIFICATION.md, 연결 계약 초안은 APPEND-PROTOCOL.md를 확인하세요.
