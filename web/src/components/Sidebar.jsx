import { Home, Search as SearchIcon, Library, ArrowLeft } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar({ guildId }) {
  const navigate = useNavigate();

  return (
    <nav className="w-64 bg-background flex flex-col p-6 gap-6 pt-8 shrink-0">
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
          <div className="flex items-center gap-4 text-white font-bold transition cursor-pointer">
            <SearchIcon size={24} /> Reproductor
          </div>
        </li>
      </ul>
 
      <div className="mt-4 pt-4 border-t border-surfaceHighlight">
         <div className="flex items-center gap-4 text-textSecondary font-bold mb-4">
            <Library size={24} /> Tus Listas
         </div>
         <p className="text-xs text-textSecondary px-1">Próximamente...</p>
      </div>
    </nav>
  );
}
