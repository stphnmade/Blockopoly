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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/asset-cache-sw.js").catch(() => {
      /* Asset caching is an optimization; the app should still run without it. */
    });
  });
}
