import usePlayerStore from '../store/usePlayerStore';
import { X, GripVertical, Play } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Queue() {
  const { queue } = usePlayerStore(state => state.state);
  const { removeTrack, moveTrack, jumpToTrack } = usePlayerStore();

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    moveTrack(result.source.index, result.destination.index);
  };

  return (
    <div className="flex flex-col h-full bg-surfaceHighlight/30 rounded-xl p-4 overflow-hidden border border-white/5">
      <h3 className="font-bold text-xl mb-4 text-white">Cola</h3>

      {queue.length === 0 ? (
        <div className="text-sm text-textSecondary flex-1 flex items-center justify-center">
          La cola está vacía
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="queue">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar"
              >
                {queue.map((track, i) => (
                  <Draggable key={`${track.encoded}-${i}`} draggableId={`${track.encoded}-${i}`} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 p-2 rounded-xl group transition-all duration-200 border border-transparent ${
                          snapshot.isDragging ? 'bg-surfaceHighlight shadow-2xl scale-[1.02] border-white/20 z-50' : 'hover:bg-white/5'
                        }`}
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="text-textSecondary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={18} />
                        </div>

                        <div className="w-4 text-right text-textSecondary text-xs font-mono hidden md:block group-hover:hidden">
                          {i + 1}
                        </div>

                        <div className="relative w-10 h-10 shrink-0 shadow-md group/thumb" onClick={() => jumpToTrack(i)}>
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} className="w-10 h-10 object-cover rounded-lg bg-surface" alt="" />
                          ) : (
                            <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center text-xs">🎵</div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity cursor-pointer">
                            <Play size={16} className="text-white fill-white" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{track.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="text-[10px] text-textSecondary truncate uppercase tracking-wider">{track.author}</div>
                            {track.requester && (
                              <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-white/5 rounded-full border border-white/5">
                                {track.requester.avatar ? (
                                  <img src={track.requester.avatar} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />
                                ) : (
                                  <div className="w-3.5 h-3.5 bg-white/10 rounded-full flex items-center justify-center text-[7px]">👤</div>
                                )}
                                <span className="text-[9px] text-textSecondary font-medium truncate max-w-[60px]">{track.requester.username}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-textSecondary font-mono hidden sm:block">
                            {track.isStream ? 'EN DIRECTO' : formatTime(track.duration)}
                          </div>
                          <button
                            className="p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-textSecondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            onClick={() => removeTrack(i)}
                            title="Eliminar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
