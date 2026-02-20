const AMPLITUDE_HTTP_API = 'https://api2.amplitude.com/2/httpapi';
const DEVICE_ID_KEY = 'tf-amplitude-device-id';
const SESSION_ID_KEY = 'tf-amplitude-session-id';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

let initialized = false;
let apiKey = '';
let deviceId = '';
let sessionId = 0;
let userId = undefined;
let currentPath = '';
let listenersBound = false;

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredValue(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function setStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private browsing contexts.
  }
}

function getApiKey() {
  const env = import.meta.env || {};
  return (
    env.VITE_AMPLITUDE_API_KEY
    || env.AMPLITUDE_API_KEY
    || env.VITE_REACT_APP_AMPLITUDE_API_KEY
    || env.REACT_APP_AMPLITUDE_API_KEY
    || window.AMPLITUDE_API_KEY
    || ''
  );
}

function getSessionId() {
  const now = Date.now();
  const previous = Number(getStoredValue(SESSION_ID_KEY));
  if (!previous) return now;
  if (now - previous > SESSION_TIMEOUT_MS) return now;
  return previous;
}

function buildBaseEvent(eventType) {
  return {
    user_id: userId,
    device_id: deviceId,
    session_id: sessionId,
    event_type: eventType,
    time: Date.now(),
    platform: 'Web',
  };
}

export function trackEvent(eventType, eventProperties = {}) {
  if (!initialized || !apiKey) return;

  const event = {
    ...buildBaseEvent(eventType),
    event_properties: {
      path: window.location.pathname,
      search: window.location.search,
      ...eventProperties,
    },
  };

  fetch(AMPLITUDE_HTTP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      events: [event],
    }),
    keepalive: true,
  }).catch(() => {
    // Ignore analytics transport failures.
  });
}

function deriveButtonLabel(button) {
  const ariaLabel = button.getAttribute('aria-label');
  const dataTrackLabel = button.getAttribute('data-track-label');
  const innerText = (button.innerText || button.textContent || '').trim();
  const value = button.getAttribute('value');
  return dataTrackLabel || ariaLabel || innerText || value || 'unknown';
}

function bindGlobalListeners() {
  if (listenersBound) return;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('button, [role="button"], input[type="button"], input[type="submit"]');
    if (!button) return;

    trackEvent('button_click', {
      label: deriveButtonLabel(button),
      id: button.id || undefined,
      name: button.getAttribute('name') || undefined,
      element: button.tagName.toLowerCase(),
    });
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    trackEvent('form_submit', {
      id: form.id || undefined,
      name: form.getAttribute('name') || undefined,
      action: form.getAttribute('action') || undefined,
    });
  }, true);

  listenersBound = true;
}

export function identifyUser(nextUserId) {
  userId = nextUserId || undefined;
}

export function clearIdentifiedUser() {
  userId = undefined;
}

export function trackRouteChange(nextPath) {
  if (!initialized || !apiKey || !nextPath) return;

  const previousPath = currentPath;
  currentPath = nextPath;

  trackEvent('page_view', {
    route: nextPath,
    previous_route: previousPath || undefined,
  });

  if (previousPath && previousPath !== nextPath) {
    trackEvent('route_transition', {
      from: previousPath,
      to: nextPath,
    });
  }
}

export function initAnalytics() {
  if (initialized) return;
  apiKey = getApiKey();
  if (!apiKey) return;

  deviceId = getStoredValue(DEVICE_ID_KEY) || randomId();
  sessionId = getSessionId();

  setStoredValue(DEVICE_ID_KEY, deviceId);
  setStoredValue(SESSION_ID_KEY, String(sessionId));

  initialized = true;
  bindGlobalListeners();
  trackEvent('session_start', {
    route: window.location.pathname,
  });
}
