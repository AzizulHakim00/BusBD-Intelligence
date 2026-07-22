import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ExperienceLayer from './experience/ExperienceLayer'
import FeatureHub from './features/FeatureHub'
import './fonts.css'
import './styles.css'
import './app-overrides.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ExperienceLayer />
    <FeatureHub />
  </React.StrictMode>
)

const localHostnames = new Set(['localhost', '127.0.0.1', '::1'])
if ('serviceWorker' in navigator && !localHostnames.has(window.location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
