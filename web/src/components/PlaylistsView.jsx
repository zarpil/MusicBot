import { useState, useEffect } from 'react';
import axios from 'axios';
import { Library, Plus, Play, MoreVertical, Loader2, Music, User } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';

export default function PlaylistsView({ guildId, onSelect }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlaylists();
    }, [guildId]);

    const fetchPlaylists = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/playlists/${guildId}`);
            setPlaylists(res.data || []);
        } catch (err) {
            console.error('Failed to fetch playlists:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-textSecondary">Cargando listas del servidor...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold mb-1">Listas del Servidor</h2>
                    <p className="text-textSecondary text-sm">Escucha las colecciones creadas por la comunidad.</p>
                </div>
            </div>

            {playlists.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                   <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <Library size={40} className="text-textSecondary opacity-20" />
                   </div>
                   <h3 className="text-xl font-bold mb-2">No hay listas aún</h3>
                   <p className="text-textSecondary max-w-sm">Guarda tu cola actual como una lista para que aparezca aquí.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-12">
                    {playlists.map((pl) => (
                        <div 
                            key={pl.id}
                            onClick={() => onSelect(pl.id)}
                            className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all cursor-pointer relative"
                        >
                            <div className="aspect-square w-full mb-4 relative shadow-2xl">
                                {pl.creator_avatar ? (
                                    <img 
                                        src={pl.creator_avatar} 
                                        className="w-full h-full object-cover rounded-2xl bg-surface" 
                                        alt="" 
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                                        <Music size={40} className="text-primary opacity-40" />
                                    </div>
                                )}
                                
                                {/* Overlay Play Button */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-all scale-95 group-hover:scale-100">
                                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                        <Play size={24} className="text-black fill-black ml-1" />
                                    </div>
                                </div>

                                {/* Track Count Tag */}
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/5">
                                    {pl.track_count || 0} TRACKS
                                </div>
                            </div>

                            <div className="min-w-0">
                                <h4 className="font-bold text-white truncate mb-1 group-hover:text-primary transition-colors">{pl.name}</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {pl.creator_avatar ? (
                                            <img src={pl.creator_avatar} className="w-4 h-4 rounded-full border border-white/10" alt="" />
                                        ) : (
                                            <User size={12} className="text-textSecondary" />
                                        )}
                                        <span className="text-[11px] text-textSecondary truncate font-medium">{pl.creator_name || 'Desconocido'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
