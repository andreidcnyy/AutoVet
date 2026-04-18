import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: any;
        Echo: Echo<any>;
    }
}

window.Pusher = Pusher;

const getAuthToken = (): string | null => {
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

const echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'no-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/api/broadcasting/auth',
    auth: {
        headers: getHeaders(),
    },
});

export default echo;
