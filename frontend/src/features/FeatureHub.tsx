import { FormEvent, useEffect, useMemo, useState } from 'react'
import './feature-hub.css'

type HubTab = 'compare' | 'account' | 'verify' | 'driver'
type AuthMode = 'login' | 'register'
type SortMode = 'recommended' | 'cheapest' | 'fastest' | 'seats' | 'reliable'

type TripLite = {
  id: string
  busId: string
  operator: string
  bus: string
  registrationNumber?: string
  coachType: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  fare: number
  availableSeats: number
  delayRisk: number
  status: string
}

type PassengerUser = {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  emergencyContact?: string
  preferredLanguage?: string
  emailVerified?: boolean
}

type BookingLite = {
  reference: string
  tripId: string
  passengerName: string
  passengerEmail: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  seats: string[]
  totalAmount: number
  status: string
  paymentStatus: string
  refundStatus?: string
  refundAmount?: number
  ticketToken?: string
}

type DriverAssignment = {
  tripId: string
  busId: string
  status: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  operator: string
  bus: string
  registrationNumber: string
  passengerCount: number
  bookedSeats: number
}

type VerifyResult = {
  valid?: boolean
  travelAllowed?: boolean
  reference?: string
  passengerName?: string
  bookingStatus?: string
  boardingPoint?: string
  droppingPoint?: string
  reason?: string
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const cities = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', "Cox's Bazar"]
const passengerTokenKey = 'busbd_passenger_token'
const driverTokenKey = 'busbd_driver_token'

const money = (value: number | string) => `৳${Number(value || 0).toLocaleString('en-BD')}`
const durationMinutes = (start: string, end: string) => Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
const durationLabel = (start: string, end: string) => {
  const minutes = durationMinutes(start, end)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dateLabel = (value: string) => new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })

async function request<T>(path: string, init: RequestInit = {}, authToken?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(body.error || body.message || response.statusText || `Request failed (${response.status})`)
  }
  return response.status === 204 ? undefined as T : response.json()
}

const nativeValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('change', { bubbles: true }))
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function applyRouteToSearch(origin: string, destination: string) {
  const form = document.querySelector<HTMLFormElement>('.search-panel')
  const selects = form?.querySelectorAll<HTMLSelectElement>('select')
  if (!form || !selects || selects.length < 2) return false
  nativeValue(selects[0], origin)
  nativeValue(selects[1], destination)
  form.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => form.requestSubmit(), 250)
  return true
}

export default function FeatureHub() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<HubTab>('compare')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const install = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const keyboard = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('keydown', keyboard)
    return () => {
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('keydown', keyboard)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('feature-hub-open', open)
    return () => document.body.classList.remove('feature-hub-open')
  }, [open])

  const notify = (text: string, tone: 'normal' | 'error' = 'normal') => {
    setMessage(tone === 'normal' ? text : '')
    setError(tone === 'error' ? text : '')
    window.setTimeout(() => {
      setMessage(current => current === text ? '' : current)
      setError(current => current === text ? '' : current)
    }, 4800)
  }

  const installApp = async () => {
    if (!installPrompt) return notify('Install is available from your browser menu on this device.', 'error')
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') notify('BusBD was added to your device.')
    setInstallPrompt(null)
  }

  return <>
    <div className="feature-dock" aria-label="BusBD feature shortcuts">
      <button className="feature-dock-main" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="busbd-feature-hub">
        <span>◎</span><b>Feature hub</b><i />
      </button>
      <button onClick={() => { setTab('compare'); setOpen(true) }} title="Compare live trips">⇄</button>
      <button onClick={() => { setTab('account'); setOpen(true) }} title="Passenger account">♙</button>
      <button onClick={() => { setTab('verify'); setOpen(true) }} title="Verify ticket">▣</button>
    </div>

    {open && <div className="feature-hub-backdrop" onMouseDown={event => event.currentTarget === event.target && setOpen(false)}>
      <section className="feature-hub" id="busbd-feature-hub" role="dialog" aria-modal="true" aria-label="BusBD feature hub">
        <header className="feature-hub-head">
          <div><span className="feature-hub-kicker"><i /> Connected services</span><h2>One place for every journey.</h2><p>Compare, manage, verify and operate using the real BusBD APIs.</p></div>
          <div className="feature-hub-head-actions"><button onClick={installApp}>＋ Install app</button><button className="feature-hub-close" onClick={() => setOpen(false)}>×</button></div>
        </header>

        <nav className="feature-hub-tabs" aria-label="Feature hub sections">
          <button className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>Smart compare</button>
          <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>Passenger account</button>
          <button className={tab === 'verify' ? 'active' : ''} onClick={() => setTab('verify')}>Ticket verifier</button>
          <button className={tab === 'driver' ? 'active' : ''} onClick={() => setTab('driver')}>Driver workspace</button>
        </nav>

        <div className="feature-hub-content">
          {message && <div className="hub-message">✓ {message}</div>}
          {error && <div className="hub-message error">! {error}</div>}
          {tab === 'compare' && <ComparePanel notify={notify} close={() => setOpen(false)} />}
          {tab === 'account' && <PassengerAccount notify={notify} />}
          {tab === 'verify' && <TicketVerifier notify={notify} />}
          {tab === 'driver' && <DriverWorkspace notify={notify} />}
        </div>
      </section>
    </div>}
  </>
}

function ComparePanel({ notify, close }: { notify: (text: string, tone?: 'normal' | 'error') => void; close: () => void }) {
  const [origin, setOrigin] = useState('Dhaka')
  const [destination, setDestination] = useState('Chattogram')
  const [sort, setSort] = useState<SortMode>('recommended')
  const [trips, setTrips] = useState<TripLite[]>([])
  const [loading, setLoading] = useState(false)

  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    if (origin === destination) return notify('Choose two different cities.', 'error')
    setLoading(true)
    try {
      const data = await request<TripLite[]>(`/api/public/trips?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`)
      setTrips(data)
      if (!data.length) notify('No live departures were found for this route.', 'error')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { search() }, [])

  const sorted = useMemo(() => [...trips].sort((a, b) => {
    if (sort === 'cheapest') return Number(a.fare) - Number(b.fare)
    if (sort === 'fastest') return durationMinutes(a.departureTime, a.arrivalTime) - durationMinutes(b.departureTime, b.arrivalTime)
    if (sort === 'seats') return b.availableSeats - a.availableSeats
    if (sort === 'reliable') return a.delayRisk - b.delayRisk
    const aScore = Number(a.fare) / 100 + durationMinutes(a.departureTime, a.arrivalTime) / 30 + a.delayRisk * 100 - a.availableSeats / 5
    const bScore = Number(b.fare) / 100 + durationMinutes(b.departureTime, b.arrivalTime) / 30 + b.delayRisk * 100 - b.availableSeats / 5
    return aScore - bScore
  }), [trips, sort])

  const choose = (trip: TripLite) => {
    const applied = applyRouteToSearch(trip.origin, trip.destination)
    if (applied) {
      notify(`${trip.origin} to ${trip.destination} opened in live search.`)
      close()
    } else {
      notify('Return to Search and apply the route again.', 'error')
    }
  }

  return <div className="hub-panel">
    <div className="hub-panel-title"><div><span>Live inventory</span><h3>Compare real departures</h3><p>Rank scheduled buses by fare, duration, seats and delay risk.</p></div><span className="hub-live-badge"><i /> API live</span></div>
    <form className="compare-form" onSubmit={search}>
      <label>From<select value={origin} onChange={event => setOrigin(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
      <button type="button" className="compare-swap" onClick={() => { setOrigin(destination); setDestination(origin) }}>⇄</button>
      <label>To<select value={destination} onChange={event => setDestination(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
      <label>Rank by<select value={sort} onChange={event => setSort(event.target.value as SortMode)}><option value="recommended">Recommended</option><option value="cheapest">Lowest fare</option><option value="fastest">Shortest time</option><option value="seats">Most seats</option><option value="reliable">Lowest delay risk</option></select></label>
      <button className="hub-primary" disabled={loading}>{loading ? 'Comparing…' : 'Compare trips →'}</button>
    </form>
    <div className="compare-results">
      {sorted.map((trip, index) => <article className="compare-trip" key={trip.id}>
        <span className="compare-rank">#{index + 1}</span>
        <div className="compare-operator"><b>{trip.operator}</b><span>{trip.bus} · {trip.coachType}</span></div>
        <div className="compare-times"><strong>{timeLabel(trip.departureTime)}</strong><span>{durationLabel(trip.departureTime, trip.arrivalTime)}</span><strong>{timeLabel(trip.arrivalTime)}</strong></div>
        <div className="compare-signals"><span>{trip.availableSeats} seats</span><span className={trip.delayRisk <= .2 ? 'safe' : 'watch'}>{Math.round(trip.delayRisk * 100)}% risk</span></div>
        <div className="compare-price"><strong>{money(trip.fare)}</strong><button onClick={() => choose(trip)}>Choose →</button></div>
      </article>)}
      {!loading && !sorted.length && <div className="hub-empty">Search a route to compare live departures.</div>}
    </div>
  </div>
}

function PassengerAccount({ notify }: { notify: (text: string, tone?: 'normal' | 'error') => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(passengerTokenKey) || '')
  const [user, setUser] = useState<PassengerUser | null>(null)
  const [bookings, setBookings] = useState<BookingLite[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('EN')

  const loadAccount = async (tokenValue = authToken) => {
    if (!tokenValue) return
    setLoading(true)
    try {
      const [profile, wallet] = await Promise.all([
        request<PassengerUser>('/api/auth/me', {}, tokenValue),
        request<BookingLite[]>('/api/bookings', {}, tokenValue)
      ])
      if (profile.role !== 'PASSENGER') throw new Error('Use a passenger account in this section.')
      setUser(profile)
      setName(profile.name || '')
      setEmail(profile.email || '')
      setPhone(profile.phone || '')
      setEmergencyContact(profile.emergencyContact || '')
      setPreferredLanguage(profile.preferredLanguage || 'EN')
      setBookings(wallet)
    } catch (cause) {
      localStorage.removeItem(passengerTokenKey)
      setAuthToken('')
      setUser(null)
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (authToken) loadAccount(authToken) }, [])

  const authenticate = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const result = authMode === 'register'
        ? await request<{ token: string; user: PassengerUser; message: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ fullName: name, email, password, phone, preferredLanguage }) })
        : await request<{ token: string; user: PassengerUser; message?: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (result.user.role !== 'PASSENGER') throw new Error('This workspace is for passenger accounts.')
      localStorage.setItem(passengerTokenKey, result.token)
      setAuthToken(result.token)
      setUser(result.user)
      setPassword('')
      await loadAccount(result.token)
      notify(result.message || 'Passenger account connected.')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const updated = await request<PassengerUser>('/api/auth/me', { method: 'PUT', body: JSON.stringify({ fullName: name, phone, emergencyContact, preferredLanguage }) }, authToken)
      setUser(updated)
      notify('Passenger profile updated.')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async (reference: string) => {
    if (!window.confirm(`Cancel booking ${reference}?`)) return
    setLoading(true)
    try {
      const updated = await request<BookingLite>(`/api/bookings/${reference}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Passenger account cancellation' }) }, authToken)
      setBookings(current => current.map(item => item.reference === reference ? updated : item))
      notify(`Booking ${reference} cancelled. Refund status updated.`)
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(passengerTokenKey)
    setAuthToken('')
    setUser(null)
    setBookings([])
    setPassword('')
    notify('Passenger account signed out.')
  }

  if (!user) return <div className="hub-panel account-auth">
    <div className="hub-panel-title"><div><span>Passenger identity</span><h3>{authMode === 'login' ? 'Open your journey wallet' : 'Create a passenger account'}</h3><p>Use a verified account to manage profiles, tickets, cancellations and refunds.</p></div></div>
    <div className="auth-mode-switch"><button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Sign in</button><button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Register</button></div>
    <form className="hub-form" onSubmit={authenticate}>
      {authMode === 'register' && <label>Full name<input required value={name} onChange={event => setName(event.target.value)} /></label>}
      <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
      {authMode === 'register' && <><label>Phone<input value={phone} onChange={event => setPhone(event.target.value)} /></label><label>Language<select value={preferredLanguage} onChange={event => setPreferredLanguage(event.target.value)}><option value="EN">English</option><option value="BN">বাংলা</option></select></label></>}
      <button className="hub-primary" disabled={loading}>{loading ? 'Connecting…' : authMode === 'login' ? 'Sign in →' : 'Create account →'}</button>
    </form>
  </div>

  return <div className="hub-panel">
    <div className="account-summary"><div className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><span>Passenger account</span><h3>{user.name}</h3><p>{user.email} · {user.emailVerified ? 'Verified' : 'Verification pending'}</p></div><button onClick={logout}>Sign out</button></div>
    <div className="account-grid">
      <form className="hub-form account-profile" onSubmit={updateProfile}>
        <div className="hub-panel-title compact"><div><span>Profile</span><h3>Travel details</h3></div></div>
        <label>Full name<input required value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Phone<input value={phone} onChange={event => setPhone(event.target.value)} /></label>
        <label>Emergency contact<input value={emergencyContact} onChange={event => setEmergencyContact(event.target.value)} /></label>
        <label>Preferred language<select value={preferredLanguage} onChange={event => setPreferredLanguage(event.target.value)}><option value="EN">English</option><option value="BN">বাংলা</option></select></label>
        <button className="hub-primary" disabled={loading}>Save profile →</button>
      </form>
      <section className="account-wallet">
        <div className="hub-panel-title compact"><div><span>Digital wallet</span><h3>My bookings</h3></div><button className="hub-text-button" onClick={() => loadAccount()}>Refresh</button></div>
        <div className="wallet-list">
          {bookings.map(booking => <article className="wallet-ticket" key={booking.reference}>
            <div><span>{booking.status}</span><strong>{booking.origin} → {booking.destination}</strong><p>{dateLabel(booking.departureTime)} · Seats {booking.seats.join(', ')}</p></div>
            <div><b>{money(booking.totalAmount)}</b><small>{booking.reference}</small>{booking.status !== 'CANCELLED' && <button onClick={() => cancelBooking(booking.reference)}>Cancel</button>}</div>
          </article>)}
          {!bookings.length && <div className="hub-empty">Bookings made with {user.email} will appear here.</div>}
        </div>
      </section>
    </div>
  </div>
}

function TicketVerifier({ notify }: { notify: (text: string, tone?: 'normal' | 'error') => void }) {
  const [ticketToken, setTicketToken] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const data = await request<VerifyResult>('/api/tickets/verify', { method: 'POST', body: JSON.stringify({ token: ticketToken.trim() }) })
      setResult(data)
      notify(data.valid ? 'Ticket signature verified.' : data.reason || 'Ticket is not valid.', data.valid ? 'normal' : 'error')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return <div className="hub-panel verifier-panel">
    <div className="hub-panel-title"><div><span>Cryptographic validation</span><h3>Verify a digital ticket</h3><p>Paste the ticket token encoded in a BusBD QR code to validate its signature and current booking status.</p></div></div>
    <form className="hub-form" onSubmit={verify}><label>Ticket token<textarea required rows={6} value={ticketToken} onChange={event => setTicketToken(event.target.value)} placeholder="Paste the signed ticket token" /></label><button className="hub-primary" disabled={loading}>{loading ? 'Verifying…' : 'Verify ticket →'}</button></form>
    {result && <div className={`verification-result ${result.valid ? 'valid' : 'invalid'}`}><div className="verification-mark">{result.valid ? '✓' : '!'}</div><div><span>{result.valid ? 'Authentic BusBD ticket' : 'Ticket rejected'}</span><h3>{result.reference || result.reason || 'Unknown ticket'}</h3>{result.passengerName && <p>{result.passengerName} · {result.bookingStatus}</p>}<div className="verification-flags"><b>{result.travelAllowed ? 'Travel allowed' : 'Travel not allowed'}</b>{result.boardingPoint && <span>{result.boardingPoint} → {result.droppingPoint}</span>}</div></div></div>}
  </div>
}

function DriverWorkspace({ notify }: { notify: (text: string, tone?: 'normal' | 'error') => void }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(driverTokenKey) || '')
  const [driver, setDriver] = useState<PassengerUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [assignments, setAssignments] = useState<DriverAssignment[]>([])
  const [selectedTrip, setSelectedTrip] = useState('')
  const [incident, setIncident] = useState('')
  const [severity, setSeverity] = useState('MEDIUM')
  const [loading, setLoading] = useState(false)

  const loadAssignments = async (tokenValue = authToken) => {
    if (!tokenValue) return
    setLoading(true)
    try {
      const [profile, data] = await Promise.all([
        request<PassengerUser>('/api/auth/me', {}, tokenValue),
        request<DriverAssignment[]>('/api/driver/assignments', {}, tokenValue)
      ])
      if (profile.role !== 'DRIVER') throw new Error('This login is not assigned to a driver role.')
      setDriver(profile)
      setAssignments(data)
      setSelectedTrip(current => current || data[0]?.tripId || '')
    } catch (cause) {
      localStorage.removeItem(driverTokenKey)
      setAuthToken('')
      setDriver(null)
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (authToken) loadAssignments(authToken) }, [])

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await request<{ token: string; user: PassengerUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (result.user.role !== 'DRIVER') throw new Error('Use an account with the DRIVER role.')
      localStorage.setItem(driverTokenKey, result.token)
      setAuthToken(result.token)
      setDriver(result.user)
      setPassword('')
      await loadAssignments(result.token)
      notify('Driver workspace connected.')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const selected = assignments.find(item => item.tripId === selectedTrip)

  const changeTripState = async (action: 'start' | 'end') => {
    if (!selected) return notify('Select an assigned trip first.', 'error')
    setLoading(true)
    try {
      await request(`/api/driver/trips/${selected.tripId}/${action}`, { method: 'POST' }, authToken)
      await loadAssignments()
      notify(`Trip ${action === 'start' ? 'started' : 'completed'} successfully.`)
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const sendGps = () => {
    if (!selected) return notify('Select an assigned trip first.', 'error')
    if (!navigator.geolocation) return notify('GPS is not available in this browser.', 'error')
    setLoading(true)
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        await request('/api/tracking/locations', { method: 'POST', body: JSON.stringify({ busId: selected.busId, tripId: selected.tripId, latitude: position.coords.latitude, longitude: position.coords.longitude, speedKph: Math.max(0, (position.coords.speed || 0) * 3.6), heading: position.coords.heading || 0 }) }, authToken)
        notify('Live GPS position sent to operations.')
      } catch (cause) {
        notify((cause as Error).message, 'error')
      } finally {
        setLoading(false)
      }
    }, gpsError => {
      setLoading(false)
      notify(gpsError.message || 'GPS permission was denied.', 'error')
    }, { enableHighAccuracy: true, timeout: 12000 })
  }

  const reportIncident = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return notify('Select an assigned trip first.', 'error')
    setLoading(true)
    try {
      await request('/api/driver/incidents', { method: 'POST', body: JSON.stringify({ tripId: selected.tripId, category: 'DRIVER_REPORT', severity, message: incident }) }, authToken)
      setIncident('')
      notify('Incident reported to operations.')
    } catch (cause) {
      notify((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(driverTokenKey)
    setAuthToken('')
    setDriver(null)
    setAssignments([])
    notify('Driver workspace signed out.')
  }

  if (!driver) return <div className="hub-panel driver-auth"><div className="hub-panel-title"><div><span>Role-secured mobile workspace</span><h3>Driver sign in</h3><p>Assigned drivers can start trips, share GPS and report incidents from a phone.</p></div></div><form className="hub-form" onSubmit={login}><label>Driver email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="hub-primary" disabled={loading}>{loading ? 'Connecting…' : 'Open driver workspace →'}</button></form></div>

  return <div className="hub-panel"><div className="account-summary driver-summary"><div className="account-avatar">▰</div><div><span>Authenticated driver</span><h3>{driver.name}</h3><p>{assignments.length} assignment{assignments.length === 1 ? '' : 's'} available</p></div><button onClick={logout}>Sign out</button></div><div className="driver-grid"><section><div className="hub-panel-title compact"><div><span>Assignments</span><h3>Current trip</h3></div><button className="hub-text-button" onClick={() => loadAssignments()}>Refresh</button></div><label className="driver-select">Assigned trip<select value={selectedTrip} onChange={event => setSelectedTrip(event.target.value)}>{assignments.map(item => <option key={item.tripId} value={item.tripId}>{item.origin} → {item.destination} · {item.status}</option>)}</select></label>{selected ? <div className="driver-trip-card"><span>{selected.status}</span><h3>{selected.origin} → {selected.destination}</h3><p>{selected.operator} · {selected.registrationNumber}</p><div><b>{dateLabel(selected.departureTime)}</b><b>{selected.bookedSeats} seats booked</b></div></div> : <div className="hub-empty">No assigned trip is available.</div>}<div className="driver-actions"><button onClick={() => changeTripState('start')} disabled={!selected || loading}>▶ Start trip</button><button onClick={sendGps} disabled={!selected || loading}>⌁ Send GPS</button><button onClick={() => changeTripState('end')} disabled={!selected || loading}>■ End trip</button></div></section><form className="hub-form incident-form" onSubmit={reportIncident}><div className="hub-panel-title compact"><div><span>Safety and operations</span><h3>Report incident</h3></div></div><label>Severity<select value={severity} onChange={event => setSeverity(event.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Message<textarea required rows={5} value={incident} onChange={event => setIncident(event.target.value)} placeholder="Describe traffic, breakdown, safety or passenger issues" /></label><button className="hub-primary" disabled={!selected || loading}>Send to operations →</button></form></div></div>
}
