# BusBD V2.3 — Passenger portal, driver PWA and live tracking

## Passenger experience

- Registration, passenger login, profile and emergency contact management
- Boarding and dropping point selection
- Adult/child passenger details per selected seat
- Women-reserved and blocked seat indicators
- Promo-code, mock-payment and signed QR confirmation
- Authenticated booking history, cancellation and refund status
- Ticket-token verification

## Driver PWA

The responsive driver workspace can be installed from a supported mobile browser. It provides assigned journeys, passenger manifests, start/end controls, phone GPS sharing, offline GPS queueing and incident reporting.

The demonstration driver account is `driver@busbd.local` with password `Driver123!`.

## Tracking security

Location ingestion requires a JWT with DRIVER, FLEET_MANAGER or SUPER_ADMIN role. A driver can only submit coordinates for the bus and trip assigned to the linked driver profile. Coordinates, speed and heading are validated before persistence.

## Live map

The passenger tracking page uses OpenStreetMap tiles through Leaflet and displays moving buses, route progress, next stop, GPS age, stale-location warnings, anomaly score and route-deviation warnings.

## Deployment validation

GitHub Actions must pass the TypeScript/Vite build, Spring Boot tests and complete Docker image before the release is merged to `main`.
