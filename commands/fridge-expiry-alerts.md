---
name: fridge-expiry-alerts
description: Build expiry-alert actions and message payloads for Slack notifications.
arguments: "<window>"
---
# /fridge-expiry-alerts

## Purpose

유통기한 임박/만료 데이터를 스캔해 Slack 알림 전송용 액션과 메시지 페이로드를 준비한다.

## Execute

- 인자로 받은 윈도우(예: `24h`, `3d`) 기준으로 대상 레코드를 추린다.
- `fridge-expiry-notifications` 스킬의 정책에 따라 임박/만료/완료 상태를 분리한다.
- 중복 전송 방지를 위해 idempotency 키를 생성하고 이전 전송 이력과 대조한다.
- 사용자 알림과 관리자 알림 메시지를 각각 생성한다.

## Output

- 알림 대상 목록(임박/만료)
- Slack 메시지 초안/페이로드
- 재전송 방지 키 목록

## Files

- 읽기: `skills/fridge-expiry-notifications/`, 관련 만료 데이터
- 갱신: 필요 시 `PROGRESS.md`, 운영 출력 파일
