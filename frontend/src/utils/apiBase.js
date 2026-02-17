const LOCAL_API_BASE = 'http://127.0.0.1:8000';
const REMOTE_API_BASE = 'https://trueformat.onrender.com';

function isLocalHostname(hostname) {
  const host = (hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

export function resolveApiBase() {
  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return LOCAL_API_BASE;
  }

  const configured = (import.meta.env.VITE_API_BASE || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  return (import.meta.env.PROD ? REMOTE_API_BASE : LOCAL_API_BASE).replace(/\/+$/, '');
}
