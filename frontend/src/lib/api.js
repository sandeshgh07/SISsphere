import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Vite proxy will handle this
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
    // Optional: Handle 401 globally by redirecting to login, but better to let AuthContext handle state
    return Promise.reject(error);
  }
);

export default api;
