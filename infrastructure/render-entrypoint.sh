#!/bin/sh
set -u

PORT_VALUE="${PORT:-8080}"
HEALTH_URL="http://127.0.0.1:${PORT_VALUE}/actuator/health"
PRIMARY_ATTEMPTS="${DATABASE_PRIMARY_STARTUP_ATTEMPTS:-15}"
APP_PID=""

forward_signal() {
  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" 2>/dev/null; then
    kill -TERM "${APP_PID}" 2>/dev/null || true
  fi
}

trap forward_signal TERM INT

run_java_in_background() {
  # shellcheck disable=SC2086
  java ${JAVA_OPTS:-} -jar app.jar &
  APP_PID=$!
}

run_java_in_foreground() {
  # shellcheck disable=SC2086
  exec java ${JAVA_OPTS:-} -jar app.jar
}

postgres_profile_active=false
case ",${SPRING_PROFILES_ACTIVE:-}," in
  *,postgres,*) postgres_profile_active=true ;;
esac

# Existing manually-created Render services do not automatically inherit new
# render.yaml variables. Therefore fallback is ON by default for the postgres
# profile and can still be disabled explicitly with DATABASE_FALLBACK_ENABLED=false.
if [ "${DATABASE_FALLBACK_ENABLED:-true}" != "true" ] || [ "${postgres_profile_active}" != "true" ]; then
  run_java_in_foreground
fi

# Do not let long remote-database retries consume Render's deployment window.
export DB_CONNECT_RETRIES="${DATABASE_PRIMARY_CONNECT_RETRIES:-1}"
export DB_CONNECTION_TIMEOUT="${DATABASE_PRIMARY_CONNECTION_TIMEOUT:-5000}"

echo "BusBD startup: testing the configured PostgreSQL/Neon connection before accepting traffic."
run_java_in_background

attempt=1
while [ "${attempt}" -le "${PRIMARY_ATTEMPTS}" ]; do
  if wget -q -T 3 -O /tmp/busbd-primary-health.json "${HEALTH_URL}" 2>/dev/null \
      && grep -q '"status":"UP"' /tmp/busbd-primary-health.json; then
    echo "BusBD startup: PostgreSQL/Neon is healthy; continuing with the persistent database."
    wait "${APP_PID}"
    exit $?
  fi

  if ! kill -0 "${APP_PID}" 2>/dev/null; then
    wait "${APP_PID}" 2>/dev/null || true
    break
  fi

  sleep 2
  attempt=$((attempt + 1))
done

if kill -0 "${APP_PID}" 2>/dev/null; then
  echo "BusBD startup: PostgreSQL/Neon did not become healthy in time; stopping the primary startup."
  kill -TERM "${APP_PID}" 2>/dev/null || true
  wait "${APP_PID}" 2>/dev/null || true
fi

echo "BusBD startup: using the seeded in-memory demo database for this instance."
export SPRING_PROFILES_ACTIVE="render-fallback"
export DATABASE_URL="jdbc:h2:mem:busbd;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
export DATABASE_USERNAME="sa"
export DATABASE_PASSWORD=""
export DATABASE_DRIVER="org.h2.Driver"
export H2_CONSOLE_ENABLED="false"
export REDIS_HEALTH_ENABLED="false"
export DB_CONNECT_RETRIES="0"

run_java_in_foreground
