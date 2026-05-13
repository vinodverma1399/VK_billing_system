// Centralized API URL — reads from environment variable in production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API = `${API_URL}/api`;
export default API_URL;
