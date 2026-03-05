# Admin Report Template

## 1. Header

- Report period: `<start_date> ~ <end_date>`
- Generated at: `<timestamp>`
- Data sources: intake log, expiry log, notification log

## 2. Executive Summary

- Total registrations
- Expiry upcoming count
- Expired unresolved count
- Overall response rate

## 3. KPI Table

| KPI | Value | Notes |
|---|---|---|
| Registrations |  |  |
| Upcoming (72h) |  |  |
| Expired |  |  |
| Resolved After Alert |  |  |
| Unowned Items |  |  |

## 4. Risk Register

| Risk | Impact | Evidence | Suggested Action |
|---|---|---|---|
| Repeated expiry by same owner | Medium/High | item ids | targeted reminder |
| Missing owner mapping | Medium | row count | intake validation 강화 |
| Alert delivery failure | High | blocked reason | channel/user mapping fix |

## 5. Recommended Actions

- Action 1: `<what>` / Owner: `<who>` / Due: `<date>`
- Action 2: `<what>` / Owner: `<who>` / Due: `<date>`
- Action 3: `<what>` / Owner: `<who>` / Due: `<date>`
