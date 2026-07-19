# BusBD Intelligence V2.2

V2.1 adds PostgreSQL, Flyway migrations, Render Key Value seat locking, persistent bookings, environment profiles and idempotency protection. V2.2 adds passenger registration and profiles, multiple boarding and dropping points, advanced seat layouts, passenger details, mock payment, signed QR verification, cancellation and refunds.

Run locally with `docker compose up --build`. The Render Blueprint defines the web service, PostgreSQL database and Redis-compatible Key Value service.
