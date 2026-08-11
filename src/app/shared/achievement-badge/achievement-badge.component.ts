import { Component, input } from '@angular/core';
import { TiltDirective } from '../tilt/tilt.directive';
import { AchievementRarity } from '../../core/services/progression.service';

export type { AchievementRarity };

@Component({
  selector: 'app-achievement-badge',
  imports: [TiltDirective],
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
}
