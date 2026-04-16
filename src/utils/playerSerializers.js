'use strict';

function serializeTrack(track) {
  if (!track) return null;
  // Requester could be a string (legacy/direct) or a user object
  let requesterInfo = null;
  if (track.requester) {
    if (typeof track.requester === 'object') {
      requesterInfo = {
        username: track.requester.username || track.requester.tag,
        avatar: track.requester.avatar || (track.requester.displayAvatarURL ? track.requester.displayAvatarURL({ size: 32 }) : null)
      };
    } else {
      requesterInfo = { username: track.requester, avatar: null };
    }
  }

  return {
    encoded:    track.encoded,
    title:      track.info.title,
    author:     track.info.author,
    duration:   track.info.duration,
    uri:        track.info.uri,
    artworkUrl: track.info.artworkUrl || null,
    sourceName: track.info.sourceName,
    isStream:   track.info.isStream,
    requester:  requesterInfo,
  };
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    guildId:  player.guildId,
    playing:  player.playing,
    paused:   player.paused,
    volume:   player.volume,
    position: player.position,
    autoplay: player.get('autoplay') ?? false,
    filters:  player.get('activeFilters') || {},
    current:  serializeTrack(player.queue.current),
    queue:    (player.queue.tracks || []).map(serializeTrack),
  };
}

module.exports = { serializeTrack, serializePlayer };
