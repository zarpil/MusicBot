import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

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
    <div className="flex flex-col h-screen w-full bg-background text-white">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar guildId={guildId} activeView={view} setView={setView} />

        <main className="flex-1 flex flex-col min-w-0 bg-surface m-0 md:m-2 mb-0 rounded-t-none md:rounded-t-xl overflow-hidden">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center p-4 border-b border-surfaceHighlight bg-surface shrink-0">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 text-textSecondary hover:text-white transition group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-semibold text-sm tracking-widest uppercase">Servidores</span>
            </button>
          </div>

          <div className="p-4 md:p-6 overflow-y-auto flex-1">
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
