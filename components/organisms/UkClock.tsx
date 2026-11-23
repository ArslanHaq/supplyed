"use client";

import { useEffect, useState } from "react";
import { Icon } from "../atoms";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h12",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", timeZoneName: "short",
});

export function UkClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 1000 - Date.now() % 1000);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="workspace-uk-clock" role="timer" aria-label="Current UK time" aria-live="off">
      <div className="workspace-uk-clock-label"><Icon name="clock" size={14} /><span>UK time</span><span className="workspace-uk-clock-live">Live</span></div>
      <time dateTime={now?.toISOString()}>{now ? timeFormat.format(now).toUpperCase() : "--:--:--"}</time>
      <span className="workspace-uk-clock-date">{now ? dateFormat.format(now) : "Europe/London"}</span>
    </div>
  );
}
