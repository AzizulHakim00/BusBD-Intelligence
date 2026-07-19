import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'
import type { Location } from '../types'

export default function LiveMapV23({ message }: { message: (text: string, error?: boolean) => void }) {
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<Map<string, L.CircleMarker>>(new Map())
  const route = useRef<L.Polyline | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedBus, setSelectedBus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!host.current || map.current) return
    map.current = L.map(host.current, { zoomControl: true }).setView([23.75, 90.40], 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [])

  const load = async () => {
    try {
      const result = await api.locations()
      setLocations(result)
      setSelectedBus(current => current || result[0]?.busId || '')
    } catch (error) { message((error as Error).message, true) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!map.current) return
    const active = new Set<string>()
    locations.forEach(location => {
      active.add(location.busId)
      const selected = location.busId === selectedBus
      let marker = markers.current.get(location.busId)
      if (!marker) {
        marker = L.circleMarker([location.latitude, location.longitude], {
          radius: selected ? 11 : 8,
          color: selected ? '#21d7ff' : '#087f5b',
          fillColor: selected ? '#0a2540' : '#0ba576', fillOpacity: .95, weight: 3
        }).addTo(map.current!)
        markers.current.set(location.busId, marker)
      }
      marker.setLatLng([location.latitude, location.longitude])
        .setRadius(selected ? 11 : 8)
        .setStyle({ color: selected ? '#21d7ff' : '#087f5b' })
        .bindPopup(`<b>${location.registrationNumber || 'BusBD bus'}</b><br>${Math.round(location.speedKph)} km/h<br>${location.stale ? 'Stale GPS' : 'Live GPS'}`)
    })
    markers.current.forEach((marker, key) => { if (!active.has(key)) { marker.remove(); markers.current.delete(key) } })

    const selected = locations.find(location => location.busId === selectedBus)
    if (selected) {
      map.current.panTo([selected.latitude, selected.longitude])
      const points = locations.filter(location => location.tripId === selected.tripId).map(location => [location.latitude, location.longitude] as L.LatLngTuple)
      route.current?.remove()
      if (points.length > 1) route.current = L.polyline(points, { color: '#0ba576', weight: 5, opacity: .75 }).addTo(map.current)
    }
  }, [locations, selectedBus])

  const selected = locations.find(location => location.busId === selectedBus)

  return <div className="v23-map-layout">
    <div className="v23-map" ref={host} />
    <aside className="v23-card v23-fleet-list">
      <div className="v23-card-title"><div><span className="eyebrow"><i className="live-dot" /> Five-second updates</span><h3>Live fleet</h3></div><button onClick={load}>Refresh</button></div>
      {loading && <div className="v23-empty">Loading fleet locations…</div>}
      {!loading && !locations.length && <div className="v23-empty">The GPS simulator or driver app has not sent a location yet.</div>}
      {locations.map(location => <button key={location.busId} className={selectedBus === location.busId ? 'active' : ''} onClick={() => setSelectedBus(location.busId)}>
        <div><strong>{location.registrationNumber || location.bus || `Bus ${location.busId.slice(0, 8)}`}</strong><span>{location.origin || 'Route'} → {location.destination || 'destination'}</span></div>
        <div><b>{Math.round(location.speedKph)} km/h</b><small>{location.stale ? `Stale ${location.staleSeconds || 0}s` : 'Live'}</small></div>
      </button>)}
      {selected && <section className="v23-live-detail">
        <div><span>Route progress</span><b>{Math.round((selected.routeProgress || 0) * 100)}%</b></div><progress max="1" value={selected.routeProgress || 0} />
        <div><span>Next stop</span><b>{selected.nextStop || 'Calculating'}</b></div>
        <div><span>Last update</span><b>{new Date(selected.recordedAt).toLocaleTimeString('en-BD')}</b></div>
        <div><span>GPS anomaly</span><b className={(selected.anomalyScore || 0) > .65 ? 'bad' : ''}>{Math.round((selected.anomalyScore || 0) * 100)}%</b></div>
        {selected.routeDeviation && <p className="v23-warning">⚠ Route deviation detected</p>}
        {selected.stale && <p className="v23-warning">⚠ GPS signal is stale</p>}
      </section>}
    </aside>
  </div>
}
