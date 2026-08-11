import { Component, computed, inject } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { ProgressionService } from '../../core/services/progression.service';
import { AchievementBadgeComponent } from '../../shared/achievement-badge/achievement-badge.component';

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

  readonly items = computed(() => {
    const unlocked = this.storage.achievements().unlocked;
    return this.progression.ACHIEVEMENTS.map((a) => ({ ...a, locked: !unlocked[a.id] }));
  });
}
