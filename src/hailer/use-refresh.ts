import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
    const interval = setInterval(() => {
      if (isBusinessHours()) {
        setRefreshKey(k => k + 1);
        setLastUpdated(new Date());
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
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
