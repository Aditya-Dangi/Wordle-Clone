import { Injectable, inject, signal } from '@angular/core';
import { EngineService } from './engine.service';
import { MotionService } from './motion.service';

export interface ActivityItem {
  id: number;
  text: string;
}

const ACTIVITY_TEMPLATES = [
  (n: number) => `A player solved today's challenge in ${n} guesses`,
  (n: number) => `A player reached a ${n}-day streak`,
  () => 'A player achieved a Perfect Game',
  () => 'A player unlocked Speed Demon',
  (n: number) => `A player cleared level ${n} in Survival`,
  () => 'A player won a Blitz round',
  (n: number) => `A player finished Marathon with a score of ${n}`,
];

let nextId = 1;

/**
 * There is no backend/realtime infrastructure in this app (local-only, no accounts,
 * no server) - see the project's original scope decision to skip social/multiplayer
 * features entirely. This service simulates "live world" ambience client-side so the
 * home page doesn't feel static, using a per-day deterministic seed for numbers that
 * stay put across a reload (rather than jumping around) plus a slow randomized drift.
 * It is intentionally isolated behind this one service: swapping in a real realtime
 * feed later only means replacing this file, not any component that reads it.
 */
@Injectable({ providedIn: 'root' })
export class MockLiveActivityService {
  private readonly engine = inject(EngineService);
  private readonly motion = inject(MotionService);

  readonly solvingNow = signal(0);
  readonly globalProgress = signal(0);
  readonly feed = signal<ActivityItem[]>([]);

  constructor() {
    const todayKey = this.engine.todayKey();
    const base = 14000 + this.engine.seededIndex(`solving:${todayKey}`, 16000);
    this.solvingNow.set(base);

    const dayFraction = (Date.now() - new Date().setHours(0, 0, 0, 0)) / 86400000;
    const seedProgress = this.engine.seededIndex(`progress:${todayKey}`, 20);
    this.globalProgress.set(Math.min(97, Math.round(dayFraction * 78 + seedProgress)));

    this.feed.set(this.makeInitialFeed());

    setInterval(() => {
      if (!this.motion.pageVisible()) return;
      this.solvingNow.update((v) => Math.max(9000, v + Math.round((Math.random() - 0.5) * 120)));
      this.globalProgress.update((v) => Math.min(99, v + (Math.random() < 0.35 ? 1 : 0)));
      if (Math.random() < 0.6) this.pushActivity();
    }, 4000);
  }

  private randomLine(): string {
    const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
    const n = 2 + Math.floor(Math.random() * 30);
    return template(n);
  }

  private makeInitialFeed(): ActivityItem[] {
    return Array.from({ length: 3 }, () => ({ id: nextId++, text: this.randomLine() }));
  }

  private pushActivity(): void {
    this.feed.update((list) => [{ id: nextId++, text: this.randomLine() }, ...list].slice(0, 5));
  }
}
