import type { AudioSource } from "expo-audio";

// Bundled placement clips work on the first installation without a separate
// content host. Sources, transcript checks and hashes accompany the WAV files.
export const placementAudio: Record<string, AudioSource> = {
  "placement-water": require("../../../../../packages/content/assets/placement/placement-water.wav"),
  "placement-right": require("../../../../../packages/content/assets/placement/placement-right.wav"),
  "placement-desire": require("../../../../../packages/content/assets/placement/placement-desire.wav"),
};
