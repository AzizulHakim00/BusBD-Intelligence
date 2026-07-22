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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
