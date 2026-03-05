# PLAN

## 운영 원칙
- 이 파일은 "앞으로 해야 할 일"을 관리한다.
- 상태는 `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED` 중 하나를 사용한다.
- 새 작업 시작 시 `TODO`의 최상단 항목부터 수행한다.

## 작업 목록
- [DONE] 운영 자동화 셋업(Command/Skill) 구축
  - `commands/` 및 `skills/` 기본 체계 생성
  - 냉장고 운영용 커맨드 5개, 스킬 3개, 운영 자동화 구조 문서 1개 작성

- [DONE] 의사결정 반영 구현계획 v1 수립
  - Google Sheets 구성원 연동, 사번 인증, OpenAI STT, MySQL, 알림/보존/비용 정책 반영
  - 산출물: `docs/architecture/implementation-plan-v1.md`

- [DONE] M1 기반 셋업
  - 모노레포 구조 생성(`apps/services/packages/infra/data`)
  - Prisma MySQL 스키마 및 초기 SQL 생성(`data/migrations/0001_init.sql`)
  - Fastify API/Worker 초기화
  - 환경변수 스키마(`@refri/config`) 및 `.env.example` 구성
  - Google Sheets Pull 동기화 모듈 구현

- [DONE] M2 등록 플로우 MVP
  - 태블릿 웹 UI(사번 조회 + 등록 폼) 초기 구현
  - 업로드 URL API(`POST /v1/assets/upload-url`) 구현
  - STT + LLM JSON 추출 API(`POST /v1/intake/transcribe`) 구현
  - 음식 등록/수정/본인조회 API 구현
  - 유통기한 6개월 상한 검증 로직 구현 및 테스트

- [DONE] 태블릿 음성 주도 UX 전환(위저드+수동 전환)
  - 시작 버튼 기반 음성 위저드 상태머신 구현
  - 이름 음성 인식 + 동명이인 사번 끝 4자리 선택 플로우 구현
  - 음식/유통기한 음성 인식 실패 1회 재시도 후 수동 전환
  - 카메라 촬영/재촬영/확정 및 파일 업로드 폴백
  - API 추가/확장: `POST /v1/auth/name-lookup`, `POST /v1/intake/transcribe(intent)`

- [DONE] 태블릿 무버튼 완전 자동 음성 진행
  - 페이지 진입 시 자동 시작, 단계별 음성 안내/음성 인식 자동 전환
  - 동명이인 선택을 음성(사번 끝4자리)으로 처리
  - 사진 단계 자동 촬영/자동 업로드/자동 등록 완료
  - `POST /v1/intake/transcribe` intent 확장(`EMPLOYEE_LAST4`)

- [TODO] M3 알림 엔진 MVP
  - 본인: D-3, D-day, D+7, 이후 주간 재알림
  - 관리자: D+7 미처리 알림
  - Slack 실패 재시도와 idempotency 키 적용

- [TODO] M4 관리자/운영 기능
  - 관리자 조회/필터/수정
  - 감사로그 조회
  - 비용 집계(월 5만원 예산 경고)
  - 보존정책 배치(1년 조회, 2년 삭제)

- [TODO] M5 안정화/릴리즈 준비
  - 통합 테스트/회귀 테스트
  - 장애 복구 리허설
  - 운영 Runbook 및 체크리스트 확정
