import { create } from 'zustand';
import axios from 'axios';

const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('LocalStorage is not accessible:', e);
    return null;
  }
};

const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('LocalStorage is not accessible:', e);
  }
};

const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('LocalStorage is not accessible:', e);
  }
};

const useAuthStore = create((set, get) => ({
  token: getStorageItem('token') || null,
  user: null,
  loading: !!getStorageItem('token'),

  setAuth: (token, user) => {
    setStorageItem('token', token);
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
      removeStorageItem('token');
      delete axios.defaults.headers.common['Authorization'];
      set({ token: null, user: null, loading: false });
    }
  },

  logout: () => {
    removeStorageItem('token');
    delete axios.defaults.headers.common['Authorization'];
    set({ token: null, user: null });
  }
}));

export default useAuthStore;
