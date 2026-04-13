import { useState, useEffect } from 'react';
import axios from 'axios';
import { History as HistoryIcon, Clock, User, Play, Loader2, Heart } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    return date.toLocaleDateString();
}

export default function History({ guildId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [favUris, setFavUris] = useState(new Set());
    const sendCommand = usePlayerStore(state => state.sendCommand);

    useEffect(() => {
        fetchHistory();
        // Load favorites to show correct heart state
        axios.get('/api/favorites').then(res => {
            setFavUris(new Set(res.data.map(f => f.track_uri)));
        }).catch(() => {});
    }, [guildId]);

    const handleToggleFavorite = async (track) => {
        const uri = track.uri;
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
                await axios.post('/api/favorites', { 
                    track: {
                        uri: track.uri,
                        title: track.title,
                        author: track.author,
                        duration: track.duration,
                        artworkUrl: track.artwork_url,
                        sourceName: track.source_name
                    }
                });
                setFavUris(prev => new Set(prev).add(uri));
            }
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    };

    async function fetchHistory() {
        setLoading(true);
        try {
            const res = await axios.get(`/api/history/${guildId}`);
            setHistory(res.data || []);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    }

    const handlePlayAgain = (track) => {
        sendCommand('ENQUEUE', { 
            track: {
                uri: track.uri,
                title: track.title,
                author: track.author,
                duration: track.duration,
                artworkUrl: track.artwork_url,
                sourceName: track.source_name
            } 
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-textSecondary">Cargando historial...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Historial</h2>
                <button 
                    onClick={fetchHistory}
                    className="text-xs text-textSecondary hover:text-white transition-colors uppercase tracking-widest font-bold"
                >
                    Refrescar
                </button>
            </div>

            {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-textSecondary italic">
                    <HistoryIcon size={48} className="mb-4 opacity-20" />
                    No hay canciones en el historial todavía
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {history.map((item, i) => (
                        <div 
                            key={item.id || i}
                            className="flex items-center gap-4 p-3 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-2xl group transition relative overflow-hidden"
                        >
                            <div className="relative w-12 h-12 shrink-0 shadow-lg">
                                {item.artwork_url ? (
                                    <img src={item.artwork_url} className="w-full h-full object-cover rounded-xl bg-surface" alt="" />
                                ) : (
                                    <div className="w-full h-full bg-surfaceHighlight rounded-xl flex items-center justify-center text-xs">🎵</div>
                                )}
                                <div 
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity cursor-pointer"
                                    onClick={() => handlePlayAgain(item)}
                                >
                                    <Play size={20} className="text-white fill-white" />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-white truncate text-sm">{item.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-textSecondary text-[10px] truncate uppercase tracking-wider">{item.author}</p>
                                    <span className="text-[10px] text-textSecondary/40">•</span>
                                    <span className="text-[10px] text-textSecondary/60 font-mono">{formatTime(item.duration)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleToggleFavorite(item)}
                                    className={`p-2 rounded-full transition-colors ${favUris.has(item.uri) ? 'text-primary bg-primary/10' : 'text-textSecondary hover:text-white hover:bg-white/10'}`}
                                >
                                    <Heart size={16} fill={favUris.has(item.uri) ? "currentColor" : "none"} />
                                </button>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {item.requester_name && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                                        {item.requester_avatar ? (
                                            <img src={item.requester_avatar} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-3.5 h-3.5 bg-white/10 rounded-full flex items-center justify-center text-[7px]">👤</div>
                                        )}
                                        <span className="text-[9px] text-textSecondary font-medium">{item.requester_name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 text-[9px] text-textSecondary/60">
                                    <Clock size={10} />
                                    {timeAgo(item.played_at)}
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
