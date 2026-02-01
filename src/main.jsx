import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: WebApp.ready() is called in index.html inline script for earliest possible execution
// This prevents blank screen / infinite loading in Telegram WebView

// Render the app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
