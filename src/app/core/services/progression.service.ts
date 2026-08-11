import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { EngineService } from './engine.service';
import { Achievement, AchievementContext, Mission, MissionLog, ModeKey, RoundResult } from '../models/game.models';

export interface RewardBreakdown {
  xp: number;
  coins: number;
  breakdown: string[];
}

export interface XpResult {
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
  gained: number;
}

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Cosmetic presentation tier only - does not affect the unlock condition below. */
  rarity: AchievementRarity;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_word', name: 'First Word', desc: 'Solve your first puzzle.', icon: '🌱', rarity: 'common' },
  { id: 'genius', name: 'Genius', desc: 'Solve a puzzle in 2 guesses.', icon: '🧠', rarity: 'rare' },
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Solve a puzzle in under 30 seconds.', icon: '⚡', rarity: 'rare' },
  { id: 'unstoppable', name: 'Unstoppable', desc: 'Reach a 10-game win streak.', icon: '🔥', rarity: 'epic' },
  { id: 'nightmare_survivor', name: 'Nightmare Survivor', desc: 'Win a game in Extreme mode.', icon: '💀', rarity: 'epic' },
  { id: 'perfect_game', name: 'Perfect Game', desc: 'Win a game without using hints.', icon: '✨', rarity: 'rare' },
  { id: 'vocabulary_monster', name: 'Vocabulary Monster', desc: 'Solve 100 puzzles total.', icon: '📚', rarity: 'epic' },
  { id: 'centurion', name: 'Centurion', desc: 'Reach a 100-day Daily Challenge streak.', icon: '🏆', rarity: 'legendary' },
  { id: 'hard_mode_hero', name: 'Hard Mode Hero', desc: 'Win 10 games in Hard mode.', icon: '🛡️', rarity: 'rare' },
  { id: 'daily_devotee', name: 'Daily Devotee', desc: 'Complete 7 Daily Challenges.', icon: '📅', rarity: 'common' },
  { id: 'marathon_finisher', name: 'Marathon Finisher', desc: 'Complete a Marathon run.', icon: '🏃', rarity: 'rare' },
  { id: 'survivalist', name: 'Survivalist', desc: 'Reach level 5 in Survival mode.', icon: '🌿', rarity: 'rare' },
  { id: 'blitz_master', name: 'Blitz Master', desc: 'Win a Blitz round.', icon: '⏱️', rarity: 'common' },
  { id: 'sudden_death_survivor', name: 'Sudden Death Survivor', desc: 'Win a Sudden Death round.', icon: '💔', rarity: 'common' },
  { id: 'multitasker', name: 'Multitasker', desc: 'Win a multi-word round.', icon: '🧩', rarity: 'common' },
  { id: 'level_10', name: 'Rising Star', desc: 'Reach player level 10.', icon: '⭐', rarity: 'epic' },
  { id: 'coin_collector', name: 'Coin Collector', desc: 'Earn 500 coins lifetime.', icon: '💎', rarity: 'rare' },
  { id: 'reverse_thinker', name: 'Reverse Thinker', desc: 'Win a Reverse Mode round.', icon: '🔄', rarity: 'common' },
];

interface MissionDef {
  id: string;
  desc: string;
  check: (log: MissionLog) => boolean;
}

const MISSION_POOL: MissionDef[] = [
  { id: 'solve_one', desc: 'Solve one puzzle', check: (log) => log.wins >= 1 },
  { id: 'no_hint_win', desc: 'Win without hints', check: (log) => log.noHintWins >= 1 },
  { id: 'four_or_fewer', desc: 'Solve in 4 guesses or fewer', check: (log) => log.fastGuessWins >= 1 },
  { id: 'hard_mode_win', desc: 'Complete a Hard Mode game', check: (log) => log.hardWins >= 1 },
  { id: 'extreme_mode_win', desc: 'Complete an Extreme Mode game', check: (log) => log.extremeWins >= 1 },
  { id: 'three_streak', desc: 'Get a 3-game win streak', check: (log) => log.bestStreakToday >= 3 },
  { id: 'play_three', desc: 'Play 3 puzzles', check: (log) => log.games >= 3 },
];

export interface RewardContext {
  won: boolean;
  isDaily: boolean;
  usedHints: boolean;
  difficulty: string | null;
  timeMs: number | null;
  guessCount: number | null;
}

export interface AchievementCheckContext {
  won: boolean;
  mode: ModeKey;
  difficulty: string | null;
  guessCount: number;
  timeMs: number | null;
  usedHints: boolean;
  completed?: boolean;
  levelReached?: number;
}

/** XP/leveling curve, coin rewards, achievement evaluation, and daily mission generation. */
@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly storage = inject(StorageService);
  private readonly engine = inject(EngineService);

  readonly ACHIEVEMENTS = ACHIEVEMENTS;

  xpForLevel(level: number): number {
    return 100 + (level - 1) * 45;
  }

  addXp(amount: number): XpResult {
    const profile = this.storage.profile();
    let xp = profile.xp + amount;
    let level = profile.level;
    let leveledUp = false;
    while (xp >= this.xpForLevel(level)) {
      xp -= this.xpForLevel(level);
      level++;
      leveledUp = true;
    }
    this.storage.setProfile({ xp, level });
    return { level, xp, xpToNext: this.xpForLevel(level), leveledUp, gained: amount };
  }

  addCoins(amount: number): number {
    const profile = this.storage.profile();
    const coins = Math.max(0, profile.coins + amount);
    const patch: { coins: number; lifetimeCoins?: number } = { coins };
    if (amount > 0) patch.lifetimeCoins = profile.lifetimeCoins + amount;
    this.storage.setProfile(patch);
    return coins;
  }

  spendCoins(amount: number): boolean {
    const profile = this.storage.profile();
    if (profile.coins < amount) return false;
    this.storage.setProfile({ coins: profile.coins - amount });
    return true;
  }

  computeReward(ctx: RewardContext): RewardBreakdown {
    if (!ctx.won) {
      return { xp: 4, coins: 0, breakdown: ['Played: +4 XP'] };
    }
    let xp = 0;
    let coins = 0;
    const breakdown: string[] = [];

    xp += 20;
    coins += 10;
    breakdown.push('Solved: +20 XP, +10 coins');

    if (ctx.isDaily) {
      xp += 20;
      coins += 10;
      breakdown.push('Daily Challenge: +20 XP, +10 coins');
    }
    if (!ctx.usedHints) {
      xp += 15;
      coins += 5;
      breakdown.push('No hints: +15 XP, +5 coins');
    }
    if (ctx.difficulty === 'hard') {
      xp += 25;
      coins += 15;
      breakdown.push('Hard Mode: +25 XP, +15 coins');
    } else if (ctx.difficulty === 'extreme') {
      xp += 40;
      coins += 25;
      breakdown.push('Extreme Mode: +40 XP, +25 coins');
    }
    if (typeof ctx.timeMs === 'number' && ctx.timeMs < 30000) {
      xp += 15;
      breakdown.push('Fast solve: +15 XP');
    }
    if (typeof ctx.guessCount === 'number' && ctx.guessCount <= 2) {
      xp += 20;
      breakdown.push('Genius solve: +20 XP');
    }

    return { xp, coins, breakdown };
  }

  /** Evaluates every achievement against current storage state + the just-finished game's
   * context, unlocking newly-earned ones. Returns the achievements unlocked by this call. */
  checkAchievements(ctx: AchievementCheckContext): AchievementDef[] {
    const unlockedNow: AchievementDef[] = [];
    const streaks = this.storage.streaks();
    const totalSolved = this.storage.totalPuzzlesSolved();
    const profile = this.storage.profile();
    const diffStats = this.storage.difficultyStats();
    const daily = this.storage.getDaily();

    const checks: Record<string, boolean> = {
      first_word: ctx.won && totalSolved >= 1,
      genius: ctx.won && ctx.guessCount <= 2,
      speed_demon: ctx.won && typeof ctx.timeMs === 'number' && ctx.timeMs < 30000,
      unstoppable: streaks.current >= 10,
      nightmare_survivor: ctx.won && ctx.difficulty === 'extreme',
      perfect_game: ctx.won && !ctx.usedHints,
      vocabulary_monster: totalSolved >= 100,
      centurion: streaks.daily.current >= 100,
      hard_mode_hero: !!diffStats['hard'] && diffStats['hard'].won >= 10,
      daily_devotee: (daily.history || []).filter((h) => h.won).length >= 7,
      marathon_finisher: ctx.mode === 'marathon' && !!ctx.completed,
      survivalist: ctx.mode === 'survival' && (ctx.levelReached || 0) >= 5,
      blitz_master: ctx.won && ctx.mode === 'blitz',
      sudden_death_survivor: ctx.won && ctx.mode === 'suddenDeath',
      multitasker: ctx.won && ctx.mode.startsWith('multiword'),
      level_10: profile.level >= 10,
      coin_collector: profile.lifetimeCoins >= 500,
      reverse_thinker: ctx.won && ctx.mode === 'reverse',
    };

    ACHIEVEMENTS.forEach((a) => {
      if (checks[a.id] && this.storage.unlockAchievement(a.id)) {
        unlockedNow.push(a);
      }
    });
    return unlockedNow;
  }

  private pickDeterministic<T>(pool: T[], count: number, seed: string): T[] {
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.engine.seededIndex(`${seed}:${i}`, i + 1);
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled.slice(0, count);
  }

  ensureTodaysMissions(): { date: string | null; list: Mission[]; claimed: Record<string, boolean> } {
    const today = this.engine.todayKey();
    const missions = this.storage.missions();
    if (missions.date === today && missions.list.length) return missions as { date: string | null; list: Mission[]; claimed: Record<string, boolean> };
    const picked: Mission[] = this.pickDeterministic(MISSION_POOL, 3, today).map((m) => ({
      id: m.id,
      label: m.desc,
      description: m.desc,
      target: 1,
      metric: 'wins',
      reward: { xp: 25, coins: 15 },
    }));
    this.storage.setMissions(picked, today);
    return this.storage.missions() as { date: string | null; list: Mission[]; claimed: Record<string, boolean> };
  }

  updateMissionProgress(log: MissionLog): Mission[] {
    const missions = this.ensureTodaysMissions();
    const newlyClaimed: Mission[] = [];
    missions.list.forEach((m) => {
      if (missions.claimed[m.id]) return;
      const def = MISSION_POOL.find((p) => p.id === m.id);
      if (def && def.check(log)) {
        this.storage.claimMission(m.id);
        this.addXp(m.reward.xp);
        this.addCoins(m.reward.coins);
        newlyClaimed.push(m);
      }
    });
    return newlyClaimed;
  }
}
