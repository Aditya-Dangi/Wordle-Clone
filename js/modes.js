// Game mode configuration + the mode-specific logic that doesn't belong in the pure engine:
// difficulty presets, daily seeding, share-text formatting, and Survival's progression curve.
(function (global) {
  "use strict";

  var Engine = global.WORDLE_ENGINE;
  var Data = global.WORDLE_DATA;

  var DIFFICULTIES = {
    easy: { key: "easy", name: "Easy", maxGuesses: 8, hardMode: false, hintsEnabled: true, label: "Beginner-friendly" },
    medium: { key: "medium", name: "Classic", maxGuesses: 6, hardMode: false, hintsEnabled: true, label: "The standard game" },
    hard: { key: "hard", name: "Hard", maxGuesses: 6, hardMode: true, hintsEnabled: true, label: "Discovered letters must be used" },
    extreme: { key: "extreme", name: "Extreme", maxGuesses: 5, hardMode: true, hintsEnabled: false, label: "Nightmare mode" },
  };

  var MODES = {
    classic: { key: "classic", name: "Classic", desc: "The standard Wordle experience.", boards: 1, icon: "🎯" },
    daily: { key: "daily", name: "Daily Challenge", desc: "One shared puzzle a day for everyone.", boards: 1, icon: "📅" },
    endless: { key: "endless", name: "Endless", desc: "Keep solving until you lose.", boards: 1, icon: "♾️" },
    blitz: { key: "blitz", name: "Blitz", desc: "Solve as many words as you can before time runs out.", boards: 1, timerOptions: [30, 60, 120], icon: "⚡" },
    timeAttack: { key: "timeAttack", name: "Time Attack", desc: "One word. Beat your best time.", boards: 1, icon: "⏱️" },
    survival: { key: "survival", name: "Survival", desc: "Every win raises the difficulty.", boards: 1, icon: "🌋" },
    marathon: { key: "marathon", name: "Marathon", desc: "Solve 10 words back to back.", boards: 1, rounds: 10, icon: "🏃" },
    suddenDeath: { key: "suddenDeath", name: "Sudden Death", desc: "One wrong guess ends the run.", boards: 1, icon: "💔" },
    multiword2: { key: "multiword2", name: "Double Word", desc: "Solve two boards with one stream of guesses.", boards: 2, icon: "🧩" },
    multiword3: { key: "multiword3", name: "Triple Word", desc: "Solve three boards at once.", boards: 3, icon: "🧩" },
    multiword4: { key: "multiword4", name: "Quad Word", desc: "Solve four boards at once.", boards: 4, icon: "🧩" },
    reverse: { key: "reverse", name: "Reverse Mode", desc: "Think of a word. The game tries to guess it.", boards: 1, icon: "🔄" },
    custom: { key: "custom", name: "Custom Challenge", desc: "Combine modifiers and set your own rating.", boards: 1, icon: "🛠️" },
  };

  function getAnswerPool(length) {
    return (Data.ANSWERS[length] || Data.ANSWERS[5]).filter(function (w) {
      return true;
    });
  }

  function getGuessPool(length) {
    return Data.GUESSES[length] || Data.GUESSES[5];
  }

  function extremeAnswerPool(length) {
    // Extreme mode leans on repeated-letter words for extra bite where available.
    var pool = getAnswerPool(length);
    var withRepeats = pool.filter(function (w) {
      return Engine.hasRepeatedLetter(w);
    });
    return withRepeats.length >= 20 ? withRepeats : pool;
  }

  var DAILY_EPOCH = new Date(2024, 0, 1);

  function dailyPuzzleNumber(date) {
    var d = date || new Date();
    var diffMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY_EPOCH;
    return Math.floor(diffMs / 86400000) + 1;
  }

  function getDailyWord() {
    var pool = getAnswerPool(5);
    var idx = Engine.seededIndex("daily:" + Engine.todayKey(), pool.length);
    return pool[idx];
  }

  function generateShareText(opts) {
    var lines = [];
    var guessLabel = opts.won ? opts.guessCount + "/" + opts.maxGuesses : "X/" + opts.maxGuesses;
    lines.push("Wordle Platform #" + opts.puzzleNumber + " " + guessLabel);
    lines.push("");
    opts.history.forEach(function (turn) {
      var row = turn.result
        .map(function (state) {
          if (state === "correct") return "🟩";
          if (state === "present") return "🟨";
          return "⬛";
        })
        .join("");
      lines.push(row);
    });
    return lines.join("\n");
  }

  // Survival ramps through the four difficulty tiers, then keeps Extreme rules while
  // slowly growing the word length every couple of levels (capped at 8 letters).
  function survivalConfigForLevel(level) {
    var tierOrder = ["easy", "medium", "hard", "extreme"];
    var tier = tierOrder[Math.min(level - 1, tierOrder.length - 1)];
    var base = DIFFICULTIES[tier];
    var wordLength = 5;
    if (level > tierOrder.length) {
      wordLength = Math.min(8, 5 + Math.floor((level - tierOrder.length) / 2));
    }
    return {
      level: level,
      difficulty: tier,
      wordLength: wordLength,
      maxGuesses: base.maxGuesses,
      hardMode: base.hardMode,
    };
  }

  function multiwordGuessBudget(boards) {
    return 5 + boards;
  }

  global.WORDLE_MODES = {
    DIFFICULTIES: DIFFICULTIES,
    MODES: MODES,
    getAnswerPool: getAnswerPool,
    getGuessPool: getGuessPool,
    extremeAnswerPool: extremeAnswerPool,
    dailyPuzzleNumber: dailyPuzzleNumber,
    getDailyWord: getDailyWord,
    generateShareText: generateShareText,
    survivalConfigForLevel: survivalConfigForLevel,
    multiwordGuessBudget: multiwordGuessBudget,
  };
})(window);
