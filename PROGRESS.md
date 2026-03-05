# PROGRESS

## 기록 원칙
- 이 파일은 "완료된 작업"만 기록한다.
- 항목은 최신이 위로 오도록 작성한다.
- 각 항목은 날짜, 담당(에이전트/사용자), 작업 요약, 산출물 경로를 포함한다.

## 완료 이력
- 2026-03-06 | 담당: Codex
  - 태블릿 등록 UX를 “버튼 없는 완전 자동 음성 진행”으로 추가 전환
  - 페이지 진입 시 자동 시작, 이름/동명이인(사번 끝4자리)/음식정보를 모두 음성 인식으로 단계 자동 진행
  - 카메라 자동 실행 후 3초 자동 촬영 및 자동 업로드/자동 등록 흐름 구현
  - 음성/추출 실패 시 1회 자동 재시도 후 수동 모드 자동 전환 유지
  - API 확장:
    - `POST /v1/intake/transcribe` intent에 `EMPLOYEE_LAST4` 추가
    - `extractEmployeeLast4FromTranscript` 추출기 추가
  - 타입/검증:
    - `pnpm typecheck` 통과
    - `pnpm test` 통과
  - 산출물: `/Users/friends/ai/refri_manager/apps/tablet-web/app/page.tsx`, `/Users/friends/ai/refri_manager/services/api/src/routes/intake.ts`, `/Users/friends/ai/refri_manager/services/api/src/lib/transcribe.ts`, `/Users/friends/ai/refri_manager/packages/shared-types/src/index.ts`

- 2026-03-06 | 담당: Codex
  - 태블릿 등록 UX를 음성 주도 위저드 + 수동 전환 구조로 전환
  - 태블릿 UI 상태머신(`IDLE~DONE`, `MANUAL_MODE`) 구현 및 TTS(`speechSynthesis`) 안내 추가
  - 이름 음성 인식 → `name-lookup` 후보 선택(동명이인 사번 끝 4자리) 흐름 구현
  - 음식/유통기한 음성 인식 실패 시 1회 재시도 후 수동 전환 로직 구현
  - 카메라 자동 실행/촬영/재촬영/확정 및 파일 업로드 폴백 구현
  - API 확장:
    - `POST /v1/auth/name-lookup` 추가
    - `POST /v1/intake/transcribe`에 `intent` 멀티파트 필드 추가(`IDENTITY_NAME`/`FOOD_INFO`)
    - 인증 헤더 `x-member-id` 지원(기존 `x-employee-no`와 병행)
  - 검증:
    - `pnpm typecheck` 통과
    - `pnpm test` 통과
    - `scripts/docker-smoke-test.sh` PASS
    - 실서버 확인: `name-lookup` 동명이인 3명 응답, `x-member-id`로 업로드 URL/음식 등록 성공
  - 산출물: `/Users/friends/ai/refri_manager/apps/tablet-web/app/page.tsx`, `/Users/friends/ai/refri_manager/services/api/src/routes/auth.ts`, `/Users/friends/ai/refri_manager/services/api/src/routes/intake.ts`, `/Users/friends/ai/refri_manager/services/api/src/lib/transcribe.ts`, `/Users/friends/ai/refri_manager/services/api/src/plugins/actor.ts`, `/Users/friends/ai/refri_manager/services/api/src/app.ts`, `/Users/friends/ai/refri_manager/packages/shared-types/src/index.ts`

- 2026-03-06 | 담당: Codex
  - 태블릿 UI 실사용 이슈 수정 및 브라우저 검증 완료
  - 구성원 조회 CORS 오류 수정(`@fastify/cors` 등록)
  - 태블릿 UI에 사진 업로드(파일 선택+업로드), 음성 녹음/업로드/분석 버튼 및 흐름 구현
  - MinIO presigned URL 브라우저 접근 경로 수정(요청 호스트 기반 자동 산출 + `MINIO_PUBLIC_ENDPOINT` override) 및 Docker MinIO 포트 분리(9100/9101)
  - `docker-up.sh`에서 루트 `.env` 자동 로드하도록 개선(OpenAI 키 주입 보장)
  - `docker-smoke-test.sh` MySQL utf8mb4 적용(한글 시드 깨짐 방지)
  - Playwright로 확인: 사번 조회 성공, 사진 업로드 성공, 음식 등록 성공, 음성 녹음/분석 성공
  - 산출물: `/Users/friends/ai/refri_manager/services/api/src/app.ts`, `/Users/friends/ai/refri_manager/services/api/src/lib/storage.ts`, `/Users/friends/ai/refri_manager/apps/tablet-web/app/page.tsx`, `/Users/friends/ai/refri_manager/packages/config/src/index.ts`, `/Users/friends/ai/refri_manager/infra/docker/docker-compose.yml`, `/Users/friends/ai/refri_manager/scripts/docker-up.sh`

- 2026-03-06 | 담당: Codex
  - 비개발자 대상 HTML 가이드 문서 작성
  - 시스템 전체 구조, 등록 흐름, 알림 타임라인, 개인정보 정책, 운영 체크포인트를 구조도와 함께 정리
  - 산출물: `/Users/friends/ai/refri_manager/docs/operations/non-technical-guide.html`

- 2026-03-06 | 담당: Codex
  - Docker 기반 로컬 실행/검증 경로 구축
  - `infra/docker/docker-compose.yml`에 `api`, `worker` 서비스 추가
  - `services/api|worker` Dockerfile 추가, `scripts/docker-up.sh`, `scripts/docker-smoke-test.sh`, `scripts/docker-down.sh` 추가
  - 실제 컨테이너 기동 후 스모크 테스트 PASS
    - 사번 조회
    - 음식 등록
    - 본인 목록 조회
  - 산출물: `/Users/friends/ai/refri_manager/infra/docker/docker-compose.yml`, `/Users/friends/ai/refri_manager/scripts/docker-*.sh`, `/Users/friends/ai/refri_manager/services/api/Dockerfile`, `/Users/friends/ai/refri_manager/services/worker/Dockerfile`

- 2026-03-06 | 담당: Codex
  - M1+M2 구현 스캐폴딩 완료 (Node TS + Fastify + Prisma + Next 모노레포)
  - API 엔드포인트 구현:
    - `POST /v1/auth/employee-lookup`
    - `POST /v1/internal/sync/members`
    - `POST /v1/intake/transcribe`
    - `POST /v1/assets/upload-url`
    - `POST /v1/foods`
    - `PATCH /v1/foods/:foodItemId`
    - `GET /v1/foods/me`
  - MySQL Prisma 스키마 + 초기 SQL 생성(`data/migrations/0001_init.sql`)
  - Worker 알림 처리 골격 구현(재시도/idempotency/fallback 포함)
  - 타입체크 및 테스트 통과(`pnpm typecheck`, `pnpm test`)
  - 산출물: `/Users/friends/ai/refri_manager/apps/`, `/Users/friends/ai/refri_manager/services/`, `/Users/friends/ai/refri_manager/packages/`, `/Users/friends/ai/refri_manager/infra/docker/`

- 2026-03-06 | 담당: Codex
  - 고정 의사결정을 반영한 구현계획 v1 수립
  - Google Sheets 구성원 연동, 사번 인증, 서버 STT, MySQL 스키마, 알림/보존/비용 정책 반영
  - `PLAN.md`를 마일스톤(M1~M5) 기준으로 재정렬
  - 산출물: `/Users/friends/ai/refri_manager/docs/architecture/implementation-plan-v1.md`, `/Users/friends/ai/refri_manager/PLAN.md`

- 2026-03-05 | 담당: Codex
  - 냉장고 운영 자동화 셋업 생성(Command + Skill)
  - `commands/`에 운영 커맨드 5종 추가
  - `skills/`에 운영 스킬 3종(`intake`, `expiry`, `admin`) 및 `agents/openai.yaml`, `references/` 추가
  - 자동화 구조 문서 작성: `docs/operations/automation-setup.md`
  - 산출물: `/Users/friends/ai/refri_manager/commands/`, `/Users/friends/ai/refri_manager/skills/`, `/Users/friends/ai/refri_manager/docs/operations/automation-setup.md`

- 2026-03-05 | 담당: Codex
  - 멀티 에이전트 진행 관리를 위한 문서 체계 도입
  - `agent.md`에 시작 시 필독 순서(`agent.md -> PROGRESS.md -> PLAN.md`) 및 갱신 규칙 추가
  - 산출물: `/Users/friends/ai/refri_manager/agent.md`, `/Users/friends/ai/refri_manager/PROGRESS.md`, `/Users/friends/ai/refri_manager/PLAN.md`

- 2026-03-05 | 담당: Codex
  - `agent.md` Soul Document 생성
  - 프로젝트 목적, 권장 폴더 구조, 기본 동작 룰, 시작/유지보수 규칙 정의
  - 산출물: `/Users/friends/ai/refri_manager/agent.md`

- 2026-03-05 | 담당: Codex
  - 냉장고 관리 에이전트 구현 방향(태블릿 음성/사진 등록, Slack 알림, 관리자 조회) 사전 조사 및 아키텍처 초안 정리
  - 산출물: 대화 내 조사/설계 제안
