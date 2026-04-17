import { useState, useEffect, useRef } from 'react';
import { X, Music, Loader2 } from 'lucide-react';
import axios from 'axios';
import usePlayerStore from '../store/usePlayerStore';

export default function LyricsOverlay({ isOpen, onClose }) {
    const { current, position, active } = usePlayerStore(state => state.state);
    const [lyrics, setLyrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const scrollRef = useRef(null);
    const lineRefs = useRef([]);

    // Manual search states
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Format seconds to mm:ss
    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Fetch lyrics when song changes
    useEffect(() => {
        if (!isOpen || !current) return;
        setIsSearching(false); // Reset search mode when song changes

        const fetchLyrics = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.get('/api/lyrics', {
                    params: {
                        title: current.title,
                        artist: current.author,
                        duration: current.duration
                    }
                });
                setLyrics(res.data);
            } catch (err) {
                console.error('Lyrics fetch error:', err);
                setError(err.response?.status === 404 ? 'No se encontraron letras para esta canción.' : 'Error al cargar las letras.');
                setLyrics(null);
            } finally {
                setLoading(false);
            }
        };

        fetchLyrics();
    }, [isOpen, current?.uri]);

    // Manual search handler
    const handleManualSearch = async (e) => {
        e?.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const res = await axios.get('/api/lyrics/search', {
                params: { q: searchQuery }
            });
            setSearchResults(res.data);
        } catch (err) {
            console.error('Manual search error:', err);
        } finally {
            setSearching(false);
        }
    };

    // Open search mode
    const openSearchMode = () => {
        setIsSearching(true);
        setSearchQuery(`${current?.author} ${current?.title}`);
        setSearchResults([]);
    };

    // Update active line based on current position
    useEffect(() => {
        if (!lyrics?.syncedLyrics || lyrics.syncedLyrics.length === 0 || isSearching) return;

        const currentPosSeconds = position / 1000;
        let index = -1;

        // Find the current line (the one whose time is closest but not greater than currentPos)
        for (let i = 0; i < lyrics.syncedLyrics.length; i++) {
            if (lyrics.syncedLyrics[i].time <= currentPosSeconds) {
                index = i;
            } else {
                break;
            }
        }

        if (index !== activeIndex) {
            setActiveIndex(index);
            // Smooth scroll to active line
            if (index !== -1 && lineRefs.current[index]) {
                lineRefs.current[index].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [position, lyrics, activeIndex, isSearching]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-x-0 top-0 bottom-24 z-[200] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
            {/* Background Backdrop with Dynamic Blur */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl" />
            
            {/* Large Blurred Artwork Background */}
            {current?.artworkUrl && (
                <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ 
                        backgroundImage: `url(${current.artworkUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(100px) saturate(2)'
                    }}
                />
            )}

            {/* Header */}
            <div className="relative z-10 w-full max-w-4xl p-8 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    {current?.artworkUrl && (
                        <img src={current.artworkUrl} className="w-16 h-16 rounded-xl shadow-2xl" alt="" />
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{current?.title || 'Unknown Track'}</h2>
                        <p className="text-primary font-medium tracking-wide uppercase text-sm mt-1">{current?.author || 'Unknown Artist'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isSearching && (
                        <button 
                            onClick={() => setIsSearching(false)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all"
                        >
                            Volver a la letra
                        </button>
                    )}
                    <button 
                        onClick={onClose}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all group"
                    >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full flex-1 overflow-hidden flex flex-col items-center">
                {isSearching ? (
                    /* Manual Search View */
                    <div className="w-full max-w-2xl px-8 flex flex-col h-full">
                        <form onSubmit={handleManualSearch} className="relative mb-8">
                            <input 
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Busca por artista o canción..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                            <button 
                                type="submit"
                                disabled={searching}
                                className="absolute right-3 top-2 bottom-2 px-6 bg-primary text-black font-bold rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {searching ? '...' : 'Buscar'}
                            </button>
                        </form>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-8">
                            {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                    <button
                                        key={result.id}
                                        onClick={() => {
                                            setLyrics(result.data);
                                            setIsSearching(false);
                                            setError(null);
                                        }}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/20 transition-all text-left group"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="text-white font-bold truncate">{result.trackName}</h4>
                                            <p className="text-textSecondary text-sm truncate">
                                                {result.artistName} • {result.albumName ? result.albumName + ' • ' : ''}
                                                <span className="text-primary/80 font-mono">{formatDuration(result.duration)}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {result.hasSynced && (
                                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                                    Sincronizada
                                                </span>
                                            )}
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Loader2 size={16} className="text-primary group-active:animate-spin" />
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : !searching && (
                                <div className="text-center py-20 text-textSecondary">
                                    <p className="text-lg">¿No es la letra correcta? <br/> Busca manualmente arriba.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Lyrics View (Standard) */
                    <div 
                        ref={scrollRef}
                        className="w-full h-full overflow-y-auto custom-scrollbar px-8 flex flex-col items-center py-[20vh]"
                    >
                        {loading ? (
                            <div className="flex flex-col items-center gap-4 text-textSecondary animate-pulse">
                                <Loader2 size={48} className="animate-spin text-primary" />
                                <p className="text-xl font-medium">Buscando letras...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-textSecondary">
                                    <Music size={40} />
                                </div>
                                <p className="text-xl text-white font-semibold">{error}</p>
                                <button 
                                    onClick={openSearchMode}
                                    className="px-6 py-3 bg-primary text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    Buscar manualmente
                                </button>
                            </div>
                        ) : (lyrics?.syncedLyrics?.length > 0) ? (
                            lyrics.syncedLyrics.map((line, i) => (
                                <p
                                    key={i}
                                    ref={el => lineRefs.current[i] = el}
                                    className={`text-3xl md:text-5xl font-bold text-center py-4 px-4 transition-all duration-500 cursor-pointer hover:text-white ${
                                        i === activeIndex 
                                        ? 'text-white scale-105 opacity-100' 
                                        : 'text-white/20 blur-[1px] hover:blur-0 scale-95 opacity-60'
                                    }`}
                                    onClick={() => usePlayerStore.getState().seek(line.time * 1000)}
                                >
                                    {line.text}
                                </p>
                            ))
                        ) : (
                            <div className="whitespace-pre-line text-2xl md:text-4xl font-bold text-white/50 text-center px-8 leading-relaxed">
                                {lyrics?.plainLyrics || 'Instrumental'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with Manual Search Toggle */}
            <div className="relative z-10 w-full max-w-4xl px-8 pb-8 pt-4 flex items-center justify-between">
                <div className="opacity-40 text-textSecondary text-[10px] uppercase tracking-[0.2em] font-bold">
                    Tussi Music System
                </div>
                {!isSearching && (
                    <button 
                        onClick={openSearchMode}
                        className="text-white/40 hover:text-white text-xs font-medium underline underline-offset-4 transition-all"
                    >
                        ¿Algún problema con la letra?
                    </button>
                )}
            </div>
        </div>
    );
}
