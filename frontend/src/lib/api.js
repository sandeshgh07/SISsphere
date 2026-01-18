import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Vite proxy will handle /api
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const activeRole = localStorage.getItem('activeRole');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (activeRole) {
      config.headers['X-Active-Role'] = activeRole;
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
      localStorage.removeItem('activeRole');
      localStorage.removeItem('availableRoles');
      // Force redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
