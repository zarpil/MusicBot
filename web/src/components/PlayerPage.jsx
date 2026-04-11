import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import usePlayerStore from '../store/usePlayerStore';
import Sidebar from './Sidebar';
import BottomPlayer from './BottomPlayer';
import Search from './Search';
import Queue from './Queue';

export default function PlayerPage() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const connect = usePlayerStore(state => state.connect);
  const disconnect = usePlayerStore(state => state.disconnect);
  const { active } = usePlayerStore(state => state.state);


  useEffect(() => {
    if (guildId) connect(guildId);
    return () => disconnect();
  }, [guildId, connect, disconnect]);

  return (
    <div className="flex flex-col h-screen w-full bg-background text-white">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar guildId={guildId} />

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
            {active ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                <Search guildId={guildId} />
                <Queue />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h2 className="text-2xl font-bold mb-2">El bot no esta en ningun canal de voz</h2>
                <p className="text-textSecondary">Unete a un canal de voz y usa <code className="bg-background px-2 py-1 rounded">/play</code> para empezar.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomPlayer />
    </div>
  );
}
