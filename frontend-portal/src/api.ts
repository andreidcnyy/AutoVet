import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add a request interceptor to attach the token
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('user');
  if (user) {
    const parsedUser = JSON.parse(user);
    if (parsedUser.token) {
      config.headers.Authorization = `Bearer ${parsedUser.token}`;
    }
  }
  return config;
});

// Auth
export const login = (credentials: any) => api.post('/login', credentials);
export const register = (data: any) => api.post('/register', data);
export const logout = () => api.post('/logout');
export const forgotPassword = (email: string) => api.post('/password/forgot', { email });
export const resetPassword = (data: any) => api.post('/password/reset', data);

// Pets
export const getPets = (params?: any) => api.get('/pets', { params });
export const createPet = (data: any) => api.post('/pets', data);
export const updatePet = (id: number, data: any) => api.put(`/pets/${id}`, data);
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

// Invoices
export const getInvoices = (params?: any) => api.get('/invoices', { params });
export const getInvoice = (id: number) => api.get(`/invoice/${id}`);

// Notifications
export const getNotifications = (params?: any) => api.get('/notifications', { params });
export const markNotificationAsRead = (id: number) => api.put(`/notifications/${id}`, { is_read: true });

// Pet Details
export const getPet = (id: number) => api.get(`/pets/${id}`);

// Profile
export const getProfile = () => api.get('/profile');
export const updateProfile = (data: any) => api.put('/profile', data);

// Settings
export const getSettings = () => api.get('/settings');

export default api;
