import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import V23Portal from './V23Portal'
import './fonts.css'
import './styles.css'
import './v1.css'
import './v23.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <V23Portal />
  </React.StrictMode>
)
