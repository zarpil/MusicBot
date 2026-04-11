import { create } from 'zustand';

const usePlayerStore = create((set, get) => ({
  ws: null,
  activeGuildId: null,
  
  // State from server
  state: {
    active: false,
    playing: false,
    paused: false,
    volume: 80,
    position: 0,
    autoplay: false,
    current: null,
    queue: [],
    loading: false,
  },

  connect: (guildId) => {
    const currentWs = get().ws;
    if (currentWs) {
      if (get().activeGuildId === guildId) return; // already connected
      currentWs.close();
    }

    set({ activeGuildId: guildId });

    // Connect to WebSocket
    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws?guildId=${guildId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { state } = get();

        switch (msg.type) {
          case 'STATE_SYNC':
          case 'TRACK_START':
          case 'TRACK_END':
          case 'QUEUE_END':
            if (msg.state) {
              set({ state: { ...state, ...msg.state, active: true, loading: false } });
            } else {
              set({ state: { ...state, active: false, loading: false } });
            }
            break;

          case 'SUCCESS':
            set({ state: { ...state, loading: false } });
            break;

          case 'POSITION_UPDATE':
            set({ state: { ...state, position: msg.position } });
            break;

          case 'QUEUE_UPDATE':
            set({ state: { ...state, queue: msg.queue } });
            break;
            
          default:
            break;
        }
      } catch (e) {
        console.error('Failed to parse WS msg', e);
      }
    };

    set({ ws });
  },

  disconnect: () => {
    const currentWs = get().ws;
    if (currentWs) currentWs.close();
    set({ ws: null, activeGuildId: null });
  },

  // Actions pushed via WS
  sendCommand: (type, payload = {}) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (type === 'ENQUEUE') {
        const { state } = get();
        set({ state: { ...state, loading: true } });
      }
      ws.send(JSON.stringify({ type, ...payload }));
    }
  },

  play: () => get().sendCommand('RESUME'),
  pause: () => get().sendCommand('PAUSE'),
  skip: () => get().sendCommand('SKIP'),
  setVolume: (v) => {
    const { state } = get();
    set({ state: { ...state, volume: v } });
    get().sendCommand('VOLUME', { volume: v });
  },
  seek: (pos) => get().sendCommand('SEEK', { position: pos }),
  toggleAutoplay: () => get().sendCommand('TOGGLE_AUTOPLAY'),
  removeTrack: (index) => get().sendCommand('REMOVE_TRACK', { index }),
  moveTrack: (fromIndex, toIndex) => get().sendCommand('MOVE_TRACK', { fromIndex, toIndex }),
  jumpToTrack: (index) => get().sendCommand('JUMP_TO_TRACK', { index }),
}));

export default usePlayerStore;
