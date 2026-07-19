import type { Location, Seat, Trip, User } from './types'

const tokenKey = 'busbd_token'
export const token = () => localStorage.getItem(tokenKey)
export const saveToken = (value: string | null) => value ? localStorage.setItem(tokenKey, value) : localStorage.removeItem(tokenKey)

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token()) headers.set('Authorization', `Bearer ${token()}`)
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(body.error || body.message || response.statusText)
  }
  return response.json()
}

export const api = {
  summary: () => request<Record<string, number | string>>('/api/public/summary'),
  trips: (origin = '', destination = '') => request<Trip[]>(`/api/public/trips?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`),
  seats: (tripId: string) => request<{ seats: Seat[]; seatCount: number; coachType: string }>(`/api/trips/${tripId}/seats`),
  hold: (tripId: string, seats: string[], ownerEmail: string) => request<{ id: string; expiresAt: string }>('/api/seat-holds', { method: 'POST', body: JSON.stringify({ tripId, seats, ownerEmail }) }),
  book: (payload: object) => request<Record<string, any>>('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  booking: (reference: string) => request<Record<string, any>>(`/api/bookings/${reference}`),
  cancelBooking: (reference: string) => request<Record<string, any>>(`/api/bookings/${reference}/cancel`, { method: 'POST' }),
  locations: () => request<Location[]>('/api/tracking/locations'),
  complaint: (payload: object) => request('/api/complaints', { method: 'POST', body: JSON.stringify(payload) }),
  login: (email: string, password: string) => request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/api/auth/me'),
  overview: () => request<Record<string, number>>('/api/operations/overview'),
  buses: () => request<any[]>('/api/operations/buses'),
  bookings: () => request<any[]>('/api/operations/bookings'),
  complaints: () => request<any[]>('/api/operations/complaints')
}
