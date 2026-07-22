# BusBD Intelligence V3.1

BusBD Intelligence is a Spring Boot and React platform for searching, booking and tracking intercity bus journeys across Bangladesh.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AzizulHakim00/BusBD-Intelligence)

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

## Render deployment

The root `render.yaml` is self-contained. A single Blueprint deployment creates:

- the Docker web service in the Singapore region
- a free Render PostgreSQL database
- a free Redis-compatible Key Value service
- generated JWT and ticket-signing secrets
- automatic deployment from the `main` branch
- readiness health checks and an H2 fallback if PostgreSQL is temporarily unavailable

Use the **Deploy to Render** button above and approve the Blueprint in the Render account that should own the service. No database URL or application secret needs to be entered manually.

## Run locally

```bash
docker compose up --build
```
