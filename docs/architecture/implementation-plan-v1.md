# 냉장고 운영 에이전트 구현계획 v1

작성일: 2026-03-06 (Asia/Seoul)

## 1) 고정 의사결정 반영

| 항목 | 결정 |
|---|---|
| 태블릿 인증 | 사번 입력 인증 |
| 구성원 정보 소스 | Google Sheets |
| 음성 처리 | 서버 STT (OpenAI) |
| 유통기한 정책 | 사용자 입력값 사용, 등록일 기준 최대 6개월 |
| 알림 정책(본인) | 기본 3회: D-3, D-day, D+7. 미처리 시 D+14부터 매주 반복 |
| 알림 정책(관리자) | D+7 시점 미처리 건 1차 알림 (이후 주간 요약에 포함) |
| 중복/정정 | 같은 음식 재등록 허용, 일반 사용자 수정 허용 |
| 개인정보/보존 | 이름/사진 로그 운영조회 1년, 2년 후 삭제 |
| 실패 처리 | Slack 재시도 + idempotency 키 |
| 비용 정책 | 월 예산 50,000원 |

## 2) 시스템 구조

```text
Tablet Web (PWA)
  -> API Server
      -> MySQL
      -> Object Storage (food photos, audio)
      -> OpenAI STT
      -> Slack API
      -> Google Sheets Sync Service
  -> Worker (scheduler/retry/expiry scans)
Admin Web
  -> API Server
```

## 3) 컴포넌트 설계

### 3.1 태블릿 웹앱 (`apps/tablet-web`)
- 기능:
  - 사번 입력 -> 사용자 확인
  - 사진 촬영
  - 음성 녹음
  - 추출 필드 확인/수정 후 등록
- 검증:
  - 유통기한 입력은 UI에서 최대 6개월 제한
  - 서버 검증 실패 메시지 표시
- 운영:
  - 키오스크 모드 고정
  - 네트워크 장애 시 재시도 큐(로컬 임시 저장)

### 3.2 API 서버 (`services/api`)
- 주요 역할:
  - 사번 인증/조회
  - 등록/수정 API
  - STT 호출 및 필드 추출
  - Slack 알림 요청 수용
  - 관리자 조회 API
- 권한:
  - 일반 사용자: 본인 항목 등록/수정
  - 관리자: 전체 조회/관리
- 핵심 정책 강제:
  - 유통기한 6개월 상한
  - 수정 이력 감사로그
  - idempotency 키 생성/검증

### 3.3 워커 (`services/worker`)
- 작업:
  - 만료 임박/만료 스캔
  - 알림 스케줄 생성/전송
  - Slack 실패 재시도(지수 백오프)
  - 보존기간 배치(1년 보관, 2년 삭제)
- 주기:
  - 만료 스캔: 1시간
  - 주간 리마인더 생성: 매일 1회
  - 보존 정책 배치: 매일 새벽

### 3.4 구성원 동기화 (`services/api` 내부 모듈)
- 소스: Google Sheets
- 방식:
  - 읽기 전용 서비스 계정
  - 1시간 주기 풀 동기화 + 수동 강제 동기화 엔드포인트
  - 조회는 MySQL 캐시 테이블 우선 사용
- 최소 컬럼:
  - `employee_no`, `name`, `department`, `slack_user_id`, `status`

### 3.5 관리자 웹앱 (`apps/admin-web`)
- 화면:
  - 등록 목록(등록자/소속/음식/사진/유통기한/상태)
  - 알림 이력(성공/실패/재시도)
  - 보존/삭제 대상 현황
  - 필터(소속, 상태, 유통기한 범위)

## 4) 데이터 모델 (MySQL 8.0 기준)

## 핵심 테이블
- `members`:
  - `id`, `employee_no`(unique), `name`, `department`, `slack_user_id`, `status`, `synced_at`
- `food_items`:
  - `id`, `member_id`, `food_name`, `expiry_date`, `registered_at`, `status`, `deleted_at`
- `food_assets`:
  - `id`, `food_item_id`, `photo_url`, `audio_url`, `created_at`
- `food_item_events` (감사로그):
  - `id`, `food_item_id`, `actor_member_id`, `event_type`, `payload_json`, `created_at`
- `notification_schedule`:
  - `id`, `food_item_id`, `target_type`(OWNER/ADMIN), `schedule_type`, `scheduled_at`, `status`
- `notification_attempts`:
  - `id`, `schedule_id`, `idempotency_key`(unique), `attempt_no`, `status`, `error_code`, `sent_at`
- `cost_usage_monthly`:
  - `month_yyyymm`, `provider`, `service`, `cost_krw`, `updated_at`

## 인덱스
- `food_items(expiry_date, status)`
- `food_items(member_id, registered_at)`
- `notification_schedule(status, scheduled_at)`
- `notification_attempts(idempotency_key)` unique
- `members(employee_no)` unique

## 5) API 초안

- `POST /v1/auth/employee-lookup`
  - input: `employee_no`
  - output: `name`, `department`, `member_id`, `status`
- `POST /v1/intake/transcribe`
  - multipart: `audio`
  - output: transcript + extracted fields
- `POST /v1/foods`
  - input: `member_id`, `food_name`, `expiry_date`, `photo_url`, `audio_url?`
- `PATCH /v1/foods/{food_id}`
  - 일반 사용자 수정 허용(권한 검증)
- `GET /v1/admin/foods`
  - 필터 조회
- `POST /v1/internal/sync/members`
  - Google Sheets 수동 동기화

## 6) 알림 로직 상세

## 본인 알림
- D-3: 만료 3일 전 09:00
- D-day: 만료일 09:00
- D+7: 만료 7일 후 09:00
- 미처리 상태(`status != disposed`)이면 D+14부터 7일 간격 반복

## 관리자 알림
- D+7 시점 미처리 건에 대해 1회 즉시 알림
- 이후는 주간 다이제스트에 포함

## idempotency 키
- 포맷: `notify:{food_item_id}:{target_type}:{schedule_type}:{yyyymmdd}`
- 동일 키는 1회 성공 후 재전송 금지

## 재시도 정책
- 1차 실패 후 1m, 5m, 15m, 1h, 6h 백오프
- 최대 시도 초과 시 `FAILED_PERM`로 종료 후 관리자 큐로 이관

## 7) 개인정보/보존 정책 구현

- 운영 조회 데이터(이름/사진 포함): 1년
- 1년 초과 2년 이하: 저빈도 접근(아카이브 플래그)
- 2년 초과: 하드 삭제 배치
- 삭제 로그(`deletion_audit`)는 비식별 메타만 유지

## 8) 비용 통제 (월 50,000원)

- 예산 캡:
  - 월 누적 80% 도달 시 경고
  - 100% 도달 시 STT 품질 옵션 하향 + 관리자 경보
- 절감 방식:
  - 음성 길이 제한(예: 20초)
  - 불필요 재전사 금지
  - 모델 호출 실패 재시도 횟수 제한
- 비용 집계:
  - 일 단위 사용량 -> 월 집계 테이블 반영

## 9) 구현 단계 (마일스톤)

1. M1 - 기반 셋업 (1주)
- MySQL 스키마, API 골격, 환경변수/시크릿 구성
- Google Sheets 동기화 기본 구현

2. M2 - 등록 플로우 MVP (1주)
- 태블릿 사번 인증, 사진/음성 등록, STT 파싱
- 유통기한 6개월 검증

3. M3 - 알림 엔진 MVP (1주)
- D-3/D-day/D+7 + 주간 재알림 + 관리자 D+7
- Slack 실패 재시도/idempotency

4. M4 - 관리자/운영 (1주)
- 관리자 조회/필터, 감사로그, 비용 대시보드
- 보존/삭제 배치

5. M5 - 안정화 (1주)
- 장애 복구 리허설
- 부하/회귀 테스트
- 운영 Runbook 완성

## 10) 런칭 전 체크리스트

- Google Sheets 권한/서비스계정 검증
- Slack 채널/사용자 매핑 검증
- 만료 시뮬레이션 데이터로 알림 정책 검증
- 개인정보 삭제 배치 dry-run 확인
- 월 예산 초과 시나리오 테스트
