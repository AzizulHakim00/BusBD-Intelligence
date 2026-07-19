# Main APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | JWT login |
| GET | `/api/public/summary` | Public network metrics |
| GET | `/api/public/trips` | Search scheduled trips |
| GET | `/api/trips/{id}/seats` | Graphical seat state |
| POST | `/api/seat-holds` | Five-minute temporary hold |
| POST | `/api/bookings` | Mock payment and booking confirmation |
| GET | `/api/bookings/{reference}` | Digital ticket and QR |
| POST | `/api/bookings/{reference}/cancel` | Cancel authenticated booking |
| GET | `/api/tracking/locations` | Latest vehicle locations |
| POST | `/api/tracking/locations` | Driver GPS update |
| GET | `/api/operations/overview` | Operations KPIs |
| POST | `/api/operations/buses` | Add bus |
| POST | `/api/operations/routes` | Add route |
| POST | `/api/operations/trips` | Schedule trip |
| POST | `/api/complaints` | Passenger support case |

Swagger UI is available at `/swagger-ui.html`.
