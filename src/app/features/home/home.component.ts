import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { ProgressionService } from '../../core/services/progression.service';
import { ModesService, MODES } from '../../core/services/modes.service';
import { GameService } from '../../core/services/game.service';
import { MockLiveActivityService } from '../../core/services/mock-live-activity.service';
import { DailyCountdownService } from '../../core/services/daily-countdown.service';
import { ModeConfig, ModeKey } from '../../core/models/game.models';
import { ModeCardComponent } from '../../shared/mode-card/mode-card.component';
import { WordCoreComponent, WordCoreState } from '../../shared/word-core/word-core.component';
import { AchievementBadgeComponent } from '../../shared/achievement-badge/achievement-badge.component';
import { CountUpDirective } from '../../shared/count-up/count-up.directive';

const MISSION_METRIC: Record<string, { field: keyof ReturnType<StorageService['getMissionLog']>; target: number }> = {
  solve_one: { field: 'wins', target: 1 },
  no_hint_win: { field: 'noHintWins', target: 1 },
  four_or_fewer: { field: 'fastGuessWins', target: 1 },
  hard_mode_win: { field: 'hardWins', target: 1 },
  extreme_mode_win: { field: 'extremeWins', target: 1 },
  three_streak: { field: 'bestStreakToday', target: 3 },
  play_three: { field: 'games', target: 3 },
};

@Component({
  selector: 'app-home',
  imports: [ModeCardComponent, RouterLink, WordCoreComponent, AchievementBadgeComponent, CountUpDirective, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly progression = inject(ProgressionService);
  private readonly modes = inject(ModesService);
  private readonly game = inject(GameService);
  readonly live = inject(MockLiveActivityService);
  private readonly countdown = inject(DailyCountdownService);

  readonly modeList: ModeConfig[] = Object.values(MODES).filter((m) => m.key !== 'daily');

  readonly daily = this.storage.daily;
  readonly puzzleNumber = computed(() => this.modes.dailyPuzzleNumber());
  readonly streaks = this.storage.streaks;
  readonly profile = this.storage.profile;
  readonly totalSolved = computed(() => this.storage.totalPuzzlesSolved());

  readonly coreState = computed<WordCoreState>(() => {
    const d = this.daily();
    if (d.completed && d.won) return 'success';
    if (d.started) return 'active';
    return 'idle';
  });

  readonly resetsIn = this.countdown.label;

  readonly heroResetMessage = computed(() => {
    const label = this.resetsIn();
    const d = this.daily();
    if (d.completed) return `Next puzzle in ${label}`;
    const streak = this.streaks().daily.current;
    if (streak > 0) return `${label} left to keep your ${streak}-day streak`;
    return `Today's puzzle resets in ${label}`;
  });

  readonly xpToNext = computed(() => this.progression.xpForLevel(this.profile().level));
  readonly xpPercent = computed(() => Math.min(100, Math.round((this.profile().xp / this.xpToNext()) * 100)));

  private readonly totals = computed(() => {
    const stats = this.storage.stats();
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
    return t.played ? Math.round((t.won / t.played) * 100) : 0;
  });

  /** Last 10 games (oldest -> newest), 1 = win / 0 = loss, for the mini form sparkline. */
  readonly recentForm = computed(() => this.storage.history().slice(0, 10).reverse().map((h) => (h.won ? 1 : 0)));

  readonly statCards = computed(() => {
    const s = this.streaks();
    const form = this.recentForm();
    const recentWins = form.filter((v) => v === 1).length;
    return [
      { icon: '🔥', label: 'Streak', value: String(s.current), sub: `Best ${s.best}`, spark: form },
      { icon: '📅', label: 'Daily Streak', value: String(s.daily.current), sub: `Best ${s.daily.best}`, spark: null },
      { icon: '✅', label: 'Solved', value: String(this.totalSolved()), sub: `${recentWins}/${form.length || 0} recent`, spark: form },
      { icon: '📈', label: 'Win Rate', value: `${this.winRate()}%`, sub: `${this.totals().played} played`, spark: form },
    ];
  });

  readonly missions = this.storage.missions;
  readonly missionLog = this.storage.missionLog;

  readonly achievementsTeaser = computed(() => {
    const unlocked = this.storage.achievements().unlocked;
    return this.progression.ACHIEVEMENTS.slice(0, 6).map((a) => ({ ...a, locked: !unlocked[a.id] }));
  });

  constructor() {
    this.storage.getDaily();
    this.progression.ensureTodaysMissions();
  }

  isMissionDone(id: string): boolean {
    return !!this.missions().claimed[id];
  }

  missionProgress(id: string): number {
    if (this.isMissionDone(id)) return 100;
    const def = MISSION_METRIC[id];
    if (!def) return 0;
    const log = this.missionLog();
    const current = Number(log[def.field]) || 0;
    return Math.min(100, Math.round((current / def.target) * 100));
  }

  playDaily(): void {
    if (this.daily().completed) return;
    this.game.startSession('daily', this.game.defaultSelectionsFor());
    this.router.navigate(['/play']);
  }

  openSetup(modeKey: ModeKey): void {
    this.router.navigate(['/setup', modeKey]);
  }

  sparkPoints(values: number[] | null): string {
    if (!values || values.length < 2) return '';
    const w = 100;
    const h = 24;
    const step = w / (values.length - 1);
    return values.map((v, i) => `${(i * step).toFixed(1)},${(h - v * (h - 4) - 2).toFixed(1)}`).join(' ');
  }
}
