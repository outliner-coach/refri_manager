# 냉장고 운영 자동화 셋업

## 에이전트 역할 구조

- Intake Agent
  - 신규 등록 데이터의 품질 검증, 중복 후보 식별, 후속 조치 생성
  - 주 스킬: `fridge-intake-operations`
- Expiry Agent
  - 만료 임박/만료 분류, 알림 페이로드 생성, 중복 전송 방지
  - 주 스킬: `fridge-expiry-notifications`
- Admin Agent
  - 등록/만료/알림 로그를 집계해 관리자 리포트 생성
  - 주 스킬: `fridge-admin-audit`
- Incident Agent
  - 운영 이슈를 분류하고 적절한 커맨드/스킬로 라우팅
  - 주 커맨드: `/fridge-incident-triage`

## Command 맵

- `/fridge-ops-status`: 현재 상태 복원 및 다음 커맨드 선택
- `/fridge-intake-review <batch-or-date>`: 등록 데이터 품질 점검
- `/fridge-expiry-alerts <window>`: 유통기한 알림 액션 생성
- `/fridge-admin-digest <period>`: 관리자 요약 리포트 생성
- `/fridge-incident-triage <incident>`: 긴급 이슈 분류 및 대응 경로 제시

## Skill 맵

- `skills/fridge-intake-operations/`
- `skills/fridge-expiry-notifications/`
- `skills/fridge-admin-audit/`

## 적용된 폴더 구조

```text
refri_manager/
├─ commands/
│  ├─ fridge-ops-status.md
│  ├─ fridge-intake-review.md
│  ├─ fridge-expiry-alerts.md
│  ├─ fridge-admin-digest.md
│  └─ fridge-incident-triage.md
├─ skills/
│  ├─ fridge-intake-operations/
│  ├─ fridge-expiry-notifications/
│  └─ fridge-admin-audit/
└─ docs/operations/
   └─ automation-setup.md
```
