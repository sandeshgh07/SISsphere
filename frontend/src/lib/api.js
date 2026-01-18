import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Vite proxy will handle /api, /auth etc.
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      // Force redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
