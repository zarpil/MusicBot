import { create } from 'zustand';
import axios from 'axios';

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('token') || null,
  user: null,
  loading: !!localStorage.getItem('token'),

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    // Configure axios for future requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ token, user, loading: false });
  },

  checkAuth: async () => {
    const { token } = get();
    if (!token) {
      set({ loading: false });
      return;
    }

    try {
      // Configure axios for this request
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await axios.get('/api/auth/me');
      set({ user: res.data, loading: false });
    } catch (err) {
      console.error('Session expired or invalid:', err);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      set({ token: null, user: null, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    set({ token: null, user: null });
  }
}));

export default useAuthStore;
