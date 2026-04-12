import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Play, Trash2, Music, User, Clock, Loader2, Plus, Search as SearchIcon } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';
import useAuthStore from '../store/useAuthStore';

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistDetails({ playlistId, onBack }) {
    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const sendCommand = usePlayerStore(state => state.sendCommand);
    const currentUser = useAuthStore(state => state.user);

    useEffect(() => {
        if (playlistId) fetchDetails();
    }, [playlistId]);

    // Debounced search for adding new tracks
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await axios.get('/api/search', {
                    params: { q: searchQuery, source: 'youtube', limit: 5 }
                });
                setSearchResults(res.data.tracks || []);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/playlists/details/${playlistId}`);
            setPlaylist(res.data);
        } catch (err) {
            console.error('Failed to fetch details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayAll = () => {
        if (!playlist || !playlist.tracks) return;
        // Logic: Enqueue each track
        playlist.tracks.forEach(t => {
            sendCommand('ENQUEUE', { track: t });
        });
    };

    const handlePlayTrack = (track) => {
        sendCommand('ENQUEUE', { track });
    };

    const handleDeletePlaylist = async () => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta lista?')) return;
        try {
            await axios.delete(`/api/playlists/${playlistId}`);
            onBack();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar la lista');
        }
    };

    const handleDeleteTrack = async (trackId) => {
        try {
            await axios.delete(`/api/playlists/${playlistId}/tracks/${trackId}`);
            fetchDetails(); // Refresh
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
            </div>
        );
    }

    if (!playlist) return null;

    const isCreator = currentUser && currentUser.id === playlist.creator_id;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-8 mb-8">
                <div className="relative group w-48 h-48 shrink-0 shadow-2xl">
                    {playlist.creator_avatar ? (
                        <img src={playlist.creator_avatar} className="w-full h-full object-cover rounded-3xl" alt="" />
                    ) : (
                        <div className="w-full h-full bg-surfaceHighlight rounded-3xl flex items-center justify-center">
                            <Music size={64} className="text-textSecondary opacity-20" />
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-end h-48">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-textSecondary hover:text-white mb-4 transition w-fit group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Volver a listas</span>
                    </button>

                    <h2 className="text-5xl font-black mb-4 tracking-tighter">{playlist.name}</h2>

                    <div className="flex items-center gap-4 text-sm text-textSecondary">
                        <div className="flex items-center gap-2">
                            <img src={playlist.creator_avatar} className="w-6 h-6 rounded-full" alt="" />
                            <span className="text-white font-bold">{playlist.creator_name}</span>
                        </div>
                        <span>•</span>
                        <span>{playlist.tracks?.length || 0} canciones</span>
                        <span>•</span>
                        <div className="flex items-center gap-4 ml-auto">
                            <button
                                onClick={handlePlayAll}
                                className="bg-primary hover:bg-green-400 text-black px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-primary/20"
                            >
                                <Play size={20} className="fill-black" /> REPRODUCIR TODO
                            </button>
                            {isCreator && (
                                <button
                                    onClick={handleDeletePlaylist}
                                    className="p-3 bg-white/5 hover:bg-red-500/20 text-textSecondary hover:text-red-500 border border-white/10 rounded-full transition-all"
                                    title="Eliminar lista"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr className="text-left text-[11px] text-textSecondary uppercase tracking-widest">
                            <th className="px-4 py-2 font-bold w-12">#</th>
                            <th className="px-4 py-2 font-bold">Título</th>
                            <th className="px-4 py-2 font-bold hidden md:table-cell">Autor</th>
                            <th className="px-4 py-2 font-bold w-20 text-right"><Clock size={16} className="inline" /></th>
                            {isCreator && <th className="px-4 py-2 w-12"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {playlist.tracks?.map((track, i) => (
                            <tr
                                key={track.id}
                                className="group hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => handlePlayTrack(track)}
                            >
                                <td className="px-4 py-3 rounded-l-2xl text-textSecondary font-mono text-sm">
                                    <div className="group-hover:hidden">{i + 1}</div>
                                    <Play size={14} className="hidden group-hover:block text-primary fill-primary" />
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-surface rounded flex items-center justify-center shrink-0">
                                            {track.artwork_url ? (
                                                <img src={track.artwork_url} className="w-full h-full object-cover rounded" alt="" />
                                            ) : (
                                                <Music size={20} className="text-textSecondary opacity-20" />
                                            )}
                                        </div>
                                        <div className="font-semibold text-white truncate">{track.title}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-textSecondary text-sm hidden md:table-cell truncate">
                                    {track.author}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono text-sm text-textSecondary ${isCreator ? '' : 'rounded-r-2xl'}`}>
                                    {formatTime(track.duration)}
                                </td>
                                {isCreator && (
                                    <td className="px-4 py-3 text-right rounded-r-2xl">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTrack(track.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Search and Add Section (Only for Creator) */}
            {isCreator && (
                <div className="mt-12 pt-12 border-t border-white/5 pb-10">
                    <h3 className="text-xl font-bold mb-1">Añadir más canciones</h3>
                    <p className="text-textSecondary text-sm mb-6">Busca algo para complementar tu lista.</p>

                    <div className="relative mb-6 max-w-xl">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar en YouTube..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition"
                        />
                        {isSearching && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="animate-spin text-primary" size={18} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 max-w-2xl">
                        {searchResults.map((track, i) => (
                            <div 
                                key={i}
                                className="flex items-center gap-4 p-2.5 hover:bg-white/5 rounded-2xl group transition-all border border-transparent hover:border-white/5"
                            >
                                <div className="w-10 h-10 bg-surface rounded flex items-center justify-center shrink-0 overflow-hidden">
                                     {track.artworkUrl ? (
                                         <img src={track.artworkUrl} className="w-full h-full object-cover" alt="" />
                                     ) : (
                                         <Music size={20} className="text-textSecondary opacity-20" />
                                     )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">{track.title}</div>
                                    <div className="text-[10px] text-textSecondary truncate">{track.author}</div>
                                </div>
                                <button 
                                    onClick={() => handleAddToPlaylist(track)}
                                    className="px-4 py-1.5 bg-white/5 hover:bg-primary text-white hover:text-black rounded-full text-xs font-bold transition-all flex items-center gap-2"
                                >
                                    <Plus size={14} /> Añadir
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
