import type { AudioPlayer } from "expo-audio";
const players = new Set<AudioPlayer>();
export function registerPlayer(player: AudioPlayer) {
  players.add(player);
  return () => {
    players.delete(player);
  };
}
export function stopAudioPlayers(except?: AudioPlayer) {
  for (const player of players)
    if (player !== except) {
      try {
        player.pause();
      } catch {
        /* A released player cannot retain audio focus. */
      }
    }
}
