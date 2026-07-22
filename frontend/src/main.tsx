import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ExperienceLayer from './experience/ExperienceLayer'
import './fonts.css'
import './styles.css'
import './app-overrides.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ExperienceLayer />
  </React.StrictMode>
)
