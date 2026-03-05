---
name: fridge-ops-status
description: Restore fridge-operations context and identify the next automation command.
arguments: ""
---
# /fridge-ops-status

## Purpose

냉장고 운영 업무를 시작하기 전에 현재 상태를 복원하고, 바로 실행할 다음 커맨드를 정한다.

## Execute

- `agent.md`, `PROGRESS.md`, `PLAN.md`를 읽고 현재 우선순위를 파악한다.
- 진행 중이거나 막힌 항목을 `intake`, `expiry`, `admin`, `incident` 축으로 분류한다.
- 필요한 스킬(`fridge-intake-operations`, `fridge-expiry-notifications`, `fridge-admin-audit`)을 선택한다.
- 다음 실행 커맨드 1개를 제안한다.

## Output

- 현재 상태 요약(4축)
- 위험/지연 이슈
- 즉시 실행할 다음 커맨드 1개

## Files

- 읽기: `agent.md`, `PROGRESS.md`, `PLAN.md`, `commands/`, `skills/`
- 갱신: 필요 시 `PROGRESS.md`, `PLAN.md`
