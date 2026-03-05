---
name: fridge-intake-operations
description: Manage intake registration quality checks for company fridge operations. Use when Codex needs to validate owner affiliation and name, normalize food labels and expiry dates, detect duplicate registrations, or prepare follow-up actions for tablet and Slack handoff.
---

# Fridge Intake Operations

Validate incoming food registration records before they flow into expiry alerts and admin reports.

## Workflow

1. Read `agent.md`, `PROGRESS.md`, and `PLAN.md` to restore project context.
2. Load intake data and normalize fields (`department`, `owner_name`, `food_name`, `expiry_date`).
3. Validate required fields and date format using `references/intake-checklist.md`.
4. Detect potential duplicates by owner + food + registration window and annotate confidence.
5. Create action rows with `issue_code`, `severity`, `owner`, `next_action`, and `due_at`.
6. Return a compact summary plus Top 3 urgent items.

## Guardrails

- Preserve source data and report only normalized copies.
- Flag unknown values instead of inventing departments or owner names.
- Use deterministic issue codes from the reference file.
- Prefer minimal remediation steps that can be executed in one pass.

## Output Contract

- Summary: total rows, valid rows, issue rows.
- Issue table: one row per issue with code, impact, and next action.
- Handoff block: commands to run next (`/fridge-expiry-alerts` or `/fridge-admin-digest`).

## References

- Intake checklist and issue taxonomy: `references/intake-checklist.md`
