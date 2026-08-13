import { Component, computed, inject } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { ProgressionService } from '../../core/services/progression.service';
import { AchievementBadgeComponent, AchievementProgress } from '../../shared/achievement-badge/achievement-badge.component';

@Component({
  selector: 'app-achievements',
  imports: [AchievementBadgeComponent],
  templateUrl: './achievements.component.html',
  styleUrl: './achievements.component.scss',
})
export class AchievementsComponent {
  private readonly storage = inject(StorageService);
  private readonly progression = inject(ProgressionService);

  readonly total = this.progression.ACHIEVEMENTS.length;
  readonly unlockedCount = computed(() => Object.keys(this.storage.achievements().unlocked).length);

  /** Only achievements with a genuine numeric threshold already tracked in storage get a
   * progress bar - no fabricated data for the purely binary/one-shot achievements. */
  private readonly progressValue: Record<string, () => number> = {
    unstoppable: () => this.storage.streaks().current,
    vocabulary_monster: () => this.storage.totalPuzzlesSolved(),
    centurion: () => this.storage.streaks().daily.current,
    hard_mode_hero: () => this.storage.difficultyStats()['hard']?.won ?? 0,
    daily_devotee: () => (this.storage.daily().history || []).filter((h) => h.won).length,
    level_10: () => this.storage.profile().level,
    coin_collector: () => this.storage.profile().lifetimeCoins,
    survivalist: () => this.storage.survivalBest().level,
  };

  private readonly progressTarget: Record<string, number> = {
    unstoppable: 10,
    vocabulary_monster: 100,
    centurion: 100,
    hard_mode_hero: 10,
    daily_devotee: 7,
    level_10: 10,
    coin_collector: 500,
    survivalist: 5,
  };

  readonly items = computed(() => {
    const unlocked = this.storage.achievements().unlocked;
    return this.progression.ACHIEVEMENTS.map((a) => {
      const locked = !unlocked[a.id];
      const target = this.progressTarget[a.id];
      const progress: AchievementProgress | null =
        locked && target ? { current: Math.min(target, this.progressValue[a.id]()), target } : null;
      return { ...a, locked, progress };
    });
  });
}
