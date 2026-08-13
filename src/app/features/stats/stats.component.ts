import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { MODES } from '../../core/services/modes.service';
import { ModeKey } from '../../core/models/game.models';
import { CountUpDirective } from '../../shared/count-up/count-up.directive';

@Component({
  selector: 'app-stats',
  imports: [CountUpDirective],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent {
  private readonly storage = inject(StorageService);

  readonly profile = this.storage.profile;
  readonly streaks = this.storage.streaks;
  readonly stats = this.storage.stats;

  /** Flips true one frame after first paint so the guess-distribution bars can
   * transition from 0 -> their real width once, instead of rendering pre-filled. */
  readonly barsReady = signal(false);

  constructor() {
    afterNextRender(() => setTimeout(() => this.barsReady.set(true), 30));
  }

  readonly totals = computed(() => {
    const stats = this.stats();
    let played = 0;
    let won = 0;
    Object.values(stats).forEach((s) => {
      played += s.played;
      won += s.won;
    });
    return { played, won };
  });

  readonly summaryCards = computed(() => {
    const t = this.totals();
    const s = this.streaks();
    const winRatePct = t.played ? Math.round((t.won / t.played) * 100) : 0;
    return [
      { label: 'Games Played', value: t.played, suffix: '' },
      { label: 'Games Won', value: t.won, suffix: '' },
      { label: 'Win Rate', value: winRatePct, suffix: '%' },
      { label: 'Current Streak', value: s.current, suffix: '' },
      { label: 'Best Streak', value: s.best, suffix: '' },
      { label: 'Daily Streak', value: s.daily.current, suffix: '' },
      { label: 'Best Daily Streak', value: s.daily.best, suffix: '' },
      { label: 'Player Level', value: this.profile().level, suffix: '' },
    ];
  });

  readonly distribution = computed(() => {
    const stats = this.stats();
    const dist = [0, 0, 0, 0, 0, 0, 0];
    Object.values(stats).forEach((s) => {
      s.guessDistribution.forEach((v, i) => (dist[i] += v));
    });
    const max = Math.max(1, ...dist);
    return dist.map((count, i) => ({
      label: i < 6 ? String(i + 1) : '7+',
      count,
      pct: count ? Math.max(6, Math.round((count / max) * 100)) : 0,
    }));
  });

  readonly modeRows = computed(() => {
    const stats = this.stats();
    return Object.keys(stats).map((k) => {
      const s = stats[k];
      const modeName = MODES[k as ModeKey]?.label || k;
      const winRate = s.played ? `${Math.round((s.won / s.played) * 100)}%` : '-';
      const avgGuess = s.won ? (s.totalGuesses / s.won).toFixed(1) : '-';
      return { modeName, played: s.played, winRate, avgGuess };
    });
  });
}
