import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api, saveToken, token } from './api'
import type { Location, Seat, Trip, User } from './types'

type Page = 'search' | 'tracking' | 'trips' | 'support' | 'operations'
type Notice = { text: string; tone?: 'normal' | 'error' }

type BookingView = {
  reference: string
  tripId: string
  passengerName: string
  passengerEmail: string
  seats: string[]
  totalAmount: number
  status: string
  paymentProvider: string
  paymentReference: string
  qrCode: string
  createdAt: string
}

const navItems: { id: Page; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'tracking', label: 'Live tracking' },
  { id: 'trips', label: 'My trips' },
  { id: 'support', label: 'Support' }
]

const cities = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', "Cox's Bazar"]
const money = (value: number | string) => `৳${Number(value || 0).toLocaleString('en-BD')}`
const clock = (value: string) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dateTime = (value: string) => new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })
const duration = (start: string, end: string) => {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
const operatorCode = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
const delayLabel = (risk: number) => risk <= .15 ? 'Low' : risk <= .35 ? 'Medium' : 'High'

export default function App() {
  const [page, setPage] = useState<Page>('search')
  const [user, setUser] = useState<User | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [language, setLanguage] = useState<'EN' | 'বাংলা'>('EN')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token()) return
    api.me().then(setUser).catch(() => saveToken(null))
  }, [])

  const go = (next: Page) => {
    if (next === 'operations' && !user) {
      setLoginOpen(true)
      return
    }
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showNotice = (text: string, tone: Notice['tone'] = 'normal') => {
    setNotice({ text, tone })
    window.setTimeout(() => setNotice(current => current?.text === text ? null : current), 5000)
  }

  return (
    <main className="site-shell">
      {busy && <div className="loading-line" />}
      <Topbar page={page} language={language} setLanguage={setLanguage} go={go} />
      {notice && <div className="notice-bar"><span>{notice.text}</span><button onClick={() => setNotice(null)}>×</button></div>}
      {page === 'search' && <SearchPage go={go} showNotice={showNotice} setBusy={setBusy} />}
      {page === 'tracking' && <TrackingPage onBack={() => go('search')} />}
      {page === 'trips' && <TripsPage showNotice={showNotice} setBusy={setBusy} />}
      {page === 'support' && <SupportPage showNotice={showNotice} setBusy={setBusy} />}
      {page === 'operations' && user && <OperationsPage user={user} onExit={() => go('search')} onLogout={() => { saveToken(null); setUser(null); setPage('search') }} />}
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} onSuccess={(loggedIn) => { setUser(loggedIn); setLoginOpen(false); setPage('operations') }} setBusy={setBusy} />}
    </main>
  )
}

function Topbar({ page, language, setLanguage, go }: { page: Page; language: 'EN' | 'বাংলা'; setLanguage: (value: 'EN' | 'বাংলা') => void; go: (page: Page) => void }) {
  return <header className="topbar">
    <button className="brand" onClick={() => go('search')} aria-label="BusBD home">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>BusBD <strong>Intelligence</strong></span>
    </button>
    <nav className="main-nav" aria-label="Primary navigation">
      {navItems.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}>{item.label}</button>)}
    </nav>
    <div className="header-actions">
      <button className="language" onClick={() => setLanguage(language === 'EN' ? 'বাংলা' : 'EN')}><span aria-hidden="true">◎</span> {language === 'EN' ? 'বাংলা / EN' : 'EN / বাংলা'}</button>
      <button className="ops-button" onClick={() => go('operations')}><span className="live-dot" /> Operations</button>
    </div>
  </header>
}

function SearchPage({ go, showNotice, setBusy }: { go: (page: Page) => void; showNotice: (message: string, tone?: Notice['tone']) => void; setBusy: (busy: boolean) => void }) {
  const [origin, setOrigin] = useState('Dhaka')
  const [destination, setDestination] = useState('Chattogram')
  const [travelDate, setTravelDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [passengers, setPassengers] = useState(1)
  const [searched, setSearched] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [summary, setSummary] = useState<Record<string, number | string>>({})
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)

  useEffect(() => { api.summary().then(setSummary).catch(() => undefined) }, [])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api.trips(origin, destination)
      setTrips(result)
      setSearched(true)
      window.setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 80)
      if (!result.length) showNotice('No scheduled buses found for this route. Try another destination.', 'error')
    } catch (error) {
      showNotice((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const liveTrip = trips[0]

  return <>
    <section className="hero">
      <div className="route-atmosphere" aria-hidden="true">
        <svg viewBox="0 0 720 680" preserveAspectRatio="none">
          <path className="route-faint" d="M-20 110 C130 10 190 210 330 150 S520 90 750 5" />
          <path className="route-faint" d="M40 680 C110 540 210 590 280 500 S420 390 520 430 S650 350 750 265" />
          <path className="route-live" d="M-20 110 C130 10 190 210 330 150 S520 90 750 5" />
          <circle cx="330" cy="150" r="7" /><circle cx="520" cy="86" r="7" /><circle cx="280" cy="500" r="7" /><circle cx="520" cy="430" r="7" />
        </svg>
      </div>
      <div className="hero-copy">
        <span className="eyebrow"><span className="spark">✦</span> Bangladesh moves smarter</span>
        <h1>Every journey,<br /><span>intelligently connected.</span></h1>
        <p>Search, book and track trusted buses across Bangladesh—with live GPS and AI-powered arrival predictions.</p>
        <form className="search-panel" onSubmit={search}>
          <label><span>From</span><div className="field-value"><b className="pin">●</b><select value={origin} onChange={event => setOrigin(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></div></label>
          <button className="swap" type="button" onClick={() => { setOrigin(destination); setDestination(origin) }} aria-label="Swap origin and destination">⇄</button>
          <label><span>To</span><div className="field-value"><b className="pin outline">◆</b><select value={destination} onChange={event => setDestination(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></div></label>
          <label><span>Date</span><div className="field-value"><b>▣</b><input type="date" value={travelDate} min={new Date().toISOString().slice(0, 10)} onChange={event => setTravelDate(event.target.value)} /></div></label>
          <label><span>Passengers</span><div className="field-value"><b>♙</b><select value={passengers} onChange={event => setPassengers(Number(event.target.value))}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}</select></div></label>
          <button className="primary-action" type="submit">Search buses <span>→</span></button>
        </form>
        <div className="quick-routes"><span>Popular now</span><button onClick={() => { setOrigin('Dhaka'); setDestination("Cox's Bazar") }}>Dhaka → Cox&apos;s Bazar</button><button onClick={() => { setOrigin('Dhaka'); setDestination('Sylhet') }}>Dhaka → Sylhet</button></div>
      </div>
      <aside className="live-card" aria-label="Live trip status">
        <div className="card-kicker"><span className="live-dot" /> Live status <span className="signal">GPS · 5 sec ago</span></div>
        <div className="operator-row"><span className="bus-avatar">▰</span><div><h2>{liveTrip?.operator || 'Green Line'}</h2><p>{liveTrip ? `${liveTrip.bus} · ${liveTrip.coachType}` : 'GL-208 · Scania AC'}</p></div></div>
        <div className="time-row"><div><span>Departed</span><strong>{liveTrip ? clock(liveTrip.departureTime) : '10:30 PM'}</strong></div><div><span>AI predicted arrival</span><strong>{liveTrip ? clock(liveTrip.arrivalTime) : '7:10 AM'}</strong></div></div>
        <div className="route-progress"><div className="rail"><i /><i className="bus-node">▰</i><i /><i /></div><div className="stops"><span>Dhaka</span><span>Cumilla</span><span>Feni</span><span>Chattogram</span></div></div>
        <div className="risk-row"><span><b>✓</b> Delay risk</span><strong>{liveTrip ? delayLabel(liveTrip.delayRisk) : 'Low'}</strong></div>
        <button className="track-link" onClick={() => go('tracking')}>Open live tracking <span>↗</span></button>
      </aside>
    </section>
    <section className="signal-strip" aria-label="Network statistics">
      <Stat value={summary.districtsConnected || 62} label="districts connected" />
      <Stat value={summary.verifiedOperators || 2} label="verified operators" />
      <Stat value={summary.buses || 3} label="buses live now" />
      <Stat value={`${summary.etaAccuracy || 91}%`} label="ETA accuracy" />
      <span className="network-live"><i className="live-dot" /> Network healthy</span>
    </section>
    <section className="results-section" id="results">
      <div className="section-heading"><div><span className="eyebrow">{searched ? 'Live availability' : 'Plan with confidence'}</span><h2>{searched ? `${origin} to ${destination}` : 'Intelligence at every step'}</h2></div><p>{searched ? `${trips.length} recommended trip${trips.length === 1 ? '' : 's'} · ${passengers} passenger${passengers > 1 ? 's' : ''} · ${travelDate}` : 'Real operational data, translated into a simpler journey.'}</p></div>
      {searched ? <div className="trip-list">{trips.map((trip, index) => <TripCard key={trip.id} trip={trip} recommended={index === 0} onChoose={() => setSelectedTrip(trip)} />)}</div> : <FeatureGrid go={go} />}
    </section>
    {selectedTrip && <BookingDialog trip={selectedTrip} passengerCount={passengers} onClose={() => setSelectedTrip(null)} showNotice={showNotice} setBusy={setBusy} />}
  </>
}

function Stat({ value, label }: { value: number | string; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div> }

function FeatureGrid({ go }: { go: (page: Page) => void }) {
  return <div className="feature-grid">
    <article><span className="feature-icon">⌁</span><h3>Live route intelligence</h3><p>Follow every active bus with location freshness, speed and route-deviation monitoring.</p><button onClick={() => go('tracking')}>See live map →</button></article>
    <article><span className="feature-icon">✦</span><h3>AI arrival predictions</h3><p>Traffic, historic travel and current speed combine for a more realistic ETA.</p><small>91% predictions within 10 minutes</small></article>
    <article className="dark-feature"><span className="feature-icon">◎</span><h3>Built for operators too</h3><p>Turn demand, fleet health and driver signals into decisions your team can act on.</p><button onClick={() => go('operations')}>Open operations →</button></article>
  </div>
}

function TripCard({ trip, recommended, onChoose }: { trip: Trip; recommended: boolean; onChoose: () => void }) {
  const risk = delayLabel(trip.delayRisk)
  return <article className={`trip-card ${recommended ? 'recommended' : ''}`}>
    {recommended && <span className="recommended-label">Best match</span>}
    <div className="trip-operator"><span className="operator-logo">{operatorCode(trip.operator)}</span><div><h3>{trip.operator}</h3><p>{trip.bus} · {trip.coachType}</p></div></div>
    <div className="trip-time"><strong>{clock(trip.departureTime)}</strong><div><span>{duration(trip.departureTime, trip.arrivalTime)}</span><i /></div><strong>{clock(trip.arrivalTime)}</strong><small>{trip.origin} → {trip.destination}</small></div>
    <div className="trip-meta"><span>★ 4.8</span><span>{trip.availableSeats} seats</span><span className={risk === 'Low' ? 'safe' : 'watch'}>{risk} delay risk</span></div>
    <div className="trip-price"><span>from</span><strong>{money(trip.fare)}</strong><button disabled={trip.availableSeats === 0} onClick={onChoose}>{trip.availableSeats ? 'View seats' : 'Sold out'}</button></div>
  </article>
}

function BookingDialog({ trip, passengerCount, onClose, showNotice, setBusy }: { trip: Trip; passengerCount: number; onClose: () => void; showNotice: (message: string, tone?: Notice['tone']) => void; setBusy: (busy: boolean) => void }) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState('Demo Passenger')
  const [email, setEmail] = useState('passenger@example.com')
  const [phone, setPhone] = useState('+8801700000000')
  const [paymentProvider, setPaymentProvider] = useState('MOCK')
  const [booking, setBooking] = useState<BookingView | null>(null)

  useEffect(() => {
    setBusy(true)
    api.seats(trip.id).then(result => setSeats(result.seats)).catch(error => showNotice(error.message, 'error')).finally(() => setBusy(false))
  }, [trip.id, setBusy, showNotice])

  const toggle = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return
    setSelected(current => current.includes(seat.number) ? current.filter(number => number !== seat.number) : current.length < passengerCount ? [...current, seat.number] : current)
  }

  const confirm = async () => {
    if (selected.length !== passengerCount) return showNotice(`Select exactly ${passengerCount} seat${passengerCount > 1 ? 's' : ''}.`, 'error')
    setBusy(true)
    try {
      const hold = await api.hold(trip.id, selected, email)
      const result = await api.book({ holdId: hold.id, passengerName: name, passengerEmail: email, passengerPhone: phone, paymentProvider })
      setBooking(result as BookingView)
      showNotice(`Booking ${String((result as BookingView).reference)} confirmed.`)
    } catch (error) {
      showNotice((error as Error).message, 'error')
      api.seats(trip.id).then(result => setSeats(result.seats)).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return <div className="booking-shade" role="dialog" aria-modal="true">
    <section className="booking-dialog">
      <button className="close-button" onClick={onClose}>×</button>
      {booking ? <div className="booking-success"><div className="success-mark">✓</div><span className="eyebrow">Digital ticket issued</span><h2>Booking confirmed</h2><p>Reference <strong>{booking.reference}</strong></p><img src={booking.qrCode} alt={`QR ticket ${booking.reference}`} /><div className="ticket-details"><div><span>Passenger</span><strong>{booking.passengerName}</strong></div><div><span>Seats</span><strong>{booking.seats.join(', ')}</strong></div><div><span>Payment</span><strong>{booking.paymentProvider} · {booking.paymentReference}</strong></div><div><span>Total</span><strong>{money(booking.totalAmount)}</strong></div></div><div className="booking-success-actions"><button className="primary-action" onClick={() => window.print()}>Print ticket →</button><button className="secondary-action" onClick={onClose}>Done</button></div></div> : <>
        <div className="booking-head"><div><span className="eyebrow">Secure seat selection</span><h2>{trip.operator}</h2><div className="booking-route"><span>{trip.origin} → {trip.destination}</span><span>{dateTime(trip.departureTime)}</span><span>{trip.coachType}</span></div></div><div className="operator-logo">{operatorCode(trip.operator)}</div></div>
        <div className="seat-legend"><span><i /> Available</span><span><i className="selected" /> Selected</span><span><i className="locked" /> Locked</span><span><i className="booked" /> Booked</span></div>
        <div className="coach-shell"><div className="seat-grid">{seats.map(seat => <button key={seat.number} className={`${seat.status.toLowerCase()} ${selected.includes(seat.number) ? 'selected' : ''}`} disabled={seat.status !== 'AVAILABLE'} onClick={() => toggle(seat)}>{seat.number}</button>)}</div></div>
        <div className="booking-form-grid form-stack"><label>Passenger name<input value={name} onChange={event => setName(event.target.value)} /></label><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Phone<input value={phone} onChange={event => setPhone(event.target.value)} /></label><label>Payment provider<select value={paymentProvider} onChange={event => setPaymentProvider(event.target.value)}><option value="MOCK">Mock payment</option><option value="BKASH" disabled>bKash — credentials required</option><option value="NAGAD" disabled>Nagad — credentials required</option><option value="SSLCOMMERZ" disabled>SSLCommerz — credentials required</option></select></label></div>
        <div className="booking-summary"><div><small>Selected seats</small><strong>{selected.length ? selected.join(', ') : 'None'}</strong></div><div><small>Total payable</small><strong>{money(Number(trip.fare) * selected.length)}</strong></div><button className="primary-action" onClick={confirm}>Lock seats & pay →</button></div>
      </>}
    </section>
  </div>
}

function TrackingPage({ onBack }: { onBack: () => void }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const load = () => api.locations().then(data => { setLocations(data); setSeconds(0) }).catch(() => undefined)
    load()
    const poll = window.setInterval(load, 5000)
    const tick = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [])
  const current = locations[0]
  const speed = Math.round(current?.speedKph || 54)
  const anomaly = current?.anomalyScore || .08
  return <section className="tracking-page">
    <div className="subpage-head"><div><button onClick={onBack}>← Back to search</button><span className="eyebrow"><i className="live-dot" /> Live journey</span><h1>Dhaka → Chattogram</h1><p>Green Line GL-208 · Updated {seconds} seconds ago</p></div><div className="trip-code">Trip <strong>#{String(current?.tripId || 'BD-2087').slice(0, 8)}</strong></div></div>
    <div className="tracking-grid"><div className="map-card"><div className="map-toolbar"><span><i className="live-dot" /> Tracking active</span><div><button>＋</button><button>−</button></div></div><svg className="live-map" viewBox="0 0 900 540" role="img" aria-label="Live route map from Dhaka to Chattogram"><defs><filter id="glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><g className="map-roads"><path d="M0 100 C180 30 250 190 430 90 S720 180 920 40" /><path d="M-20 460 C140 390 190 500 330 390 S570 330 920 420" /><path d="M110 0 C180 130 90 260 210 560" /><path d="M680 0 C610 180 790 270 730 560" /></g><path className="main-route-glow" d="M125 115 C270 155 245 260 410 275 S580 330 760 430" /><path className="main-route" d="M125 115 C270 155 245 260 410 275 S580 330 760 430" /><circle className="city-point" cx="125" cy="115" r="12" /><circle className="city-point" cx="410" cy="275" r="10" /><circle className="city-point" cx="760" cy="430" r="12" /><g className="moving-bus" filter="url(#glow)"><circle cx="410" cy="275" r="22" /><text x="410" y="281" textAnchor="middle">▰</text></g><text className="map-label" x="90" y="86">Dhaka</text><text className="map-label" x="376" y="245">Cumilla</text><text className="map-label" x="725" y="470">Chattogram</text></svg><div className="map-legend"><span><i className="legend-live" />Live route</span><span><i className="legend-road" />Road network</span><span>{locations.length ? 'Live GPS API' : 'GPS simulator starting'}</span></div></div>
      <aside className="journey-panel"><div className="journey-hero"><span className="bus-avatar">▰</span><div><span>Current location</span><h2>{current ? `${current.latitude.toFixed(3)}, ${current.longitude.toFixed(3)}` : 'Cumilla Bypass'}</h2><p>Moving southeast at {speed} km/h</p></div></div><div className="eta-card"><span>AI predicted arrival</span><strong>7:10 <small>AM</small></strong><p>± 8 min confidence range</p><div className="confidence"><i style={{ width: '91%' }} /><span>91% confidence</span></div></div><div className="telemetry"><div><span>Distance left</span><strong>154 km</strong></div><div><span>Current delay</span><strong className="good">+6 min</strong></div><div><span>GPS anomaly</span><strong>{Math.round(anomaly * 100)}%</strong></div><div><span>Next stop</span><strong>Feni</strong></div></div><div className="journey-alert"><b>✦</b><div><strong>Traffic intelligence</strong><p>Moderate congestion near Feni may add 7–10 minutes.</p></div></div></aside>
    </div>
  </section>
}

function TripsPage({ showNotice, setBusy }: { showNotice: (message: string, tone?: Notice['tone']) => void; setBusy: (busy: boolean) => void }) {
  const [reference, setReference] = useState('')
  const [booking, setBooking] = useState<BookingView | null>(null)
  const lookup = async (event: FormEvent) => {
    event.preventDefault()
    if (!reference.trim()) return
    setBusy(true)
    try { setBooking(await api.booking(reference.trim().toUpperCase()) as BookingView) }
    catch (error) { setBooking(null); showNotice((error as Error).message, 'error') }
    finally { setBusy(false) }
  }
  const cancel = async () => {
    if (!booking || !window.confirm(`Cancel booking ${booking.reference}?`)) return
    setBusy(true)
    try { setBooking(await api.cancelBooking(booking.reference) as BookingView); showNotice('Booking cancelled and mock refund initiated.') }
    catch (error) { showNotice((error as Error).message, 'error') }
    finally { setBusy(false) }
  }
  return <section className="portal-page"><div className="portal-card"><div className="portal-title"><div><span className="eyebrow">Digital ticket wallet</span><h1>Your trips</h1><p>Retrieve a confirmed journey, QR ticket, cancellation and refund status.</p></div></div><form className="ticket-lookup" onSubmit={lookup}><input value={reference} onChange={event => setReference(event.target.value.toUpperCase())} placeholder="Enter booking reference, e.g. BBD123456" /><button className="primary-action">Find ticket →</button></form>{booking ? <div className="ticket-view"><img src={booking.qrCode} alt={`QR ticket ${booking.reference}`} /><div><span className="eyebrow">{booking.status}</span><h2>{booking.reference}</h2><p>{booking.passengerName}</p><div className="ticket-details"><div><span>Seats</span><strong>{booking.seats.join(', ')}</strong></div><div><span>Total</span><strong>{money(booking.totalAmount)}</strong></div><div><span>Payment</span><strong>{booking.paymentProvider}</strong></div><div><span>Created</span><strong>{dateTime(booking.createdAt)}</strong></div></div>{booking.status !== 'CANCELLED' && <button className="danger-action" onClick={cancel}>Cancel booking</button>}</div></div> : <div className="empty-state">Your confirmed ticket will appear here after entering its reference.</div>}</div></section>
}

function SupportPage({ showNotice, setBusy }: { showNotice: (message: string, tone?: Notice['tone']) => void; setBusy: (busy: boolean) => void }) {
  const [email, setEmail] = useState('passenger@example.com')
  const [category, setCategory] = useState('General support')
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try { await api.complaint({ email, category, message }); setMessage(''); showNotice('Support case submitted. AI classification is complete.') }
    catch (error) { showNotice((error as Error).message, 'error') }
    finally { setBusy(false) }
  }
  return <section className="portal-page"><div className="portal-card"><div className="portal-title"><div><span className="eyebrow">Passenger care</span><h1>How can we help?</h1><p>Get help with tickets, refunds, lost items and trip problems.</p></div></div><div className="support-grid"><form className="form-stack" onSubmit={submit}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option>General support</option><option>Refund</option><option>Lost and found</option><option>Payment issue</option><option>Driver or safety report</option></select></label><label>Message<textarea required value={message} onChange={event => setMessage(event.target.value)} placeholder="Describe what happened" /></label><button className="primary-action">Submit case →</button></form><div className="support-options"><div className="support-option"><b>✦ AI case classification</b><p>Your message is classified as refund, lost-and-found or general support for faster routing.</p></div><div className="support-option"><b>◎ Bangla / English ready</b><p>The support workflow accepts either language. OpenAI assistance remains optional and server-side.</p></div><div className="support-option"><b>⌁ Audit-safe workflow</b><p>Every operational action can be recorded through the Spring Boot audit service.</p></div></div></div></div></section>
}

function LoginDialog({ onClose, onSuccess, setBusy }: { onClose: () => void; onSuccess: (user: User) => void; setBusy: (busy: boolean) => void }) {
  const [email, setEmail] = useState('admin@busbd.local')
  const [password, setPassword] = useState('Admin123!')
  const [error, setError] = useState('')
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await api.login(email, password); saveToken(result.token); onSuccess(result.user) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="auth-shade" role="dialog" aria-modal="true"><section className="auth-card"><button className="close-button" onClick={onClose}>×</button><span className="eyebrow"><i className="live-dot" /> Secure operations</span><h2>Sign in to BusBD</h2><p>Role-based access for operator staff, fleet managers, support agents and administrators.</p><form className="form-stack" onSubmit={login}>{error && <div className="auth-error">{error}</div>}<label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary-action">Sign in →</button></form><div className="demo-accounts"><b>Demo administrator</b><br />admin@busbd.local / Admin123!</div></section></div>
}

function OperationsPage({ user, onExit, onLogout }: { user: User; onExit: () => void; onLogout: () => void }) {
  const [overview, setOverview] = useState<Record<string, number>>({})
  const [buses, setBuses] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    Promise.all([api.overview(), api.buses(), api.bookings(), api.complaints()]).then(([o, b, bk, c]) => { setOverview(o); setBuses(b); setBookings(bk); setComplaints(c) }).catch(() => undefined)
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const greeting = useMemo(() => time.getHours() < 12 ? 'Good morning' : time.getHours() < 18 ? 'Good afternoon' : 'Good evening', [time])
  const confirmed = bookings.filter(item => item.status === 'CONFIRMED').length
  return <section className="operations-page"><div className="ops-rail"><div className="rail-brand"><span className="brand-mark"><i /><i /><i /></span></div>{['⌂', '⌁', '▦', '♙', '⚙'].map((icon, index) => <button key={icon} className={index === 0 ? 'active' : ''}>{icon}</button>)}<button onClick={onExit}>↩</button></div><div className="ops-main"><header className="ops-header"><div><span className="eyebrow"><i className="live-dot" /> Operations live</span><h1>{greeting}, {user.name.split(' ')[0]}</h1><p>Here is what needs attention across your network. <span className="role-badge">{user.role}</span></p></div><div className="ops-clock"><span>{time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span><strong>{time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong><button className="logout-button" onClick={onLogout}>Sign out</button></div></header>
      <div className="kpi-grid"><Kpi label="Scheduled trips" value={overview.trips || 0} note={`${overview.buses || 0} managed buses`} trend="LIVE" /><Kpi label="Confirmed bookings" value={confirmed} note={`${bookings.length} total records`} trend="+V1" /><Kpi label="Open complaints" value={overview.openComplaints || 0} note="AI-prioritized support" trend="CARE" /><Kpi label="Today’s revenue" value={money(overview.revenue || 0)} note="Mock-payment total" trend="+8.4%" /></div>
      <div className="ops-grid"><div className="fleet-map-panel"><div className="panel-head"><div><h2>Live fleet network</h2><p>{buses.length} vehicles managed</p></div><button>Open command map ↗</button></div><div className="mini-map"><svg viewBox="0 0 800 360"><g className="network-lines"><path d="M80 70L220 150L350 90L470 190L650 80" /><path d="M220 150L280 280L470 190L620 300" /><path d="M350 90L550 70L650 80" /><path d="M470 190L620 300L740 210" /></g>{[[80,70],[220,150],[350,90],[470,190],[650,80],[280,280],[620,300],[550,70],[740,210]].map((point,index) => <circle key={index} cx={point[0]} cy={point[1]} r={index === 3 ? 9 : 5} className={index === 3 ? 'hub' : ''} />)}</svg><div className="map-pulse p1" /><div className="map-pulse p2" /><div className="fleet-summary"><span><i className="live-dot" /> {Math.max(1, buses.length - 1)} on route</span><span><i className="amber-dot" /> 1 delayed</span><span><i className="red-dot" /> {overview.openComplaints || 0} attention</span></div></div></div>
        <div className="attention-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>AI-prioritized alerts</p></div><span className="count-badge">{Math.max(1, complaints.length)}</span></div>{complaints.slice(0, 3).map((item, index) => <Alert key={item.id || index} tone={index === 0 ? 'red' : index === 1 ? 'amber' : 'blue'} title={item.aiClassification || item.category || 'Passenger support'} meta={item.message || item.email} time="now" />)}{!complaints.length && <Alert tone="blue" title="Network operating normally" meta="No open complaints in the demo database" time="live" />}<button className="all-alerts">View all alerts →</button></div></div>
      <div className="intelligence-row"><article><span className="ai-label">✦ AI forecast</span><h3>Friday demand will peak between 9–11 PM</h3><p>Recommend additional Dhaka–Chattogram departures based on the demand baseline service.</p><div className="forecast-bars">{[32,48,61,90,72,45].map(value => <i key={value} style={{ height: `${value}%` }} />)}</div></article><article><span className="ai-label">◎ Fleet allocation</span><h3>{Math.max(1, Math.floor(buses.length / 2))} buses can be reassigned safely</h3><p>Estimated additional weekend revenue is generated by the demonstration optimizer.</p><button>Review recommendation →</button></article><article className="ai-copilot"><span className="ai-label">BusBD operations copilot</span><h3>Ask your network anything.</h3><div className="copilot-input"><span>Which trips are at risk tomorrow?</span><button>↑</button></div></article></div>
      <div className="intelligence-row"><article><span className="ai-label">Fleet inventory</span><h3>Managed buses</h3><div className="data-list">{buses.slice(0, 4).map(bus => <div className="data-row" key={bus.id}><strong>{bus.registrationNumber}</strong><span>{bus.model} · {bus.coachType}</span><span>{bus.seatCount} seats</span></div>)}</div></article><article><span className="ai-label">Booking stream</span><h3>Recent bookings</h3><div className="data-list">{bookings.slice(0, 4).map(item => <div className="data-row" key={item.id}><strong>{item.reference}</strong><span>{item.passengerName}</span><span>{item.status}</span></div>)}</div></article><article><span className="ai-label">API control plane</span><h3>Enterprise V1 is connected</h3><p>JWT, Redis-compatible locks, WebSocket GPS, QR tickets, Swagger, Docker and ML service interfaces are active.</p><span className="api-badge">/swagger-ui.html · /actuator/health · /api-docs</span></article></div>
    </div></section>
}

function Kpi({ label, value, note, trend }: { label: string; value: string | number; note: string; trend: string }) { return <article className="kpi"><div><span>{label}</span><strong>{value}</strong></div><b>{trend}</b><p><i className="live-dot" />{note}</p></article> }
function Alert({ tone, title, meta, time }: { tone: string; title: string; meta: string; time: string }) { return <div className="alert-row"><i className={`alert-icon ${tone}`}>!</i><div><strong>{title}</strong><span>{meta}</span></div><time>{time}</time></div> }
