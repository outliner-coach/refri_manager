---
name: fridge-admin-audit
description: Produce administrative audit summaries for fridge operations. Use when Codex needs to report who registered what item, inspect photo and expiry compliance, summarize expiry-response performance, or prepare weekly and monthly admin digest output.
---

# Fridge Admin Audit

Generate admin-ready summaries for registration ownership, expiry handling quality, and operational risk.

## Workflow

1. Read period input and load registration, expiry, and notification logs.
2. Aggregate metrics by department, owner, and status.
3. Flag risk patterns: repeated expired items, unresolved alerts, unowned registrations.
4. Render output using `references/admin-report-template.md`.
5. Recommend 1-3 follow-up actions with owner and target date.

## Guardrails

- Use absolute dates in all summaries.
- Keep audit language factual and traceable to source rows.
- Separate observed facts from recommendations.
- Include the query window in the report header.

## Output Contract

- Executive summary (3-5 lines).
- KPI table (registrations, upcoming, expired, resolved).
- Risk register (issue, impact, suggested action).
- Follow-up action list.

## References

- Report structure and KPI definitions: `references/admin-report-template.md`
