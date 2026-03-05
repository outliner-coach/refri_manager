---
name: fridge-incident-triage
description: Triage urgent fridge-operation incidents and route work to the proper command and skill.
arguments: "<incident>"
---
# /fridge-incident-triage

## Purpose

긴급 운영 이슈(대량 만료 누락, 중복 알림 폭주, 사용자 식별 실패)를 빠르게 분류하고 대응 경로를 정한다.

## Execute

- 사건 설명에서 영향 범위, 시작 시점, 관련 사용자/채널을 추출한다.
- 이슈 유형을 `intake`, `expiry`, `admin`, `platform` 중 하나로 분류한다.
- 유형별로 실행할 커맨드와 필요한 스킬을 지정한다.
- 1차 완화 조치와 재발 방지 체크 항목을 제시한다.

## Output

- 사건 요약(영향/우선순위)
- 즉시 실행 커맨드와 스킬
- 완화 조치 및 후속 확인 항목

## Files

- 읽기: `commands/`, `skills/`, `PROGRESS.md`, `PLAN.md`
- 갱신: `PROGRESS.md`, 필요 시 `PLAN.md`
