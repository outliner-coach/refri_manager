# Intake Checklist

## Required Fields

| Field | Rule | Error Code |
|---|---|---|
| `department` | non-empty, predefined department set | `INTAKE_DEPARTMENT_MISSING` |
| `owner_name` | non-empty string, 2+ chars | `INTAKE_OWNER_MISSING` |
| `food_name` | non-empty normalized label | `INTAKE_FOOD_MISSING` |
| `expiry_date` | ISO `YYYY-MM-DD` | `INTAKE_EXPIRY_INVALID` |
| `photo_url` | accessible image URL/path | `INTAKE_PHOTO_MISSING` |

## Duplicate Heuristic

- Key: `department + owner_name + food_name + registration_date(YYYY-MM-DD)`
- Mark as `duplicate_candidate=true` when key matches and photo hash similarity is high.

## Severity Policy

- `high`: missing owner or invalid expiry
- `medium`: missing department or duplicate candidate
- `low`: formatting inconsistency only

## Recommended Next Actions

- `request_owner_confirmation`
- `request_expiry_correction`
- `merge_duplicate_records`
- `approve_and_publish`
