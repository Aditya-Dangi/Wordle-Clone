// Player progression: XP/leveling curve, coin rewards, achievement definitions + evaluation,
// and daily mission generation. Reads/writes through WORDLE_STORAGE only.
(function (global) {
  "use strict";

  var Storage = global.WORDLE_STORAGE;
  var Engine = global.WORDLE_ENGINE;

  // XP required to go from `level` to `level + 1`.
  function xpForLevel(level) {
    return 100 + (level - 1) * 45;
  }

  function addXp(amount) {
    var profile = Storage.getProfile();
    var xp = profile.xp + amount;
    var level = profile.level;
    var leveledUp = false;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
      leveledUp = true;
    }
    Storage.setProfile({ xp: xp, level: level });
    return { level: level, xp: xp, xpToNext: xpForLevel(level), leveledUp: leveledUp, gained: amount };
  }

  function addCoins(amount) {
    var profile = Storage.getProfile();
    var coins = Math.max(0, profile.coins + amount);
    var patch = { coins: coins };
    if (amount > 0) patch.lifetimeCoins = profile.lifetimeCoins + amount;
    Storage.setProfile(patch);
    return coins;
  }

  function spendCoins(amount) {
    var profile = Storage.getProfile();
    if (profile.coins < amount) return false;
    Storage.setProfile({ coins: profile.coins - amount });
    return true;
  }

  // Computes the XP/coin reward for a just-finished game from a context describing what
  // happened. Called once per game by the mode controller in main.js.
  function computeReward(ctx) {
    var xp = 0;
    var coins = 0;
    if (!ctx.won) {
      return { xp: 4, coins: 0, breakdown: ["Played: +4 XP"] };
    }
    var breakdown = [];

    xp += 20;
    coins += 10;
    breakdown.push("Solved: +20 XP, +10 coins");

    if (ctx.isDaily) {
      xp += 20;
      coins += 10;
      breakdown.push("Daily Challenge: +20 XP, +10 coins");
    }
    if (!ctx.usedHints) {
      xp += 15;
      coins += 5;
      breakdown.push("No hints: +15 XP, +5 coins");
    }
    if (ctx.difficulty === "hard") {
      xp += 25;
      coins += 15;
      breakdown.push("Hard Mode: +25 XP, +15 coins");
    } else if (ctx.difficulty === "extreme") {
      xp += 40;
      coins += 25;
      breakdown.push("Extreme Mode: +40 XP, +25 coins");
    }
    if (typeof ctx.timeMs === "number" && ctx.timeMs < 30000) {
      xp += 15;
      breakdown.push("Fast solve: +15 XP");
    }
    if (typeof ctx.guessCount === "number" && ctx.guessCount <= 2) {
      xp += 20;
      breakdown.push("Genius solve: +20 XP");
    }

    return { xp: xp, coins: coins, breakdown: breakdown };
  }

  var ACHIEVEMENTS = [
    { id: "first_word", name: "First Word", desc: "Solve your first puzzle.", icon: "🌱" },
    { id: "genius", name: "Genius", desc: "Solve a puzzle in 2 guesses.", icon: "🧠" },
    { id: "speed_demon", name: "Speed Demon", desc: "Solve a puzzle in under 30 seconds.", icon: "⚡" },
    { id: "unstoppable", name: "Unstoppable", desc: "Reach a 10-game win streak.", icon: "🔥" },
    { id: "nightmare_survivor", name: "Nightmare Survivor", desc: "Win a game in Extreme mode.", icon: "💀" },
    { id: "perfect_game", name: "Perfect Game", desc: "Win a game without using hints.", icon: "✨" },
    { id: "vocabulary_monster", name: "Vocabulary Monster", desc: "Solve 100 puzzles total.", icon: "📚" },
    { id: "centurion", name: "Centurion", desc: "Reach a 100-day Daily Challenge streak.", icon: "🏆" },
    { id: "hard_mode_hero", name: "Hard Mode Hero", desc: "Win 10 games in Hard mode.", icon: "🛡️" },
    { id: "daily_devotee", name: "Daily Devotee", desc: "Complete 7 Daily Challenges.", icon: "📅" },
    { id: "marathon_finisher", name: "Marathon Finisher", desc: "Complete a Marathon run.", icon: "🏃" },
    { id: "survivalist", name: "Survivalist", desc: "Reach level 5 in Survival mode.", icon: "🌿" },
    { id: "blitz_master", name: "Blitz Master", desc: "Win a Blitz round.", icon: "⏱️" },
    { id: "sudden_death_survivor", name: "Sudden Death Survivor", desc: "Win a Sudden Death round.", icon: "💔" },
    { id: "multitasker", name: "Multitasker", desc: "Win a multi-word round.", icon: "🧩" },
    { id: "level_10", name: "Rising Star", desc: "Reach player level 10.", icon: "⭐" },
    { id: "coin_collector", name: "Coin Collector", desc: "Earn 500 coins lifetime.", icon: "💎" },
    { id: "reverse_thinker", name: "Reverse Thinker", desc: "Win a Reverse Mode round.", icon: "🔄" },
  ];

  // Evaluates every achievement against current storage state + the context of the game
  // that just finished, unlocking any newly-earned ones. Returns the list of achievements
  // unlocked by this call (usually 0 or 1, occasionally more).
  function checkAchievements(ctx) {
    var unlockedNow = [];
    var streaks = Storage.getStreaks();
    var totalSolved = Storage.totalPuzzlesSolved();
    var profile = Storage.getProfile();
    var diffStats = Storage.getDifficultyStats();

    var checks = {
      first_word: ctx.won && totalSolved >= 1,
      genius: ctx.won && ctx.guessCount <= 2,
      speed_demon: ctx.won && typeof ctx.timeMs === "number" && ctx.timeMs < 30000,
      unstoppable: streaks.current >= 10,
      nightmare_survivor: ctx.won && ctx.difficulty === "extreme",
      perfect_game: ctx.won && !ctx.usedHints,
      vocabulary_monster: totalSolved >= 100,
      centurion: streaks.daily.current >= 100,
      hard_mode_hero: diffStats.hard && diffStats.hard.won >= 10,
      daily_devotee: Storage.getDaily().history && Storage.getDaily().history.filter(function (h) { return h.won; }).length >= 7,
      marathon_finisher: ctx.mode === "marathon" && ctx.completed,
      survivalist: ctx.mode === "survival" && ctx.levelReached >= 5,
      blitz_master: ctx.won && ctx.mode === "blitz",
      sudden_death_survivor: ctx.won && ctx.mode === "suddenDeath",
      multitasker: ctx.won && ctx.mode === "multiword",
      level_10: profile.level >= 10,
      coin_collector: profile.lifetimeCoins >= 500,
      reverse_thinker: ctx.won && ctx.mode === "reverse",
    };

    ACHIEVEMENTS.forEach(function (a) {
      if (checks[a.id] && Storage.unlockAchievement(a.id)) {
        unlockedNow.push(a);
      }
    });
    return unlockedNow;
  }

  var MISSION_POOL = [
    { id: "solve_one", desc: "Solve one puzzle", check: function (log) { return log.wins >= 1; } },
    { id: "no_hint_win", desc: "Win without hints", check: function (log) { return log.noHintWins >= 1; } },
    { id: "four_or_fewer", desc: "Solve in 4 guesses or fewer", check: function (log) { return log.fastGuessWins >= 1; } },
    { id: "hard_mode_win", desc: "Complete a Hard Mode game", check: function (log) { return log.hardWins >= 1; } },
    { id: "extreme_mode_win", desc: "Complete an Extreme Mode game", check: function (log) { return log.extremeWins >= 1; } },
    { id: "three_streak", desc: "Get a 3-game win streak", check: function (log) { return log.bestStreakToday >= 3; } },
    { id: "play_three", desc: "Play 3 puzzles", check: function (log) { return log.games >= 3; } },
  ];

  function pickDeterministic(pool, count, seed) {
    var shuffled = pool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Engine.seededIndex(seed + ":" + i, i + 1);
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled.slice(0, count);
  }

  function ensureTodaysMissions() {
    var today = Engine.todayKey();
    var missions = Storage.getMissions();
    if (missions.date === today && missions.list.length) return missions;
    var picked = pickDeterministic(MISSION_POOL, 3, today).map(function (m) {
      return { id: m.id, desc: m.desc, reward: { xp: 25, coins: 15 } };
    });
    Storage.setMissions(picked, today);
    return Storage.getMissions();
  }

  // `log` accumulates today's session facts; call updateMissionProgress after each game.
  function updateMissionProgress(log) {
    var missions = ensureTodaysMissions();
    var newlyClaimed = [];
    missions.list.forEach(function (m) {
      if (missions.claimed[m.id]) return;
      var def = MISSION_POOL.filter(function (p) { return p.id === m.id; })[0];
      if (def && def.check(log)) {
        Storage.claimMission(m.id);
        addXp(m.reward.xp);
        addCoins(m.reward.coins);
        newlyClaimed.push(m);
      }
    });
    return newlyClaimed;
  }

  global.WORDLE_PROGRESSION = {
    xpForLevel: xpForLevel,
    addXp: addXp,
    addCoins: addCoins,
    spendCoins: spendCoins,
    computeReward: computeReward,
    ACHIEVEMENTS: ACHIEVEMENTS,
    checkAchievements: checkAchievements,
    ensureTodaysMissions: ensureTodaysMissions,
    updateMissionProgress: updateMissionProgress,
  };
})(window);
