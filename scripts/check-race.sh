#!/usr/bin/env bash
# Проверка защиты от race condition на POST /api/bookings.
# Ожидаемый результат: 1x201 (успех) и 4x409 (конфликт).
#
# Требования: curl, python3 (опционально), xargs.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SERVICE_ID="${SERVICE_ID:-1}"
DATE="${DATE:-$(date -d '+1 day' +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)}"
TIME="${TIME:-10:00}"
PARALLEL="${PARALLEL:-5}"

echo "▶ Проверка race condition"
echo "  URL:       $BASE_URL/api/bookings"
echo "  service_id=$SERVICE_ID, date=$DATE, start_time=$TIME"
echo "  параллельных запросов: $PARALLEL"
echo

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

seq 1 "$PARALLEL" | xargs -n1 -P"$PARALLEL" -I{} \
  bash -c "curl -s -o '$tmpdir/{}.body' -w '%{http_code}' \
    -X POST '$BASE_URL/api/bookings' \
    -H 'Content-Type: application/json' \
    -d '{\"service_id\":$SERVICE_ID,\"date\":\"$DATE\",\"start_time\":\"$TIME\",\"client_name\":\"Race#{} \",\"client_phone\":\"+9989012345{}\"}' \
    > '$tmpdir/{}.code'"

ok=0; conflict=0; other=0
for f in "$tmpdir"/*.code; do
  code="$(cat "$f")"
  case "$code" in
    201) ok=$((ok+1)) ;;
    409) conflict=$((conflict+1)) ;;
    *)   other=$((other+1)) ;;
  esac
done

echo
echo "─ Результат ─────────────────────────"
echo "  201 Created:   $ok"
echo "  409 Conflict:  $conflict"
echo "  прочее:        $other"
echo "─────────────────────────────────────"

if [ "$ok" -eq 1 ] && [ "$conflict" -eq $((PARALLEL - 1)) ]; then
  echo "✅ OK — race condition защищён корректно"
  exit 0
else
  echo "❌ FAIL — ожидалось 1×201 и $((PARALLEL - 1))×409"
  echo
  echo "Тела ответов:"
  for f in "$tmpdir"/*.body; do
    echo "  $f: $(cat "$f")"
  done
  exit 1
fi