import { Component, input } from '@angular/core';
import { AchievementRarity } from '../../core/services/progression.service';

export type { AchievementRarity };

export interface AchievementProgress {
  current: number;
  target: number;
}

@Component({
  selector: 'app-achievement-badge',
  templateUrl: './achievement-badge.component.html',
  styleUrl: './achievement-badge.component.scss',
  host: { class: 'achievement-badge-host' },
})
export class AchievementBadgeComponent {
  readonly icon = input.required<string>();
  readonly name = input.required<string>();
  readonly description = input<string>('');
  readonly locked = input(false);
  readonly rarity = input<AchievementRarity>('common');
  readonly compact = input(false);
  readonly progress = input<AchievementProgress | null>(null);
}
