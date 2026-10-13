# 게시 상태 · 2026-10-13

소스: https://github.com/erakeun/ray-care-log
사이트: https://erakeun.github.io/ray-care-log/

초기 페이지 게시 성공. 개인 식별정보 입력 필드 없음. 공통 서버 v5를 차량별 appId로 연결했습니다. 실제 저장 수신 확인 상태를 화면에 표시합니다. 기존 브라우저 기록은 자동 이관하지 않습니다. 소유자 Sheet/Apps Script/endpoint/OAuth/신규 계정/결제 자원은 이 작업에서 생성하지 않았습니다. 공통 서버 규격을 받으면 차량 appId를 유지하며 조회/저장/충돌/로그·두 독립 세션 검증을 추가합니다.

GitHub 토큰에 workflow scope가 없어 자동 CI 템플릿은 scripts에 보관. 로컬 npm test 통과 후 build:cloud/stage:pages로 public을 생성하고 gh-pages 브랜치에 정적 파일만 게시합니다. 새 권한은 요청하지 않았습니다.
