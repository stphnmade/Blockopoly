import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/styles/mat.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/asset-cache-sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        /* Asset caching is an optimization; the app should still run without it. */
      });
  });
}
