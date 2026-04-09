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

// Pets
export const getPets = () => api.get('/pets');
export const createPet = (data: any) => api.post('/pets', data);
export const getSpecies = () => api.get('/species?per_page=100');
export const getBreeds = (speciesId?: number) => api.get('/breeds?per_page=200' + (speciesId ? `&species_id=${speciesId}` : ''));
export const getPetSizeCategories = () => api.get('/pet-size-categories?per_page=100');
export const getWeightRanges = () => api.get('/weight-ranges?per_page=100');

// Appointments
export const getAppointments = () => api.get('/appointments');
export const createAppointment = (data: any) => api.post('/appointments', data);
export const getServices = () => api.get('/services');
export const getVets = () => api.get('/vets');

// Notifications
export const getNotifications = () => api.get('/notifications');

export default api;
