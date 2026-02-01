import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Render the app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Signal to Telegram that the Mini App is ready
// This MUST be called after initial render to show the app instantly
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
}
