---
name: fridge-admin-digest
description: Produce admin digest on registrations, expiry actions, and operational risks.
arguments: "<period>"
---
# /fridge-admin-digest

## Purpose

관리자가 바로 확인할 수 있도록 등록 현황, 만료 대응, 운영 리스크를 주기 보고 형태로 정리한다.

## Execute

- 인자로 받은 기간(예: `daily`, `weekly`, `2026-03`)을 확정한다.
- `fridge-admin-audit` 스킬 템플릿으로 핵심 지표를 집계한다.
- 등록량, 만료 대응률, 잔여 리스크, 반복 이슈를 추출한다.
- 다음 기간 개선 액션 1~3개를 제안한다.

## Output

- 관리자 요약 리포트
- 지표 표(등록/폐기/만료 대응)
- 리스크 및 개선 액션

## Files

- 읽기: `skills/fridge-admin-audit/`, 관련 운영 데이터
- 갱신: 필요 시 `PROGRESS.md`, 운영 출력 파일
