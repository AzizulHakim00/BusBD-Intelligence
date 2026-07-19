import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { DriverAssignment, User } from '../types'

type AuthResult = { token: string; user: User; message?: string }
type QueuedPoint = { busId: string; tripId: string; latitude: number; longitude: number; speedKph: number; heading: number }
const queueKey = 'busbd_driver_gps_queue'

export default function DriverV23({ user, onAuth, message, setBusy }: {
  user: User | null
  onAuth: (result: AuthResult) => void
  message: (text: string, error?: boolean) => void
  setBusy?: (busy: boolean) => void
}) {
  const [email, setEmail] = useState('driver@busbd.local')
  const [password, setPassword] = useState('Driver123!')
  const [assignments, setAssignments] = useState<DriverAssignment[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [queued, setQueued] = useState(() => readQueue().length)
  const [incident, setIncident] = useState({ category: 'Delay', severity: 'LOW', message: '' })
  const watchRef = useRef<number | null>(null)

  const selected = assignments.find(item => item.tripId === selectedId) || assignments[0]

  const load = async () => {
    try {
      const result = await api.driverAssignments()
      setAssignments(result)
      setSelectedId(current => current || result[0]?.tripId || '')
    } catch (error) { message((error as Error).message, true) }
  }
  useEffect(() => { if (user?.role === 'DRIVER') load() }, [user?.id])
  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy?.(true)
    try {
      const result = await api.login(email, password)
      if (result.user.role !== 'DRIVER') throw new Error('This workspace requires a driver account.')
      onAuth(result)
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy?.(false) }
  }

  const changeStatus = async (action: 'start' | 'end') => {
    if (!selected) return
    setBusy?.(true)
    try {
      const updated = action === 'start' ? await api.startTrip(selected.tripId) : await api.endTrip(selected.tripId)
      setAssignments(current => current.map(item => item.tripId === updated.tripId ? updated : item))
      message(action === 'start' ? 'Journey started. GPS sharing is now available.' : 'Journey completed.')
      if (action === 'end') stopSharing()
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy?.(false) }
  }

  const sendPoint = async (point: QueuedPoint) => {
    try { await api.driverLocation(point); return true }
    catch { return false }
  }

  const flushQueue = async () => {
    const queue = readQueue()
    if (!queue.length) return
    const remaining: QueuedPoint[] = []
    for (const point of queue) if (!(await sendPoint(point))) remaining.push(point)
    writeQueue(remaining); setQueued(remaining.length)
    if (!remaining.length) message('Offline GPS queue synchronized.')
  }

  const startSharing = () => {
    if (!selected) return message('Choose an assigned trip first.', true)
    if (selected.status !== 'IN_PROGRESS') return message('Start the journey before sharing GPS.', true)
    if (!navigator.geolocation) return message('This browser does not support GPS.', true)
    flushQueue()
    watchRef.current = navigator.geolocation.watchPosition(async position => {
      const point: QueuedPoint = {
        busId: selected.busId,
        tripId: selected.tripId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speedKph: Math.max(0, Number(position.coords.speed || 0) * 3.6),
        heading: Number(position.coords.heading || 0)
      }
      const sent = navigator.onLine && await sendPoint(point)
      if (!sent) {
        const queue = [...readQueue(), point].slice(-250)
        writeQueue(queue); setQueued(queue.length)
      }
    }, error => message(`GPS error: ${error.message}`, true), { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 })
    setSharing(true); message('Live phone GPS sharing started.')
  }

  const stopSharing = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null; setSharing(false)
  }

  const report = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setBusy?.(true)
    try {
      await api.driverIncident({ tripId: selected.tripId, ...incident })
      setIncident(current => ({ ...current, message: '' }))
      message(incident.severity === 'EMERGENCY' ? 'Emergency alert sent to operations.' : 'Incident reported to operations.')
    } catch (error) { message((error as Error).message, true) }
    finally { setBusy?.(false) }
  }

  if (!user || user.role !== 'DRIVER') return <div className="v23-auth-layout">
    <form className="v23-card v23-form" onSubmit={login}>
      <span className="eyebrow">Authorized driver access</span><h3>Driver PWA sign in</h3>
      <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary-action">Open driver workspace →</button>
    </form>
    <aside className="v23-card v23-demo"><b>Demo driver</b><code>driver@busbd.local</code><code>Driver123!</code><p>GPS submissions are authorized against the linked driver, assigned bus and assigned trip.</p></aside>
  </div>

  return <div className="v23-driver-layout">
    <aside className="v23-card v23-assignment-list"><span className="eyebrow">Assigned journeys</span><h3>{assignments.length} trip{assignments.length === 1 ? '' : 's'}</h3>
      {assignments.map(item => <button className={selected?.tripId === item.tripId ? 'active' : ''} key={item.tripId} onClick={() => setSelectedId(item.tripId)}><strong>{item.origin} → {item.destination}</strong><span>{item.registrationNumber} · {item.status}</span><small>{new Date(item.departureTime).toLocaleString('en-BD')}</small></button>)}
      {!assignments.length && <div className="v23-empty">No trips assigned to this driver.</div>}
    </aside>

    {selected && <>
      <section className="v23-card v23-driver-control"><div className="v23-card-title"><div><span className="eyebrow"><i className="live-dot" /> Mobile control</span><h3>{selected.origin} → {selected.destination}</h3></div><b className={`v23-pill ${selected.status.toLowerCase()}`}>{selected.status}</b></div>
        <div className="v23-driver-stats"><div><span>Bus</span><b>{selected.registrationNumber}</b></div><div><span>Passengers</span><b>{selected.passengerCount}</b></div><div><span>GPS queue</span><b>{queued}</b></div></div>
        <div className="v23-driver-actions"><button disabled={selected.status === 'IN_PROGRESS'} onClick={() => changeStatus('start')}>Start journey</button><button className={sharing ? 'danger-action' : 'primary-action'} onClick={sharing ? stopSharing : startSharing}>{sharing ? 'Stop GPS' : 'Share phone GPS'}</button><button disabled={selected.status === 'COMPLETED'} onClick={() => changeStatus('end')}>End journey</button></div>
        <p className="v23-gps-state"><i className={`live-dot ${sharing ? '' : 'offline'}`} /> {sharing ? 'Location is updating live.' : 'GPS sharing is stopped.'} {queued > 0 && <button onClick={flushQueue}>Retry {queued} queued points</button>}</p>
      </section>

      <section className="v23-card v23-manifest"><span className="eyebrow">Passenger manifest</span><h3>{selected.manifest.length} passenger records</h3><div>{selected.manifest.map((passenger, index) => <article key={`${passenger.seatNumber}-${index}`}><b>{passenger.seatNumber}</b><span>{passenger.fullName}</span><small>{passenger.passengerType}{passenger.gender ? ` · ${passenger.gender}` : ''}</small></article>)}</div></section>

      <form className="v23-card v23-form v23-incident" onSubmit={report}><span className="eyebrow">Incident and emergency</span><h3>Notify operations</h3>
        <label>Category<select value={incident.category} onChange={event => setIncident({ ...incident, category: event.target.value })}><option>Delay</option><option>Breakdown</option><option>Safety</option><option>Road closure</option><option>Passenger issue</option></select></label>
        <label>Severity<select value={incident.severity} onChange={event => setIncident({ ...incident, severity: event.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>EMERGENCY</option></select></label>
        <label>Message<textarea required value={incident.message} onChange={event => setIncident({ ...incident, message: event.target.value })} /></label>
        <button className={incident.severity === 'EMERGENCY' ? 'danger-action' : 'primary-action'}>{incident.severity === 'EMERGENCY' ? 'Send emergency alert' : 'Report incident'}</button>
      </form>
    </>}
  </div>
}

function readQueue(): QueuedPoint[] {
  try { return JSON.parse(localStorage.getItem(queueKey) || '[]') as QueuedPoint[] }
  catch { return [] }
}
function writeQueue(queue: QueuedPoint[]) { localStorage.setItem(queueKey, JSON.stringify(queue)) }
