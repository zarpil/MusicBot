import { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Plus, Heart, Music, Loader2, Trash2 } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';

export default function FavoritesView() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const enqueue = usePlayerStore(state => state.enqueue);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/favorites');
      setFavorites(res.data);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (uri) => {
    try {
      await axios.delete('/api/favorites', { data: { uri } });
      setFavorites(prev => prev.filter(f => f.track_uri !== uri));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const playFavorite = (track) => {
    const trackToEnqueue = {
      title: track.title,
      author: track.author,
      uri: track.track_uri,
      duration: track.duration,
      artworkUrl: track.artwork_url,
      sourceName: track.source_name
    };
    enqueue(trackToEnqueue);
  };

  const formatDuration = (ms) => {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-primary">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p className="text-textSecondary">Cargando tus favoritos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Heart className="text-primary fill-primary" size={32} />
            Mis Favoritos
          </h1>
          <p className="text-textSecondary mt-1">Tu colección personal de canciones guardadas.</p>
        </div>
        
        {favorites.length > 0 && (
            <button 
                onClick={() => favorites.forEach(f => playFavorite(f))}
                className="bg-primary text-black font-bold px-6 py-3 rounded-full flex items-center gap-2 hover:scale-105 transition active:scale-95"
            >
                <Play size={20} fill="black" /> Reproducir Todo
            </button>
        )}
      </div>

      <div className="bg-surfaceHighlight/30 rounded-2xl border border-white/5 overflow-hidden">
        {favorites.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-surfaceHighlight rounded-full flex items-center justify-center text-textSecondary/40">
              <Heart size={40} />
            </div>
            <p className="text-textSecondary">Aún no has añadido ninguna canción a tus favoritos.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-textSecondary text-xs uppercase tracking-widest border-b border-white/5">
                <th className="p-4 font-bold w-12">#</th>
                <th className="p-4 font-bold">Título</th>
                <th className="p-4 font-bold hidden md:table-cell">Autor</th>
                <th className="p-4 font-bold text-right"><Loader2 size={16} className="opacity-0" /></th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((track, i) => (
                <tr key={track.id} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                  <td className="p-4 text-textSecondary font-mono">{i + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-lg shadow-lg">
                        {track.artwork_url ? (
                          <img src={track.artwork_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-surfaceHighlight flex items-center justify-center">
                            <Music size={20} className="text-textSecondary" />
                          </div>
                        )}
                        <button 
                            onClick={() => playFavorite(track)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Play size={20} fill="white" className="text-white" />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate group-hover:text-primary transition-colors">{track.title}</div>
                        <div className="text-sm text-textSecondary truncate md:hidden">{track.author}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-textSecondary hidden md:table-cell">{track.author}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-textSecondary font-mono mr-4 hidden sm:inline">
                            {formatDuration(track.duration)}
                        </span>
                        <button 
                            onClick={() => playFavorite(track)}
                            className="p-2 hover:bg-primary/20 hover:text-primary rounded-full transition-colors text-textSecondary"
                            title="Añadir a la cola"
                        >
                            <Plus size={18} />
                        </button>
                        <button 
                            onClick={() => removeFavorite(track.track_uri)}
                            className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors text-textSecondary"
                            title="Quitar de favoritos"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
