import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Search as SearchIcon, Plus, Loader2, Play, Music, Cloud, ChevronDown } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const sources = [
    { id: 'youtube', name: 'YouTube', icon: Play, color: 'text-red-500' },
    { id: 'spotify', name: 'Spotify', icon: Music, color: 'text-green-500' },
    { id: 'soundcloud', name: 'SoundCloud', icon: Cloud, color: 'text-orange-500' },
];

export default function Search({ guildId }) {
    const [query, setQuery] = useState('');
    const [source, setSource] = useState('youtube');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    
    const sendCommand = usePlayerStore(state => state.sendCommand);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced real-time search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            performSearch();
        }, 500);

        return () => clearTimeout(timer);
    }, [query, source]);

    async function performSearch() {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await axios.get('/api/search', {
                params: { q: query, source }
            });
            setResults(res.data.tracks || []);
        } catch (err) {
            console.error('Search error:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        
        // If results are already here and we hit Enter, play the first one
        if (results.length > 0) {
            handlePlay(results[0]);
        } else {
            // Force immediate search if no results yet
            performSearch();
        }
    };

    const handlePlay = async (track) => {
        sendCommand('ENQUEUE', { track });
    };

    const activeSource = sources.find(s => s.id === source);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <h2 className="text-3xl font-bold mb-6">Buscar</h2>
            
            <form onSubmit={handleSubmit} className="mb-6 relative flex gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={20} />
                    <input 
                        type="text" 
                        placeholder="¿Qué quieres escuchar hoy?"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition placeholder-textSecondary shadow-lg"
                    />
                </div>

                {/* Custom Source Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="h-full bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl px-4 flex items-center gap-3 transition min-w-[140px] shadow-lg"
                    >
                        <activeSource.icon size={20} className={activeSource.color} />
                        <span className="font-medium text-sm">{activeSource.name}</span>
                        <ChevronDown size={16} className={`ml-auto transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {sources.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                        setSource(s.id);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/10 ${source === s.id ? 'bg-primary/20 text-white' : 'text-textSecondary hover:text-white'}`}
                                >
                                    <s.icon size={18} className={s.color} />
                                    <span className="font-medium">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <button type="submit" className="hidden"></button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {loading && (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                        <Loader2 className="animate-spin text-primary" size={40} />
                        <p className="text-textSecondary animate-pulse">Buscando en {activeSource.name}...</p>
                    </div>
                )}
                
                {!loading && results.length === 0 && query && (
                    <div className="text-center p-12 text-textSecondary italic">
                        No se han encontrado resultados para "{query}"
                    </div>
                )}

                {!loading && results.map((track, i) => (
                    <div 
                        key={i} 
                        className="flex items-center gap-4 p-3.5 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-2xl group transition cursor-pointer relative overflow-hidden" 
                        onClick={() => handlePlay(track)}
                    >
                        <div className="relative w-14 h-14 shrink-0 shadow-lg">
                            {track.artworkUrl ? (
                                <img src={track.artworkUrl} className="w-full h-full object-cover rounded-xl bg-surface" alt="" />
                            ) : (
                                <div className="w-full h-full bg-surfaceHighlight rounded-xl flex items-center justify-center">🎵</div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                                <Plus size={24} className="text-white transform scale-75 group-hover:scale-100 transition-transform" />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white truncate text-base group-hover:text-primary transition-colors">{track.title}</h4>
                            <p className="text-textSecondary text-xs mt-0.5 truncate uppercase tracking-wider">{track.author}</p>
                        </div>

                        <div className="text-sm font-mono text-textSecondary/50 group-hover:text-textSecondary transition-colors hidden sm:block">
                            {formatTime(track.duration)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
