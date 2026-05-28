import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

let _cachedToken: string | null = null;
let _cachedTokenRaw: string | null = null;

const getToken = (): string | null => {
  const raw = localStorage.getItem('user');
  if (!raw) { _cachedToken = null; _cachedTokenRaw = null; return null; }
  if (raw === _cachedTokenRaw) return _cachedToken;
  try {
    _cachedTokenRaw = raw;
    _cachedToken = JSON.parse(raw)?.token ?? null;
  } catch { _cachedToken = null; }
  return _cachedToken;
};

// Add a request interceptor to attach the token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Detect maintenance mode (503) and account suspension/deactivation (401) globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 503) {
      window.dispatchEvent(new CustomEvent('maintenance-mode'));
    }
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const { email } = JSON.parse(stored);
          if (email) {
            const res = await fetch(`/api/portal/check-status?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            if (data.status === 'suspended' || data.status === 'deactivated') {
              window.dispatchEvent(new CustomEvent('portal-account-blocked', { detail: { status: data.status, message: data.message } }));
            }
          }
        } catch (_) {}
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (credentials: any) => api.post('/login', { ...credentials, source: 'portal' });
export const register = (data: any) => api.post('/register', data);
export const logout = () => api.post('/logout');
export const forgotPassword = (email: string) => api.post('/password/forgot', { email });
export const resetPassword = (data: any) => api.post('/password/reset', data);

// Dashboard
export const getPortalOverview = () => api.get('/portal/overview');

// Pets
export const getPets = (params?: any) => api.get('/pets', { params });
export const getPet = (id: number) => api.get(`/pets/${id}`);
export const createPet = (data: any) => api.post('/pets', data);
export const updatePet = (id: number, data: any) => api.put(`/pets/${id}`, data);
export const deletePet = (id: number) => api.delete(`/pets/${id}`);
export const getSpecies = () => api.get('/species?per_page=100');
export const getBreeds = (speciesId?: number) => api.get('/breeds?per_page=200' + (speciesId ? `&species_id=${speciesId}` : ''));
export const getPetSizeCategories = () => api.get('/pet-size-categories?per_page=100');
export const getWeightRanges = () => api.get('/weight-ranges?per_page=100');

// Appointments
export const getAppointments = (params?: any) => api.get('/appointments', { params });
export const getAppointment = (id: number) => api.get(`/appointments/${id}`);
export const createAppointment = (data: any) => api.post('/appointments', data);
export const cancelAppointment = (id: number) => api.put(`/appointments/${id}`, { status: 'cancelled' });
export const getServices = () => api.get('/services');
export const getVets = () => api.get('/vets');
export const getAvailability = (date: string, vetId?: string) => api.get('/appointments/availability', { params: { date, vet_id: vetId } });

// Medical Records
export const getMedicalRecords = (params?: any) => api.get('/medical-records', { params });
export const getMedicalRecord = (id: number) => api.get(`/medical-records/${id}`);

// Notifications
export const getNotifications = (params?: any) => api.get('/notifications', { params });
export const markNotificationAsRead = (id: number) => api.put(`/notifications/${id}`, { is_read: true });
export const getSystemAnnouncements = () => api.get('/system-announcements', { params: { target: 'portal' } });
export const getPublicSystemAnnouncements = (target: string) => api.get('/public/system-announcements', { params: { target } });

// Profile
export const getProfile = () => api.get('/profile');
export const updateProfile = (data: any) => api.put('/profile', data);
export const deleteAccount = () => api.delete('/profile');
export const recoverAccount = () => api.post('/profile/recover');

// Invoices
export const getInvoices = (params?: any) => api.get('/invoices', { params });
export const getInvoice = (id: number) => api.get(`/invoices/${id}`);

// Sync
export const triggerSync = () => api.post('/sync/trigger');

// Settings
export const getSettings = () => api.get('/settings');

// Reviews
export const getPendingReview = () => api.get('/portal/reviews/pending');
export const submitReview = (data: any) => api.post('/portal/reviews', data);
export const getPublicReviews = () => axios.get('/api/reviews/public');

export default api;
