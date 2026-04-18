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

export function getEcho() {
    if (!echoInstance) {
        echoInstance = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY || 'no-key',
            wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
            wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
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
