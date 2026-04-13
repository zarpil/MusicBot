import { Home, Search as SearchIcon, Library, ArrowLeft, History, Heart } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar({ guildId, activeView, setView }) {
  const navigate = useNavigate();

  return (
    <nav className="hidden md:flex w-64 bg-background flex-col p-6 gap-6 pt-8 shrink-0">
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 text-textSecondary hover:text-white transition group w-fit"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-semibold text-sm tracking-widest uppercase">Cambiar Servidor</span>
      </button>
 
      <ul className="space-y-4">
        <li>
          <NavLink to={`/`} className="flex items-center gap-4 text-textSecondary hover:text-white font-bold transition">
            <Home size={24} /> Inicio
          </NavLink>
        </li>
        <li>
          <div 
            onClick={() => setView('player')}
            className={`flex items-center gap-4 font-bold transition cursor-pointer ${activeView === 'player' ? 'text-primary' : 'text-textSecondary hover:text-white'}`}
          >
            <SearchIcon size={24} /> Reproductor
          </div>
        </li>
        <li>
          <div 
            onClick={() => setView('favorites')}
            className={`flex items-center gap-4 font-bold transition cursor-pointer ${activeView === 'favorites' ? 'text-primary' : 'text-textSecondary hover:text-white'}`}
          >
            <Heart size={24} /> Mis Favoritos
          </div>
        </li>
        <li>
          <div 
            onClick={() => setView('history')}
            className={`flex items-center gap-4 font-bold transition cursor-pointer ${activeView === 'history' ? 'text-primary' : 'text-textSecondary hover:text-white'}`}
          >
            <History size={24} /> Historial
          </div>
        </li>
        <li>
          <div 
            onClick={() => setView('playlists')}
            className={`flex items-center gap-4 font-bold transition cursor-pointer ${activeView === 'playlists' ? 'text-primary' : 'text-textSecondary hover:text-white'}`}
          >
            <Library size={24} /> Listas del Servidor
          </div>
        </li>
      </ul>
 
      <div className="mt-4 pt-4 border-t border-surfaceHighlight">
         <div className="text-[10px] text-textSecondary uppercase tracking-widest font-bold px-1 mb-4 opacity-50">
            Comunidad
         </div>
         <p className="text-xs text-textSecondary/60 px-1 italic">Comparte y descubre música con tu servidor.</p>
      </div>
    </nav>
  );
}
