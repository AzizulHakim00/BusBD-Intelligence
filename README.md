# BusBD Intelligence

AI-powered smart public transport and fleet operations platform for Bangladesh, implemented as a Spring Boot application with an operational dashboard, live vehicle simulation, route/trip records, basic recommendation scoring, health checks, Docker packaging and Render deployment configuration.

## Included

- Responsive operations dashboard
- OpenStreetMap/Leaflet live fleet view
- Fleet, route and trip REST APIs
- Seeded H2 demo database
- PostgreSQL runtime profile
- Rule-based journey recommendation endpoint ready for ML/OpenAI integration
- Spring Boot Actuator health endpoint
- Docker multi-stage build
- Render Blueprint (`render.yaml`)
- GitHub Actions Maven verification

## Run locally

Requirements: Java 21 and Maven 3.9+

```bash
mvn spring-boot:run
```

Open `http://localhost:8080`.

## API

```text
GET  /api/dashboard
GET  /api/buses
GET  /api/routes
GET  /api/trips
POST /api/recommendations
POST /api/simulation/tick
GET  /actuator/health
```

Recommendation example:

```bash
curl -X POST http://localhost:8080/api/recommendations \
  -H 'Content-Type: application/json' \
  -d '{"origin":"Dhaka","destination":"Chattogram","preference":"AC and low delay","passengerCount":1}'
```

## PostgreSQL

Activate the `postgres` profile and provide:

```text
SPRING_PROFILES_ACTIVE=postgres
SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:5432/DATABASE
SPRING_DATASOURCE_USERNAME=USERNAME
SPRING_DATASOURCE_PASSWORD=PASSWORD
```

## Deploy on Render

The repository contains a `Dockerfile` and `render.yaml`. In Render, create a Blueprint from this GitHub repository. Render builds the Java application with Docker and monitors `/actuator/health`.

## Important scope note

This repository is an enterprise-style working demo/MVP. The AI endpoint currently uses transparent business scoring, not a trained production model. Payment gateways, authenticated roles, WebSocket GPS ingestion, OpenAI credentials and production ML services should be added as separate secured integrations.
