import { useEffect, useState } from 'react';

// Was 5 min flat — with several dashboards commonly open at once, all forcing
// a fresh (non-cached) insight recompute on every tick, this could stack up
// and trip the workspace's API rate limit. 20 min base + up to 5 min of
// random jitter per cycle spreads simultaneously-opened apps apart instead of
// letting them all fire in lockstep.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const REFRESH_JITTER_MS = 5 * 60 * 1000; // + up to 5 minutes, randomized each cycle

function isBusinessHours(): boolean {
  const now = new Date();
  const day = now.getDay();   // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const isDuringHours = hour >= 7 && hour < 17;
  return isWeekday && isDuringHours;
}

export function useRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = REFRESH_INTERVAL_MS + Math.random() * REFRESH_JITTER_MS;
      timeoutId = setTimeout(() => {
        if (isBusinessHours()) {
          setRefreshKey(k => k + 1);
          setLastUpdated(new Date());
        }
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  function refresh() {
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
  }

  function fmtLastUpdated(): string {
    return lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  return { refreshKey, refresh, lastUpdated, fmtLastUpdated };
}
