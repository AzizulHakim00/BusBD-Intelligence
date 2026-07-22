# BusBD Intelligence V3.0

BusBD Intelligence is a Spring Boot and React platform for searching, booking and tracking intercity bus journeys across Bangladesh.

## Current platform capabilities

- PostgreSQL persistence with Flyway migrations and H2 development fallback
- Redis-compatible seat locking, idempotent booking and advanced seat layouts
- Passenger registration, profiles, boarding/dropping points and passenger details
- Mock payment, signed QR ticket verification, cancellations and refunds
- Live GPS tracking, operational dashboards, support classification and production smoke tests
- Smart journey planner with fare, time, distance and carbon estimates
- Saved routes, recent plans and device-local journey watches
- Journey Guard with emergency contact storage, location capture, itinerary sharing, safety check-ins, SMS handoff and direct 999 calling
- Installable PWA shell with offline-safe startup while live booking and tracking APIs remain network-only

## Run locally

```bash
docker compose up --build
```

The Render Blueprint defines the web service, PostgreSQL database and Redis-compatible Key Value service.
