import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Play, Trash2, Music, User, Clock, Loader2, Plus, Search as SearchIcon, X, GripVertical, Heart } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import usePlayerStore from '../store/usePlayerStore';
import useAuthStore from '../store/useAuthStore';

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalTime(ms) {
    if (!ms || isNaN(ms)) return '0 min';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    
    if (h > 0) {
        return `${h} h ${m} min`;
    }
    return `${m} min`;
}

export default function PlaylistDetails({ playlistId, onBack }) {
    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [favUris, setFavUris] = useState(new Set());

    const sendCommand = usePlayerStore(state => state.sendCommand);
    const currentUser = useAuthStore(state => state.user);

    useEffect(() => {
        if (playlistId) fetchDetails();
        // Fetch favorites on mount
        axios.get('/api/favorites').then(res => {
            setFavUris(new Set(res.data.map(f => f.track_uri)));
        }).catch(() => {});
    }, [playlistId]);

    const handleToggleFavorite = async (e, track) => {
        e.stopPropagation(); // Don't play the track when clicking heart
        const uri = track.uri || track.track_uri;
        const isCurrentlyFav = favUris.has(uri);

        try {
            if (isCurrentlyFav) {
                await axios.delete('/api/favorites', { data: { uri } });
                setFavUris(prev => {
                    const next = new Set(prev);
                    next.delete(uri);
                    return next;
                });
            } else {
                // Formatting for the API (standardizing keys)
                const trackData = {
                    uri: uri,
                    title: track.title,
                    author: track.author,
                    duration: track.duration,
                    artworkUrl: track.artwork_url || track.artworkUrl,
                    sourceName: track.source_name || track.sourceName
                };
                await axios.post('/api/favorites', { track: trackData });
                setFavUris(prev => new Set(prev).add(uri));
            }
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    };

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

    const handleAddToPlaylist = async (track) => {
        try {
            await axios.post(`/api/playlists/${playlistId}/tracks`, { track });
            fetchDetails(); // Refresh list to show new track
            // Optional: clear search if you want, but maybe the user wants to add more
        } catch (err) {
            alert(err.response?.data?.error || 'Error al añadir canción');
        }
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

    const handleReorder = async (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;

        const newTracks = Array.from(playlist.tracks);
        const [reorderedTrack] = newTracks.splice(result.source.index, 1);
        newTracks.splice(result.destination.index, 0, reorderedTrack);

        setPlaylist({ ...playlist, tracks: newTracks });

        try {
            await axios.put(`/api/playlists/${playlistId}/reorder`, {
                trackIds: newTracks.map(t => t.id)
            });
        } catch (err) {
            console.error('Failed to reorder tracks:', err);
            fetchDetails(); // Revert on failure
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
    const totalDuration = playlist.tracks?.reduce((acc, t) => acc + (t.duration || 0), 0) || 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
                <div className="relative group w-48 h-48 md:w-56 md:h-56 shrink-0 shadow-2xl">
                    {playlist.creator_avatar ? (
                        <img src={playlist.creator_avatar} className="w-full h-full object-cover rounded-[2rem] md:rounded-3xl" alt="" />
                    ) : (
                        <div className="w-full h-full bg-surfaceHighlight rounded-[2rem] md:rounded-3xl flex items-center justify-center">
                            <Music size={64} className="text-textSecondary opacity-20" />
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-center md:justify-end text-center md:text-left">
                    <button
                        onClick={onBack}
                        className="hidden md:flex items-center gap-2 text-textSecondary hover:text-white mb-4 transition w-fit group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Volver a listas</span>
                    </button>

                    <h2 className="text-3xl md:text-6xl font-black mb-3 md:mb-4 tracking-tighter leading-none">{playlist.name}</h2>

                    <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-textSecondary">
                        <div className="flex items-center gap-2">
                            <img src={playlist.creator_avatar} className="w-6 h-6 rounded-full" alt="" />
                            <span className="text-white font-bold">{playlist.creator_name}</span>
                        </div>
                        <div className="hidden md:block">|</div>
                        <div className="flex items-center gap-4">
                            <span>{playlist.tracks?.length || 0} canciones</span>
                            <span>•</span>
                            <span>{formatTotalTime(totalDuration)}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-6">
                        <button 
                            onClick={handlePlayAll}
                            className="bg-primary hover:bg-pink-400 text-black px-6 md:px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-xl shadow-primary/20"
                        >
                            <Play size={20} className="fill-black" /> REPRODUCIR TODO
                        </button>
                        {isCreator && (
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setIsSearchModalOpen(true)}
                                    className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-full font-bold flex items-center gap-2 transition-all border border-white/10"
                                    title="Añadir canción"
                                >
                                    <Plus size={20} />
                                    <span className="hidden md:inline">AÑADIR</span>
                                </button>
                                <button 
                                    onClick={handleDeletePlaylist}
                                    className="p-3 bg-white/5 hover:bg-red-500/20 text-textSecondary hover:text-red-500 border border-white/10 rounded-full transition-all"
                                    title="Eliminar lista"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                       {/* Tracks List */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <DragDropContext onDragEnd={handleReorder}>
                    <Droppable droppableId="playlist-tracks" isDropDisabled={!isCreator}>
                        {(provided) => (
                            <div 
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-2 pb-20"
                            >
                                {/* Desktop Header (Hidden on Mobile) */}
                                <div className="hidden md:grid grid-cols-[48px_48px_1fr_1fr_48px_80px_48px] gap-4 px-4 py-2 text-[11px] text-textSecondary uppercase tracking-widest font-bold border-b border-white/5 mb-2">
                                    <span>#</span>
                                    <span></span>
                                    <span>Título</span>
                                    <span>Autor</span>
                                    <span className="text-center"><Heart size={14} className="inline opacity-40" /></span>
                                    <span className="text-right"><Clock size={14} className="inline opacity-40" /></span>
                                    <span></span>
                                </div>

                                {playlist.tracks?.map((track, i) => (
                                    <Draggable 
                                        key={track.id.toString()} 
                                        draggableId={track.id.toString()} 
                                        index={i}
                                        isDragDisabled={!isCreator}
                                    >
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                onClick={() => handlePlayTrack(track)}
                                                className={`flex md:grid md:grid-cols-[48px_48px_1fr_1fr_48px_80px_48px] items-center gap-4 p-3 md:p-2 rounded-2xl md:rounded-xl group transition-all cursor-pointer border border-transparent ${
                                                    snapshot.isDragging 
                                                        ? 'bg-surfaceHighlight shadow-2xl scale-[1.02] border-white/20 z-[200]' 
                                                        : 'hover:bg-white/5'
                                                }`}
                                            >
                                                {/* Index / Play Icon */}
                                                <div className="hidden md:flex items-center justify-center text-textSecondary font-mono text-sm">
                                                    <span className="group-hover:hidden">{i + 1}</span>
                                                    <Play size={14} className="hidden group-hover:block text-primary fill-primary" />
                                                </div>

                                                {/* Drag Handle */}
                                                {isCreator ? (
                                                    <div 
                                                        {...provided.dragHandleProps}
                                                        className="text-textSecondary opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing p-1"
                                                    >
                                                        <GripVertical size={16} />
                                                    </div>
                                                ) : <div className="hidden md:block"></div>}

                                                {/* Track Info (Artwork + Title + Author) */}
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-12 h-12 md:w-10 md:h-10 bg-surface rounded-xl md:rounded-lg flex items-center justify-center shrink-0 shadow-lg">
                                                        {track.artwork_url ? (
                                                            <img src={track.artwork_url} className="w-full h-full object-cover rounded-xl md:rounded-lg" alt="" />
                                                        ) : (
                                                            <Music size={20} className="text-textSecondary opacity-20" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold md:font-semibold text-white truncate text-base md:text-sm">{track.title}</div>
                                                        <div className="text-xs text-textSecondary md:hidden truncate mt-0.5">{track.author}</div>
                                                    </div>
                                                </div>

                                                {/* Desktop Author Column */}
                                                <div className="hidden md:block text-textSecondary text-xs truncate">
                                                    {track.author}
                                                </div>

                                                {/* Favorite Button */}
                                                <div className="flex items-center justify-center">
                                                    <button 
                                                        onClick={(e) => handleToggleFavorite(e, track)}
                                                        className={`p-2 rounded-full transition-colors ${favUris.has(track.uri || track.track_uri) ? 'text-primary' : 'text-textSecondary hover:text-white hover:bg-white/10'}`}
                                                    >
                                                        <Heart size={18} md:size={16} fill={favUris.has(track.uri || track.track_uri) ? "currentColor" : "none"} />
                                                    </button>
                                                </div>

                                                {/* Duration */}
                                                <div className="text-right font-mono text-xs md:text-sm text-textSecondary pr-2">
                                                    {formatTime(track.duration)}
                                                </div>

                                                {/* Delete Button (Creator only) */}
                                                {isCreator && (
                                                    <div className="hidden md:flex items-center justify-end">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTrack(track.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>
   </div>

            {/* Search Modal (Only for Creator) */}
            {isCreator && isSearchModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div 
                        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decorative background glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[80px] rounded-full"></div>
                        
                        <div className="flex items-center justify-between mb-8 relative">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-1">Añadir canciones</h3>
                                <p className="text-textSecondary text-sm">Busca música para complementar "{playlist.name}"</p>
                            </div>
                            <button 
                                onClick={() => setIsSearchModalOpen(false)}
                                className="p-2 hover:bg-white/5 rounded-full text-textSecondary hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="relative mb-8 relative">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={20} />
                            <input 
                                type="text" 
                                placeholder="Busca por nombre, artista o enlace..."
                                value={searchQuery}
                                autoFocus
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition placeholder:text-textSecondary/50 shadow-inner"
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Loader2 className="animate-spin text-primary" size={20} />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar relative">
                            {searchResults.length === 0 && searchQuery && !isSearching && (
                                <div className="text-center py-8 text-textSecondary italic text-sm">
                                    No se han encontrado resultados
                                </div>
                            )}

                            {searchResults.map((track, i) => (
                                <div 
                                    key={i}
                                    className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl group transition-all border border-transparent hover:border-white/5"
                                >
                                    <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
                                         {track.artworkUrl ? (
                                             <img src={track.artworkUrl} className="w-full h-full object-cover" alt="" />
                                         ) : (
                                             <Music size={24} className="text-textSecondary opacity-20" />
                                         )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{track.title}</div>
                                        <div className="text-[11px] text-textSecondary/60 truncate uppercase tracking-wider mt-0.5">{track.author}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => handleToggleFavorite(e, track)}
                                            className={`p-2 rounded-full transition-colors ${favUris.has(track.uri) ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-white hover:bg-white/10'}`}
                                            title={favUris.has(track.uri) ? "Quitar de favoritos" : "Añadir a favoritos"}
                                        >
                                            <Heart size={16} fill={favUris.has(track.uri) ? "currentColor" : "none"} />
                                        </button>
                                        <button 
                                            onClick={() => handleAddToPlaylist(track)}
                                            className="px-5 py-2 bg-primary hover:bg-pink-400 text-black rounded-full text-xs font-bold transition-all flex items-center gap-2 transform active:scale-95 shadow-lg shadow-primary/10"
                                        >
                                            <Plus size={14} /> AÑADIR
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Backdrop Click */}
                    <div className="absolute inset-0 -z-10" onClick={() => setIsSearchModalOpen(false)}></div>
                </div>
            )}
        </div>
    );
}
