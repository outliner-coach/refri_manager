# Expiry Policy

## Scan Windows

| Window | Condition | Status |
|---|---|---|
| `24h` | `expiry_date <= now + 24h` and not expired | `upcoming` |
| `72h` | `expiry_date <= now + 72h` and not in `24h` | `upcoming` |
| `expired` | `expiry_date < now` | `expired` |

## Idempotency Key

- Format: `expiry:{item_id}:{status}:{window}:{yyyy-mm-dd}`
- Reuse key for retries of the same alert attempt.
- Do not send when the same key already has `sent=true`.

## Notification Channels

- Owner reminder: DM or designated team channel.
- Admin escalation: `#fridge-admin` or configured ops channel.

## Blocked Send Reasons

- `missing_slack_id`
- `invalid_channel`
- `no_owner_mapping`
- `duplicate_key_sent`
