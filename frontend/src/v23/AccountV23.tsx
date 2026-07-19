import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api'
import type { BookingView, User } from '../types'

type AuthResult = { token: string; user: User; message?: string }

export default function AccountV23({ user, onAuth, setUser, message }: {
  user: User | null
  onAuth: (result: AuthResult) => void
  setUser: (user: User | null) => void
  message: (text: string, error?: boolean) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('passenger@busbd.local')
  const [password, setPassword] = useState('Passenger123!')
  const [name, setName] = useState('Demo Passenger')
  const [phone, setPhone] = useState('+8801700000000')
  const [profile, setProfile] = useState({ fullName: '', phone: '', emergencyContact: '', preferredLanguage: 'EN' })
  const [bookings, setBookings] = useState<BookingView[]>([])
  const [verifyToken, setVerifyToken] = useState('')
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setProfile({ fullName: user.name, phone: user.phone || '', emergencyContact: user.emergencyContact || '', preferredLanguage: user.preferredLanguage || 'EN' })
    api.myBookings().then(setBookings).catch(error => message(error.message, true))
  }, [user?.id])

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const result = mode === 'login'
        ? await api.login(email, password)
        : await api.register({ fullName: name, email, password, phone, preferredLanguage: 'EN' })
      onAuth(result)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const updated = await api.updateProfile(profile)
      setUser(updated)
      message('Profile and emergency contact saved.')
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  const cancel = async (reference: string) => {
    if (!window.confirm(`Cancel booking ${reference}? The refund policy will be applied automatically.`)) return
    setBusy(true)
    try {
      const updated = await api.cancelBooking(reference)
      setBookings(current => current.map(item => item.reference === reference ? updated : item))
      message(`Booking cancelled. Mock refund: ৳${Number(updated.refundAmount || 0).toLocaleString('en-BD')}`)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try { setVerification(await api.verifyTicket(verifyToken)); message('Ticket verification completed.') }
    catch (error) { message((error as Error).message, true) }
    finally { setBusy(false) }
  }

  if (!user) return <div className="v23-auth-layout">
    <form className="v23-card v23-form" onSubmit={submitAuth}>
      <span className="eyebrow">Passenger identity</span>
      <h3>{mode === 'login' ? 'Sign in to My Trips' : 'Create passenger account'}</h3>
      {mode === 'register' && <label>Full name<input required value={name} onChange={event => setName(event.target.value)} /></label>}
      <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      {mode === 'register' && <label>Phone<input required value={phone} onChange={event => setPhone(event.target.value)} /></label>}
      <label>Password<input type="password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary-action" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Register →'}</button>
      <button type="button" className="v23-link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create a passenger account' : 'Already registered? Sign in'}</button>
    </form>
    <aside className="v23-card v23-demo"><b>Demo passenger</b><code>passenger@busbd.local</code><code>Passenger123!</code><p>Registration, email-verification state, profile editing, booking history and refunds are connected to the Spring Boot APIs.</p></aside>
  </div>

  return <div className="v23-account-grid">
    <form className="v23-card v23-form" onSubmit={saveProfile}>
      <span className="eyebrow">Passenger profile</span><h3>{user.name}</h3>
      <label>Full name<input value={profile.fullName} onChange={event => setProfile({ ...profile, fullName: event.target.value })} /></label>
      <label>Phone<input value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label>
      <label>Emergency contact<input value={profile.emergencyContact} onChange={event => setProfile({ ...profile, emergencyContact: event.target.value })} /></label>
      <label>Language<select value={profile.preferredLanguage} onChange={event => setProfile({ ...profile, preferredLanguage: event.target.value })}><option value="EN">English</option><option value="BN">বাংলা</option></select></label>
      <button className="primary-action" disabled={busy}>Save profile</button>
      <small>{user.emailVerified ? '✓ Email verified' : 'Email verification required'} · {user.role}</small>
    </form>

    <section className="v23-card v23-booking-history">
      <div className="v23-card-title"><div><span className="eyebrow">Digital ticket wallet</span><h3>My bookings</h3></div><button onClick={() => api.myBookings().then(setBookings)}>Refresh</button></div>
      {!bookings.length && <div className="v23-empty">No bookings are linked to this account yet.</div>}
      {bookings.map(booking => <article className="v23-ticket-row" key={booking.reference}>
        <img src={booking.qrCode} alt={`QR ticket ${booking.reference}`} />
        <div><strong>{booking.reference}</strong><span>{booking.origin} → {booking.destination}</span><small>{new Date(booking.departureTime).toLocaleString('en-BD')} · Seats {booking.seats.join(', ')}</small><small>{booking.boardingPoint} → {booking.droppingPoint}</small></div>
        <div className="v23-status"><b className={booking.status === 'CANCELLED' ? 'bad' : ''}>{booking.status}</b><span>৳{Number(booking.totalAmount).toLocaleString('en-BD')}</span><small>{booking.refundStatus !== 'NOT_REQUESTED' ? `${booking.refundStatus}: ৳${booking.refundAmount}` : booking.paymentStatus}</small>{booking.status === 'CONFIRMED' && <button onClick={() => cancel(booking.reference)}>Cancel</button>}</div>
      </article>)}
    </section>

    <form className="v23-card v23-form v23-verify" onSubmit={verify}>
      <span className="eyebrow">Signed QR verification</span><h3>Verify ticket token</h3>
      <textarea required placeholder="Paste the BBDT signed token" value={verifyToken} onChange={event => setVerifyToken(event.target.value)} />
      <button className="primary-action" disabled={busy}>Verify ticket</button>
      {verification && <pre>{JSON.stringify(verification, null, 2)}</pre>}
    </form>
  </div>
}
