import { useEffect, useState } from 'react';

/**
 * Server clock offset. All timers are rendered from server timestamps (roundStart/End, phaseEndsAt),
 * so every client shows the same countdown regardless of local clock drift.
 */
let offsetMs = 0;
let bestRtt = Number.POSITIVE_INFINITY;

export const serverNow = () => Date.now() + offsetMs;

/** Record one ping sample (t0/t1 local, server time). Keeps the lowest-latency sample. */
export function recordClockSample(t0: number, server: number, t1: number) {
  const rtt = t1 - t0;
  if (rtt <= bestRtt) {
    bestRtt = rtt;
    offsetMs = server - (t0 + rtt / 2);
  }
}

export function resetClock() {
  bestRtt = Number.POSITIVE_INFINITY;
}

/** Re-renders every `intervalMs` and returns the current server time. */
export function useServerNow(intervalMs = 100) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const secondsLeft = (until: number | null | undefined, now: number) =>
  until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
