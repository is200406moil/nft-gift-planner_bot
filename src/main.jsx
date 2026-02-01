import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Signal to Telegram that the Mini App is ready IMMEDIATELY
// This MUST be called as early as possible to prevent blank screen in WebView
// The SDK handles the visual transition - calling ready() doesn't require React to be mounted
if (window.Telegram?.WebApp) {
  // Call ready() immediately to signal to Telegram that the app container is available
  // This prevents the "infinite loading" in Telegram WebView
  window.Telegram.WebApp.ready();
}

// Render the app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
