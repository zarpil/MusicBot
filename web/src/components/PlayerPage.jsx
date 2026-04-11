import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import usePlayerStore from '../store/usePlayerStore';
import Sidebar from './Sidebar';
import BottomPlayer from './BottomPlayer';
import Search from './Search';
import Queue from './Queue';

export default function PlayerPage() {
  const { guildId } = useParams();
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

        <main className="flex-1 flex flex-col min-w-0 bg-surface m-2 mb-0 rounded-t-xl overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
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
