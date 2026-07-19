# V2.1 and V2.2 implementation

## Persistence

Flyway owns schema creation. Hibernate runs in `validate` mode. PostgreSQL stores users, trips, bookings, passengers, active seat reservations, refunds, complaints, audits and GPS history.

## Seat locking and double-booking protection

Redis-compatible Key Value keys use the pattern `busbd:seat:{tripId}:{seat}` with a five-minute TTL. Booking confirmation also inserts a row into `booking_seat_reservations`, protected by a unique `(trip_id, seat_number)` constraint. Redis improves user experience; PostgreSQL remains the final concurrency authority.

## Idempotency

Clients send an `Idempotency-Key` header when confirming a booking. Repeating the same confirmation returns the already-created booking instead of charging or reserving twice.

## Cancellation

- 24 hours or more before departure: 90% mock refund
- 6–24 hours before departure: 70% mock refund
- Less than 6 hours: online cancellation blocked

Cancellation deletes active seat reservations, restores availability and creates a refund audit record.

## Ticket verification

The QR code contains an HMAC-signed `BBDT` token. `/api/tickets/verify` validates its signature and checks the live booking/payment status.
