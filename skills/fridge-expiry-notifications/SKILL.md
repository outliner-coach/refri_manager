---
name: fridge-expiry-notifications
description: Prepare expiry monitoring and Slack notification actions for company fridge operations. Use when Codex needs to scan expiry windows, classify imminent and expired items, prevent duplicate sends, and produce channel-ready alert payloads.
---

# Fridge Expiry Notifications

Classify expiry risk and prepare deterministic Slack alerts for users and admins.

## Workflow

1. Read intake-normalized data and prior notification log.
2. Resolve the scan window (`24h`, `72h`, `expired`) and apply policy from `references/expiry-policy.md`.
3. Classify each record into `upcoming`, `expired`, `closed`, or `ignore`.
4. Generate idempotency keys before creating outbound messages.
5. Build two payload sets: owner-facing reminders and admin escalation notices.
6. Return send-ready payloads with retry-safe metadata.

## Guardrails

- Never create duplicate alerts for the same item and same status window.
- Keep message text short and action-oriented.
- Include absolute dates in alerts to avoid timezone confusion.
- Report blocked sends separately (`missing_slack_id`, `invalid_channel`, `data_conflict`).

## Output Contract

- Classification summary by status.
- Alert payload list with channel, message body, idempotency key.
- Blocked send list with reason and remediation step.

## References

- Expiry windows and idempotency rules: `references/expiry-policy.md`
