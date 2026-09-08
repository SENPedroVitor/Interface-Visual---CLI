import { useEffect, useState } from 'react';

export type DayPart = 'morning' | 'midday' | 'evening' | 'night';

function computeDayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Tracks the local time-of-day bucket so the app can carry a subtle ambient
 * tint of its own, independent of the light/dark theme — gives it "its own
 * sense of time" instead of feeling frozen.
 */
export function useTimeOfDay(): DayPart {
  const [dayPart, setDayPart] = useState<DayPart>(() => computeDayPart(new Date()));

  useEffect(() => {
    // A slow-moving ambient cue only needs to catch up every few minutes.
    const interval = setInterval(() => {
      setDayPart(computeDayPart(new Date()));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return dayPart;
}
