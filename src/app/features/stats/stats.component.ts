import { Component, computed, inject } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { MODES } from '../../core/services/modes.service';
import { ModeKey } from '../../core/models/game.models';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent {
  private readonly storage = inject(StorageService);

  readonly profile = this.storage.profile;
  readonly streaks = this.storage.streaks;
  readonly stats = this.storage.stats;

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

  readonly winRate = computed(() => {
    const t = this.totals();
    return t.played ? `${Math.round((t.won / t.played) * 100)}%` : '0%';
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
