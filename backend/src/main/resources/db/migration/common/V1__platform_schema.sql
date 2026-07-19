CREATE TABLE app_users (
  id UUID PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone VARCHAR(40),
  emergency_contact VARCHAR(80),
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'EN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX idx_user_email ON app_users(email);

CREATE TABLE transport_operators (
  id UUID PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE,
  code VARCHAR(40), phone VARCHAR(60), email VARCHAR(160),
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE counters (
  id UUID PRIMARY KEY,
  operator_id UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  district VARCHAR(120) NOT NULL,
  address VARCHAR(500), phone VARCHAR(60),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY,
  operator_id UUID NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  license_number VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(60), active BOOLEAN NOT NULL DEFAULT TRUE,
  safety_score DOUBLE PRECISION NOT NULL DEFAULT 4.7
);

CREATE TABLE buses (
  id UUID PRIMARY KEY,
  operator_id UUID NOT NULL,
  registration_number VARCHAR(120) NOT NULL UNIQUE,
  model VARCHAR(160) NOT NULL,
  coach_type VARCHAR(100) NOT NULL,
  seat_count INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  amenities VARCHAR(1000),
  health_score DOUBLE PRECISION NOT NULL DEFAULT 92.0,
  seat_layout VARCHAR(30) NOT NULL DEFAULT '2X2',
  women_reserved_seats VARCHAR(300),
  blocked_seats VARCHAR(300)
);

CREATE TABLE routes (
  id UUID PRIMARY KEY,
  origin VARCHAR(140) NOT NULL,
  destination VARCHAR(140) NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  stops_csv VARCHAR(1200),
  boarding_points_csv VARCHAR(1200),
  dropping_points_csv VARCHAR(1200),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE trips (
  id UUID PRIMARY KEY,
  bus_id UUID NOT NULL,
  route_id UUID NOT NULL,
  driver_id UUID,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
  fare NUMERIC(10,2) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'SCHEDULED',
  boarding_point VARCHAR(180),
  dropping_point VARCHAR(180),
  available_seats INTEGER NOT NULL,
  delay_risk DOUBLE PRECISION NOT NULL DEFAULT 0.12
);
CREATE INDEX idx_trip_departure ON trips(departure_time);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE,
  trip_id UUID NOT NULL,
  user_id UUID,
  passenger_name VARCHAR(180) NOT NULL,
  passenger_email VARCHAR(180) NOT NULL,
  passenger_phone VARCHAR(60),
  seat_numbers VARCHAR(300) NOT NULL,
  boarding_point VARCHAR(180) NOT NULL,
  dropping_point VARCHAR(180) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  promo_code VARCHAR(40),
  status VARCHAR(40) NOT NULL,
  payment_status VARCHAR(40) NOT NULL,
  payment_provider VARCHAR(40),
  payment_reference VARCHAR(120),
  idempotency_key VARCHAR(120) UNIQUE,
  qr_payload VARCHAR(1000),
  cancellation_reason VARCHAR(500),
  refund_status VARCHAR(40) NOT NULL DEFAULT 'NOT_REQUESTED',
  refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX idx_booking_reference ON bookings(reference);
CREATE INDEX idx_booking_email ON bookings(passenger_email);
CREATE INDEX idx_booking_trip ON bookings(trip_id);

CREATE TABLE booking_passengers (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  passenger_type VARCHAR(30) NOT NULL,
  gender VARCHAR(20),
  seat_number VARCHAR(20) NOT NULL,
  phone VARCHAR(60)
);
CREATE INDEX idx_booking_passenger_booking ON booking_passengers(booking_id);

CREATE TABLE booking_seat_reservations (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  trip_id UUID NOT NULL,
  seat_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT uq_trip_seat UNIQUE(trip_id, seat_number)
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(40) NOT NULL,
  reason VARCHAR(500),
  provider_reference VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  passenger_email VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  message VARCHAR(2500) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  ai_classification VARCHAR(160),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor VARCHAR(180), action VARCHAR(120), resource_type VARCHAR(120), resource_id VARCHAR(180),
  details VARCHAR(2000), created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE vehicle_locations (
  id UUID PRIMARY KEY,
  bus_id UUID NOT NULL,
  trip_id UUID,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kph DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION NOT NULL,
  anomaly_score DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_vehicle_location_bus_time ON vehicle_locations(bus_id, recorded_at);
