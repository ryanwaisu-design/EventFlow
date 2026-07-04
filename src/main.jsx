import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from './context/AppContext';
import App from './App';
import './styles.css';
import './seating/seating-light.css';
import './seating/seating.css';

const IS_LOCALHOST =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

async function clearServiceWorkerAndCaches() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

async function bootstrap() {
  if (import.meta.env.DEV || IS_LOCALHOST) {
    await clearServiceWorkerAndCaches();
  } else if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = `${import.meta.env.BASE_URL}service-worker.js`;
      navigator.serviceWorker.register(swPath).catch(() => {
        /* offline registration optional */
      });
    });
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
}

bootstrap();
