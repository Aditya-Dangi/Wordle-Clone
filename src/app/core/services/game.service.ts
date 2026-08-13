import { Injectable, inject, signal } from '@angular/core';
import { EngineService } from './engine.service';
import { StorageService } from './storage.service';
import { ProgressionService } from './progression.service';
import { ModesService, DIFFICULTIES, MODES } from './modes.service';
import { WordsService } from './words.service';
import { SoundService } from './sound.service';
import { ToastService } from './toast.service';
import { CustomModifiers, Difficulty, GuessTurn, ModeConfig, ModeKey, TileState } from '../models/game.models';

export interface TileVM {
  letter: string;
  state: TileState | 'active' | 'empty' | 'hidden';
  flipping: boolean;
  dance: boolean;
  shake: boolean;
  feedback?: TileState;
}

export interface SetupSelections {
  difficulty: Difficulty;
  wordLength: number;
  category: string;
  timerSeconds: number;
  mods: CustomModifiers;
}

export interface HintDef {
  id: 'vowel' | 'first' | 'position' | 'category' | 'eliminate';
  label: string;
  cost: number;
}

export const HINTS: HintDef[] = [
  { id: 'vowel', label: '🔡 Reveal Vowel', cost: 10 },
  { id: 'first', label: '🔤 First Letter', cost: 15 },
  { id: 'position', label: '📍 Reveal Letter', cost: 20 },
  { id: 'category', label: '🏷️ Category', cost: 10 },
  { id: 'eliminate', label: '🚫 Eliminate Letters', cost: 15 },
];

const RANK: Record<TileState, 0 | 1 | 2> = { absent: 0, present: 1, correct: 2 };

export interface Session {
  mode: ModeKey;
  modeConfig: ModeConfig;
  difficulty: Difficulty | 'custom';
  wordLength: number;
  maxGuesses: number;
  hardMode: boolean;
  boardsCount: number;
  category: string;
  answerPool: string[];
  guessPool: string[];
  isDaily: boolean;
  blindTiles: boolean;
  noVowelFeedback: boolean;
  noRepeatGuesses: boolean;
  hintsEnabled: boolean;
  timerSeconds: number | null;
  stopwatch: boolean;
  usedGuesses: Record<string, boolean>;
  usedHints: boolean;
  active: boolean;
  locked: boolean;
  survivalLevel: number | null;
  survivalCleared: number;
  marathonRound: number;
  marathonScore: number;
  blitzSolved: number;
  endlessCount: number;
  suddenDeathCount: number;
  wordIntelOn: boolean;
  startedAt: number;
  roundStartTime: number;
  puzzleNumber: number | null;
  answers: string[];
  boardHistories: GuessTurn[][];
  boardSolved: boolean[];
  currentGuess: string;
  guessesUsed: number;
  timeRemaining: number;
  elapsedDisplay: number;
  timerText: string | null;
  timerLow: boolean;
  boards: TileVM[][][];
  keyRanks: Record<string, 0 | 1 | 2>;
  candidateInfo: string | null;
  reverseCandidates: string[];
  reverseHistory: GuessTurn[];
  currentReverseGuess: string;
  currentFeedback: TileState[];
}

export interface SessionResult {
  won: boolean;
  title: string;
  summary: string;
  answers: string[] | null;
  rewardXp: number;
  rewardCoins: number;
  leveledUp: boolean;
  newLevel: number;
  canShare: boolean;
  shareText: string | null;
}

function defaultSelections(defaultDifficulty: Difficulty): SetupSelections {
  return {
    difficulty: defaultDifficulty,
    wordLength: 5,
    category: 'any',
    timerSeconds: 60,
    mods: {
      wordLength: 5,
      maxGuesses: 6,
      hardMode: false,
      timerSeconds: null,
      blindTiles: false,
      noVowelFeedback: false,
      noRepeatGuesses: false,
      noHints: false,
    },
  };
}

/** Owns the current game session's state machine: starting rounds, guesses, timers, hints,
 * reverse mode, and scoring/rewards at round end. UI components only read `session()`/`result()`
 * and call the public methods below - this is the Angular replacement for main.js's session object. */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly engine = inject(EngineService);
  private readonly storage = inject(StorageService);
  private readonly progression = inject(ProgressionService);
  private readonly modes = inject(ModesService);
  private readonly words = inject(WordsService);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);

  readonly session = signal<Session | null>(null);
  readonly result = signal<SessionResult | null>(null);
  readonly HINTS = HINTS;

  private s: Session | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private lastSessionConfig: { mode: ModeKey; selections: SetupSelections } | null = null;

  defaultSelectionsFor(): SetupSelections {
    return defaultSelections(this.storage.settings().defaultDifficulty || 'medium');
  }

  private notify(): void {
    if (this.s) this.session.set({ ...this.s });
  }

  canRestart(): boolean {
    return !!this.lastSessionConfig;
  }

  restart(): void {
    if (this.lastSessionConfig) this.startSession(this.lastSessionConfig.mode, this.lastSessionConfig.selections);
  }

  leaveSession(): void {
    if (this.s) this.s.active = false;
    this.clearTimer();
  }

  private buildAnswerPool(wordLength: number, category: string, extreme: boolean): string[] {
    const pool = extreme ? this.modes.extremeAnswerPool(wordLength) : this.modes.getAnswerPool(wordLength);
    if (category && category !== 'any') {
      const set = new Set(this.words.categoryWords(category, wordLength));
      const filtered = pool.filter((w) => set.has(w));
      if (filtered.length) return filtered;
    }
    return pool;
  }

  /* ---------------------------------------------------------------------- session start */

  startSession(modeKey: ModeKey, selections: SetupSelections): void {
    const mode = MODES[modeKey];
    const boardsCount = mode.boards;
    let difficultyKey: Difficulty | 'custom' = selections.difficulty || 'medium';
    let difficulty = DIFFICULTIES[difficultyKey as Difficulty] || DIFFICULTIES.medium;
    let wordLength = selections.wordLength || 5;
    let maxGuesses = difficulty.maxGuesses;
    let hardMode = difficulty.hardMode;
    let timerSeconds: number | null = null;
    let stopwatch = false;
    let category = selections.category || 'any';
    const isDaily = modeKey === 'daily';
    let blindTiles = false;
    let noVowelFeedback = false;
    let noRepeatGuesses = false;
    let hintsDisabledOverride = false;

    if (modeKey === 'blitz') {
      timerSeconds = selections.timerSeconds || 60;
      wordLength = selections.wordLength || 5;
      maxGuesses = 6;
      hardMode = false;
      difficultyKey = 'medium';
      difficulty = DIFFICULTIES.medium;
    }
    if (modeKey === 'timeAttack') stopwatch = true;
    if (modeKey === 'suddenDeath') {
      wordLength = selections.wordLength || 5;
      maxGuesses = 1;
      hardMode = false;
    }
    if (modeKey === 'multiword2' || modeKey === 'multiword3' || modeKey === 'multiword4') {
      wordLength = selections.wordLength || 5;
      maxGuesses = this.modes.multiwordGuessBudget(boardsCount);
      hardMode = false;
    }
    if (modeKey === 'reverse') {
      wordLength = selections.wordLength || 5;
      maxGuesses = 10;
    }
    if (modeKey === 'survival') {
      const svc0 = this.modes.survivalConfigForLevel(1);
      wordLength = svc0.wordLength;
      maxGuesses = svc0.maxGuesses;
      hardMode = svc0.hardMode;
      difficultyKey = svc0.difficulty;
      difficulty = DIFFICULTIES[svc0.difficulty];
    }
    if (modeKey === 'custom') {
      const mods = selections.mods;
      wordLength = mods.wordLength;
      maxGuesses = mods.maxGuesses;
      hardMode = mods.hardMode;
      timerSeconds = mods.timerSeconds || null;
      blindTiles = mods.blindTiles;
      noVowelFeedback = mods.noVowelFeedback;
      noRepeatGuesses = mods.noRepeatGuesses;
      hintsDisabledOverride = mods.noHints;
      difficultyKey = 'custom';
    }
    if (isDaily) {
      wordLength = 5;
      difficultyKey = 'medium';
      difficulty = DIFFICULTIES.medium;
      maxGuesses = 6;
      hardMode = false;
      category = 'any';
    }

    const answerPool = this.buildAnswerPool(wordLength, category, difficultyKey === 'extreme');
    const guessPool = this.modes.getGuessPool(wordLength);

    this.s = {
      mode: modeKey,
      modeConfig: mode,
      difficulty: difficultyKey,
      wordLength,
      maxGuesses,
      hardMode,
      boardsCount,
      category,
      answerPool,
      guessPool,
      isDaily,
      blindTiles,
      noVowelFeedback,
      noRepeatGuesses,
      hintsEnabled: !hintsDisabledOverride && difficulty.hintsEnabled !== false,
      timerSeconds,
      stopwatch,
      usedGuesses: {},
      usedHints: false,
      active: true,
      locked: false,
      survivalLevel: modeKey === 'survival' ? 1 : null,
      survivalCleared: 0,
      marathonRound: 0,
      marathonScore: 0,
      blitzSolved: 0,
      endlessCount: 0,
      suddenDeathCount: 0,
      wordIntelOn: false,
      startedAt: Date.now(),
      roundStartTime: Date.now(),
      puzzleNumber: isDaily ? this.modes.dailyPuzzleNumber() : null,
      answers: [],
      boardHistories: [],
      boardSolved: [],
      currentGuess: '',
      guessesUsed: 0,
      timeRemaining: 0,
      elapsedDisplay: 0,
      timerText: null,
      timerLow: false,
      boards: [],
      keyRanks: {},
      candidateInfo: null,
      reverseCandidates: [],
      reverseHistory: [],
      currentReverseGuess: '',
      currentFeedback: [],
    };

    this.result.set(null);
    this.lastSessionConfig = { mode: modeKey, selections };
    this.storage.getDaily();
    this.notify();

    if (modeKey === 'reverse') {
      this.startReverseRound();
    } else {
      this.pickAnswersForRound();
      this.resetRoundState();
      this.setupBoards();
    }
    this.startTimerIfNeeded();
  }

  private pickAnswersForRound(): void {
    const s = this.s!;
    s.answers = [];
    const used: Record<string, boolean> = {};
    for (let i = 0; i < s.boardsCount; i++) {
      let word: string;
      if (s.isDaily) {
        word = this.modes.getDailyWord();
      } else {
        let attempts = 0;
        do {
          word = this.engine.randomWord(s.answerPool);
          attempts++;
        } while (used[word] && attempts < 20 && s.answerPool.length > s.boardsCount);
      }
      used[word] = true;
      s.answers.push(word);
    }
  }

  private resetRoundState(): void {
    const s = this.s!;
    s.boardHistories = s.answers.map(() => []);
    s.boardSolved = s.answers.map(() => false);
    s.currentGuess = '';
    s.guessesUsed = 0;
    s.usedGuesses = {};
    s.roundStartTime = Date.now();
  }

  private makeEmptyBoard(wordLength: number, maxGuesses: number): TileVM[][] {
    return Array.from({ length: maxGuesses }, () =>
      Array.from({ length: wordLength }, () => ({ letter: '', state: 'empty' as const, flipping: false, dance: false, shake: false })),
    );
  }

  private setupBoards(): void {
    const s = this.s!;
    s.boards = Array.from({ length: s.boardsCount }, () => this.makeEmptyBoard(s.wordLength, s.maxGuesses));
    s.keyRanks = {};
    s.candidateInfo = null;
    this.notify();
  }

  /* ---------------------------------------------------------------------- timer */

  private clearTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  private startTimerIfNeeded(): void {
    this.clearTimer();
    const s = this.s!;
    if (s.timerSeconds) {
      s.timeRemaining = s.timerSeconds;
      s.timerText = this.formatTime(s.timeRemaining);
      s.timerLow = s.timeRemaining <= 10;
      this.notify();
      this.timerHandle = setInterval(() => {
        s.timeRemaining--;
        s.timerText = this.formatTime(Math.max(0, s.timeRemaining));
        s.timerLow = s.timeRemaining <= 10;
        this.notify();
        if (s.timeRemaining <= 0) {
          this.clearTimer();
          this.onTimerExpired();
        }
      }, 1000);
    } else if (s.stopwatch) {
      s.elapsedDisplay = 0;
      s.timerText = this.formatTime(0);
      s.timerLow = false;
      this.notify();
      this.timerHandle = setInterval(() => {
        s.elapsedDisplay++;
        s.timerText = this.formatTime(s.elapsedDisplay);
        this.notify();
      }, 1000);
    } else {
      s.timerText = null;
      this.notify();
    }
  }

  private onTimerExpired(): void {
    const s = this.s;
    if (!s || !s.active) return;
    this.toast.showAlert("Time's up!", 1500);
    s.locked = true;
    const won = s.mode === 'blitz' ? s.blitzSolved > 0 : false;
    this.finalizeSessionEnd(won, this.currentModeExtra());
  }

  /* ---------------------------------------------------------------------- hints & word intel */

  useHint(id: HintDef['id'], cost: number): void {
    const s = this.s;
    if (!s || !s.active || s.locked) return;
    if (!this.progression.spendCoins(cost)) {
      this.toast.showAlert('Not enough coins', 1400);
      return;
    }
    s.usedHints = true;

    // Multi-board modes (Double/Triple/Quad Word) share one hint bar for every board, so a
    // hint must cover every still-unsolved board - not just board 0 - or it's useless on the
    // boards it silently skips.
    const activeBoards = s.answers.map((answer, i) => ({ answer, i })).filter(({ i }) => !s.boardSolved[i]);
    const label = (i: number) => (s.boardsCount > 1 ? `B${i + 1}: ` : '');
    let msg = '';

    if (id === 'vowel') {
      const parts = activeBoards.map(({ answer, i }) => {
        const vowels = answer.split('').filter((c) => 'aeiou'.includes(c));
        return vowels.length ? `${label(i)}${vowels[0].toUpperCase()}` : `${label(i)}none`;
      });
      msg = `Vowel - ${parts.join('  ·  ')}`;
    } else if (id === 'first') {
      const parts = activeBoards.map(({ answer, i }) => `${label(i)}${answer[0].toUpperCase()}`);
      msg = `Starts with - ${parts.join('  ·  ')}`;
    } else if (id === 'position') {
      const parts = activeBoards.map(({ answer, i }) => {
        const idx = Math.floor(Math.random() * answer.length);
        return `${label(i)}pos ${idx + 1} = ${answer[idx].toUpperCase()}`;
      });
      msg = parts.join('  ·  ');
    } else if (id === 'category') {
      const parts = activeBoards.map(({ answer, i }) => {
        const cats = this.words.categories().filter((c) => this.words.categoryWords(c, answer.length).includes(answer));
        return cats.length ? `${label(i)}${cats[0][0].toUpperCase()}${cats[0].slice(1)}` : null;
      }).filter((v): v is string => !!v);
      msg = parts.length ? `Category - ${parts.join('  ·  ')}` : 'No category hint available';
    } else if (id === 'eliminate') {
      // A letter is only truly "safe" to eliminate if it's absent from every still-active
      // board's answer - eliminating a letter that's actually needed for board 2 while only
      // checking board 0 would actively mislead the player.
      const usedLetters = new Set(activeBoards.map(({ answer }) => answer).join('').split(''));
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((l) => !usedLetters.has(l));
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      const picks = letters.slice(0, 3);
      picks.forEach((l) => {
        const current = s.keyRanks[l] ?? -1;
        if (0 > current) s.keyRanks[l] = 0;
      });
      msg = `Not in any word: ${picks.join(', ').toUpperCase()}`;
    }

    this.toast.showAlert(msg, 2600);
    this.notify();
  }

  toggleWordIntel(): void {
    if (!this.s) return;
    this.s.wordIntelOn = !this.s.wordIntelOn;
    this.updateCandidateInfo();
  }

  private updateCandidateInfo(): void {
    const s = this.s!;
    if (!s.wordIntelOn || s.boardsCount > 1 || s.mode === 'reverse') {
      s.candidateInfo = null;
      this.notify();
      return;
    }
    const candidates = this.engine.filterCandidates(s.answerPool, s.boardHistories[0]);
    if (candidates.length <= 8 && s.boardHistories[0].length > 0) {
      s.candidateInfo = `${candidates.length} possible word${candidates.length === 1 ? '' : 's'}: ${candidates.join(', ').toUpperCase()}`;
    } else {
      s.candidateInfo = `${candidates.length} possible words remaining`;
    }
    this.notify();
  }

  /* ---------------------------------------------------------------------- core gameplay */

  pressKey(letter: string): void {
    const s = this.s;
    if (!s || !s.active || s.locked || s.mode === 'reverse') return;
    if (s.currentGuess.length >= s.wordLength) return;
    s.currentGuess += letter;
    const row = s.guessesUsed;
    const col = s.currentGuess.length - 1;
    s.boards.forEach((board, i) => {
      if (s.boardSolved[i]) return;
      const tile = board[row]?.[col];
      if (tile) {
        tile.letter = letter.toUpperCase();
        tile.state = 'active';
      }
    });
    this.sound.play('key');
    this.notify();
  }

  deleteKey(): void {
    const s = this.s;
    if (!s || !s.active || s.locked || s.mode === 'reverse') return;
    if (s.currentGuess.length === 0) return;
    const row = s.guessesUsed;
    const col = s.currentGuess.length - 1;
    s.boards.forEach((board, i) => {
      if (s.boardSolved[i]) return;
      const tile = board[row]?.[col];
      if (tile) {
        tile.letter = '';
        tile.state = 'empty';
      }
    });
    s.currentGuess = s.currentGuess.slice(0, -1);
    this.notify();
  }

  private flipTile(tile: TileVM, letter: string, state: TileState | 'hidden', delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        tile.flipping = true;
        this.notify();
        setTimeout(() => {
          tile.letter = letter.toUpperCase();
          tile.state = state;
          tile.flipping = false;
          this.notify();
          setTimeout(resolve, 260);
        }, 260);
      }, delayMs);
    });
  }

  private shakeTiles(tiles: TileVM[]): void {
    tiles.forEach((t) => (t.shake = true));
    this.notify();
    setTimeout(() => {
      tiles.forEach((t) => (t.shake = false));
      this.notify();
    }, 260);
  }

  private danceTiles(tiles: TileVM[]): void {
    tiles.forEach((t, index) => {
      setTimeout(
        () => {
          t.dance = true;
          this.notify();
          setTimeout(() => {
            t.dance = false;
            this.notify();
          }, 500);
        },
        (index * 500) / 5,
      );
    });
  }

  submitGuess(): void {
    const s = this.s;
    if (!s || !s.active || s.locked) return;
    const guess = s.currentGuess;
    const row = s.guessesUsed;
    const activeRowTiles: TileVM[] = [];
    s.boards.forEach((board, i) => {
      if (!s.boardSolved[i]) activeRowTiles.push(...board[row]);
    });

    if (guess.length !== s.wordLength) {
      this.toast.showAlert('Not enough letters');
      this.shakeTiles(activeRowTiles);
      this.sound.play('invalid');
      return;
    }
    if (!s.guessPool.includes(guess)) {
      this.toast.showAlert('Not in word list');
      this.shakeTiles(activeRowTiles);
      this.sound.play('invalid');
      return;
    }
    if (s.noRepeatGuesses && s.usedGuesses[guess]) {
      this.toast.showAlert('You already tried that word');
      this.shakeTiles(activeRowTiles);
      this.sound.play('invalid');
      return;
    }
    if (s.hardMode) {
      for (let i = 0; i < s.boards.length; i++) {
        if (s.boardSolved[i]) continue;
        const check = this.engine.checkHardMode(guess, s.boardHistories[i]);
        if (!check.valid) {
          this.toast.showAlert(check.reason || 'Invalid guess');
          this.shakeTiles(activeRowTiles);
          this.sound.play('invalid');
          return;
        }
      }
    }

    s.locked = true;
    s.usedGuesses[guess] = true;
    const bestRankForLetter: Record<string, 0 | 1 | 2> = {};
    const flipPromises: Promise<void>[] = [];
    const blindCol = s.blindTiles ? Math.floor(Math.random() * s.wordLength) : -1;

    s.boards.forEach((board, i) => {
      if (s.boardSolved[i]) return;
      const result = this.engine.evaluateGuess(guess, s.answers[i]);
      s.boardHistories[i].push({ guess, result });
      const tiles = board[row];
      tiles.forEach((tile, idx) => {
        const letter = guess[idx];
        let displayState: TileState | 'hidden' = result[idx];
        if (s.noVowelFeedback && 'aeiou'.includes(letter)) displayState = 'hidden';
        if (idx === blindCol) displayState = 'hidden';
        const delay = idx * 220;
        flipPromises.push(
          this.flipTile(tile, letter, displayState, delay).then(() => {
            if (displayState !== 'hidden') {
              const rank = RANK[displayState];
              if (bestRankForLetter[letter] === undefined || rank > bestRankForLetter[letter]) {
                bestRankForLetter[letter] = rank;
              }
            }
          }),
        );
      });
    });

    Promise.all(flipPromises).then(() => {
      Object.keys(bestRankForLetter).forEach((letter) => {
        const rank = bestRankForLetter[letter];
        const current = s.keyRanks[letter] ?? -1;
        if (rank > current) s.keyRanks[letter] = rank;
      });
      this.notify();
      this.afterFlip(guess, row);
    });
  }

  private afterFlip(guess: string, row: number): void {
    const s = this.s!;
    s.boards.forEach((board, i) => {
      if (s.boardSolved[i]) return;
      if (guess === s.answers[i]) {
        s.boardSolved[i] = true;
        this.danceTiles(board[row]);
      }
    });
    s.guessesUsed++;
    s.currentGuess = '';

    const allSolved = s.boardSolved.every((v) => v);
    const outOfGuesses = s.guessesUsed >= s.maxGuesses;

    this.updateCandidateInfo();
    s.locked = false;
    this.notify();

    if (allSolved) {
      this.sound.play('win');
      this.handleRoundEnd(true);
      return;
    }
    if (outOfGuesses) {
      this.sound.play('lose');
      this.handleRoundEnd(false);
    }
  }

  private currentModeExtra(): Record<string, unknown> {
    const s = this.s!;
    switch (s.mode) {
      case 'endless':
        return { endlessCount: s.endlessCount };
      case 'survival':
        return { levelReached: s.survivalCleared };
      case 'marathon':
        return { completed: false, score: s.marathonScore };
      case 'suddenDeath':
        return { suddenDeathCount: s.suddenDeathCount };
      case 'blitz':
        return { blitzSolved: s.blitzSolved };
      default:
        return {};
    }
  }

  private handleRoundEnd(won: boolean): void {
    const s = this.s!;
    switch (s.mode) {
      case 'endless':
        if (won) {
          s.endlessCount++;
          this.toast.showAlert('Solved! Next word...', 1300);
          this.notify();
          setTimeout(() => this.startNextRound(), 1100);
        } else {
          this.finalizeSessionEnd(false, { endlessCount: s.endlessCount });
        }
        break;
      case 'blitz':
        if (won) s.blitzSolved++;
        this.notify();
        setTimeout(() => this.startNextRound(), won ? 800 : 1300);
        break;
      case 'survival':
        if (won) {
          s.survivalCleared++;
          s.survivalLevel = (s.survivalLevel || 1) + 1;
          const cfg = this.modes.survivalConfigForLevel(s.survivalLevel);
          s.wordLength = cfg.wordLength;
          s.maxGuesses = cfg.maxGuesses;
          s.hardMode = cfg.hardMode;
          s.difficulty = cfg.difficulty;
          s.answerPool = this.buildAnswerPool(s.wordLength, 'any', cfg.difficulty === 'extreme');
          s.guessPool = this.modes.getGuessPool(s.wordLength);
          this.toast.showAlert(`Level ${s.survivalLevel}!`, 1300);
          this.notify();
          setTimeout(() => this.startNextRound(), 1100);
        } else {
          this.finalizeSessionEnd(false, { levelReached: s.survivalCleared });
        }
        break;
      case 'marathon': {
        s.marathonRound++;
        if (won) s.marathonScore += Math.max(10, (s.maxGuesses - s.guessesUsed + 1) * 20);
        const rounds = (s.modeConfig as ModeConfig & { rounds?: number }).rounds || 10;
        if (s.marathonRound < rounds) {
          this.notify();
          setTimeout(() => this.startNextRound(), 1100);
        } else {
          this.finalizeSessionEnd(s.marathonScore > 0, { completed: true, score: s.marathonScore, rounds: s.marathonRound });
        }
        break;
      }
      case 'suddenDeath':
        if (won) {
          s.suddenDeathCount++;
          this.notify();
          setTimeout(() => this.startNextRound(), 800);
        } else {
          this.finalizeSessionEnd(false, { suddenDeathCount: s.suddenDeathCount });
        }
        break;
      default:
        this.finalizeSessionEnd(won, {});
    }
  }

  private startNextRound(): void {
    const s = this.s;
    if (!s || !s.active) return;
    this.pickAnswersForRound();
    this.resetRoundState();
    this.setupBoards();
    this.updateCandidateInfo();
  }

  onGiveUp(): void {
    const s = this.s;
    if (!s || !s.active) return;
    this.clearTimer();
    s.locked = true;
    this.finalizeSessionEnd(false, this.currentModeExtra());
  }

  /* ---------------------------------------------------------------------- reverse mode */

  private startReverseRound(): void {
    const s = this.s!;
    s.reverseCandidates = this.modes.getAnswerPool(s.wordLength).slice();
    s.reverseHistory = [];
    s.currentGuess = '';
    s.guessesUsed = 0;
    s.roundStartTime = Date.now();
    s.answers = [];
    s.boardHistories = [[]];
    s.boardSolved = [false];
    s.boards = [this.makeEmptyBoard(s.wordLength, s.maxGuesses)];
    this.notify();
    this.makeReverseGuess();
  }

  private pickReverseGuess(): string {
    const candidates = this.s!.reverseCandidates;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private makeReverseGuess(): void {
    const s = this.s!;
    if (s.guessesUsed >= s.maxGuesses) {
      this.finalizeSessionEnd(false, {});
      return;
    }
    const guess = this.pickReverseGuess();
    s.currentReverseGuess = guess;
    s.currentFeedback = new Array(s.wordLength).fill('absent');
    const row = s.guessesUsed;
    const tiles = s.boards[0][row];
    tiles.forEach((tile, idx) => {
      tile.letter = guess[idx].toUpperCase();
      tile.state = 'active';
      tile.feedback = 'absent';
    });
    this.notify();
  }

  cycleReverseTile(row: number, col: number): void {
    const s = this.s;
    if (!s || !s.active || s.mode !== 'reverse') return;
    if (row !== s.guessesUsed) return;
    const order: TileState[] = ['absent', 'present', 'correct'];
    const tile = s.boards[0][row][col];
    const cur = tile.feedback || 'absent';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    tile.feedback = next;
    tile.state = next;
    s.currentFeedback[col] = next;
    this.notify();
  }

  submitReverseFeedback(): void {
    const s = this.s!;
    const guess = s.currentReverseGuess;
    const feedback = s.currentFeedback;

    if (feedback.every((state) => state === 'correct')) {
      s.reverseHistory.push({ guess, result: feedback });
      this.danceTiles(s.boards[0][s.guessesUsed]);
      s.guessesUsed++;
      this.sound.play('win');
      this.finalizeSessionEnd(true, {});
      return;
    }

    const narrowed = this.engine.filterCandidates(s.reverseCandidates, [{ guess, result: feedback }]);
    if (narrowed.length === 0) {
      this.toast.showAlert("That doesn't match any word - check your colors and try again.", 2400);
      return;
    }
    const withoutGuess = narrowed.filter((w) => w !== guess);
    s.reverseCandidates = withoutGuess.length ? withoutGuess : narrowed;
    s.reverseHistory.push({ guess, result: feedback });
    s.guessesUsed++;
    this.makeReverseGuess();
  }

  /* ---------------------------------------------------------------------- session end */

  private summaryTitle(won: boolean): string {
    const s = this.s!;
    switch (s.mode) {
      case 'endless':
        return won ? 'Nice Run!' : 'Run Over';
      case 'blitz':
        return "Time's Up!";
      case 'survival':
        return won ? 'Level Up!' : 'Defeated';
      case 'marathon':
        return 'Marathon Complete';
      case 'suddenDeath':
        return won ? 'Survived!' : 'Eliminated';
      case 'reverse':
        return won ? 'Guessed It!' : 'Stumped!';
      default:
        return won ? 'You Win!' : 'So Close!';
    }
  }

  private summaryLine(won: boolean, guessCount: number): string {
    const s = this.s!;
    switch (s.mode) {
      case 'endless':
        return `You solved ${s.endlessCount} word${s.endlessCount === 1 ? '' : 's'} before losing.`;
      case 'blitz':
        return `You solved ${s.blitzSolved} word${s.blitzSolved === 1 ? '' : 's'} in ${s.timerSeconds} seconds.`;
      case 'survival':
        return `You cleared ${s.survivalCleared} level${s.survivalCleared === 1 ? '' : 's'}.`;
      case 'marathon':
        return `Final score: ${s.marathonScore} across ${s.marathonRound} words.`;
      case 'suddenDeath':
        return `You survived ${s.suddenDeathCount} word${s.suddenDeathCount === 1 ? '' : 's'} in a row.`;
      case 'reverse':
        return won ? `The game found your word in ${guessCount} guesses.` : "The game couldn't narrow it down in time.";
      default:
        return won ? `Solved in ${guessCount}/${s.maxGuesses} guesses.` : 'Better luck next time.';
    }
  }

  private copyToClipboard(text: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* clipboard unavailable - user can still read the text on screen */
    }
    document.body.removeChild(ta);
  }

  shareResult(): void {
    const s = this.s;
    const r = this.result();
    if (!s || !r?.shareText) return;
    this.copyToClipboard(r.shareText);
    this.toast.showAlert('Copied to clipboard!', 1500);
  }

  dismissResult(): void {
    this.result.set(null);
  }

  private finalizeSessionEnd(won: boolean, extra: Record<string, unknown>): void {
    const s = this.s;
    if (!s) return;
    s.active = false;
    this.clearTimer();

    const timeMs = s.stopwatch ? s.elapsedDisplay * 1000 : Date.now() - s.startedAt;
    const guessCount = s.guessesUsed;
    const score =
      extra['score'] !== undefined
        ? (extra['score'] as number)
        : s.mode === 'endless'
          ? s.endlessCount
          : s.mode === 'blitz'
            ? s.blitzSolved
            : s.mode === 'suddenDeath'
              ? s.suddenDeathCount
              : undefined;

    const reward = this.progression.computeReward({
      won,
      isDaily: s.isDaily,
      usedHints: s.usedHints,
      difficulty: s.difficulty,
      timeMs,
      guessCount,
    });
    const xpResult = this.progression.addXp(reward.xp);
    this.progression.addCoins(reward.coins);

    this.storage.recordModeResult(s.mode, { won, guessCount, timeMs, usedHints: s.usedHints, score: score ?? null, difficulty: s.difficulty === 'custom' ? null : s.difficulty });
    if (s.difficulty && s.difficulty !== 'custom') this.storage.recordDifficultyResult(s.difficulty, won);
    this.storage.updateStreak(won);
    if (s.hardMode) this.storage.updateModifierStreak('hard', won);
    this.storage.updateModifierStreak('perfect', won && !s.usedHints);
    if (s.isDaily) this.storage.completeDaily(won, guessCount);
    if (s.mode === 'survival') this.storage.setSurvivalBest((extra['levelReached'] as number) || 0);
    if (s.mode === 'marathon') this.storage.setMarathonBest((extra['score'] as number) || 0);

    this.storage.recordMissionEvent({ won, guessCount, timeMs, usedHints: s.usedHints, difficulty: s.difficulty === 'custom' ? null : s.difficulty, score: score ?? null });
    this.progression.updateMissionProgress(this.storage.getMissionLog());
    const unlockedAchievements = this.progression.checkAchievements({
      won,
      mode: s.mode,
      difficulty: s.difficulty,
      guessCount,
      timeMs,
      usedHints: s.usedHints,
      completed: extra['completed'] as boolean | undefined,
      levelReached: extra['levelReached'] as number | undefined,
    });

    const multiRoundModes: Partial<Record<ModeKey, boolean>> = { endless: true, blitz: true, survival: true, marathon: true, suddenDeath: true, reverse: true };
    const canShare = s.boardsCount === 1 && !multiRoundModes[s.mode] && s.boardHistories[0]?.length > 0;

    this.result.set({
      won,
      title: this.summaryTitle(won),
      summary: this.summaryLine(won, guessCount),
      answers: !won && s.answers.length && s.mode !== 'reverse' ? s.answers.map((w) => w.toUpperCase()) : null,
      rewardXp: reward.xp,
      rewardCoins: reward.coins,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.level,
      canShare,
      shareText: canShare
        ? this.modes.generateShareText({
            puzzleNumber: s.puzzleNumber || this.modes.dailyPuzzleNumber(),
            won,
            guessCount,
            maxGuesses: s.maxGuesses,
            history: s.boardHistories[0],
          })
        : null,
    });

    unlockedAchievements.forEach((a) => {
      this.toast.showAchievement(a);
      this.sound.play('achievement');
    });
    if (xpResult.leveledUp) this.sound.play('levelup');

    this.notify();
  }
}
