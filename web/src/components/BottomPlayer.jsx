import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, Repeat } from 'lucide-react';
import usePlayerStore from '../store/usePlayerStore';

function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BottomPlayer() {
  const { active, paused, volume, position, autoplay, current, loading } = usePlayerStore(state => state.state);
  const { play, pause, skip, setVolume, toggleAutoplay, seek } = usePlayerStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  
  const [localVolume, setLocalVolume] = useState(volume);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const ignoreSyncTimer = useRef(null);

  // Sync local volume with store when it changes from outside
  useEffect(() => {
    if (!isDraggingVolume && !ignoreSyncTimer.current) {
      setLocalVolume(volume);
    }
  }, [volume, isDraggingVolume]);

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value);
    setLocalVolume(val);
    
    // Clear existing timer
    if (ignoreSyncTimer.current) clearTimeout(ignoreSyncTimer.current);
    
    // Lock sync for 1.5 seconds to prevent snap-back
    ignoreSyncTimer.current = setTimeout(() => {
      ignoreSyncTimer.current = null;
    }, 1500);

    // Debounce the actual command
    const debounceTimer = setTimeout(() => {
      setVolume(val);
    }, 50);

    return () => clearTimeout(debounceTimer);
  };

  if (loading) {
    return (
      <div className="h-24 bg-black border-t border-surfaceHighlight flex items-center px-4 animate-pulse">
        <div className="w-14 h-14 bg-surface rounded shadow-md"></div>
        <div className="ml-4">
          <div className="h-4 w-32 bg-surface rounded mb-2"></div>
          <div className="h-3 w-24 bg-surface rounded"></div>
        </div>
        <div className="flex-1 text-center text-textSecondary text-sm font-medium">Cargando pista...</div>
      </div>
    );
  }

  if (!active || !current) {
    return <div className="h-24 bg-black border-t border-surfaceHighlight flex items-center justify-center text-textSecondary text-sm">Esperando música...</div>;
  }

  const currentPosition = isDragging ? dragValue : position;
  const progressPercent = current.isStream ? 100 : (currentPosition / current.duration) * 100;

  const handleSeekStart = () => {
    setIsDragging(true);
    setDragValue(position);
  };

  const handleSeekChange = (e) => {
    setDragValue(parseInt(e.target.value));
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
    seek(dragValue);
  };

  return (
    <div className="h-auto md:h-24 bg-black border-t border-surfaceHighlight px-4 py-3 md:py-0 flex flex-col md:flex-row items-center justify-between shrink-0 select-none gap-3 md:gap-0">
      {/* Left: Track Info */}
      <div className="flex items-center gap-4 w-full md:w-[30%] md:min-w-[180px]">
        {current.artworkUrl ? (
          <img src={current.artworkUrl} className="w-12 h-12 md:w-14 md:h-14 rounded shadow-md object-cover" alt="Art" />
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 bg-surface rounded flex items-center justify-center shadow-md">🎵</div>
        )}
        <div className="overflow-hidden flex-1">
          <div className="truncate font-semibold hover:underline cursor-pointer" title={current.title}>{current.title}</div>
          <div className="flex items-center gap-2">
             <div className="text-xs text-textSecondary truncate">{current.author}</div>
             {current.requester && (
               <div className="flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                 {current.requester.avatar ? (
                   <img src={current.requester.avatar} className="w-3 h-3 rounded-full object-cover" alt="" />
                 ) : (
                   <div className="w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center text-[6px]">👤</div>
                 )}
                 <span className="truncate max-w-[80px]">{current.requester.username}</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Middle: Controls */}
      <div className="flex flex-col items-center justify-center w-full md:max-w-[40%] flex-1 gap-2">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleAutoplay} 
            className={`transition ${autoplay ? 'text-primary' : 'text-textSecondary hover:text-white'}`}
            title="Autoplay"
          >
            <Repeat size={18} />
          </button>
          
          <button 
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-md"
            onClick={paused ? play : pause}
          >
            {paused ? <Play size={18} className="ml-1" /> : <Pause size={18} />}
          </button>

          <button onClick={skip} className="text-textSecondary hover:text-white transition">
            <SkipForward size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full flex items-center gap-2 text-xs text-textSecondary font-mono group">
          <span className="w-10 text-right">{formatTime(currentPosition)}</span>
          <div className="flex-1 relative flex items-center h-4">
             {/* Visual Background */}
             <div className="absolute w-full h-1 bg-surfaceHighlight rounded-full shadow-inner"></div>
             {/* Visual Progress */}
             <div 
               className="absolute h-1 bg-primary rounded-full group-hover:bg-green-400 transition-colors pointer-events-none"
               style={{ width: `${Math.min(progressPercent, 100)}%` }}
             />
             {/* Hidden Real Input for Interaction */}
             <input 
               type="range"
               min="0"
               max={current.duration || 100}
               value={currentPosition}
               onMouseDown={handleSeekStart}
               onInput={handleSeekChange}
               onMouseUp={handleSeekEnd}
               onTouchStart={handleSeekStart}
               onTouchEnd={handleSeekEnd}
               className="absolute w-full h-4 opacity-0 cursor-pointer accent-primary"
               disabled={current.isStream}
             />
          </div>
          <span className="w-10">{current.isStream ? 'LIVE' : formatTime(current.duration)}</span>
        </div>
      </div>

      {/* Right: Volume */}
      <div className="hidden md:flex w-[30%] min-w-[180px] justify-end items-center gap-2 text-textSecondary pr-4">
        <Volume2 size={20} />
        <input 
          type="range" 
          min="0" max="100" 
          value={localVolume}
          onMouseDown={() => setIsDraggingVolume(true)}
          onMouseUp={() => setIsDraggingVolume(false)}
          onTouchStart={() => setIsDraggingVolume(true)}
          onTouchEnd={() => setIsDraggingVolume(false)}
          onChange={handleVolumeChange}
          className="w-24 h-1 bg-surfaceHighlight rounded-full appearance-none cursor-pointer accent-white hover:accent-primary transition"
        />
      </div>
    </div>
  );
}
