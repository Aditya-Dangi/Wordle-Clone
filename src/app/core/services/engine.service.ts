import { Injectable } from '@angular/core';
import { GuessTurn, TileState } from '../models/game.models';

/**
 * Pure game-logic: letter evaluation, hard-mode validation, candidate filtering,
 * challenge rating, and deterministic daily-seed helpers. No DOM/state access.
 */
@Injectable({ providedIn: 'root' })
export class EngineService {
  /**
   * Two-pass evaluation: exact matches are resolved first and removed from the letter
   * pool, so a duplicate letter in the guess can only be marked "present" as many times
   * as it remains unclaimed in the answer.
   */
  evaluateGuess(guess: string, answer: string): TileState[] {
    const len = answer.length;
    const result: TileState[] = new Array(len).fill('absent');
    const answerLetters: (string | null)[] = answer.split('');
    const guessLetters = guess.split('');
    const remaining: Record<string, number> = {};

    for (let i = 0; i < len; i++) {
      if (guessLetters[i] === answerLetters[i]) {
        result[i] = 'correct';
        answerLetters[i] = null;
      }
    }

    for (let i = 0; i < len; i++) {
      const letter = answerLetters[i];
      if (letter != null) {
        remaining[letter] = (remaining[letter] || 0) + 1;
      }
    }

    for (let i = 0; i < len; i++) {
      if (result[i] === 'correct') continue;
      const g = guessLetters[i];
      if (remaining[g] > 0) {
        result[i] = 'present';
        remaining[g]--;
      }
    }

    return result;
  }

  /** Aggregates every prior guess's constraints and checks whether a new guess honors all of them. */
  checkHardMode(guess: string, history: GuessTurn[]): { valid: boolean; reason?: string } {
    const mustPosition: Record<number, string> = {};
    const mustInclude: Record<string, number> = {};

    history.forEach((turn) => {
      const localCounts: Record<string, number> = {};
      for (let i = 0; i < turn.guess.length; i++) {
        const letter = turn.guess[i];
        if (turn.result[i] === 'correct') {
          mustPosition[i] = letter;
          localCounts[letter] = (localCounts[letter] || 0) + 1;
        } else if (turn.result[i] === 'present') {
          localCounts[letter] = (localCounts[letter] || 0) + 1;
        }
      }
      Object.keys(localCounts).forEach((letter) => {
        mustInclude[letter] = Math.max(mustInclude[letter] || 0, localCounts[letter]);
      });
    });

    for (const posKey in mustPosition) {
      const pos = Number(posKey);
      const required = mustPosition[pos];
      if (guess[pos] !== required) {
        return { valid: false, reason: `Position ${pos + 1} must be ${required.toUpperCase()}` };
      }
    }

    const guessCounts: Record<string, number> = {};
    for (let i = 0; i < guess.length; i++) {
      guessCounts[guess[i]] = (guessCounts[guess[i]] || 0) + 1;
    }
    for (const letter in mustInclude) {
      const minCount = mustInclude[letter];
      if ((guessCounts[letter] || 0) < minCount) {
        return { valid: false, reason: `Your guess must contain ${letter.toUpperCase()}` };
      }
    }

    return { valid: true };
  }

  /** Every word in `pool` still consistent with every guess/result pair seen so far. */
  filterCandidates(pool: string[], history: GuessTurn[]): string[] {
    if (history.length === 0) return pool.slice();
    return pool.filter((word) =>
      history.every((turn) => {
        const evalResult = this.evaluateGuess(turn.guess, word);
        return evalResult.every((state, i) => state === turn.result[i]);
      }),
    );
  }

  /** Deterministic string hash -> stable index, so every player sees the same daily seed. */
  seededIndex(seedStr: string, poolLength: number): number {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    return hash % poolLength;
  }

  todayKey(date?: Date): string {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  randomWord(pool: string[], exclude?: string): string {
    let candidates = pool;
    if (exclude) {
      candidates = pool.filter((w) => w !== exclude);
      if (candidates.length === 0) candidates = pool;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Weighted difficulty score (0-100) for the Custom Challenge builder. */
  computeChallengeRating(mods: {
    hardMode?: boolean;
    timerSeconds?: number | null;
    blindTiles?: boolean;
    noVowelFeedback?: boolean;
    maxGuesses?: number;
    wordLength?: number;
    noRepeatGuesses?: boolean;
    noHints?: boolean;
  }): number {
    let score = 0;
    if (mods.hardMode) score += 20;
    if (mods.timerSeconds) {
      if (mods.timerSeconds <= 30) score += 25;
      else if (mods.timerSeconds <= 60) score += 15;
      else score += 8;
    }
    if (mods.blindTiles) score += 15;
    if (mods.noVowelFeedback) score += 18;
    if (mods.maxGuesses) {
      if (mods.maxGuesses <= 3) score += 30;
      else if (mods.maxGuesses <= 4) score += 20;
      else if (mods.maxGuesses <= 5) score += 10;
    }
    if (mods.wordLength) {
      if (mods.wordLength >= 8) score += 12;
      else if (mods.wordLength >= 7) score += 8;
      else if (mods.wordLength <= 4) score += 6;
    }
    if (mods.noRepeatGuesses) score += 8;
    if (mods.noHints) score += 6;
    return Math.max(1, Math.min(100, score));
  }

  countLetters(word: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const ch of word) counts[ch] = (counts[ch] || 0) + 1;
    return counts;
  }

  hasRepeatedLetter(word: string): boolean {
    const counts = this.countLetters(word);
    return Object.values(counts).some((n) => n > 1);
  }
}
