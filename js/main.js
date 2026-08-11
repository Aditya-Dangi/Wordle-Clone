// App controller: wires engine + storage + progression + modes + ui together, owns the
// current game session's state machine, and renders the Home/Stats/Achievements/Settings
// screens. This is the only file that touches "what should happen", everything else is a
// reusable building block.
(function () {
  "use strict";

  var Engine = window.WORDLE_ENGINE;
  var Storage = window.WORDLE_STORAGE;
  var Progression = window.WORDLE_PROGRESSION;
  var Modes = window.WORDLE_MODES;
  var UI = window.WORDLE_UI;
  var Data = window.WORDLE_DATA;

  var session = null;
  var setupState = { mode: null, selections: {} };
  var lastSessionConfig = null;
  var timerHandle = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    UI.applySettings(Storage.getSettings());
    wireNav();
    wireGlobalModals();
    wireHome();
    wireSetupControls();
    wirePlayControls();
    renderHeader();
    renderHome();
    UI.showView("home");
  }

  /* ---------------------------------------------------------------------- helpers */

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      /* clipboard unavailable - user can still read the text on screen */
    }
    document.body.removeChild(ta);
  }

  function aggregateStats() {
    var stats = Storage.getState().stats;
    var played = 0;
    var won = 0;
    Object.keys(stats).forEach(function (k) {
      played += stats[k].played;
      won += stats[k].won;
    });
    return { played: played, won: won };
  }

  function buildAnswerPool(wordLength, category, extreme) {
    var pool = extreme ? Modes.extremeAnswerPool(wordLength) : Modes.getAnswerPool(wordLength);
    if (category && category !== "any" && wordLength === 5 && Data.CATEGORIES[category]) {
      var set = {};
      Data.CATEGORIES[category].forEach(function (w) {
        set[w] = true;
      });
      var filtered = pool.filter(function (w) {
        return set[w];
      });
      if (filtered.length) return filtered;
    }
    return pool;
  }

  /* ---------------------------------------------------------------------- header / nav */

  function renderHeader() {
    var profile = Storage.getProfile();
    var xpToNext = Progression.xpForLevel(profile.level);
    document.querySelectorAll("[data-level-badge]").forEach(function (el) {
      el.textContent = "Lv " + profile.level;
    });
    document.querySelectorAll("[data-xp-fill]").forEach(function (el) {
      el.style.width = Math.min(100, Math.round((profile.xp / xpToNext) * 100)) + "%";
    });
    var coinsEl = document.querySelector("[data-coins-display]");
    if (coinsEl) coinsEl.textContent = "💎 " + profile.coins;
    var coinsPlayEl = document.querySelector("[data-coins-display-play]");
    if (coinsPlayEl) coinsPlayEl.textContent = "💎 " + profile.coins;
  }

  function wireNav() {
    document.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goToView(btn.getAttribute("data-view"));
      });
    });
  }

  function goToView(name) {
    UI.showView(name);
    if (name === "home") renderHome();
    if (name === "stats") renderStats();
    if (name === "achievements") renderAchievements();
    if (name === "settings") renderSettings();
  }

  function wireGlobalModals() {
    document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        UI.closeModal(btn.getAttribute("data-close-modal"));
      });
    });
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) overlay.hidden = true;
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay:not([hidden])").forEach(function (m) {
          m.hidden = true;
        });
      }
    });
    var howtoBtn = document.querySelector("[data-open-howto]");
    if (howtoBtn) howtoBtn.addEventListener("click", function () { UI.openModal("howto"); });
  }

  /* ---------------------------------------------------------------------- home */

  function renderHome() {
    var daily = Storage.getDaily();
    var puzzleNumber = Modes.dailyPuzzleNumber();
    document.querySelector("[data-daily-number]").textContent = "#" + puzzleNumber;

    var statusEl = document.querySelector("[data-daily-status]");
    var playBtn = document.querySelector("[data-play-daily]");
    if (daily.completed) {
      statusEl.textContent = daily.won
        ? "Solved in " + daily.guessCount + "/6 guesses. Come back tomorrow!"
        : "Missed today's word. Come back tomorrow!";
      playBtn.disabled = true;
      playBtn.textContent = "Completed for Today";
    } else {
      statusEl.textContent = "One shared puzzle for everyone today.";
      playBtn.disabled = false;
      playBtn.textContent = "Play Daily Challenge";
    }

    var streaks = Storage.getStreaks();
    document.querySelector("[data-pill-current-streak]").textContent = streaks.current;
    document.querySelector("[data-pill-daily-streak]").textContent = streaks.daily.current;
    document.querySelector("[data-pill-solved]").textContent = Storage.totalPuzzlesSolved();
    var totals = aggregateStats();
    document.querySelector("[data-pill-winrate]").textContent = totals.played
      ? Math.round((totals.won / totals.played) * 100) + "%"
      : "0%";

    var modeGrid = document.querySelector("[data-mode-grid]");
    modeGrid.innerHTML = "";
    Object.keys(Modes.MODES).forEach(function (key) {
      if (key === "daily") return;
      var mode = Modes.MODES[key];
      modeGrid.appendChild(
        UI.createModeCard(mode, function () {
          openSetup(key);
        })
      );
    });

    renderMissions();
    renderAchievementsTeaser();
    renderHeader();
  }

  function wireHome() {
    document.querySelector("[data-play-daily]").addEventListener("click", function () {
      if (Storage.getDaily().completed) return;
      startSession("daily", {});
    });
  }

  function renderMissions() {
    var missions = Progression.ensureTodaysMissions();
    var list = document.querySelector("[data-missions-list]");
    list.innerHTML = "";
    missions.list.forEach(function (m) {
      var done = !!missions.claimed[m.id];
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="mission-check' + (done ? " done" : "") + '">' + (done ? "✓" : "") + "</span>" +
        '<span class="mission-desc' + (done ? " done" : "") + '">' + m.desc + "</span>" +
        '<span class="mission-reward">+' + m.reward.xp + " XP</span>";
      list.appendChild(li);
    });
  }

  function renderAchievementsTeaser() {
    var unlocked = Storage.getAchievements().unlocked;
    var row = document.querySelector("[data-achievements-teaser]");
    row.innerHTML = "";
    Progression.ACHIEVEMENTS.slice(0, 6).forEach(function (a) {
      var locked = !unlocked[a.id];
      var el = document.createElement("div");
      el.className = "achievement-card" + (locked ? " locked" : "");
      el.innerHTML =
        '<span class="achievement-icon">' + a.icon + "</span>" +
        '<span class="achievement-name">' + a.name + "</span>";
      row.appendChild(el);
    });
  }

  /* ---------------------------------------------------------------------- setup screen */

  function defaultSelectionsFor() {
    var settings = Storage.getSettings();
    return {
      difficulty: settings.defaultDifficulty || "medium",
      wordLength: 5,
      category: "any",
      timerSeconds: 60,
      mods: {
        hardMode: false,
        blindTiles: false,
        noVowelFeedback: false,
        noRepeatGuesses: false,
        noHints: false,
        maxGuesses: 6,
        wordLength: 5,
        timerSeconds: null,
      },
    };
  }

  function openSetup(modeKey) {
    setupState = { mode: modeKey, selections: defaultSelectionsFor() };
    var mode = Modes.MODES[modeKey];
    document.querySelector("[data-setup-icon]").textContent = mode.icon;
    document.querySelector("[data-setup-title]").textContent = mode.name;
    document.querySelector("[data-setup-desc]").textContent = mode.desc;
    renderSetupOptions();
    goToView("setup");
  }

  function renderSetupOptions() {
    var container = document.querySelector("[data-setup-options]");
    container.innerHTML = "";
    var s = setupState.selections;
    var modeKey = setupState.mode;

    function addDifficultyChip() {
      container.appendChild(
        UI.createOptionChipGroup({
          label: "Difficulty",
          choices: Object.keys(Modes.DIFFICULTIES).map(function (k) {
            var d = Modes.DIFFICULTIES[k];
            return { value: d.key, label: d.name, sub: d.maxGuesses + " guesses" };
          }),
          selected: s.difficulty,
          onChange: function (v) {
            s.difficulty = v;
          },
        })
      );
    }

    function addWordLengthChip() {
      container.appendChild(
        UI.createOptionChipGroup({
          label: "Word Length",
          choices: [4, 5, 6, 7, 8].map(function (n) {
            return { value: n, label: n + " letters" };
          }),
          selected: s.wordLength,
          onChange: function (v) {
            s.wordLength = Number(v);
            renderSetupOptions();
          },
        })
      );
    }

    function addCategoryChip() {
      if (s.wordLength !== 5) return;
      var cats = Object.keys(Data.CATEGORIES);
      container.appendChild(
        UI.createOptionChipGroup({
          label: "Category",
          choices: [{ value: "any", label: "Any" }].concat(
            cats.map(function (c) {
              return { value: c, label: capitalize(c) };
            })
          ),
          selected: s.category,
          onChange: function (v) {
            s.category = v;
          },
        })
      );
    }

    function addTimerChip() {
      container.appendChild(
        UI.createOptionChipGroup({
          label: "Timer",
          choices: Modes.MODES.blitz.timerOptions.map(function (t) {
            return { value: t, label: t + "s" };
          }),
          selected: s.timerSeconds,
          onChange: function (v) {
            s.timerSeconds = Number(v);
          },
        })
      );
    }

    function note(text) {
      var p = document.createElement("p");
      p.className = "muted";
      p.textContent = text;
      container.appendChild(p);
    }

    switch (modeKey) {
      case "classic":
      case "endless":
      case "timeAttack":
        addDifficultyChip();
        addWordLengthChip();
        addCategoryChip();
        break;
      case "blitz":
        addTimerChip();
        addWordLengthChip();
        break;
      case "survival":
        note(
          "Starts at Easy. Every word you solve raises the difficulty: word length, guess count, and Hard Mode rules escalate. One loss ends the run."
        );
        break;
      case "marathon":
        addDifficultyChip();
        addWordLengthChip();
        break;
      case "suddenDeath":
        addWordLengthChip();
        note("You get exactly one guess per word. Miss once and the run ends.");
        break;
      case "multiword2":
      case "multiword3":
      case "multiword4":
        addWordLengthChip();
        note("One stream of guesses is checked against every board at once.");
        break;
      case "reverse":
        addWordLengthChip();
        note("Think of a word of this length. The game will guess it - you just color the tiles.");
        break;
      case "custom":
        renderCustomModifiers(container, s);
        break;
      default:
        break;
    }

    var ratingBox = document.querySelector("[data-challenge-rating]");
    ratingBox.hidden = modeKey !== "custom";
    if (modeKey === "custom") updateChallengeRatingDisplay();
  }

  function renderCustomModifiers(container, s) {
    container.appendChild(
      UI.createOptionChipGroup({
        label: "Word Length",
        choices: [4, 5, 6, 7, 8].map(function (n) {
          return { value: n, label: n + " letters" };
        }),
        selected: s.mods.wordLength,
        onChange: function (v) {
          s.mods.wordLength = Number(v);
          updateChallengeRatingDisplay();
        },
      })
    );
    container.appendChild(
      UI.createOptionChipGroup({
        label: "Guesses",
        choices: [3, 4, 5, 6, 7, 8].map(function (n) {
          return { value: n, label: String(n) };
        }),
        selected: s.mods.maxGuesses,
        onChange: function (v) {
          s.mods.maxGuesses = Number(v);
          updateChallengeRatingDisplay();
        },
      })
    );
    container.appendChild(
      UI.createOptionChipGroup({
        label: "Timer",
        choices: [
          { value: 0, label: "None" },
          { value: 30, label: "30s" },
          { value: 60, label: "60s" },
          { value: 120, label: "120s" },
        ],
        selected: s.mods.timerSeconds || 0,
        onChange: function (v) {
          s.mods.timerSeconds = Number(v) || null;
          updateChallengeRatingDisplay();
        },
      })
    );

    [
      ["hardMode", "Hard Mode", "Discovered letters must be reused"],
      ["blindTiles", "Blind Tiles", "One tile per row stays hidden"],
      ["noVowelFeedback", "No Vowel Feedback", "Vowel tiles never reveal color"],
      ["noRepeatGuesses", "No Repeat Guesses", "You can't submit the same word twice"],
      ["noHints", "No Hints", "Disables the hint bar"],
    ].forEach(function (item) {
      container.appendChild(
        UI.createToggleRow({
          label: item[1],
          sub: item[2],
          checked: s.mods[item[0]],
          onChange: function (v) {
            s.mods[item[0]] = v;
            updateChallengeRatingDisplay();
          },
        })
      );
    });
  }

  function updateChallengeRatingDisplay() {
    var rating = Engine.computeChallengeRating(setupState.selections.mods);
    document.querySelector("[data-challenge-rating-value]").textContent = rating;
  }

  function wireSetupControls() {
    document.querySelector("[data-setup-back]").addEventListener("click", function () {
      goToView("home");
    });
    document.querySelector("[data-setup-start]").addEventListener("click", function () {
      startSession(setupState.mode, setupState.selections);
    });
  }

  /* ---------------------------------------------------------------------- session start */

  function startSession(modeKey, selections) {
    var mode = Modes.MODES[modeKey];
    var boardsCount = mode.boards;
    var difficultyKey = selections.difficulty || "medium";
    var difficulty = Modes.DIFFICULTIES[difficultyKey] || Modes.DIFFICULTIES.medium;
    var wordLength = selections.wordLength || 5;
    var maxGuesses = difficulty.maxGuesses;
    var hardMode = difficulty.hardMode;
    var timerSeconds = null;
    var stopwatch = false;
    var category = selections.category || "any";
    var isDaily = modeKey === "daily";
    var blindTiles = false;
    var noVowelFeedback = false;
    var noRepeatGuesses = false;
    var hintsDisabledOverride = false;

    if (modeKey === "blitz") {
      timerSeconds = selections.timerSeconds || 60;
      wordLength = selections.wordLength || 5;
      maxGuesses = 6;
      hardMode = false;
      difficultyKey = "medium";
      difficulty = Modes.DIFFICULTIES.medium;
    }
    if (modeKey === "timeAttack") {
      stopwatch = true;
    }
    if (modeKey === "suddenDeath") {
      wordLength = selections.wordLength || 5;
      maxGuesses = 1;
      hardMode = false;
    }
    if (modeKey === "multiword2" || modeKey === "multiword3" || modeKey === "multiword4") {
      wordLength = selections.wordLength || 5;
      maxGuesses = Modes.multiwordGuessBudget(boardsCount);
      hardMode = false;
    }
    if (modeKey === "reverse") {
      wordLength = selections.wordLength || 5;
      maxGuesses = 10;
    }
    if (modeKey === "survival") {
      var svc0 = Modes.survivalConfigForLevel(1);
      wordLength = svc0.wordLength;
      maxGuesses = svc0.maxGuesses;
      hardMode = svc0.hardMode;
      difficultyKey = svc0.difficulty;
      difficulty = Modes.DIFFICULTIES[svc0.difficulty];
    }
    if (modeKey === "custom") {
      var mods = selections.mods;
      wordLength = mods.wordLength;
      maxGuesses = mods.maxGuesses;
      hardMode = mods.hardMode;
      timerSeconds = mods.timerSeconds || null;
      blindTiles = mods.blindTiles;
      noVowelFeedback = mods.noVowelFeedback;
      noRepeatGuesses = mods.noRepeatGuesses;
      hintsDisabledOverride = mods.noHints;
      difficultyKey = "custom";
    }
    if (isDaily) {
      wordLength = 5;
      difficultyKey = "medium";
      difficulty = Modes.DIFFICULTIES.medium;
      maxGuesses = 6;
      hardMode = false;
      category = "any";
    }

    var answerPool = buildAnswerPool(wordLength, category, difficultyKey === "extreme");
    var guessPool = Modes.getGuessPool(wordLength);

    session = {
      mode: modeKey,
      modeConfig: mode,
      difficulty: difficultyKey,
      wordLength: wordLength,
      maxGuesses: maxGuesses,
      hardMode: hardMode,
      boardsCount: boardsCount,
      category: category,
      answerPool: answerPool,
      guessPool: guessPool,
      isDaily: isDaily,
      blindTiles: blindTiles,
      noVowelFeedback: noVowelFeedback,
      noRepeatGuesses: noRepeatGuesses,
      hintsEnabled: !hintsDisabledOverride && difficulty.hintsEnabled !== false,
      timerSeconds: timerSeconds,
      stopwatch: stopwatch,
      usedGuesses: {},
      usedHints: false,
      active: true,
      locked: false,
      survivalLevel: modeKey === "survival" ? 1 : null,
      survivalCleared: 0,
      marathonRound: 0,
      marathonScore: 0,
      marathonTotalGuesses: 0,
      marathonTotalTime: 0,
      blitzSolved: 0,
      endlessCount: 0,
      suddenDeathCount: 0,
      wordIntelOn: false,
      startedAt: Date.now(),
      puzzleNumber: isDaily ? Modes.dailyPuzzleNumber() : null,
      answers: [],
      boardHistories: [],
      boardSolved: [],
      currentGuess: "",
      guessesUsed: 0,
    };

    lastSessionConfig = { mode: modeKey, selections: selections };
    Storage.getDaily();

    enterPlayView();

    if (modeKey === "reverse") {
      startReverseRound();
    } else {
      pickAnswersForRound();
      resetRoundState();
      setupBoardsUI();
    }
  }

  function pickAnswersForRound() {
    session.answers = [];
    var used = {};
    for (var i = 0; i < session.boardsCount; i++) {
      var word;
      if (session.isDaily) {
        word = Modes.getDailyWord();
      } else {
        var attempts = 0;
        do {
          word = Engine.randomWord(session.answerPool);
          attempts++;
        } while (used[word] && attempts < 20 && session.answerPool.length > session.boardsCount);
      }
      used[word] = true;
      session.answers.push(word);
    }
  }

  function resetRoundState() {
    session.boardHistories = session.answers.map(function () {
      return [];
    });
    session.boardSolved = session.answers.map(function () {
      return false;
    });
    session.currentGuess = "";
    session.guessesUsed = 0;
    session.usedGuesses = {};
    session.roundStartTime = Date.now();
  }

  function setupBoardsUI() {
    var container = document.querySelector("[data-boards-container]");
    session.boardEls = UI.buildBoards(container, {
      boards: session.boardsCount,
      wordLength: session.wordLength,
      maxGuesses: session.maxGuesses,
    });
    UI.resetKeyboard(document.querySelector("[data-keyboard]"));
  }

  function enterPlayView() {
    document.querySelector("[data-play-mode-name]").textContent =
      session.modeConfig.name + (session.category && session.category !== "any" ? " · " + capitalize(session.category) : "");
    var badge = document.querySelector("[data-play-difficulty-badge]");
    var diffDef = Modes.DIFFICULTIES[session.difficulty];
    badge.textContent = diffDef ? diffDef.name : capitalize(session.difficulty);
    badge.className = "badge difficulty-" + session.difficulty;

    document.querySelector("[data-restart]").classList.add("hidden");
    document.querySelector("[data-give-up]").classList.remove("hidden");
    document.querySelector("[data-alert-container]").innerHTML = "";
    document.querySelector("[data-candidate-info]").hidden = true;
    document.querySelector("[data-keyboard]").style.display = session.mode === "reverse" ? "none" : "";

    renderHintBar();
    renderHeader();
    startTimerIfNeeded();
    goToViewPlayOnly();
  }

  function goToViewPlayOnly() {
    UI.showView("play");
  }

  /* ---------------------------------------------------------------------- timer */

  function clearTimerHandle() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function startTimerIfNeeded() {
    clearTimerHandle();
    var display = document.querySelector("[data-timer-display]");
    if (session.timerSeconds) {
      session.timeRemaining = session.timerSeconds;
      display.classList.remove("hidden");
      display.textContent = formatTime(session.timeRemaining);
      display.classList.toggle("low", session.timeRemaining <= 10);
      timerHandle = setInterval(function () {
        session.timeRemaining--;
        display.textContent = formatTime(Math.max(0, session.timeRemaining));
        display.classList.toggle("low", session.timeRemaining <= 10);
        if (session.timeRemaining <= 0) {
          clearTimerHandle();
          onTimerExpired();
        }
      }, 1000);
    } else if (session.stopwatch) {
      session.elapsedDisplay = 0;
      display.classList.remove("hidden");
      display.classList.remove("low");
      display.textContent = formatTime(0);
      timerHandle = setInterval(function () {
        session.elapsedDisplay++;
        display.textContent = formatTime(session.elapsedDisplay);
      }, 1000);
    } else {
      display.classList.add("hidden");
    }
  }

  function onTimerExpired() {
    if (!session || !session.active) return;
    UI.showAlert(document.querySelector("[data-alert-container]"), "Time's up!", 1500);
    session.locked = true;
    var won = session.mode === "blitz" ? session.blitzSolved > 0 : false;
    finalizeSessionEnd(won, currentModeExtra());
  }

  /* ---------------------------------------------------------------------- hints & word intel */

  var HINTS = [
    { id: "vowel", label: "🔡 Reveal Vowel", cost: 10 },
    { id: "first", label: "🔤 First Letter", cost: 15 },
    { id: "position", label: "📍 Reveal Letter", cost: 20 },
    { id: "category", label: "🏷️ Category", cost: 10 },
    { id: "eliminate", label: "🚫 Eliminate Letters", cost: 15 },
  ];

  function renderHintBar() {
    var bar = document.querySelector("[data-hint-bar]");
    bar.innerHTML = "";
    if (session.mode === "reverse") return;
    if (!session.hintsEnabled) return;

    HINTS.forEach(function (h) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hint-btn";
      btn.textContent = h.label + " (" + h.cost + "💎)";
      btn.addEventListener("click", function () {
        useHint(h.id, h.cost);
      });
      bar.appendChild(btn);
    });

    var intelBtn = document.createElement("button");
    intelBtn.type = "button";
    intelBtn.className = "hint-btn";
    intelBtn.textContent = "💡 Word Intelligence";
    intelBtn.addEventListener("click", function () {
      session.wordIntelOn = !session.wordIntelOn;
      updateCandidateInfo();
    });
    bar.appendChild(intelBtn);
  }

  function useHint(id, cost) {
    if (!session || !session.active || session.locked) return;
    if (!Progression.spendCoins(cost)) {
      UI.showAlert(document.querySelector("[data-alert-container]"), "Not enough coins", 1400);
      return;
    }
    session.usedHints = true;
    var answer = session.answers[0];
    var alertContainer = document.querySelector("[data-alert-container]");
    var msg = "";
    var keyboardEl = document.querySelector("[data-keyboard]");

    if (id === "vowel") {
      var vowels = answer.split("").filter(function (c) {
        return "aeiou".indexOf(c) !== -1;
      });
      msg = vowels.length ? "Contains the vowel: " + vowels[0].toUpperCase() : "No standard vowels in this word";
    } else if (id === "first") {
      msg = "Starts with: " + answer[0].toUpperCase();
    } else if (id === "position") {
      var idx = Math.floor(Math.random() * answer.length);
      msg = "Position " + (idx + 1) + " is: " + answer[idx].toUpperCase();
    } else if (id === "category") {
      var cats = Object.keys(Data.CATEGORIES).filter(function (c) {
        return Data.CATEGORIES[c].indexOf(answer) !== -1;
      });
      msg = cats.length ? "Category: " + capitalize(cats[0]) : "No category hint for this word";
    } else if (id === "eliminate") {
      var letters = "abcdefghijklmnopqrstuvwxyz".split("").filter(function (l) {
        return answer.indexOf(l) === -1;
      });
      shuffleArray(letters);
      var picks = letters.slice(0, 3);
      picks.forEach(function (l) {
        UI.updateKeyState(keyboardEl, l, "wrong");
      });
      msg = "Not in the word: " + picks.join(", ").toUpperCase();
    }

    UI.showAlert(alertContainer, msg, 2600);
    renderHeader();
  }

  function updateCandidateInfo() {
    var panel = document.querySelector("[data-candidate-info]");
    if (!session.wordIntelOn || session.boardsCount > 1 || session.mode === "reverse") {
      panel.hidden = true;
      return;
    }
    var candidates = Engine.filterCandidates(session.answerPool, session.boardHistories[0]);
    panel.hidden = false;
    if (candidates.length <= 8 && session.boardHistories[0].length > 0) {
      panel.textContent =
        candidates.length + (candidates.length === 1 ? " possible word: " : " possible words: ") +
        candidates.join(", ").toUpperCase();
    } else {
      panel.textContent = candidates.length + " possible words remaining";
    }
  }

  /* ---------------------------------------------------------------------- core gameplay */

  function wirePlayControls() {
    document.addEventListener("keydown", function (e) {
      if (!session || !session.active || session.locked) return;
      if (session.mode === "reverse") return;
      if (document.querySelector(".modal-overlay:not([hidden])")) return;
      var playPanel = document.querySelector('[data-view-panel="play"]');
      if (!playPanel.classList.contains("active")) return;
      if (e.key === "Enter") {
        submitGuess();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        deleteKey();
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        pressKey(e.key.toLowerCase());
      }
    });

    document.querySelector("[data-keyboard]").addEventListener("click", function (e) {
      if (!session || !session.active || session.locked || session.mode === "reverse") return;
      var keyBtn = e.target.closest("[data-key]");
      if (keyBtn) {
        pressKey(keyBtn.dataset.key);
        return;
      }
      if (e.target.closest("[data-enter]")) {
        submitGuess();
        return;
      }
      if (e.target.closest("[data-delete]")) {
        deleteKey();
      }
    });

    document.querySelector("[data-boards-container]").addEventListener("click", function (e) {
      if (!session || !session.active || session.mode !== "reverse") return;
      var tile = e.target.closest(".tile");
      if (!tile || tile.dataset.row === undefined) return;
      var row = Number(tile.dataset.row);
      if (row !== session.guessesUsed) return;
      var order = ["wrong", "wrong-location", "correct"];
      var cur = tile.dataset.feedback || "wrong";
      var next = order[(order.indexOf(cur) + 1) % order.length];
      tile.dataset.feedback = next;
      tile.dataset.state = next;
      var col = Number(tile.dataset.col);
      session.currentFeedback[col] = next;
    });

    document.querySelector("[data-give-up]").addEventListener("click", onGiveUp);
    document.querySelector("[data-restart]").addEventListener("click", function () {
      if (lastSessionConfig) startSession(lastSessionConfig.mode, lastSessionConfig.selections);
    });
    document.querySelector("[data-play-back]").addEventListener("click", function () {
      if (session) {
        session.active = false;
        clearTimerHandle();
      }
      goToView("home");
    });
  }

  function pressKey(letter) {
    if (session.locked) return;
    if (session.currentGuess.length >= session.wordLength) return;
    session.currentGuess += letter;
    var row = session.guessesUsed;
    var col = session.currentGuess.length - 1;
    session.boardEls.forEach(function (boardEl, i) {
      if (session.boardSolved[i]) return;
      var tile = UI.getTile(boardEl, row, col);
      if (tile) UI.setTileLetter(tile, letter);
    });
    UI.playSound("key");
  }

  function deleteKey() {
    if (session.locked) return;
    if (session.currentGuess.length === 0) return;
    var row = session.guessesUsed;
    var col = session.currentGuess.length - 1;
    session.boardEls.forEach(function (boardEl, i) {
      if (session.boardSolved[i]) return;
      var tile = UI.getTile(boardEl, row, col);
      if (tile) UI.clearTile(tile);
    });
    session.currentGuess = session.currentGuess.slice(0, -1);
  }

  function submitGuess() {
    if (session.locked) return;
    var alertContainer = document.querySelector("[data-alert-container]");
    var guess = session.currentGuess;
    var row = session.guessesUsed;
    var activeRows = [];
    session.boardEls.forEach(function (boardEl, i) {
      if (!session.boardSolved[i]) activeRows.push(UI.getRowTiles(boardEl, row));
    });

    if (guess.length !== session.wordLength) {
      UI.showAlert(alertContainer, "Not enough letters");
      activeRows.forEach(UI.shakeRow);
      UI.playSound("invalid");
      return;
    }
    if (session.guessPool.indexOf(guess) === -1) {
      UI.showAlert(alertContainer, "Not in word list");
      activeRows.forEach(UI.shakeRow);
      UI.playSound("invalid");
      return;
    }
    if (session.noRepeatGuesses && session.usedGuesses[guess]) {
      UI.showAlert(alertContainer, "You already tried that word");
      activeRows.forEach(UI.shakeRow);
      UI.playSound("invalid");
      return;
    }
    if (session.hardMode) {
      for (var i = 0; i < session.boardEls.length; i++) {
        if (session.boardSolved[i]) continue;
        var check = Engine.checkHardMode(guess, session.boardHistories[i]);
        if (!check.valid) {
          UI.showAlert(alertContainer, check.reason);
          activeRows.forEach(UI.shakeRow);
          UI.playSound("invalid");
          return;
        }
      }
    }

    session.locked = true;
    session.usedGuesses[guess] = true;
    var keyboardEl = document.querySelector("[data-keyboard]");
    var flipPromises = [];
    var bestRankForLetter = {};
    var rankOf = { wrong: 0, "wrong-location": 1, correct: 2 };
    var blindCol = session.blindTiles ? Math.floor(Math.random() * session.wordLength) : -1;

    session.boardEls.forEach(function (boardEl, i) {
      if (session.boardSolved[i]) return;
      var result = Engine.evaluateGuess(guess, session.answers[i]);
      session.boardHistories[i].push({ guess: guess, result: result });
      var tiles = UI.getRowTiles(boardEl, row);
      tiles.forEach(function (tile, idx) {
        var letter = guess[idx];
        var trueState = result[idx];
        var displayState = Engine.toDisplayState(trueState);
        if (session.noVowelFeedback && "aeiou".indexOf(letter) !== -1) displayState = "hidden";
        if (idx === blindCol) displayState = "hidden";
        var delay = idx * 220;
        flipPromises.push(
          new Promise(function (resolve) {
            setTimeout(function () {
              UI.flipTile(tile, letter, displayState).then(resolve);
              if (displayState !== "hidden") {
                var rank = rankOf[displayState];
                if (bestRankForLetter[letter] === undefined || rank > bestRankForLetter[letter]) {
                  bestRankForLetter[letter] = rank;
                }
              }
            }, delay);
          })
        );
      });
    });

    Promise.all(flipPromises).then(function () {
      Object.keys(bestRankForLetter).forEach(function (letter) {
        var rank = bestRankForLetter[letter];
        var state = rank === 2 ? "correct" : rank === 1 ? "wrong-location" : "wrong";
        UI.updateKeyState(keyboardEl, letter, state);
      });
      afterFlip(guess, row);
    });
  }

  function afterFlip(guess, row) {
    session.boardEls.forEach(function (boardEl, i) {
      if (session.boardSolved[i]) return;
      if (guess === session.answers[i]) {
        session.boardSolved[i] = true;
        UI.danceRow(UI.getRowTiles(boardEl, row));
      }
    });
    session.guessesUsed++;
    session.currentGuess = "";

    var allSolved = session.boardSolved.every(function (v) {
      return v;
    });
    var outOfGuesses = session.guessesUsed >= session.maxGuesses;

    updateCandidateInfo();
    session.locked = false;

    if (allSolved) {
      UI.playSound("win");
      handleRoundEnd(true);
      return;
    }
    if (outOfGuesses) {
      UI.playSound("lose");
      handleRoundEnd(false);
    }
  }

  function currentModeExtra() {
    switch (session.mode) {
      case "endless":
        return { endlessCount: session.endlessCount };
      case "survival":
        return { levelReached: session.survivalCleared };
      case "marathon":
        return { completed: false, score: session.marathonScore };
      case "suddenDeath":
        return { suddenDeathCount: session.suddenDeathCount };
      case "blitz":
        return { blitzSolved: session.blitzSolved };
      default:
        return {};
    }
  }

  function handleRoundEnd(won) {
    var alertContainer = document.querySelector("[data-alert-container]");
    switch (session.mode) {
      case "endless":
        if (won) {
          session.endlessCount++;
          UI.showAlert(alertContainer, "Solved! Next word...", 1300);
          setTimeout(startNextRound, 1100);
        } else {
          finalizeSessionEnd(false, { endlessCount: session.endlessCount });
        }
        break;
      case "blitz":
        if (won) session.blitzSolved++;
        setTimeout(startNextRound, won ? 800 : 1300);
        break;
      case "survival":
        if (won) {
          session.survivalCleared++;
          session.survivalLevel++;
          var cfg = Modes.survivalConfigForLevel(session.survivalLevel);
          session.wordLength = cfg.wordLength;
          session.maxGuesses = cfg.maxGuesses;
          session.hardMode = cfg.hardMode;
          session.difficulty = cfg.difficulty;
          session.answerPool = buildAnswerPool(session.wordLength, "any", cfg.difficulty === "extreme");
          session.guessPool = Modes.getGuessPool(session.wordLength);
          UI.showAlert(alertContainer, "Level " + session.survivalLevel + "!", 1300);
          setTimeout(startNextRound, 1100);
        } else {
          finalizeSessionEnd(false, { levelReached: session.survivalCleared });
        }
        break;
      case "marathon":
        session.marathonRound++;
        session.marathonTotalGuesses += session.guessesUsed;
        session.marathonTotalTime += Date.now() - session.roundStartTime;
        if (won) session.marathonScore += Math.max(10, (session.maxGuesses - session.guessesUsed + 1) * 20);
        if (session.marathonRound < session.modeConfig.rounds) {
          setTimeout(startNextRound, 1100);
        } else {
          finalizeSessionEnd(session.marathonScore > 0, {
            completed: true,
            score: session.marathonScore,
            rounds: session.marathonRound,
          });
        }
        break;
      case "suddenDeath":
        if (won) {
          session.suddenDeathCount++;
          setTimeout(startNextRound, 800);
        } else {
          finalizeSessionEnd(false, { suddenDeathCount: session.suddenDeathCount });
        }
        break;
      default:
        finalizeSessionEnd(won, {});
    }
  }

  function startNextRound() {
    if (!session || !session.active) return;
    pickAnswersForRound();
    resetRoundState();
    setupBoardsUI();
    document.querySelector("[data-candidate-info]").hidden = true;
    document.querySelector("[data-alert-container]").innerHTML = "";
    updateCandidateInfo();
  }

  function onGiveUp() {
    if (!session || !session.active) return;
    clearTimerHandle();
    session.locked = true;
    finalizeSessionEnd(false, currentModeExtra());
  }

  /* ---------------------------------------------------------------------- reverse mode */

  function startReverseRound() {
    session.reverseCandidates = Modes.getAnswerPool(session.wordLength).slice();
    session.reverseHistory = [];
    session.currentGuess = "";
    session.guessesUsed = 0;
    session.roundStartTime = Date.now();
    session.answers = [];
    session.boardHistories = [[]];
    session.boardSolved = [false];
    setupBoardsUI();
    makeReverseGuess();
  }

  function pickReverseGuess() {
    var candidates = session.reverseCandidates;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function makeReverseGuess() {
    if (session.guessesUsed >= session.maxGuesses) {
      finalizeSessionEnd(false, {});
      return;
    }
    var guess = pickReverseGuess();
    session.currentReverseGuess = guess;
    session.currentFeedback = new Array(session.wordLength).fill("wrong");
    var boardEl = session.boardEls[0];
    var row = session.guessesUsed;
    var tiles = UI.getRowTiles(boardEl, row);
    tiles.forEach(function (tile, idx) {
      tile.textContent = guess[idx].toUpperCase();
      tile.dataset.letter = guess[idx];
      tile.dataset.state = "active";
      tile.dataset.feedback = "wrong";
    });
    renderReverseControls();
  }

  function renderReverseControls() {
    var bar = document.querySelector("[data-hint-bar]");
    bar.innerHTML = "";
    var hint = document.createElement("div");
    hint.className = "muted";
    hint.style.width = "100%";
    hint.textContent = "Tap tiles to cycle gray → yellow → green to match your secret word, then submit.";
    bar.appendChild(hint);
    var submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "hint-btn";
    submitBtn.textContent = "Submit Feedback";
    submitBtn.addEventListener("click", submitReverseFeedback);
    bar.appendChild(submitBtn);
  }

  function submitReverseFeedback() {
    var guess = session.currentReverseGuess;
    var feedback = session.currentFeedback;
    var alertContainer = document.querySelector("[data-alert-container]");

    if (feedback.every(function (s) { return s === "correct"; })) {
      session.reverseHistory.push({ guess: guess, result: feedback });
      UI.danceRow(UI.getRowTiles(session.boardEls[0], session.guessesUsed));
      session.guessesUsed++;
      UI.playSound("win");
      finalizeSessionEnd(true, {});
      return;
    }

    var engineFeedback = feedback.map(Engine.toEngineState);
    var narrowed = Engine.filterCandidates(session.reverseCandidates, [{ guess: guess, result: engineFeedback }]);
    if (narrowed.length === 0) {
      UI.showAlert(alertContainer, "That doesn't match any word - check your colors and try again.", 2400);
      return;
    }
    var withoutGuess = narrowed.filter(function (w) { return w !== guess; });
    session.reverseCandidates = withoutGuess.length ? withoutGuess : narrowed;
    session.reverseHistory.push({ guess: guess, result: feedback });
    session.guessesUsed++;
    makeReverseGuess();
  }

  /* ---------------------------------------------------------------------- session end */

  function summaryTitle(won) {
    switch (session.mode) {
      case "endless":
        return won ? "Nice Run!" : "Run Over";
      case "blitz":
        return "Time's Up!";
      case "survival":
        return won ? "Level Up!" : "Defeated";
      case "marathon":
        return "Marathon Complete";
      case "suddenDeath":
        return won ? "Survived!" : "Eliminated";
      case "reverse":
        return won ? "Guessed It!" : "Stumped!";
      default:
        return won ? "You Win!" : "So Close!";
    }
  }

  function summaryLine(ctx) {
    switch (session.mode) {
      case "endless":
        return "You solved " + session.endlessCount + " word" + (session.endlessCount === 1 ? "" : "s") + " before losing.";
      case "blitz":
        return "You solved " + session.blitzSolved + " word" + (session.blitzSolved === 1 ? "" : "s") + " in " + session.timerSeconds + " seconds.";
      case "survival":
        return "You cleared " + session.survivalCleared + " level" + (session.survivalCleared === 1 ? "" : "s") + ".";
      case "marathon":
        return "Final score: " + session.marathonScore + " across " + session.marathonRound + " words.";
      case "suddenDeath":
        return "You survived " + session.suddenDeathCount + " word" + (session.suddenDeathCount === 1 ? "" : "s") + " in a row.";
      case "reverse":
        return ctx.won
          ? "The game found your word in " + ctx.guessCount + " guesses."
          : "The game couldn't narrow it down in time.";
      default:
        return ctx.won ? "Solved in " + ctx.guessCount + "/" + session.maxGuesses + " guesses." : "Better luck next time.";
    }
  }

  function finalizeSessionEnd(won, extra) {
    if (!session) return;
    session.active = false;
    clearTimerHandle();

    var timeMs = session.stopwatch ? session.elapsedDisplay * 1000 : Date.now() - session.startedAt;
    var ctx = {
      won: won,
      mode: session.mode,
      difficulty: session.difficulty,
      guessCount: session.guessesUsed,
      timeMs: timeMs,
      usedHints: session.usedHints,
      isDaily: session.isDaily,
      completed: extra.completed || false,
      levelReached: extra.levelReached,
      score:
        extra.score !== undefined
          ? extra.score
          : session.mode === "endless"
          ? session.endlessCount
          : session.mode === "blitz"
          ? session.blitzSolved
          : session.mode === "suddenDeath"
          ? session.suddenDeathCount
          : undefined,
    };

    var reward = Progression.computeReward(ctx);
    var xpResult = Progression.addXp(reward.xp);
    Progression.addCoins(reward.coins);

    Storage.recordModeResult(session.mode, {
      won: won,
      guessCount: ctx.guessCount,
      timeMs: ctx.timeMs,
      usedHints: session.usedHints,
      score: ctx.score,
    });
    if (session.difficulty) Storage.recordDifficultyResult(session.difficulty, won);
    Storage.updateStreak(won);
    if (session.hardMode) Storage.updateModifierStreak("hard", won);
    Storage.updateModifierStreak("perfect", won && !session.usedHints);
    if (session.isDaily) Storage.completeDaily(won, ctx.guessCount);
    if (session.mode === "survival") Storage.setSurvivalBest(extra.levelReached || 0);
    if (session.mode === "marathon") Storage.setMarathonBest(extra.score || 0);

    Storage.recordMissionEvent({
      won: won,
      guessCount: ctx.guessCount,
      usedHints: session.usedHints,
      difficulty: session.difficulty,
    });
    Progression.updateMissionProgress(Storage.getMissionLog());
    var unlockedAchievements = Progression.checkAchievements(ctx);

    renderHeader();
    showResultModal(won, ctx, reward, xpResult);

    unlockedAchievements.forEach(function (a) {
      UI.showAchievementToast(document.querySelector("[data-achievement-toast-container]"), a);
      UI.playSound("achievement");
    });
    if (xpResult.leveledUp) UI.playSound("levelup");

    document.querySelector("[data-give-up]").classList.add("hidden");
    document.querySelector("[data-restart]").classList.remove("hidden");
  }

  function showResultModal(won, ctx, reward, xpResult) {
    document.querySelector("[data-result-title]").textContent = summaryTitle(won);

    var body = document.querySelector("[data-result-body]");
    body.innerHTML = "";

    var summary = document.createElement("p");
    summary.textContent = summaryLine(ctx);
    body.appendChild(summary);

    if (!won && session.answers && session.answers.length && session.mode !== "reverse") {
      var answerP = document.createElement("p");
      answerP.className = "muted";
      answerP.textContent =
        "Answer" + (session.answers.length > 1 ? "s" : "") + ": " +
        session.answers.map(function (w) { return w.toUpperCase(); }).join(", ");
      body.appendChild(answerP);
    }

    var rewardsRow = document.createElement("div");
    rewardsRow.className = "result-rewards";
    rewardsRow.innerHTML =
      '<span class="result-reward-pill">+' + reward.xp + " XP</span>" +
      '<span class="result-reward-pill">💎 +' + reward.coins + "</span>" +
      (xpResult.leveledUp ? '<span class="result-reward-pill">🎉 Level ' + xpResult.level + "!</span>" : "");
    body.appendChild(rewardsRow);

    var shareBtn = document.querySelector("[data-result-share]");
    var multiRoundModes = { endless: true, blitz: true, survival: true, marathon: true, suddenDeath: true, reverse: true };
    var canShare =
      session.boardsCount === 1 &&
      !multiRoundModes[session.mode] &&
      session.boardHistories &&
      session.boardHistories[0] &&
      session.boardHistories[0].length > 0;
    shareBtn.style.display = canShare ? "inline-block" : "none";
    if (canShare) {
      shareBtn.onclick = function () {
        var text = Modes.generateShareText({
          puzzleNumber: session.puzzleNumber || Modes.dailyPuzzleNumber(),
          won: won,
          guessCount: ctx.guessCount,
          maxGuesses: session.maxGuesses,
          history: session.boardHistories[0],
        });
        copyToClipboard(text);
        UI.showAlert(document.querySelector("[data-alert-container]"), "Copied to clipboard!", 1500);
      };
    }

    document.querySelector("[data-result-continue]").onclick = function () {
      UI.closeModal("result");
    };

    UI.openModal("result");
  }

  /* ---------------------------------------------------------------------- stats screen */

  function renderStats() {
    var container = document.querySelector("[data-stats-content]");
    container.innerHTML = "";
    var profile = Storage.getProfile();
    var streaks = Storage.getStreaks();
    var totals = aggregateStats();
    var stats = Storage.getState().stats;

    var summaryGrid = document.createElement("div");
    summaryGrid.className = "stats-summary-grid";
    [
      ["Games Played", totals.played],
      ["Games Won", totals.won],
      ["Win Rate", totals.played ? Math.round((totals.won / totals.played) * 100) + "%" : "0%"],
      ["Current Streak", streaks.current],
      ["Best Streak", streaks.best],
      ["Daily Streak", streaks.daily.current],
      ["Best Daily Streak", streaks.daily.best],
      ["Player Level", profile.level],
    ].forEach(function (c) {
      var card = document.createElement("div");
      card.className = "stats-summary-card";
      card.innerHTML = "<strong>" + c[1] + "</strong><span>" + c[0] + "</span>";
      summaryGrid.appendChild(card);
    });
    container.appendChild(summaryGrid);

    var dist = [0, 0, 0, 0, 0, 0, 0];
    Object.keys(stats).forEach(function (k) {
      stats[k].guessDistribution.forEach(function (v, i) {
        dist[i] += v;
      });
    });
    var maxDist = Math.max.apply(null, dist.concat([1]));
    var distCard = document.createElement("div");
    distCard.className = "card";
    distCard.innerHTML = '<h3 class="section-title">Guess Distribution</h3>';
    dist.forEach(function (count, i) {
      var row = document.createElement("div");
      row.className = "distribution-row";
      var pct = count ? Math.max(6, Math.round((count / maxDist) * 100)) : 0;
      row.innerHTML =
        '<span class="distribution-label">' + (i < 6 ? i + 1 : "7+") + "</span>" +
        '<span class="distribution-bar-track"><span class="distribution-bar-fill" style="width:' + pct + '%">' + count + "</span></span>";
      distCard.appendChild(row);
    });
    container.appendChild(distCard);

    var modeCard = document.createElement("div");
    modeCard.className = "card";
    var rows = Object.keys(stats)
      .map(function (k) {
        var s = stats[k];
        var modeName = (Modes.MODES[k] && Modes.MODES[k].name) || k;
        var winRate = s.played ? Math.round((s.won / s.played) * 100) + "%" : "-";
        var avgGuess = s.won ? (s.totalGuesses / s.won).toFixed(1) : "-";
        return "<tr><td>" + modeName + "</td><td>" + s.played + "</td><td>" + winRate + "</td><td>" + avgGuess + "</td></tr>";
      })
      .join("");
    modeCard.innerHTML =
      '<h3 class="section-title">By Mode</h3>' +
      (rows
        ? '<table class="mode-stats-table"><thead><tr><th>Mode</th><th>Played</th><th>Win %</th><th>Avg Guesses</th></tr></thead><tbody>' + rows + "</tbody></table>"
        : '<p class="muted">No games played yet.</p>');
    container.appendChild(modeCard);
  }

  /* ---------------------------------------------------------------------- achievements screen */

  function renderAchievements() {
    var unlocked = Storage.getAchievements().unlocked;
    var grid = document.querySelector("[data-achievements-grid]");
    grid.innerHTML = "";
    Progression.ACHIEVEMENTS.forEach(function (a) {
      var locked = !unlocked[a.id];
      var el = document.createElement("div");
      el.className = "achievement-card" + (locked ? " locked" : "");
      el.innerHTML =
        '<span class="achievement-icon">' + a.icon + "</span>" +
        '<span class="achievement-name">' + a.name + "</span>" +
        '<span class="achievement-desc">' + a.desc + "</span>";
      grid.appendChild(el);
    });
  }

  /* ---------------------------------------------------------------------- settings screen */

  function renderSettings() {
    var container = document.querySelector("[data-settings-content]");
    container.innerHTML = "";
    var settings = Storage.getSettings();

    var themeSection = document.createElement("div");
    themeSection.className = "settings-section";
    themeSection.innerHTML = "<h3>Theme</h3>";
    var row = document.createElement("div");
    row.className = "theme-swatch-row";
    [
      ["midnight", "Midnight", "hsl(240,12%,20%)"],
      ["paper", "Paper", "hsl(40,30%,80%)"],
      ["forest", "Forest", "hsl(150,25%,25%)"],
      ["ocean", "Ocean", "hsl(205,40%,25%)"],
      ["inferno", "Inferno", "hsl(15,60%,35%)"],
    ].forEach(function (t) {
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "theme-swatch" + (settings.theme === t[0] ? " selected" : "");
      sw.style.background = t[2];
      sw.title = t[1];
      sw.textContent = t[1].slice(0, 2);
      sw.addEventListener("click", function () {
        Storage.setSettings({ theme: t[0] });
        UI.applySettings(Storage.getSettings());
        renderSettings();
      });
      row.appendChild(sw);
    });
    themeSection.appendChild(row);
    container.appendChild(themeSection);

    var toggleSection = document.createElement("div");
    toggleSection.className = "settings-section";
    toggleSection.innerHTML = "<h3>Preferences</h3>";
    [
      ["sound", "Sound Effects", "Key presses, wins, and achievements"],
      ["haptics", "Haptics", "Vibrate on supported mobile devices"],
      ["colorBlind", "Color-blind Mode", "Adds symbols to tiles alongside color"],
      ["highContrast", "High Contrast", "Stronger borders and saturated colors"],
      ["reducedMotion", "Reduced Motion", "Shortens animations"],
    ].forEach(function (item) {
      toggleSection.appendChild(
        UI.createToggleRow({
          label: item[1],
          sub: item[2],
          checked: settings[item[0]],
          onChange: function (v) {
            var patch = {};
            patch[item[0]] = v;
            Storage.setSettings(patch);
            UI.applySettings(Storage.getSettings());
            if (item[0] === "haptics" && v && navigator.vibrate) navigator.vibrate(20);
          },
        })
      );
    });
    container.appendChild(toggleSection);

    var diffSection = document.createElement("div");
    diffSection.className = "settings-section";
    diffSection.innerHTML = "<h3>Default Difficulty</h3>";
    diffSection.appendChild(
      UI.createOptionChipGroup({
        label: "",
        choices: Object.keys(Modes.DIFFICULTIES).map(function (k) {
          return { value: Modes.DIFFICULTIES[k].key, label: Modes.DIFFICULTIES[k].name };
        }),
        selected: settings.defaultDifficulty,
        onChange: function (v) {
          Storage.setSettings({ defaultDifficulty: v });
        },
      })
    );
    container.appendChild(diffSection);

    var dataSection = document.createElement("div");
    dataSection.className = "settings-section";
    dataSection.innerHTML = "<h3>Data</h3>";
    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn-secondary";
    resetBtn.style.marginRight = "0.5em";
    resetBtn.textContent = "Reset Statistics";
    resetBtn.addEventListener("click", function () {
      UI.showConfirm("Reset statistics?", "This clears stats, streaks, XP, coins, and achievements. Settings are kept.", function () {
        Storage.resetStats();
        renderSettings();
        renderHeader();
        renderHome();
      });
    });
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-danger";
    clearBtn.textContent = "Clear All Data";
    clearBtn.addEventListener("click", function () {
      UI.showConfirm("Clear all data?", "This erases everything, including settings. This cannot be undone.", function () {
        Storage.clearAll();
        UI.applySettings(Storage.getSettings());
        renderSettings();
        renderHeader();
        renderHome();
      });
    });
    var howtoBtn = document.createElement("button");
    howtoBtn.type = "button";
    howtoBtn.className = "btn btn-secondary";
    howtoBtn.style.marginTop = "0.6em";
    howtoBtn.style.display = "block";
    howtoBtn.textContent = "How to Play";
    howtoBtn.addEventListener("click", function () {
      UI.openModal("howto");
    });

    dataSection.appendChild(resetBtn);
    dataSection.appendChild(clearBtn);
    dataSection.appendChild(howtoBtn);
    container.appendChild(dataSection);
  }
})();
