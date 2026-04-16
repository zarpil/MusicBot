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

    // Fetch lyrics when song changes
    useEffect(() => {
        if (!isOpen || !current) return;

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

    // Update active line based on current position
    useEffect(() => {
        if (!lyrics?.syncedLyrics || lyrics.syncedLyrics.length === 0) return;

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
    }, [position, lyrics, activeIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
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
                <button 
                    onClick={onClose}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all group"
                >
                    <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            {/* Lyrics Container */}
            <div className="relative z-10 w-full flex-1 overflow-hidden">
                <div 
                    ref={scrollRef}
                    className="h-full overflow-y-auto custom-scrollbar px-8 flex flex-col items-center py-[20vh]"
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
            </div>

            {/* Footer hint */}
            <div className="relative z-10 pb-8 pt-4 pointer-events-none opacity-40 text-textSecondary text-xs uppercase tracking-[0.2em] font-bold">
                Tussi Music Lyrics System
            </div>
        </div>
    );
}
