#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"
WORK_DIR="$(mktemp -d)"
PROGRESS_LOG="${BUSBD_SMOKE_PROGRESS_LOG:-/tmp/busbd-smoke-progress.log}"
: > "$PROGRESS_LOG"
exec > >(tee -a "$PROGRESS_LOG") 2>&1

cleanup() { rm -rf "$WORK_DIR"; }
on_error() {
  local status=$?
  echo "[BusBD smoke] FAILED at line ${BASH_LINENO[0]} with status ${status}"
  echo "[BusBD smoke] temporary response files:"
  find "$WORK_DIR" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT
trap on_error ERR

log() { printf '\n[BusBD smoke] %s\n' "$1"; }
json_post() {
  local url="$1"
  local payload="$2"
  shift 2
  curl --fail --silent --show-error -H 'Content-Type: application/json' "$@" -d "$payload" "$url"
}

log "waiting for the complete application"
for attempt in $(seq 1 90); do
  if curl --fail --silent "$BASE_URL/actuator/health" | grep -q '"status":"UP"'; then
    break
  fi
  if [ "$attempt" -eq 90 ]; then
    echo "Application did not become healthy." >&2
    exit 1
  fi
  sleep 2
done

log "verifying the HAR frontend and JavaScript bundle"
curl --fail --silent --show-error "$BASE_URL/" -o "$WORK_DIR/index.html"
grep -q 'functional-har-design' "$WORK_DIR/index.html"
JS_PATH="$(grep -oE 'src="/assets/[^"]+\.js"' "$WORK_DIR/index.html" | head -n1 | cut -d'"' -f2)"
test -n "$JS_PATH"
curl --fail --silent --show-error "$BASE_URL$JS_PATH" -o "$WORK_DIR/app.js"
test -s "$WORK_DIR/app.js"

log "checking public summary, trips, seats and GPS"
curl --fail --silent --show-error "$BASE_URL/api/public/summary" -o "$WORK_DIR/summary.json"
jq -e 'type == "object" and (.buses | tonumber) >= 1' "$WORK_DIR/summary.json" >/dev/null
curl --fail --silent --show-error "$BASE_URL/api/public/trips?origin=Dhaka&destination=Chattogram" -o "$WORK_DIR/trips.json"
TRIP_ID="$(jq -r '.[0].id // empty' "$WORK_DIR/trips.json")"
test -n "$TRIP_ID"
curl --fail --silent --show-error "$BASE_URL/api/trips/$TRIP_ID/seats" -o "$WORK_DIR/seats.json"
SEAT="$(jq -r '.seats[] | select(.status == "AVAILABLE") | .number' "$WORK_DIR/seats.json" | head -n1)"
test -n "$SEAT"
curl --fail --silent --show-error "$BASE_URL/api/tracking/locations" -o "$WORK_DIR/locations.json"
jq -e 'type == "array"' "$WORK_DIR/locations.json" >/dev/null

STAMP="$(date +%s)-$RANDOM"
EMAIL="smoke-$STAMP@busbd.local"
PASSWORD='SmokePass123!'

log "registering a passenger and verifying profile APIs"
REGISTER_PAYLOAD="$(jq -nc --arg name 'Smoke Passenger' --arg email "$EMAIL" --arg password "$PASSWORD" --arg phone '+8801700000000' '{fullName:$name,email:$email,password:$password,phone:$phone,preferredLanguage:"EN"}')"
json_post "$BASE_URL/api/auth/register" "$REGISTER_PAYLOAD" -o "$WORK_DIR/register.json"
PASSENGER_TOKEN="$(jq -r '.token // empty' "$WORK_DIR/register.json")"
test -n "$PASSENGER_TOKEN"
curl --fail --silent --show-error -H "Authorization: Bearer $PASSENGER_TOKEN" "$BASE_URL/api/auth/me" -o "$WORK_DIR/profile.json"
jq -e --arg email "$EMAIL" '.email == $email' "$WORK_DIR/profile.json" >/dev/null
PROFILE_PAYLOAD='{"fullName":"Smoke Passenger Updated","phone":"+8801700000001","emergencyContact":"+8801800000000","preferredLanguage":"BN"}'
curl --fail --silent --show-error -X PUT -H 'Content-Type: application/json' -H "Authorization: Bearer $PASSENGER_TOKEN" -d "$PROFILE_PAYLOAD" "$BASE_URL/api/auth/me" -o "$WORK_DIR/profile-updated.json"
jq -e '.name == "Smoke Passenger Updated"' "$WORK_DIR/profile-updated.json" >/dev/null

log "holding a seat and completing a mock payment booking"
HOLD_PAYLOAD="$(jq -nc --arg trip "$TRIP_ID" --arg seat "$SEAT" --arg email "$EMAIL" '{tripId:$trip,seats:[$seat],ownerEmail:$email}')"
json_post "$BASE_URL/api/seat-holds" "$HOLD_PAYLOAD" -o "$WORK_DIR/hold.json"
HOLD_ID="$(jq -r '.id // empty' "$WORK_DIR/hold.json")"
test -n "$HOLD_ID"
BOOK_PAYLOAD="$(jq -nc --arg hold "$HOLD_ID" --arg email "$EMAIL" '{holdId:$hold,passengerName:"Smoke Passenger Updated",passengerEmail:$email,passengerPhone:"+8801700000001",paymentProvider:"MOCK"}')"
IDEMPOTENCY="smoke-booking-$STAMP"
json_post "$BASE_URL/api/bookings" "$BOOK_PAYLOAD" -H "Idempotency-Key: $IDEMPOTENCY" -o "$WORK_DIR/booking.json"
REFERENCE="$(jq -r '.reference // empty' "$WORK_DIR/booking.json")"
TICKET_TOKEN="$(jq -r '.ticketToken // empty' "$WORK_DIR/booking.json")"
test -n "$REFERENCE"
test -n "$TICKET_TOKEN"
curl --fail --silent --show-error "$BASE_URL/api/bookings/$REFERENCE" -o "$WORK_DIR/booking-read.json"
jq -e --arg reference "$REFERENCE" '.reference == $reference and .status == "CONFIRMED"' "$WORK_DIR/booking-read.json" >/dev/null
curl --fail --silent --show-error -H "Authorization: Bearer $PASSENGER_TOKEN" "$BASE_URL/api/bookings" -o "$WORK_DIR/my-bookings.json"
jq -e --arg reference "$REFERENCE" 'map(.reference) | index($reference) != null' "$WORK_DIR/my-bookings.json" >/dev/null

log "verifying the QR ticket and cancellation flow"
VERIFY_PAYLOAD="$(jq -nc --arg token "$TICKET_TOKEN" '{token:$token}')"
json_post "$BASE_URL/api/tickets/verify" "$VERIFY_PAYLOAD" -o "$WORK_DIR/ticket-verify.json"
jq -e '.valid == true and .travelAllowed == true' "$WORK_DIR/ticket-verify.json" >/dev/null
curl --fail --silent --show-error -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $PASSENGER_TOKEN" -d '{"reason":"Automated deployment verification"}' "$BASE_URL/api/bookings/$REFERENCE/cancel" -o "$WORK_DIR/cancelled.json"
jq -e '.status == "CANCELLED"' "$WORK_DIR/cancelled.json" >/dev/null

log "submitting and classifying passenger support"
COMPLAINT_PAYLOAD="$(jq -nc --arg email "$EMAIL" '{email:$email,category:"Refund",message:"Please check the refund for my smoke test booking"}')"
json_post "$BASE_URL/api/complaints" "$COMPLAINT_PAYLOAD" -o "$WORK_DIR/complaint.json"
jq -e '.aiClassification == "REFUND"' "$WORK_DIR/complaint.json" >/dev/null

log "checking secure operations with the seeded administrator"
ADMIN_LOGIN='{"email":"admin@busbd.local","password":"Admin123!"}'
json_post "$BASE_URL/api/auth/login" "$ADMIN_LOGIN" -o "$WORK_DIR/admin-login.json"
ADMIN_TOKEN="$(jq -r '.token // empty' "$WORK_DIR/admin-login.json")"
test -n "$ADMIN_TOKEN"
curl --fail --silent --show-error -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/operations/overview" -o "$WORK_DIR/operations.json"
jq -e 'type == "object" and has("trips") and has("buses")' "$WORK_DIR/operations.json" >/dev/null

log "all frontend and backend workflows passed"
printf 'Trip: %s\nSeat: %s\nBooking: %s\n' "$TRIP_ID" "$SEAT" "$REFERENCE"
