import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { BookingView, PassengerInput, Seat, Trip, User } from '../types'

const cities = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', "Cox's Bazar"]
const money = (value: number | string) => `৳${Number(value || 0).toLocaleString('en-BD')}`

export default function PassengerBookingV23({ user, message, onOpenAccount }: {
  user: User | null
  message: (text: string, error?: boolean) => void
  onOpenAccount: () => void
}) {
  const [origin, setOrigin] = useState('Dhaka')
  const [destination, setDestination] = useState('Chattogram')
  const [trips, setTrips] = useState<Trip[]>([])
  const [trip, setTrip] = useState<Trip | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [boardingPoint, setBoardingPoint] = useState('')
  const [droppingPoint, setDroppingPoint] = useState('')
  const [contact, setContact] = useState({ name: user?.name || 'Demo Passenger', email: user?.email || 'passenger@example.com', phone: user?.phone || '+8801700000000' })
  const [passengers, setPassengers] = useState<Record<string, PassengerInput>>({})
  const [promoCode, setPromoCode] = useState('')
  const [paymentProvider, setPaymentProvider] = useState('MOCK')
  const [ticket, setTicket] = useState<BookingView | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) setContact({ name: user.name, email: user.email, phone: user.phone || '+8801700000000' })
  }, [user?.id])

  const search = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setTicket(null)
    try {
      const result = await api.trips(origin, destination)
      setTrips(result); setTrip(null); setSeats([]); setSelected([])
      if (!result.length) message('No scheduled trips found for this route.', true)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  const chooseTrip = async (chosen: Trip) => {
    setBusy(true)
    try {
      const map = await api.seats(chosen.id)
      setTrip(chosen); setSeats(map.seats); setSelected([]); setPassengers({}); setTicket(null)
      setBoardingPoint(chosen.boardingPoints?.[0] || chosen.boardingPoint || chosen.origin)
      setDroppingPoint(chosen.droppingPoints?.[0] || chosen.droppingPoint || chosen.destination)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  const toggleSeat = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return
    setSelected(current => current.includes(seat.number) ? current.filter(number => number !== seat.number) : current.length < 4 ? [...current, seat.number] : current)
    setPassengers(current => current[seat.number] ? current : {
      ...current,
      [seat.number]: { fullName: contact.name, passengerType: 'ADULT', gender: seat.category === 'WOMEN_RESERVED' ? 'FEMALE' : '', seatNumber: seat.number, phone: contact.phone }
    })
  }

  const updatePassenger = (seatNumber: string, patch: Partial<PassengerInput>) => {
    setPassengers(current => ({ ...current, [seatNumber]: { ...current[seatNumber], ...patch, seatNumber } }))
  }

  const estimated = useMemo(() => {
    if (!trip) return 0
    const subtotal = Number(trip.fare) * selected.length
    const children = selected.filter(number => passengers[number]?.passengerType === 'CHILD').length
    const childDiscount = Number(trip.fare) * children * .15
    const promoDiscount = promoCode.toUpperCase() === 'BUSBD10' ? subtotal * .10 : 0
    return Math.max(0, subtotal - Math.min(subtotal * .30, childDiscount + promoDiscount))
  }, [trip, selected, passengers, promoCode])

  const confirm = async () => {
    if (!trip || !selected.length) return message('Select at least one available seat.', true)
    const records = selected.map(number => passengers[number])
    if (records.some(record => !record?.fullName?.trim())) return message('Enter every passenger name.', true)
    const womenError = selected.find(number => seats.find(seat => seat.number === number)?.category === 'WOMEN_RESERVED' && passengers[number]?.gender === 'MALE')
    if (womenError) return message(`Seat ${womenError} is reserved for women passengers.`, true)
    setBusy(true)
    try {
      const hold = await api.hold(trip.id, selected, contact.email)
      const result = await api.book({
        holdId: hold.id,
        passengerName: contact.name,
        passengerEmail: contact.email,
        passengerPhone: contact.phone,
        paymentProvider,
        boardingPoint,
        droppingPoint,
        promoCode: promoCode.trim() || undefined,
        idempotencyKey: `WEB-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        passengers: records
      })
      setTicket(result)
      message(`Booking ${result.reference} confirmed.`)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  if (ticket) return <div className="v23-confirmation">
    <div className="v23-success">✓</div><span className="eyebrow">Payment accepted</span><h2>Journey confirmed</h2>
    <img src={ticket.qrCode} alt={`QR ticket ${ticket.reference}`} />
    <strong>{ticket.reference}</strong><p>{ticket.origin} → {ticket.destination}</p><p>Seats {ticket.seats.join(', ')} · {money(ticket.totalAmount)}</p>
    <div className="v23-receipt"><span>Boarding</span><b>{ticket.boardingPoint}</b><span>Dropping</span><b>{ticket.droppingPoint}</b><span>Payment</span><b>{ticket.paymentReference}</b></div>
    {!user && <button className="primary-action" onClick={onOpenAccount}>Create account to keep this ticket</button>}
    <button onClick={() => { setTicket(null); setTrip(null); setSelected([]) }}>Book another trip</button>
  </div>

  return <div className="v23-booking-flow">
    <form className="v23-card v23-route-search" onSubmit={search}>
      <label>From<select value={origin} onChange={event => setOrigin(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
      <button type="button" onClick={() => { setOrigin(destination); setDestination(origin) }}>⇄</button>
      <label>To<select value={destination} onChange={event => setDestination(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
      <button className="primary-action" disabled={busy}>Search buses</button>
    </form>

    {!!trips.length && !trip && <section className="v23-card"><span className="eyebrow">Live availability</span><h3>Choose a scheduled trip</h3><div className="v23-trip-list">{trips.map(item => <button key={item.id} onClick={() => chooseTrip(item)}><div><strong>{item.operator}</strong><span>{item.bus} · {item.coachType}</span></div><div><b>{new Date(item.departureTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b><span>{item.availableSeats} seats</span></div><strong>{money(item.fare)} →</strong></button>)}</div></section>}

    {trip && <div className="v23-booking-grid">
      <section className="v23-card"><div className="v23-card-title"><div><span className="eyebrow">1 · Seat selection</span><h3>{trip.operator} · {trip.coachType}</h3></div><button onClick={() => setTrip(null)}>Change trip</button></div>
        <div className="v23-seat-legend"><span>Available</span><span className="women">Women reserved</span><span className="busy">Booked/locked</span></div>
        <div className={`v23-seat-map ${trip.seatLayout || '2X2'}`}>{seats.map(seat => <button key={seat.number} disabled={seat.status !== 'AVAILABLE'} className={`${seat.status.toLowerCase()} ${seat.category?.toLowerCase() || ''} ${selected.includes(seat.number) ? 'selected' : ''}`} onClick={() => toggleSeat(seat)} title={`${seat.category || 'REGULAR'} · ${seat.status}`}>{seat.number}</button>)}</div>
      </section>

      <section className="v23-card v23-form"><span className="eyebrow">2 · Journey points</span><h3>Boarding and dropping</h3>
        <label>Boarding point<select value={boardingPoint} onChange={event => setBoardingPoint(event.target.value)}>{(trip.boardingPoints?.length ? trip.boardingPoints : [trip.boardingPoint || trip.origin]).map(point => <option key={point}>{point}</option>)}</select></label>
        <label>Dropping point<select value={droppingPoint} onChange={event => setDroppingPoint(event.target.value)}>{(trip.droppingPoints?.length ? trip.droppingPoints : [trip.droppingPoint || trip.destination]).map(point => <option key={point}>{point}</option>)}</select></label>
        <label>Contact name<input value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} /></label>
        <label>Email<input type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} /></label>
        <label>Phone<input value={contact.phone} onChange={event => setContact({ ...contact, phone: event.target.value })} /></label>
      </section>

      <section className="v23-card v23-passengers"><span className="eyebrow">3 · Passenger records</span><h3>{selected.length ? `${selected.length} selected seat${selected.length > 1 ? 's' : ''}` : 'Select seats first'}</h3>
        {selected.map(number => { const record = passengers[number]; return <div className="v23-passenger-row" key={number}><b>{number}</b><input placeholder="Passenger name" value={record?.fullName || ''} onChange={event => updatePassenger(number, { fullName: event.target.value })} /><select value={record?.passengerType || 'ADULT'} onChange={event => updatePassenger(number, { passengerType: event.target.value as 'ADULT' | 'CHILD' })}><option value="ADULT">Adult</option><option value="CHILD">Child</option></select><select value={record?.gender || ''} onChange={event => updatePassenger(number, { gender: event.target.value as '' | 'MALE' | 'FEMALE' })}><option value="">Gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></div> })}
      </section>

      <section className="v23-card v23-payment"><span className="eyebrow">4 · Secure payment</span><h3>Confirm booking</h3>
        <label>Promo code<input placeholder="BUSBD10" value={promoCode} onChange={event => setPromoCode(event.target.value.toUpperCase())} /></label>
        <label>Provider<select value={paymentProvider} onChange={event => setPaymentProvider(event.target.value)}><option value="MOCK">Mock payment</option><option value="SSLCOMMERZ" disabled>SSLCommerz sandbox — next release</option></select></label>
        <div className="v23-price"><span>Estimated total</span><strong>{money(estimated)}</strong><small>Child and promo discounts are validated by the backend.</small></div>
        <button className="primary-action" disabled={busy || !selected.length} onClick={confirm}>{busy ? 'Securing seats…' : 'Pay and generate QR ticket →'}</button>
      </section>
    </div>}
  </div>
}
