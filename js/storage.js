// Persistence layer: a single localStorage record holding profile, settings, stats,
// streaks, achievements, missions and daily-challenge state. Every reader merges onto
// defaults so new fields added later don't break existing saved data.
(function (global) {
  "use strict";

  var KEY = "wordle_platform_v1";

  function defaultState() {
    return {
      version: 1,
      profile: { xp: 0, level: 1, coins: 0, lifetimeCoins: 0 },
      settings: {
        theme: "midnight",
        sound: true,
        haptics: true,
        colorBlind: false,
        highContrast: false,
        reducedMotion: false,
        defaultDifficulty: "medium",
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

  function deepMerge(base, extra) {
    if (Array.isArray(base)) return extra !== undefined ? extra : base;
    if (typeof base !== "object" || base === null) return extra !== undefined ? extra : base;
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = deepMerge(base[k], extra ? extra[k] : undefined);
    });
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (!(k in out)) out[k] = extra[k];
      });
    }
    return out;
  }

  function load() {
    var raw;
    try {
      raw = global.localStorage.getItem(KEY);
    } catch (e) {
      return defaultState();
    }
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      return deepMerge(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  var state = load();
  var persistTimer = null;

  function persist() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable (private mode, quota) - silently degrade to in-memory only */
    }
  }

  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persist();
    }, 50);
  }

  function emptyModeStats() {
    return {
      played: 0,
      won: 0,
      totalGuesses: 0,
      totalTimeMs: 0,
      bestTimeMs: null,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0], // index 6 = "7+"
      noHintWins: 0,
      bestScore: 0,
    };
  }

  function getModeStats(modeKey) {
    if (!state.stats[modeKey]) {
      state.stats[modeKey] = emptyModeStats();
      schedulePersist();
    }
    return state.stats[modeKey];
  }

  function getState() {
    return state;
  }

  function getProfile() {
    return state.profile;
  }

  function setProfile(patch) {
    Object.assign(state.profile, patch);
    schedulePersist();
  }

  function getSettings() {
    return state.settings;
  }

  function setSettings(patch) {
    Object.assign(state.settings, patch);
    schedulePersist();
  }

  function recordModeResult(modeKey, result) {
    var s = getModeStats(modeKey);
    s.played++;
    if (result.won) {
      s.won++;
      var bucket = Math.min(result.guessCount - 1, 6);
      s.guessDistribution[bucket]++;
      if (!result.usedHints) s.noHintWins++;
    }
    if (typeof result.timeMs === "number") {
      s.totalTimeMs += result.timeMs;
      if (result.won && (s.bestTimeMs == null || result.timeMs < s.bestTimeMs)) {
        s.bestTimeMs = result.timeMs;
      }
    }
    if (typeof result.guessCount === "number") s.totalGuesses += result.guessCount;
    if (typeof result.score === "number" && result.score > s.bestScore) s.bestScore = result.score;

    state.history.unshift({
      mode: modeKey,
      won: result.won,
      guessCount: result.guessCount || null,
      timeMs: result.timeMs || null,
      score: result.score || null,
      date: new Date().toISOString(),
    });
    state.history = state.history.slice(0, 50);
    schedulePersist();
    return s;
  }

  function recordDifficultyResult(difficulty, won) {
    if (!state.difficultyStats[difficulty]) {
      state.difficultyStats[difficulty] = { played: 0, won: 0 };
    }
    var d = state.difficultyStats[difficulty];
    d.played++;
    if (won) d.won++;
    schedulePersist();
    return d;
  }

  function getDifficultyStats() {
    return state.difficultyStats;
  }

  function totalPuzzlesSolved() {
    return Object.keys(state.stats).reduce(function (sum, key) {
      return sum + state.stats[key].won;
    }, 0);
  }

  function getStreaks() {
    return state.streaks;
  }

  function updateStreak(won) {
    if (won) {
      state.streaks.current++;
      if (state.streaks.current > state.streaks.best) state.streaks.best = state.streaks.current;
    } else {
      state.streaks.current = 0;
    }
    schedulePersist();
    return state.streaks;
  }

  function updateModifierStreak(key, hit) {
    var s = state.streaks[key];
    if (!s) return;
    if (hit) {
      s.current++;
      if (s.current > s.best) s.best = s.current;
    } else {
      s.current = 0;
    }
    schedulePersist();
  }

  function getDaily() {
    var todayKey = global.WORDLE_ENGINE.todayKey();
    if (state.daily.date !== todayKey) {
      state.daily = { date: todayKey, started: false, completed: false, won: null, history: state.daily.history || [] };
      schedulePersist();
    }
    return state.daily;
  }

  function completeDaily(won, guessCount) {
    var todayKey = global.WORDLE_ENGINE.todayKey();
    var daily = getDaily();
    daily.completed = true;
    daily.won = won;
    daily.guessCount = guessCount;

    var streaks = state.streaks.daily;
    var last = streaks.lastCompletedDate;
    var y = new Date(todayKey);
    y.setDate(y.getDate() - 1);
    var yesterdayKey = global.WORDLE_ENGINE.todayKey(y);

    if (won) {
      streaks.current = last === yesterdayKey ? streaks.current + 1 : 1;
      if (streaks.current > streaks.best) streaks.best = streaks.current;
    } else {
      streaks.current = 0;
    }
    streaks.lastCompletedDate = todayKey;
    daily.history = [{ date: todayKey, won: won, guessCount: guessCount }].concat(daily.history || []).slice(0, 30);
    schedulePersist();
    return daily;
  }

  function getMissionLog() {
    var today = global.WORDLE_ENGINE.todayKey();
    if (state.missionLog.date !== today) {
      state.missionLog = {
        date: today,
        games: 0,
        wins: 0,
        noHintWins: 0,
        fastGuessWins: 0,
        hardWins: 0,
        extremeWins: 0,
        bestStreakToday: 0,
      };
      schedulePersist();
    }
    return state.missionLog;
  }

  function recordMissionEvent(result) {
    var log = getMissionLog();
    log.games++;
    if (result.won) {
      log.wins++;
      if (!result.usedHints) log.noHintWins++;
      if (typeof result.guessCount === "number" && result.guessCount <= 4) log.fastGuessWins++;
      if (result.difficulty === "hard") log.hardWins++;
      if (result.difficulty === "extreme") log.extremeWins++;
    }
    log.bestStreakToday = Math.max(log.bestStreakToday, state.streaks.current);
    schedulePersist();
    return log;
  }

  function getAchievements() {
    return state.achievements;
  }

  function unlockAchievement(id) {
    if (state.achievements.unlocked[id]) return false;
    state.achievements.unlocked[id] = new Date().toISOString();
    schedulePersist();
    return true;
  }

  function getMissions() {
    return state.missions;
  }

  function setMissions(list, date) {
    state.missions = { date: date, list: list, claimed: {} };
    schedulePersist();
  }

  function claimMission(id) {
    state.missions.claimed[id] = true;
    schedulePersist();
  }

  function getSurvivalBest() {
    return state.survivalBest;
  }

  function setSurvivalBest(level) {
    if (level > state.survivalBest.level) {
      state.survivalBest.level = level;
      schedulePersist();
      return true;
    }
    return false;
  }

  function getMarathonBest() {
    return state.marathonBest;
  }

  function setMarathonBest(score) {
    if (score > state.marathonBest.score) {
      state.marathonBest.score = score;
      schedulePersist();
      return true;
    }
    return false;
  }

  function resetStats() {
    var keepSettings = state.settings;
    state = defaultState();
    state.settings = keepSettings;
    persist();
  }

  function clearAll() {
    state = defaultState();
    persist();
  }

  global.WORDLE_STORAGE = {
    getState: getState,
    getProfile: getProfile,
    setProfile: setProfile,
    getSettings: getSettings,
    setSettings: setSettings,
    getModeStats: getModeStats,
    recordModeResult: recordModeResult,
    recordDifficultyResult: recordDifficultyResult,
    getDifficultyStats: getDifficultyStats,
    totalPuzzlesSolved: totalPuzzlesSolved,
    getStreaks: getStreaks,
    updateStreak: updateStreak,
    updateModifierStreak: updateModifierStreak,
    getDaily: getDaily,
    completeDaily: completeDaily,
    getAchievements: getAchievements,
    unlockAchievement: unlockAchievement,
    getMissions: getMissions,
    setMissions: setMissions,
    claimMission: claimMission,
    getMissionLog: getMissionLog,
    recordMissionEvent: recordMissionEvent,
    getSurvivalBest: getSurvivalBest,
    setSurvivalBest: setSurvivalBest,
    getMarathonBest: getMarathonBest,
    setMarathonBest: setMarathonBest,
    resetStats: resetStats,
    clearAll: clearAll,
  };
})(window);
