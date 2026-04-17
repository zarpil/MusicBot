import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, Heart, History as HistoryIcon, Library } from 'lucide-react';

import usePlayerStore from '../store/usePlayerStore';
import Sidebar from './Sidebar';
import BottomPlayer from './BottomPlayer';
import Search from './Search';
import Queue from './Queue';
import History from './History';
import PlaylistsView from './PlaylistsView';
import PlaylistDetails from './PlaylistDetails';
import FavoritesView from './FavoritesView';

export default function PlayerPage() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const connect = usePlayerStore(state => state.connect);
  const disconnect = usePlayerStore(state => state.disconnect);
  const { active } = usePlayerStore(state => state.state);

  const [view, setView] = useState('player'); // 'player', 'history', 'playlists', 'playlist-details'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);


  useEffect(() => {
    if (guildId) connect(guildId);
    return () => disconnect();
  }, [guildId, connect, disconnect]);

  return (
    <div className="flex flex-col h-screen w-full bg-background text-white overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar guildId={guildId} activeView={view} setView={setView} />

        <main className="flex-1 flex flex-col min-w-0 bg-surface m-0 md:m-2 mb-0 rounded-t-none md:rounded-t-xl overflow-hidden relative">
          {/* Mobile Header & Navigation */}
          <div className="md:hidden flex flex-col bg-surface/80 backdrop-blur-xl border-b border-surfaceHighlight shrink-0 z-[150]">
            <div className="flex items-center p-4">
              <button 
                onClick={() => navigate('/')} 
                className="flex items-center gap-2 text-textSecondary hover:text-white transition group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-semibold text-sm tracking-widest uppercase text-xs">Servidores</span>
              </button>
              <div className="flex-1 text-center font-black text-white text-sm uppercase tracking-widest">
                Tussi Bot
              </div>
              <div className="w-20"></div> {/* Spacer for alignment */}
            </div>

            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between px-6 pb-4">
              {[
                { id: 'player', icon: <SearchIcon size={18} />, label: 'Buscar' },
                { id: 'favorites', icon: <Heart size={18} />, label: 'Favoritos' },
                { id: 'history', icon: <HistoryIcon size={18} />, label: 'Historial' },
                { id: 'playlists', icon: <Library size={18} />, label: 'Listas' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex flex-col items-center gap-1 transition-all ${view === item.id ? 'text-primary' : 'text-textSecondary opacity-60'}`}
                >
                  <div className={`p-2 rounded-xl transition-all ${view === item.id ? 'bg-primary/10' : ''}`}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6 overflow-y-auto flex-1 pb-24 md:pb-6">
            {view === 'player' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                <Search guildId={guildId} />
                <Queue />
              </div>
            ) : view === 'history' ? (
              <History guildId={guildId} />
            ) : view === 'favorites' ? (
              <FavoritesView />
            ) : view === 'playlists' ? (
              <PlaylistsView 
                guildId={guildId} 
                onSelect={(id) => {
                  setSelectedPlaylistId(id);
                  setView('playlist-details');
                }} 
              />
            ) : (
              <PlaylistDetails 
                playlistId={selectedPlaylistId} 
                onBack={() => setView('playlists')} 
              />
            )}
          </div>
        </main>
      </div>

      <BottomPlayer />
    </div>
  );
}
