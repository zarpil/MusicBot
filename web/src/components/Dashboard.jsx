import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const [guilds, setGuilds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/guilds').then(res => {
      setGuilds(res.data);
    }).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col items-center pt-20 p-8 min-h-full bg-background overflow-y-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold mb-3 tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Panel de Música</h1>
        <p className="text-textSecondary text-lg">Selecciona un servidor para gestionar la música</p>
      </div>
 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl px-4">
        {guilds.map(guild => (
          <div 
            key={guild.id} 
            onClick={() => navigate(`/guild/${guild.id}`)}
            className="group relative bg-surface/50 hover:bg-surfaceHighlight p-6 rounded-[2rem] cursor-pointer transition-all duration-300 flex flex-col items-center text-center gap-4 border border-white/5 hover:border-primary/50 hover:scale-[1.02] shadow-xl"
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-primary/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blur-xl"></div>
            
            <div className="relative">
              {guild.icon ? (
                <img src={guild.icon} alt={guild.name} className="w-24 h-24 rounded-full shadow-2xl border-2 border-white/10 group-hover:border-primary/50 transition-all duration-300" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-surfaceHighlight flex items-center justify-center text-3xl font-black shadow-2xl border-2 border-white/10 group-hover:border-primary/50 transition-all duration-300">
                  {guild.name.charAt(0)}
                </div>
              )}
              {/* Online indicator or similar badge could go here */}
            </div>

            <div className="relative w-full">
              <h2 className="text-xl font-bold truncate text-white mb-1 group-hover:text-primary transition-colors">{guild.name}</h2>
              <p className="text-textSecondary/60 text-xs font-mono tracking-widest uppercase">{guild.id}</p>
            </div>

            <button className="relative mt-2 px-6 py-2 bg-white/5 group-hover:bg-primary group-hover:text-black rounded-full text-sm font-bold transition-all duration-300 border border-white/10 group-hover:border-transparent">
              GESTIONAR
            </button>
          </div>
        ))}
        {guilds.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-textSecondary bg-surface/20 rounded-[3rem] border border-dashed border-white/10">
            <p className="text-lg italic">El bot no está en ningún servidor todavía.</p>
            <button className="mt-4 text-primary hover:underline font-bold">Invitar al bot</button>
          </div>
        )}
      </div>
    </div>
  );
}
