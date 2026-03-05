---
name: fridge-intake-review
description: Review intake registrations, detect data quality issues, and produce follow-up actions.
arguments: "<batch-or-date>"
---
# /fridge-intake-review

## Purpose

신규 음식 등록 데이터의 완성도와 정확도를 점검하고, 누락/충돌 항목에 대한 후속 조치를 만든다.

## Execute

- 인자로 받은 배치 또는 날짜 범위를 기준으로 대상 등록 목록을 확정한다.
- `fridge-intake-operations` 스킬 규칙으로 필수 필드와 날짜 형식을 검증한다.
- 중복 등록, 사용자 식별 불가, 유통기한 오류를 분류한다.
- 각 이슈마다 담당자, 조치 방법, 마감 시점을 포함한 액션 리스트를 작성한다.

## Output

- 검증 요약(전체/정상/이슈 건수)
- 이슈 분류표(코드, 영향도, 조치)
- 즉시 처리할 항목 Top 3

## Files

- 읽기: `skills/fridge-intake-operations/`, 관련 입력 데이터
- 갱신: 필요 시 `PROGRESS.md`, 운영 출력 파일
