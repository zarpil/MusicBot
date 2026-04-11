import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const [guilds, setGuilds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://localhost:3001/api/guilds').then(res => {
      setGuilds(res.data);
    }).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 h-full bg-background overflow-y-auto">
      <h1 className="text-4xl font-bold mb-2">Panel de Música</h1>
      <p className="text-textSecondary mb-8">Selecciona un servidor para gestionar la música</p>
 
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
        {guilds.map(guild => (
          <div 
            key={guild.id} 
            onClick={() => navigate(`/guild/${guild.id}`)}
            className="bg-surface hover:bg-surfaceHighlight p-4 rounded-xl cursor-pointer transition flex items-center gap-4 group shadow-md hover:shadow-lg border border-transparent hover:border-primary/50"
          >
            {guild.icon ? (
              <img src={guild.icon} alt={guild.name} className="w-16 h-16 rounded-full group-hover:scale-105 transition-transform" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-surfaceHighlight flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
                {guild.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold truncate group-hover:text-primary transition-colors">{guild.name}</h2>
              <p className="text-textSecondary text-sm">{guild.id}</p>
            </div>
          </div>
        ))}
        {guilds.length === 0 && (
          <div className="col-span-full text-center text-textSecondary mt-8">
            El bot no está en ningún servidor todavía.
          </div>
        )}
      </div>
    </div>
  );
}
