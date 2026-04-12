import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import PlayerPage from './components/PlayerPage';
import Login from './components/Login';
import useAuthStore from './store/useAuthStore';
import { Loader2 } from 'lucide-react';

function App() {
  const token = useAuthStore(state => state.token);
  const loading = useAuthStore(state => state.loading);
  const checkAuth = useAuthStore(state => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center text-primary">
        <Loader2 size={48} className="animate-spin mb-4" />
        <p className="text-xl font-medium animate-pulse">Verificando sesión...</p>
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden text-white">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/guild/:guildId" element={<PlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;
