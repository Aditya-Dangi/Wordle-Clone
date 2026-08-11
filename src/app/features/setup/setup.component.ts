import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameService, SetupSelections } from '../../core/services/game.service';
import { ModesService, MODES } from '../../core/services/modes.service';
import { WordsService } from '../../core/services/words.service';
import { EngineService } from '../../core/services/engine.service';
import { Difficulty, ModeKey } from '../../core/models/game.models';
import { OptionChipGroupComponent } from '../../shared/option-chips/option-chip-group.component';
import { ToggleRowComponent } from '../../shared/toggle-row/toggle-row.component';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Component({
  selector: 'app-setup',
  imports: [OptionChipGroupComponent, ToggleRowComponent, RouterLink],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly game = inject(GameService);
  private readonly words = inject(WordsService);
  private readonly engine = inject(EngineService);
  readonly modesService = inject(ModesService);

  readonly modeKey = signal<ModeKey>((this.route.snapshot.paramMap.get('mode') as ModeKey) || 'classic');
  readonly mode = computed(() => MODES[this.modeKey()]);
  readonly selections = signal<SetupSelections>(this.game.defaultSelectionsFor());

  readonly difficultyChoices = Object.values(this.modesService.DIFFICULTIES).map((d) => ({
    value: d.key,
    label: d.label,
    sub: d.hardMode ? `${d.maxGuesses} guesses · reuse hints` : `${d.maxGuesses} guesses`,
  }));
  readonly wordLengthChoices = [4, 5, 6, 7, 8].map((n) => ({ value: n, label: `${n} letters` }));
  readonly guessCountChoices = [3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }));
  readonly timerChoices = [
    { value: 0, label: 'None' },
    { value: 30, label: '30s' },
    { value: 60, label: '60s' },
    { value: 120, label: '120s' },
  ];
  readonly blitzTimerChoices = (MODES.blitz.timerOptions || [30, 60, 120]).map((t) => ({ value: t, label: `${t}s` }));

  readonly categoryChoices = computed(() => [{ value: 'any', label: 'Any' }, ...this.words.categories().map((c) => ({ value: c, label: capitalize(c) }))]);

  readonly challengeRating = computed(() => this.engine.computeChallengeRating(this.selections().mods));

  setDifficulty(v: string | number): void {
    this.selections.update((s) => ({ ...s, difficulty: v as Difficulty }));
  }

  setWordLength(v: string | number): void {
    const wordLength = Number(v);
    this.selections.update((s) => ({ ...s, wordLength, category: wordLength === 5 ? s.category : 'any' }));
  }

  setCategory(v: string | number): void {
    this.selections.update((s) => ({ ...s, category: String(v) }));
  }

  setTimer(v: string | number): void {
    this.selections.update((s) => ({ ...s, timerSeconds: Number(v) }));
  }

  setMod<K extends keyof SetupSelections['mods']>(key: K, value: SetupSelections['mods'][K]): void {
    this.selections.update((s) => ({ ...s, mods: { ...s.mods, [key]: value } }));
  }

  start(): void {
    this.game.startSession(this.modeKey(), this.selections());
    this.router.navigate(['/play']);
  }
}
