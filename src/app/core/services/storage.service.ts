import { Injectable, inject, signal } from '@angular/core';
import { EngineService } from './engine.service';
import {
  Difficulty,
  HistoryEntry,
  Mission,
  ModeKey,
  ModeStats,
  MissionLog,
  Profile,
  RoundResult,
  Settings,
  StreaksState,
} from '../models/game.models';

const KEY = 'wordle_platform_v1';

interface DailyState {
  date: string | null;
  started: boolean;
  completed: boolean;
  won: boolean | null;
  guessCount?: number | null;
  history: { date: string; won: boolean; guessCount: number | null }[];
}

interface MissionsState {
  date: string | null;
  list: Mission[];
  claimed: Record<string, boolean>;
}

interface RootState {
  version: number;
  profile: Profile;
  settings: Settings;
  stats: Record<string, ModeStats>;
  difficultyStats: Record<string, { played: number; won: number }>;
  streaks: StreaksState;
  achievements: { unlocked: Record<string, string> };
  missions: MissionsState;
  missionLog: MissionLog;
  daily: DailyState;
  survivalBest: { level: number };
  marathonBest: { score: number };
  history: HistoryEntry[];
}

function emptyModeStats(): ModeStats {
  return {
    played: 0,
    won: 0,
    totalGuesses: 0,
    totalTimeMs: 0,
    bestTimeMs: null,
    guessDistribution: [0, 0, 0, 0, 0, 0, 0],
    noHintWins: 0,
    bestScore: 0,
  };
}

function defaultState(): RootState {
  return {
    version: 1,
    profile: { xp: 0, level: 1, coins: 0, lifetimeCoins: 0 },
    settings: {
      theme: 'midnight',
      sound: true,
      haptics: true,
      colorBlind: false,
      highContrast: false,
      reducedMotion: false,
      defaultDifficulty: 'medium',
    },
    stats: {},
    difficultyStats: {},
    streaks: {
      current: 0,
      best: 0,
      daily: { current: 0, best: 0, lastCompletedDate: null },
      hard: { current: 0, best: 0 },
      perfect: { current: 0, best: 0 },
    },
    achievements: { unlocked: {} },
    missions: { date: null, list: [], claimed: {} },
    missionLog: {
      date: null,
      games: 0,
      wins: 0,
      noHintWins: 0,
      fastGuessWins: 0,
      hardWins: 0,
      extremeWins: 0,
      bestStreakToday: 0,
    },
    daily: { date: null, started: false, completed: false, won: null, history: [] },
    survivalBest: { level: 0 },
    marathonBest: { score: 0 },
    history: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, extra: any): any {
  if (Array.isArray(base)) return extra !== undefined ? extra : base;
  if (typeof base !== 'object' || base === null) return extra !== undefined ? extra : base;
  const out: Record<string, unknown> = {};
  Object.keys(base).forEach((k) => {
    out[k] = deepMerge(base[k], extra ? extra[k] : undefined);
  });
  if (extra) {
    Object.keys(extra).forEach((k) => {
      if (!(k in out)) out[k] = extra[k];
    });
  }
  return out;
}

function load(): RootState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return deepMerge(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

/**
 * Single localStorage record for profile/settings/stats/streaks/achievements/missions.
 * Every reader merges onto defaults so new fields don't break existing saved data.
 * Exposes state as signals so components re-render automatically on change.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly engine = inject(EngineService);
  private state: RootState = load();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly profile = signal<Profile>(this.state.profile);
  readonly settings = signal<Settings>(this.state.settings);
  readonly stats = signal<Record<string, ModeStats>>(this.state.stats);
  readonly difficultyStats = signal<Record<string, { played: number; won: number }>>(this.state.difficultyStats);
  readonly streaks = signal<StreaksState>(this.state.streaks);
  readonly achievements = signal<{ unlocked: Record<string, string> }>(this.state.achievements);
  readonly missions = signal<MissionsState>(this.state.missions);
  readonly missionLog = signal<MissionLog>(this.state.missionLog);
  readonly history = signal<HistoryEntry[]>(this.state.history);
  readonly survivalBest = signal(this.state.survivalBest);
  readonly marathonBest = signal(this.state.marathonBest);
  readonly daily = signal<DailyState>(this.state.daily);

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch {
        /* storage unavailable (private mode, quota) - degrade to in-memory only */
      }
    }, 50);
  }

  setProfile(patch: Partial<Profile>): void {
    Object.assign(this.state.profile, patch);
    this.profile.set({ ...this.state.profile });
    this.schedulePersist();
  }

  setSettings(patch: Partial<Settings>): void {
    Object.assign(this.state.settings, patch);
    this.settings.set({ ...this.state.settings });
    this.schedulePersist();
  }

  getModeStats(modeKey: ModeKey): ModeStats {
    if (!this.state.stats[modeKey]) {
      this.state.stats[modeKey] = emptyModeStats();
      this.stats.set({ ...this.state.stats });
      this.schedulePersist();
    }
    return this.state.stats[modeKey];
  }

  recordModeResult(modeKey: ModeKey, result: RoundResult): ModeStats {
    const s = this.getModeStats(modeKey);
    s.played++;
    if (result.won) {
      s.won++;
      const bucket = Math.min((result.guessCount ?? 1) - 1, 6);
      s.guessDistribution[bucket]++;
      if (!result.usedHints) s.noHintWins++;
    }
    if (typeof result.timeMs === 'number') {
      s.totalTimeMs += result.timeMs;
      if (result.won && (s.bestTimeMs == null || result.timeMs < s.bestTimeMs)) {
        s.bestTimeMs = result.timeMs;
      }
    }
    if (typeof result.guessCount === 'number') s.totalGuesses += result.guessCount;
    if (typeof result.score === 'number' && result.score > s.bestScore) s.bestScore = result.score;

    this.state.history.unshift({
      mode: modeKey,
      won: result.won,
      guessCount: result.guessCount,
      timeMs: result.timeMs,
      score: result.score,
      date: new Date().toISOString(),
    });
    this.state.history = this.state.history.slice(0, 50);

    this.stats.set({ ...this.state.stats });
    this.history.set(this.state.history);
    this.schedulePersist();
    return s;
  }

  recordDifficultyResult(difficulty: Difficulty, won: boolean): void {
    if (!this.state.difficultyStats[difficulty]) {
      this.state.difficultyStats[difficulty] = { played: 0, won: 0 };
    }
    const d = this.state.difficultyStats[difficulty];
    d.played++;
    if (won) d.won++;
    this.difficultyStats.set({ ...this.state.difficultyStats });
    this.schedulePersist();
  }

  totalPuzzlesSolved(): number {
    return Object.keys(this.state.stats).reduce((sum, key) => sum + this.state.stats[key].won, 0);
  }

  updateStreak(won: boolean): StreaksState {
    if (won) {
      this.state.streaks.current++;
      if (this.state.streaks.current > this.state.streaks.best) {
        this.state.streaks.best = this.state.streaks.current;
      }
    } else {
      this.state.streaks.current = 0;
    }
    this.streaks.set({ ...this.state.streaks });
    this.schedulePersist();
    return this.state.streaks;
  }

  updateModifierStreak(key: 'hard' | 'perfect', hit: boolean): void {
    const s = this.state.streaks[key];
    if (!s) return;
    if (hit) {
      s.current++;
      if (s.current > s.best) s.best = s.current;
    } else {
      s.current = 0;
    }
    this.streaks.set({ ...this.state.streaks });
    this.schedulePersist();
  }

  getDaily(): DailyState {
    const todayKey = this.engine.todayKey();
    if (this.state.daily.date !== todayKey) {
      this.state.daily = { date: todayKey, started: false, completed: false, won: null, history: this.state.daily.history || [] };
      this.daily.set({ ...this.state.daily });
      this.schedulePersist();
    }
    return this.state.daily;
  }

  markDailyStarted(): void {
    this.getDaily().started = true;
    this.daily.set({ ...this.state.daily });
    this.schedulePersist();
  }

  completeDaily(won: boolean, guessCount: number | null): DailyState {
    const todayKey = this.engine.todayKey();
    const daily = this.getDaily();
    daily.completed = true;
    daily.won = won;
    daily.guessCount = guessCount;

    const streaks = this.state.streaks.daily;
    const last = streaks.lastCompletedDate;
    const y = new Date(todayKey);
    y.setDate(y.getDate() - 1);
    const yesterdayKey = this.engine.todayKey(y);

    if (won) {
      streaks.current = last === yesterdayKey ? streaks.current + 1 : 1;
      if (streaks.current > streaks.best) streaks.best = streaks.current;
    } else {
      streaks.current = 0;
    }
    streaks.lastCompletedDate = todayKey;
    daily.history = [{ date: todayKey, won, guessCount }, ...(daily.history || [])].slice(0, 30);
    this.streaks.set({ ...this.state.streaks });
    this.daily.set({ ...this.state.daily });
    this.schedulePersist();
    return daily;
  }

  getMissionLog(): MissionLog {
    const today = this.engine.todayKey();
    if (this.state.missionLog.date !== today) {
      this.state.missionLog = {
        date: today,
        games: 0,
        wins: 0,
        noHintWins: 0,
        fastGuessWins: 0,
        hardWins: 0,
        extremeWins: 0,
        bestStreakToday: 0,
      };
      this.missionLog.set({ ...this.state.missionLog });
      this.schedulePersist();
    }
    return this.state.missionLog;
  }

  recordMissionEvent(result: RoundResult): MissionLog {
    const log = this.getMissionLog();
    log.games++;
    if (result.won) {
      log.wins++;
      if (!result.usedHints) log.noHintWins++;
      if (typeof result.guessCount === 'number' && result.guessCount <= 4) log.fastGuessWins++;
      if (result.difficulty === 'hard') log.hardWins++;
      if (result.difficulty === 'extreme') log.extremeWins++;
    }
    log.bestStreakToday = Math.max(log.bestStreakToday, this.state.streaks.current);
    this.missionLog.set({ ...this.state.missionLog });
    this.schedulePersist();
    return log;
  }

  unlockAchievement(id: string): boolean {
    if (this.state.achievements.unlocked[id]) return false;
    this.state.achievements.unlocked[id] = new Date().toISOString();
    this.achievements.set({ unlocked: { ...this.state.achievements.unlocked } });
    this.schedulePersist();
    return true;
  }

  setMissions(list: Mission[], date: string): void {
    this.state.missions = { date, list, claimed: {} };
    this.missions.set({ ...this.state.missions });
    this.schedulePersist();
  }

  claimMission(id: string): void {
    this.state.missions.claimed[id] = true;
    this.missions.set({ ...this.state.missions, claimed: { ...this.state.missions.claimed } });
    this.schedulePersist();
  }

  setSurvivalBest(level: number): boolean {
    if (level > this.state.survivalBest.level) {
      this.state.survivalBest.level = level;
      this.survivalBest.set({ ...this.state.survivalBest });
      this.schedulePersist();
      return true;
    }
    return false;
  }

  setMarathonBest(score: number): boolean {
    if (score > this.state.marathonBest.score) {
      this.state.marathonBest.score = score;
      this.marathonBest.set({ ...this.state.marathonBest });
      this.schedulePersist();
      return true;
    }
    return false;
  }

  resetStats(): void {
    const keepSettings = this.state.settings;
    this.state = defaultState();
    this.state.settings = keepSettings;
    this.pushAllSignals();
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }

  clearAll(): void {
    this.state = defaultState();
    this.pushAllSignals();
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }

  private pushAllSignals(): void {
    this.profile.set(this.state.profile);
    this.settings.set(this.state.settings);
    this.stats.set(this.state.stats);
    this.difficultyStats.set(this.state.difficultyStats);
    this.streaks.set(this.state.streaks);
    this.achievements.set(this.state.achievements);
    this.missions.set(this.state.missions);
    this.missionLog.set(this.state.missionLog);
    this.history.set(this.state.history);
    this.survivalBest.set(this.state.survivalBest);
    this.marathonBest.set(this.state.marathonBest);
    this.daily.set(this.state.daily);
  }
}
