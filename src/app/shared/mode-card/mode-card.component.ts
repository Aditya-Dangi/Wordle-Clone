import { Component, computed, inject, input, output } from '@angular/core';
import { ModeConfig } from '../../core/models/game.models';
import { StorageService } from '../../core/services/storage.service';
import { ModeVisualComponent } from '../mode-visual/mode-visual.component';

function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

@Component({
  selector: 'app-mode-card',
  imports: [ModeVisualComponent],
  templateUrl: './mode-card.component.html',
  styleUrl: './mode-card.component.scss',
  host: { class: 'mode-card-host' },
})
export class ModeCardComponent {
  private readonly storage = inject(StorageService);

  readonly mode = input.required<ModeConfig>();
  readonly activated = output<void>();

  private readonly stats = computed(() => this.storage.stats()[this.mode().key]);

  readonly bestLine = computed(() => {
    const s = this.stats();
    if (!s || s.played === 0) return 'Not played yet';
    if (this.mode().key === 'timeAttack' && s.bestTimeMs != null) return `Best time ${formatTime(s.bestTimeMs)}`;
    if (s.bestScore > 0) return `Best score ${s.bestScore}`;
    return `${s.won}/${s.played} won`;
  });

  readonly played = computed(() => this.stats()?.played ?? 0);
}
