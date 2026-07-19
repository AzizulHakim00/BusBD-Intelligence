# BusBD Intelligence

Enterprise-style bus booking, fleet operations and live tracking platform for Bangladesh. The repository contains a clean editable React frontend, a Java 21 Spring Boot backend, PostgreSQL/PostGIS/pgvector infrastructure, Redis-compatible seat locking, WebSocket GPS updates and a FastAPI ML service.

## Current runnable release

- JWT authentication with six seeded roles
- Passenger trip search and comparison
- Graphical seat selection
- Five-minute seat locks with Redis fallback
- Mock payment, booking confirmation and cancellation
- QR digital tickets
- Operators, counters, buses, drivers, routes and trip schedules
- GPS simulator and live location endpoint
- WebSocket topic at `/topic/locations`
- Passenger, support and operations interfaces
- Complaint classification baseline
- Audit records
- Swagger/OpenAPI and Actuator health
- Bangla/English interface toggle
- FastAPI ETA, demand, delay, anomaly and recommendation baselines
- Docker Compose and Render deployment

## Repository structure

```text
backend/          Spring Boot API and domain model
frontend/         React + TypeScript web application
ml-service/       FastAPI prediction service
database/         PostGIS + pgvector image and initialization
documentation/    Architecture, APIs and demonstration guide
Dockerfile        Single-service Render production build
docker-compose.yml Full local topology
render.yaml       Automatic Render deployment blueprint
```

## One-command local run

Requirements: Docker Desktop.

```bash
docker compose up --build
```

Open:

- Application: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger-ui.html`
- ML API: `http://localhost:8000/docs`

## Demonstration accounts

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@busbd.local` | `Admin123!` |
| Operator staff | `operator@busbd.local` | `Operator123!` |
| Fleet manager | `fleet@busbd.local` | `Fleet123!` |
| Driver | `driver@busbd.local` | `Driver123!` |
| Passenger | `passenger@busbd.local` | `Passenger123!` |
| Support agent | `support@busbd.local` | `Support123!` |

These are demo credentials only. Change the JWT secret and remove seeded passwords before production use.

## Render deployment

The root Dockerfile compiles the React application, embeds it in Spring Boot and starts one web service. `render.yaml` enables deployment on every commit. The existing Render service can run in H2 demo mode immediately. For managed PostgreSQL and Redis, configure the variables in `.env.example`.

## Scope

This is a strong academic/enterprise MVP, not a production national ticketing network. Real bKash/Nagad/SSLCommerz payments, device GPS ingestion, production ML training, OpenAI credentials, SMS gateways and regulated operational controls require external accounts, real datasets and security review.
