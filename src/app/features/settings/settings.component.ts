import { Component, inject } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { ModesService } from '../../core/services/modes.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { HowtoService } from '../../core/services/howto.service';
import { Difficulty, Settings } from '../../core/models/game.models';
import { ToggleRowComponent } from '../../shared/toggle-row/toggle-row.component';
import { OptionChipGroupComponent } from '../../shared/option-chips/option-chip-group.component';

interface ThemeSwatch {
  key: string;
  name: string;
  color: string;
}

const THEMES: ThemeSwatch[] = [
  { key: 'midnight', name: 'Midnight', color: 'hsl(240,12%,20%)' },
  { key: 'paper', name: 'Paper', color: 'hsl(40,30%,80%)' },
  { key: 'forest', name: 'Forest', color: 'hsl(150,25%,25%)' },
  { key: 'ocean', name: 'Ocean', color: 'hsl(205,40%,25%)' },
  { key: 'inferno', name: 'Inferno', color: 'hsl(15,60%,35%)' },
];

const TOGGLES: { key: keyof Settings; label: string; sub: string }[] = [
  { key: 'sound', label: 'Sound Effects', sub: 'Key presses, wins, and achievements' },
  { key: 'haptics', label: 'Haptics', sub: 'Vibrate on supported mobile devices' },
  { key: 'colorBlind', label: 'Color-blind Mode', sub: 'Adds symbols to tiles alongside color' },
  { key: 'highContrast', label: 'High Contrast', sub: 'Stronger borders and saturated colors' },
  { key: 'reducedMotion', label: 'Reduced Motion', sub: 'Shortens animations' },
];

@Component({
  selector: 'app-settings',
  imports: [ToggleRowComponent, OptionChipGroupComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly howto = inject(HowtoService);
  readonly modesService = inject(ModesService);

  readonly settings = this.storage.settings;
  readonly themes = THEMES;
  readonly toggles = TOGGLES;

  readonly difficultyChoices = Object.values(this.modesService.DIFFICULTIES).map((d) => ({ value: d.key, label: d.label }));

  setTheme(key: string): void {
    this.storage.setSettings({ theme: key });
  }

  toggle(key: keyof Settings, value: boolean): void {
    this.storage.setSettings({ [key]: value } as Partial<Settings>);
    if (key === 'haptics' && value && navigator.vibrate) navigator.vibrate(20);
  }

  setDefaultDifficulty(v: string | number): void {
    this.storage.setSettings({ defaultDifficulty: v as Difficulty });
  }

  openHowto(): void {
    this.howto.show();
  }

  resetStats(): void {
    this.confirmSvc.ask('Reset statistics?', 'This clears stats, streaks, XP, coins, and achievements. Settings are kept.', () => {
      this.storage.resetStats();
    });
  }

  clearAll(): void {
    this.confirmSvc.ask('Clear all data?', 'This erases everything, including settings. This cannot be undone.', () => {
      this.storage.clearAll();
    });
  }
}
