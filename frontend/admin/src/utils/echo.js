import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echoInstance = null;

const getAuthToken = () => {
    try {
        const stored = localStorage.getItem('user');
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed?.token || null;
    } catch (e) {
        return null;
    }
};

const getHeaders = () => {
    const token = getAuthToken();
    return {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
    };
};

/**
 * With no Pusher key configured, real-time is switched off entirely and this
 * module hands back a stub that silently absorbs every call.
 *
 * Without it, every screen that subscribes to a channel opened a WebSocket to
 * pusher.com using the literal key "unconfigured" and then retried it on a
 * timer. On a machine with no internet that is a steady stream of failures
 * behind a demo, and the backend already broadcasts to the log rather than to
 * Pusher, so there was never anything on the other end to hear.
 *
 * Every consumer keeps calling echo.private(...).listen(...) as before; the
 * calls simply do nothing. Set VITE_PUSHER_APP_KEY to turn it back on.
 */
export const realtimeEnabled = Boolean(
  (import.meta.env.VITE_PUSHER_APP_KEY || '').trim()
);

const noopChannel = new Proxy({}, {
  get() {
    // Channel methods chain (listen, stopListening, subscribed, error),
    // so each one answers with the channel again.
    return () => noopChannel;
  },
});

const noopEcho = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'connector' || prop === 'options') return {};
    return () => noopChannel;
  },
});

export function getEcho() {
    if (!realtimeEnabled) return noopEcho;

    if (!echoInstance) {
        echoInstance = new Echo({
            broadcaster: 'pusher',
            key: import.meta.env.VITE_PUSHER_APP_KEY || 'unconfigured',
            cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap1',
            forceTLS: true,
            enabledTransports: ['ws', 'wss'],
            authEndpoint: '/api/broadcasting/auth',
            auth: { headers: getHeaders() },
            activityTimeout: 30000,
            pongTimeout: 6000,
        });
    }
    return echoInstance;
}

export function destroyEcho() {
    if (echoInstance) {
        try { echoInstance.disconnect(); } catch (_) {}
        echoInstance = null;
    }
}

const echoProxy = new Proxy({}, {
    get(_target, prop) {
        return getEcho()[prop];
    },
});

export default echoProxy;
