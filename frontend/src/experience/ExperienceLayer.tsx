import { useEffect, useMemo, useState } from 'react'
import './experience.css'

type PlannerRoute = {
  id: string
  origin: string
  destination: string
  travelDate: string
  passengers: number
  savedAt: string
}

type SystemSnapshot = {
  loading: boolean
  online: boolean
  health: 'UP' | 'DEGRADED' | 'UNKNOWN'
  buses: number
  operators: number
  districts: number
  gpsSignals: number
  checkedAt: string
}

const cities = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', "Cox's Bazar"]
const savedKey = 'busbd_saved_routes_v4'
const recentKey = 'busbd_recent_plans_v4'

const routeData: Record<string, { fare: number; hours: number; distance: number }> = {
  'Dhaka|Chattogram': { fare: 1200, hours: 6.2, distance: 265 },
  "Dhaka|Cox's Bazar": { fare: 1800, hours: 10.5, distance: 390 },
  'Dhaka|Sylhet': { fare: 1050, hours: 5.4, distance: 240 },
  'Dhaka|Rajshahi': { fare: 1100, hours: 5.8, distance: 245 },
  'Chattogram|Sylhet': { fare: 1350, hours: 7.1, distance: 320 },
  "Chattogram|Cox's Bazar": { fare: 650, hours: 3.6, distance: 150 },
  'Rajshahi|Sylhet': { fare: 1450, hours: 8.4, distance: 365 }
}

const safeRead = (key: string): PlannerRoute[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.slice(0, 6) : []
  } catch {
    return []
  }
}

const nativeValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('change', { bubbles: true }))
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const formatCheckedAt = () => new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })

export default function ExperienceLayer() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'plan' | 'status'>('plan')
  const [origin, setOrigin] = useState('Dhaka')
  const [destination, setDestination] = useState('Chattogram')
  const [travelDate, setTravelDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [passengers, setPassengers] = useState(1)
  const [saved, setSaved] = useState<PlannerRoute[]>(() => safeRead(savedKey))
  const [recent, setRecent] = useState<PlannerRoute[]>(() => safeRead(recentKey))
  const [toast, setToast] = useState('')
  const [snapshot, setSnapshot] = useState<SystemSnapshot>({
    loading: true,
    online: navigator.onLine,
    health: 'UNKNOWN',
    buses: 0,
    operators: 0,
    districts: 0,
    gpsSignals: 0,
    checkedAt: ''
  })

  const estimate = useMemo(() => {
    const direct = routeData[`${origin}|${destination}`]
    const reverse = routeData[`${destination}|${origin}`]
    const route = direct || reverse || { fare: 1250, hours: 6.8, distance: 285 }
    return {
      fare: route.fare * passengers,
      hours: route.hours,
      distance: route.distance,
      carbon: Math.round(route.distance * passengers * 0.105)
    }
  }, [origin, destination, passengers])

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(current => current === message ? '' : current), 2600)
  }

  const loadStatus = async () => {
    setSnapshot(current => ({ ...current, loading: true, online: navigator.onLine }))
    try {
      const [healthResponse, summaryResponse, gpsResponse] = await Promise.all([
        fetch('/actuator/health', { cache: 'no-store' }),
        fetch('/api/public/summary', { cache: 'no-store' }),
        fetch('/api/tracking/locations', { cache: 'no-store' })
      ])
      const health = await healthResponse.json().catch(() => ({ status: 'UNKNOWN' }))
      const summary = await summaryResponse.json().catch(() => ({}))
      const gps = await gpsResponse.json().catch(() => [])
      const healthy = healthResponse.ok && summaryResponse.ok
      setSnapshot({
        loading: false,
        online: true,
        health: healthy && health.status === 'UP' ? 'UP' : 'DEGRADED',
        buses: Number(summary.buses || 0),
        operators: Number(summary.verifiedOperators || 0),
        districts: Number(summary.districtsConnected || 0),
        gpsSignals: Array.isArray(gps) ? gps.length : 0,
        checkedAt: formatCheckedAt()
      })
    } catch {
      setSnapshot(current => ({ ...current, loading: false, online: navigator.onLine, health: 'DEGRADED', checkedAt: formatCheckedAt() }))
    }
  }

  useEffect(() => {
    document.body.classList.add('experience-ready')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = Array.from(document.querySelectorAll<HTMLElement>(
      '.hero-copy, .live-card, .signal-strip > *, .feature-grid > *, .trip-card, .portal-card, .tracking-grid > *, .kpi, .ops-grid > *, .intelligence-row > *'
    ))
    targets.forEach((element, index) => {
      element.classList.add('motion-seed')
      element.style.setProperty('--motion-delay', `${Math.min(index % 8, 7) * 70}ms`)
    })

    const observer = reducedMotion ? null : new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')
          observer?.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -35px' })

    targets.forEach(element => reducedMotion ? element.classList.add('in-view') : observer?.observe(element))

    const pointer = (event: PointerEvent) => {
      document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`)
      document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`)
    }
    window.addEventListener('pointermove', pointer, { passive: true })

    const online = () => {
      setSnapshot(current => ({ ...current, online: true }))
      loadStatus()
    }
    const offline = () => setSnapshot(current => ({ ...current, online: false, health: 'DEGRADED' }))
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    loadStatus()
    const timer = window.setInterval(loadStatus, 45000)

    return () => {
      observer?.disconnect()
      window.removeEventListener('pointermove', pointer)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.clearInterval(timer)
      document.body.classList.remove('experience-ready')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])

  const makeRoute = (): PlannerRoute => ({
    id: `${origin}-${destination}-${travelDate}-${Date.now()}`,
    origin,
    destination,
    travelDate,
    passengers,
    savedAt: new Date().toISOString()
  })

  const rememberRecent = (route: PlannerRoute) => {
    const next = [route, ...recent.filter(item => !(item.origin === route.origin && item.destination === route.destination))].slice(0, 4)
    setRecent(next)
    localStorage.setItem(recentKey, JSON.stringify(next))
  }

  const saveRoute = () => {
    if (origin === destination) return flash('Choose two different cities.')
    const route = makeRoute()
    const next = [route, ...saved.filter(item => !(item.origin === route.origin && item.destination === route.destination))].slice(0, 6)
    setSaved(next)
    localStorage.setItem(savedKey, JSON.stringify(next))
    rememberRecent(route)
    flash('Route saved on this device.')
  }

  const removeRoute = (id: string) => {
    const next = saved.filter(item => item.id !== id)
    setSaved(next)
    localStorage.setItem(savedKey, JSON.stringify(next))
  }

  const useRoute = (route?: PlannerRoute) => {
    const plan = route || makeRoute()
    if (plan.origin === plan.destination) return flash('Choose two different cities.')
    setOrigin(plan.origin)
    setDestination(plan.destination)
    setTravelDate(plan.travelDate)
    setPassengers(plan.passengers)
    rememberRecent(plan)

    const form = document.querySelector<HTMLFormElement>('.search-panel')
    const selects = form?.querySelectorAll<HTMLSelectElement>('select')
    const date = form?.querySelector<HTMLInputElement>('input[type="date"]')
    if (!form || !selects || selects.length < 3 || !date) {
      openNavigation('Search')
      flash('Search page opened. Apply the plan again.')
      return
    }
    nativeValue(selects[0], plan.origin)
    nativeValue(selects[1], plan.destination)
    nativeValue(date, plan.travelDate)
    nativeValue(selects[2], String(plan.passengers))
    setOpen(false)
    form.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flash('Plan applied to bus search.')
  }

  const openNavigation = (label: string) => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.main-nav button, .header-actions button'))
    const target = buttons.find(button => button.textContent?.trim().toLowerCase().includes(label.toLowerCase()))
    target?.click()
    setOpen(false)
  }

  const swap = () => {
    setOrigin(destination)
    setDestination(origin)
  }

  const healthy = snapshot.online && snapshot.health === 'UP'

  return <>
    <div className="ambient-network" aria-hidden="true">
      <i className="ambient-orb orb-one" /><i className="ambient-orb orb-two" /><i className="ambient-orb orb-three" />
    </div>

    <button className={`system-pulse ${healthy ? 'healthy' : 'degraded'}`} onClick={() => { setTab('status'); setOpen(true); loadStatus() }} aria-label="Open live system status">
      <i />
      <span>{snapshot.online ? (healthy ? 'Network live' : 'Checking network') : 'Offline mode'}</span>
    </button>

    <button className={`journey-orb ${open ? 'active' : ''}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="journey-assistant">
      <span className="orb-glyph">✦</span>
      <span className="orb-label">Journey assistant</span>
    </button>

    {open && <div className="assistant-backdrop" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
      <aside id="journey-assistant" className="journey-assistant" aria-label="BusBD journey assistant">
        <header className="assistant-header">
          <div><span className="assistant-kicker"><i className="live-dot" /> BusBD intelligence</span><h2>Plan with live context.</h2></div>
          <button className="assistant-close" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
        </header>

        <div className="assistant-tabs" role="tablist">
          <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')} role="tab">Smart planner</button>
          <button className={tab === 'status' ? 'active' : ''} onClick={() => { setTab('status'); loadStatus() }} role="tab">Live system</button>
        </div>

        {tab === 'plan' ? <div className="assistant-body">
          <div className="assistant-route-grid">
            <label><span>From</span><select value={origin} onChange={event => setOrigin(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
            <button className="assistant-swap" onClick={swap} aria-label="Swap cities">⇄</button>
            <label><span>To</span><select value={destination} onChange={event => setDestination(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
            <label><span>Date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={travelDate} onChange={event => setTravelDate(event.target.value)} /></label>
            <label><span>Passengers</span><select value={passengers} onChange={event => setPassengers(Number(event.target.value))}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>

          <div className="estimate-card">
            <div><span>Estimated total</span><strong>৳{estimate.fare.toLocaleString('en-BD')}</strong></div>
            <div><span>Journey time</span><strong>{estimate.hours.toFixed(1)}h</strong></div>
            <div><span>Road distance</span><strong>{estimate.distance} km</strong></div>
            <div><span>CO₂ saved vs car</span><strong>{estimate.carbon} kg</strong></div>
          </div>

          <div className="assistant-actions">
            <button className="assistant-primary" onClick={() => useRoute()}>Use in search <span>→</span></button>
            <button className="assistant-secondary" onClick={saveRoute}>☆ Save route</button>
          </div>

          {saved.length > 0 && <section className="assistant-list"><div className="assistant-list-head"><h3>Saved routes</h3><span>{saved.length}</span></div>{saved.map(route => <div className="saved-route" key={route.id}><button onClick={() => useRoute(route)}><strong>{route.origin} → {route.destination}</strong><span>{route.travelDate} · {route.passengers} passenger{route.passengers > 1 ? 's' : ''}</span></button><button className="remove-route" onClick={() => removeRoute(route.id)} aria-label={`Remove ${route.origin} to ${route.destination}`}>×</button></div>)}</section>}

          {recent.length > 0 && <section className="recent-plans"><h3>Recent plans</h3><div>{recent.map(route => <button key={route.id} onClick={() => useRoute(route)}>{route.origin} <span>→</span> {route.destination}</button>)}</div></section>}
        </div> : <div className="assistant-body">
          <div className={`system-hero ${healthy ? 'healthy' : 'degraded'}`}><span className="system-radar"><i /></span><div><span>Current platform status</span><h3>{snapshot.loading ? 'Synchronizing…' : healthy ? 'All core services operational' : snapshot.online ? 'Running with limited telemetry' : 'You are currently offline'}</h3><p>{snapshot.checkedAt ? `Last checked at ${snapshot.checkedAt}` : 'Connecting to BusBD services'}</p></div></div>
          <div className="live-metric-grid">
            <article><span>Connected districts</span><strong>{snapshot.districts || '—'}</strong><i /></article>
            <article><span>Verified operators</span><strong>{snapshot.operators || '—'}</strong><i /></article>
            <article><span>Managed buses</span><strong>{snapshot.buses || '—'}</strong><i /></article>
            <article><span>Live GPS signals</span><strong>{snapshot.gpsSignals || '—'}</strong><i /></article>
          </div>
          <div className="quick-command-grid">
            <button onClick={() => openNavigation('Live tracking')}><b>⌁</b><span>Open live tracking</span></button>
            <button onClick={() => openNavigation('My trips')}><b>▣</b><span>Find my ticket</span></button>
            <button onClick={() => openNavigation('Support')}><b>◎</b><span>Passenger support</span></button>
            <button onClick={() => openNavigation('Operations')}><b>✦</b><span>Operations portal</span></button>
          </div>
          <button className="status-refresh" onClick={loadStatus} disabled={snapshot.loading}>{snapshot.loading ? 'Refreshing live data…' : 'Refresh system snapshot'}</button>
        </div>}

        {toast && <div className="assistant-toast" role="status">{toast}</div>}
      </aside>
    </div>}
  </>
}
