#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/docker-compose.yml"
API_BASE="${API_BASE:-http://localhost:4000}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
if [ -d "/Applications/Docker.app/Contents/Resources/bin" ]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi


if ! command -v "$DOCKER_BIN" >/dev/null 2>&1; then
  if [ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
    DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
  else
    echo "[smoke] docker binary not found. Set DOCKER_BIN or add docker to PATH."
    exit 1
  fi
fi

MEMBER_ID="11111111-1111-1111-1111-111111111111"
EMPLOYEE_NO="E1001"
EMAIL="e1001@example.com"
EXPIRY_DATE="$(node -e "const d=new Date(); d.setDate(d.getDate()+30); console.log(d.toISOString().slice(0,10));")"

printf "[smoke] waiting for api...\n"
for i in {1..60}; do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

printf "[smoke] upserting seed member...\n"
"$DOCKER_BIN" compose -f "$COMPOSE_FILE" exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot refri_manager -e "
INSERT INTO members (id, employee_no, name, department, email, status, synced_at)
VALUES ('$MEMBER_ID', '$EMPLOYEE_NO', '홍길동', '플랫폼', '$EMAIL', 'ACTIVE', NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), department=VALUES(department), email=VALUES(email), status='ACTIVE', synced_at=NOW();"

printf "[smoke] employee lookup...\n"
LOOKUP_RESP="$(curl -fsS -X POST "$API_BASE/v1/auth/employee-lookup" -H 'content-type: application/json' -d "{\"employeeNo\":\"$EMPLOYEE_NO\"}")"
echo "$LOOKUP_RESP" | grep -q "$EMPLOYEE_NO"

printf "[smoke] create food...\n"
CREATE_RESP="$(curl -fsS -X POST "$API_BASE/v1/foods" \
  -H 'content-type: application/json' \
  -H "x-employee-no: $EMPLOYEE_NO" \
  -d "{\"memberId\":\"$MEMBER_ID\",\"foodName\":\"샌드위치\",\"expiryDate\":\"$EXPIRY_DATE\",\"photoObjectKey\":\"photo/test.jpg\"}")"
echo "$CREATE_RESP" | grep -q "foodItemId"

printf "[smoke] list my foods...\n"
LIST_RESP="$(curl -fsS "$API_BASE/v1/foods/me" -H "x-employee-no: $EMPLOYEE_NO")"
echo "$LIST_RESP" | grep -q "샌드위치"

printf "[smoke] PASS\n"
