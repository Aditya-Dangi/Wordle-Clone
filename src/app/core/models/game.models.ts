export type TileState = 'correct' | 'present' | 'absent';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export type ModeKey =
  | 'classic'
  | 'daily'
  | 'endless'
  | 'blitz'
  | 'timeAttack'
  | 'survival'
  | 'marathon'
  | 'suddenDeath'
  | 'multiword2'
  | 'multiword3'
  | 'multiword4'
  | 'reverse'
  | 'custom';

export interface GuessTurn {
  guess: string;
  result: TileState[];
}

export interface BoardState {
  answer: string;
  history: GuessTurn[];
  solved: boolean;
}

export interface DifficultyConfig {
  key: Difficulty;
  label: string;
  description: string;
  wordLength: number;
  maxGuesses: number;
  hardMode: boolean;
  timerSeconds: number | null;
}

export interface ModeConfig {
  key: ModeKey;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  boards: number;
  category: 'core' | 'timed' | 'endurance' | 'multi' | 'special';
  allowsDifficultyPick: boolean;
  allowsCategoryPick: boolean;
  allowsWordLengthPick: boolean;
  allowsCustomModifiers: boolean;
}

export interface CustomModifiers {
  wordLength: number;
  maxGuesses: number;
  hardMode: boolean;
  timerSeconds: number | null;
  blindTiles: boolean;
  noVowelFeedback: boolean;
  noRepeatGuesses: boolean;
  noHints: boolean;
}

export interface RoundResult {
  won: boolean;
  guessCount: number | null;
  timeMs: number | null;
  score: number | null;
  usedHints: boolean;
  difficulty: Difficulty | null;
}

export interface ModeStats {
  played: number;
  won: number;
  totalGuesses: number;
  totalTimeMs: number;
  bestTimeMs: number | null;
  guessDistribution: number[];
  noHintWins: number;
  bestScore: number;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  totalSolved: number;
  streaks: StreaksState;
  stats: Record<string, ModeStats>;
  difficultyStats: Record<string, { played: number; won: number }>;
  lastResult: RoundResult | null;
  lastMode: ModeKey | null;
}

export interface StreaksState {
  current: number;
  best: number;
  daily: { current: number; best: number; lastCompletedDate: string | null };
  hard: { current: number; best: number };
  perfect: { current: number; best: number };
}

export interface Mission {
  id: string;
  label: string;
  description: string;
  target: number;
  metric: keyof MissionLog | 'streak';
  reward: { xp: number; coins: number };
}

export interface MissionLog {
  date: string | null;
  games: number;
  wins: number;
  noHintWins: number;
  fastGuessWins: number;
  hardWins: number;
  extremeWins: number;
  bestStreakToday: number;
}

export interface Profile {
  xp: number;
  level: number;
  coins: number;
  lifetimeCoins: number;
}

export interface Settings {
  theme: string;
  sound: boolean;
  haptics: boolean;
  colorBlind: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  defaultDifficulty: Difficulty;
}

export interface HistoryEntry {
  mode: ModeKey;
  won: boolean;
  guessCount: number | null;
  timeMs: number | null;
  score: number | null;
  date: string;
}
