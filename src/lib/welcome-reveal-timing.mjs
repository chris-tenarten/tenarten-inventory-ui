// Slow only the spark cutting interval before the first steel plate moves.
export const SPARK_PLAYBACK_RATE = 0.6;
export const STEEL_SPLIT_START_MS = 1630;
export const SPARK_SLOWDOWN_EXTRA_MS = STEEL_SPLIT_START_MS / SPARK_PLAYBACK_RATE - STEEL_SPLIT_START_MS;
export const REVEAL_DURATION_MS = 3500 + SPARK_SLOWDOWN_EXTRA_MS;

export function revealPlaybackTime(elapsed) {
  return elapsed < STEEL_SPLIT_START_MS / SPARK_PLAYBACK_RATE
    ? elapsed * SPARK_PLAYBACK_RATE
    : elapsed - SPARK_SLOWDOWN_EXTRA_MS;
}
