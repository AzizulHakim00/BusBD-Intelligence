import { useEffect, useState } from 'react'
import { api, saveToken, token } from './api'
import type { User } from './types'
import AccountV23 from './v23/AccountV23'
import PassengerBookingV23 from './v23/PassengerBookingV23'
import DriverV23 from './v23/DriverV23'
import LiveMapV23 from './v23/LiveMapV23'

type Panel = 'booking' | 'account' | 'tracking' | 'driver' | null

export default function V23Portal() {
  const [panel, setPanel] = useState<Panel>(null)
  const [user, setUser] = useState<User | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    if (!token()) return
    api.me().then(setUser).catch(() => saveToken(null))
  }, [])

  const message = (text: string, error = false) => {
    setNotice({ text, error })
    window.setTimeout(() => setNotice(current => current?.text === text ? null : current), 4500)
  }
  const auth = (result: { token: string; user: User; message?: string }) => {
    saveToken(result.token)
    setUser(result.user)
    message(result.message || 'Signed in successfully.')
  }
  const logout = () => {
    saveToken(null)
    setUser(null)
    setPanel(null)
    message('Signed out.')
  }

  return <>
    <nav className="v23-dock" aria-label="BusBD V2.3 tools">
      <button onClick={() => setPanel('booking')}><b>▦</b><span>Advanced booking</span></button>
      <button onClick={() => setPanel('tracking')}><b>⌁</b><span>Live map</span></button>
      <button onClick={() => setPanel(user?.role === 'DRIVER' ? 'driver' : 'account')}><b>◎</b><span>{user ? user.name.split(' ')[0] : 'Account'}</span></button>
      {user?.role === 'DRIVER' && <button className="driver-shortcut" onClick={() => setPanel('driver')}><b>▰</b><span>Driver PWA</span></button>}
    </nav>

    {notice && <div className={`v23-toast ${notice.error ? 'error' : ''}`}>{notice.text}<button onClick={() => setNotice(null)}>×</button></div>}

    {panel && <div className="v23-overlay" role="dialog" aria-modal="true">
      <section className="v23-shell">
        <header className="v23-shell-head">
          <div><span className="eyebrow">BusBD Enterprise V2.3</span><h2>{panel === 'booking' ? 'Complete passenger booking' : panel === 'tracking' ? 'Live fleet intelligence' : panel === 'driver' ? 'Driver mobile workspace' : 'Passenger account'}</h2></div>
          <div className="v23-head-actions">{user && <button onClick={logout}>Sign out</button>}<button className="v23-close" onClick={() => setPanel(null)}>×</button></div>
        </header>
        <div className="v23-shell-body">
          {panel === 'booking' && <PassengerBookingV23 user={user} message={message} onOpenAccount={() => setPanel('account')} />}
          {panel === 'tracking' && <LiveMapV23 message={message} />}
          {panel === 'account' && <AccountV23 user={user} onAuth={auth} setUser={setUser} message={message} />}
          {panel === 'driver' && <DriverV23 user={user} onAuth={auth} message={message} />}
        </div>
      </section>
    </div>}
  </>
}
