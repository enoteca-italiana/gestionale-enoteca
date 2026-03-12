import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App';
import '@/styles.css';
import { registerSW } from 'virtual:pwa-register';

async function unregisterSwInDevOnce() {
  if (!import.meta.env.DEV) return;
  const key = 'scarichi.dev.swUnregistered';
  if (sessionStorage.getItem(key) === 'true') return;

  if (!('serviceWorker' in navigator)) {
    sessionStorage.setItem(key, 'true');
    return;
  }

  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) {
    sessionStorage.setItem(key, 'true');
    return;
  }

  await Promise.all(regs.map((r) => r.unregister()));
  sessionStorage.setItem(key, 'true');
}

void unregisterSwInDevOnce();

registerSW({
  immediate: true
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
