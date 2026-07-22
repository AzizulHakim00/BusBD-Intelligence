import type { BookingView, DriverAssignment, Location, PassengerInput, Seat, Trip, User } from './types'

const tokenKey = 'busbd_token'
const passengerTokenKey = 'busbd_passenger_token'
const bookingEmailKey = 'busbd_last_booking_email'

export const token = () => localStorage.getItem(tokenKey) || localStorage.getItem(passengerTokenKey)
export const saveToken = (value: string | null) => value ? localStorage.setItem(tokenKey, value) : localStorage.removeItem(tokenKey)

const rememberBookingEmail = (email: string) => {
  const normalized = email.trim().toLowerCase()
  if (normalized) localStorage.setItem(bookingEmailKey, normalized)
  return normalized
}

const requestBookingEmail = () => {
  const remembered = localStorage.getItem(bookingEmailKey) || ''
  const entered = window.prompt('Enter the email used for this booking:', remembered)
  if (!entered?.trim()) throw new Error('The booking email is required to protect your ticket.')
  return rememberBookingEmail(entered)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token()) headers.set('Authorization', `Bearer ${token()}`)
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(body.error || body.message || response.statusText)
  }
  return response.status === 204 ? undefined as T : response.json()
}

export const api = {
  summary: () => request<Record<string, number | string>>('/api/public/summary'),
  trips: (origin = '', destination = '') => request<Trip[]>(`/api/public/trips?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`),
  seats: (tripId: string) => request<{ seats: Seat[]; seatCount: number; coachType: string; seatLayout: string; lockMinutes: number }>(`/api/trips/${tripId}/seats`),
  hold: (tripId: string, seats: string[], ownerEmail: string) => request<{ id: string; expiresAt: string }>('/api/seat-holds', { method: 'POST', body: JSON.stringify({ tripId, seats, ownerEmail }) }),
  book: (payload: { holdId: string; passengerName: string; passengerEmail: string; passengerPhone: string; paymentProvider: string; boardingPoint?: string; droppingPoint?: string; promoCode?: string; idempotencyKey?: string; passengers?: PassengerInput[] }) => {
    rememberBookingEmail(payload.passengerEmail)
    return request<BookingView>('/api/bookings', { method: 'POST', headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}, body: JSON.stringify(payload) })
  },
  booking: (reference: string) => {
    const email = requestBookingEmail()
    return request<BookingView>(`/api/bookings/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`)
  },
  myBookings: () => request<BookingView[]>('/api/bookings'),
  cancelBooking: (reference: string, reason = 'Passenger cancellation') => request<BookingView>(`/api/bookings/${reference}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  verifyTicket: (ticketToken: string) => request<Record<string, unknown>>('/api/tickets/verify', { method: 'POST', body: JSON.stringify({ token: ticketToken }) }),
  locations: () => request<Location[]>('/api/tracking/locations'),
  tripTracking: (tripId: string) => request<Record<string, unknown>>(`/api/tracking/trips/${tripId}`),
  complaint: (payload: object) => request('/api/complaints', { method: 'POST', body: JSON.stringify(payload) }),
  login: (email: string, password: string) => request<{ token: string; user: User; message?: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: { fullName: string; email: string; password: string; phone: string; preferredLanguage: string }) => request<{ token: string; user: User; message: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<User>('/api/auth/me'),
  updateProfile: (payload: Partial<User>) => request<User>('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) }),
  driverAssignments: () => request<DriverAssignment[]>('/api/driver/assignments'),
  startTrip: (tripId: string) => request<DriverAssignment>(`/api/driver/trips/${tripId}/start`, { method: 'POST' }),
  endTrip: (tripId: string) => request<DriverAssignment>(`/api/driver/trips/${tripId}/end`, { method: 'POST' }),
  driverLocation: (payload: { busId: string; tripId: string; latitude: number; longitude: number; speedKph: number; heading: number }) => request<Location>('/api/tracking/locations', { method: 'POST', body: JSON.stringify(payload) }),
  driverIncident: (payload: { tripId: string; category: string; message: string; severity: string }) => request('/api/driver/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  overview: () => request<Record<string, number>>('/api/operations/overview'),
  buses: () => request<any[]>('/api/operations/buses'),
  bookings: () => request<any[]>('/api/operations/bookings'),
  complaints: () => request<any[]>('/api/operations/complaints')
}
