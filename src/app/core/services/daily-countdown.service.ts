import { Injectable, signal } from '@angular/core';

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Time remaining until the daily challenge/missions reset at local midnight -
 * the same boundary EngineService.todayKey() uses, so this always agrees with
 * whatever "today" means elsewhere in the app. */
@Injectable({ providedIn: 'root' })
export class DailyCountdownService {
  readonly label = signal(formatDuration(msUntilNextLocalMidnight()));

  constructor() {
    setInterval(() => this.label.set(formatDuration(msUntilNextLocalMidnight())), 30_000);
  }
}
