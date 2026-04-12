import { useState } from 'react';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError('El PIN debe tener 6 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/login', { pin });
      setAuth(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al verificar el PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-background flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="max-w-md w-full bg-surface p-8 rounded-2xl shadow-2xl border border-white/5">
        <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
          <Lock size={32} />
        </div>
        
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Acceso Privado</h1>
        <p className="text-textSecondary mb-8 text-sm">
          Abre Discord, utiliza el comando <code className="bg-background px-1.5 py-0.5 rounded text-primary">/play</code> sin argumentos y obtendrás tu PIN de un solo uso (válido por 5 min).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="relative group">
            <input 
              type="text" 
              maxLength="6"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPin(val);
                setError('');
              }}
              placeholder="000000"
              className="w-full bg-background border-2 border-surfaceHighlight text-center text-4xl font-mono tracking-[0.5em] rounded-xl py-6 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition placeholder-surfaceHighlight/50"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">{error}</p>
          )}

          <button 
            type="submit" 
            disabled={loading || pin.length !== 6}
            className="w-full bg-primary hover:bg-green-500 text-black font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/20 -translate-y-0.5 hover:-translate-y-1 active:translate-y-0"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>Entrar <ArrowRight size={20} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
