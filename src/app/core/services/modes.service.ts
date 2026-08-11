import { Injectable, inject } from '@angular/core';
import { EngineService } from './engine.service';
import { WordsService } from './words.service';
import { Difficulty, DifficultyConfig, GuessTurn, ModeConfig, ModeKey } from '../models/game.models';

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig & { hintsEnabled: boolean }> = {
  easy: { key: 'easy', label: 'Easy', description: 'Beginner-friendly', wordLength: 5, maxGuesses: 8, hardMode: false, timerSeconds: null, hintsEnabled: true },
  medium: { key: 'medium', label: 'Classic', description: 'The standard game', wordLength: 5, maxGuesses: 6, hardMode: false, timerSeconds: null, hintsEnabled: true },
  hard: { key: 'hard', label: 'Hard', description: 'Discovered letters must be used', wordLength: 5, maxGuesses: 6, hardMode: true, timerSeconds: null, hintsEnabled: true },
  extreme: { key: 'extreme', label: 'Extreme', description: 'Nightmare mode', wordLength: 5, maxGuesses: 5, hardMode: true, timerSeconds: null, hintsEnabled: false },
};

export const MODES: Record<ModeKey, ModeConfig & { rounds?: number; timerOptions?: number[] }> = {
  classic: { key: 'classic', label: 'Classic', tagline: 'The standard Wordle experience.', description: 'The standard Wordle experience.', icon: '🎯', boards: 1, category: 'core', allowsDifficultyPick: true, allowsCategoryPick: true, allowsWordLengthPick: true, allowsCustomModifiers: false },
  daily: { key: 'daily', label: 'Daily Challenge', tagline: 'One shared puzzle a day for everyone.', description: 'One shared puzzle a day for everyone.', icon: '📅', boards: 1, category: 'core', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: false, allowsCustomModifiers: false },
  endless: { key: 'endless', label: 'Endless', tagline: 'Keep solving until you lose.', description: 'Keep solving until you lose.', icon: '♾️', boards: 1, category: 'endurance', allowsDifficultyPick: true, allowsCategoryPick: true, allowsWordLengthPick: true, allowsCustomModifiers: false },
  blitz: { key: 'blitz', label: 'Blitz', tagline: 'Solve as many words as you can before time runs out.', description: 'Solve as many words as you can before time runs out.', icon: '⚡', boards: 1, category: 'timed', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false, timerOptions: [30, 60, 120] },
  timeAttack: { key: 'timeAttack', label: 'Time Attack', tagline: 'One word. Beat your best time.', description: 'One word. Beat your best time.', icon: '⏱️', boards: 1, category: 'timed', allowsDifficultyPick: true, allowsCategoryPick: true, allowsWordLengthPick: true, allowsCustomModifiers: false },
  survival: { key: 'survival', label: 'Survival', tagline: 'Every win raises the difficulty.', description: 'Every win raises the difficulty.', icon: '🌋', boards: 1, category: 'endurance', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: false, allowsCustomModifiers: false },
  marathon: { key: 'marathon', label: 'Marathon', tagline: 'Solve 10 words back to back.', description: 'Solve 10 words back to back.', icon: '🏃', boards: 1, category: 'endurance', allowsDifficultyPick: true, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false, rounds: 10 },
  suddenDeath: { key: 'suddenDeath', label: 'Sudden Death', tagline: 'One wrong guess ends the run.', description: 'One wrong guess ends the run.', icon: '💔', boards: 1, category: 'special', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false },
  multiword2: { key: 'multiword2', label: 'Double Word', tagline: 'Solve two boards with one stream of guesses.', description: 'Solve two boards with one stream of guesses.', icon: '🧩', boards: 2, category: 'multi', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false },
  multiword3: { key: 'multiword3', label: 'Triple Word', tagline: 'Solve three boards at once.', description: 'Solve three boards at once.', icon: '🧩', boards: 3, category: 'multi', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false },
  multiword4: { key: 'multiword4', label: 'Quad Word', tagline: 'Solve four boards at once.', description: 'Solve four boards at once.', icon: '🧩', boards: 4, category: 'multi', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false },
  reverse: { key: 'reverse', label: 'Reverse Mode', tagline: 'Think of a word. The game tries to guess it.', description: 'Think of a word. The game tries to guess it.', icon: '🔄', boards: 1, category: 'special', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: true, allowsCustomModifiers: false },
  custom: { key: 'custom', label: 'Custom Challenge', tagline: 'Combine modifiers and set your own rating.', description: 'Combine modifiers and set your own rating.', icon: '🛠️', boards: 1, category: 'special', allowsDifficultyPick: false, allowsCategoryPick: false, allowsWordLengthPick: false, allowsCustomModifiers: true },
};

const DAILY_EPOCH = new Date(2024, 0, 1);

/** Mode/difficulty configuration plus the mode-specific logic that doesn't belong in the pure engine. */
@Injectable({ providedIn: 'root' })
export class ModesService {
  private readonly engine = inject(EngineService);
  private readonly words = inject(WordsService);

  readonly DIFFICULTIES = DIFFICULTIES;
  readonly MODES = MODES;

  getAnswerPool(length: number): string[] {
    return this.words.answerPool(length).length ? this.words.answerPool(length) : this.words.answerPool(5);
  }

  getGuessPool(length: number): string[] {
    return this.words.guessPool(length).length ? this.words.guessPool(length) : this.words.guessPool(5);
  }

  /** Extreme mode leans on repeated-letter words for extra bite where available. */
  extremeAnswerPool(length: number): string[] {
    const pool = this.getAnswerPool(length);
    const withRepeats = pool.filter((w) => this.engine.hasRepeatedLetter(w));
    return withRepeats.length >= 20 ? withRepeats : pool;
  }

  dailyPuzzleNumber(date?: Date): number {
    const d = date || new Date();
    const diffMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - DAILY_EPOCH.getTime();
    return Math.floor(diffMs / 86400000) + 1;
  }

  getDailyWord(): string {
    const pool = this.getAnswerPool(5);
    const idx = this.engine.seededIndex('daily:' + this.engine.todayKey(), pool.length);
    return pool[idx];
  }

  generateShareText(opts: { puzzleNumber: number; won: boolean; guessCount: number; maxGuesses: number; history: GuessTurn[] }): string {
    const lines: string[] = [];
    const guessLabel = opts.won ? `${opts.guessCount}/${opts.maxGuesses}` : `X/${opts.maxGuesses}`;
    lines.push(`Wordle #${opts.puzzleNumber} ${guessLabel}`);
    lines.push('');
    opts.history.forEach((turn) => {
      const row = turn.result.map((state) => (state === 'correct' ? '🟩' : state === 'present' ? '🟨' : '⬛')).join('');
      lines.push(row);
    });
    return lines.join('\n');
  }

  /** Survival ramps through the four difficulty tiers, then keeps Extreme rules while
   * slowly growing the word length every couple of levels (capped at 8 letters). */
  survivalConfigForLevel(level: number): { level: number; difficulty: Difficulty; wordLength: number; maxGuesses: number; hardMode: boolean } {
    const tierOrder: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
    const tier = tierOrder[Math.min(level - 1, tierOrder.length - 1)];
    const base = DIFFICULTIES[tier];
    let wordLength = 5;
    if (level > tierOrder.length) {
      wordLength = Math.min(8, 5 + Math.floor((level - tierOrder.length) / 2));
    }
    return { level, difficulty: tier, wordLength, maxGuesses: base.maxGuesses, hardMode: base.hardMode };
  }

  multiwordGuessBudget(boards: number): number {
    return 5 + boards;
  }
}
