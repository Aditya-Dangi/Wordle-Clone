// UI toolkit: theme/accessibility application, view routing, board + keyboard rendering,
// modals, toasts, sound, and small DOM-building primitives (chips/toggles/lists) shared by
// the setup, stats, achievements and settings screens. main.js owns *what* to show; this
// file owns *how* it's drawn.
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------------- theme / a11y */

  function applySettings(settings) {
    var root = document.documentElement;
    root.setAttribute("data-theme", settings.theme);
    root.setAttribute("data-color-blind", settings.colorBlind ? "true" : "false");
    root.setAttribute("data-high-contrast", settings.highContrast ? "true" : "false");
    root.setAttribute("data-reduced-motion", settings.reducedMotion ? "true" : "false");
  }

  /* ---------------------------------------------------------------------- view routing */

  function showView(name) {
    document.querySelectorAll("[data-view-panel]").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-view-panel") === name);
    });
    document.querySelectorAll("[data-nav] .nav-btn").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-view") === name);
    });
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------------- toasts */

  function showAlert(container, message, duration) {
    if (duration === undefined) duration = 1200;
    var alert = document.createElement("div");
    alert.textContent = message;
    alert.className = "alert";
    container.prepend(alert);
    if (duration == null) return alert;
    setTimeout(function () {
      alert.classList.add("hide");
      alert.addEventListener("transitionend", function () {
        alert.remove();
      });
      setTimeout(function () {
        if (alert.parentNode) alert.remove();
      }, 600);
    }, duration);
    return alert;
  }

  function showAchievementToast(container, achievement) {
    var el = document.createElement("div");
    el.className = "achievement-toast";
    el.innerHTML =
      '<span class="achievement-icon">' + achievement.icon + "</span>" +
      "<div><strong>Achievement Unlocked</strong><span>" + achievement.name + "</span></div>";
    container.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 4200);
  }

  /* ---------------------------------------------------------------------- boards */

  function buildBoards(container, opts) {
    container.innerHTML = "";
    container.dataset.boards = String(opts.boards);
    var boards = [];
    for (var b = 0; b < opts.boards; b++) {
      var wrap = document.createElement("div");
      wrap.className = "board-wrap";
      wrap.dataset.board = String(b);

      if (opts.boards > 1) {
        var label = document.createElement("div");
        label.className = "board-label";
        label.textContent = "Board " + (b + 1);
        wrap.appendChild(label);
      }

      var grid = document.createElement("div");
      grid.className = "guess-grid";
      grid.style.gridTemplateColumns = "repeat(" + opts.wordLength + ", var(--tile-size, 3.4rem))";
      grid.style.gridTemplateRows = "repeat(" + opts.maxGuesses + ", var(--tile-size, 3.4rem))";

      for (var r = 0; r < opts.maxGuesses; r++) {
        for (var c = 0; c < opts.wordLength; c++) {
          var tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.row = String(r);
          tile.dataset.col = String(c);
          grid.appendChild(tile);
        }
      }

      wrap.appendChild(grid);
      container.appendChild(wrap);
      boards.push(grid);
    }
    return boards;
  }

  function getTile(boardEl, row, col) {
    return boardEl.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  }

  function getRowTiles(boardEl, row) {
    return Array.prototype.slice.call(boardEl.querySelectorAll('[data-row="' + row + '"]'));
  }

  function setTileLetter(tile, letter) {
    tile.textContent = letter;
    tile.dataset.letter = letter;
    tile.dataset.state = "active";
  }

  function clearTile(tile) {
    tile.textContent = "";
    delete tile.dataset.state;
    delete tile.dataset.letter;
  }

  function flipTile(tile, letter, state) {
    return new Promise(function (resolve) {
      tile.classList.add("flip");
      var handledMid = false;
      function onMid() {
        if (handledMid) return;
        handledMid = true;
        tile.removeEventListener("transitionend", onMid);
        tile.classList.remove("flip");
        tile.textContent = letter.toUpperCase();
        tile.dataset.state = state;
        tile.addEventListener(
          "transitionend",
          function () {
            resolve();
          },
          { once: true }
        );
        // Fallback in case the return transition doesn't fire (e.g. instant reduced-motion).
        setTimeout(resolve, 250);
      }
      tile.addEventListener("transitionend", onMid, { once: true });
      setTimeout(onMid, 400);
    });
  }

  function shakeRow(tiles) {
    tiles.forEach(function (tile) {
      tile.classList.add("shake");
      tile.addEventListener(
        "animationend",
        function () {
          tile.classList.remove("shake");
        },
        { once: true }
      );
    });
  }

  function danceRow(tiles) {
    tiles.forEach(function (tile, index) {
      setTimeout(function () {
        tile.classList.add("dance");
        tile.addEventListener(
          "animationend",
          function () {
            tile.classList.remove("dance");
          },
          { once: true }
        );
      }, (index * 500) / 5);
    });
  }

  /* ---------------------------------------------------------------------- keyboard */

  var KEY_RANK = { wrong: 0, "wrong-location": 1, correct: 2 };

  function resetKeyboard(keyboardEl) {
    keyboardEl.querySelectorAll("[data-key]").forEach(function (key) {
      key.classList.remove("wrong", "wrong-location", "correct");
      delete key.dataset.rank;
    });
  }

  function updateKeyState(keyboardEl, letter, state) {
    var key = keyboardEl.querySelector('[data-key="' + letter.toLowerCase() + '"]');
    if (!key) return;
    var rank = KEY_RANK[state];
    var current = key.dataset.rank ? Number(key.dataset.rank) : -1;
    if (rank > current) {
      key.classList.remove("wrong", "wrong-location", "correct");
      key.classList.add(state);
      key.dataset.rank = String(rank);
    }
  }

  /* ---------------------------------------------------------------------- modals */

  function openModal(name) {
    var el = document.querySelector("[data-" + name + "-modal]");
    if (el) el.hidden = false;
  }

  function closeModal(name) {
    var el = document.querySelector("[data-" + name + "-modal]");
    if (el) el.hidden = true;
  }

  function showConfirm(title, body, onConfirm) {
    var modal = document.querySelector("[data-confirm-modal]");
    modal.querySelector("[data-confirm-title]").textContent = title;
    modal.querySelector("[data-confirm-body]").textContent = body;
    var okBtn = modal.querySelector("[data-confirm-ok]");
    var cancelBtn = modal.querySelector("[data-confirm-cancel]");
    function cleanup() {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      closeModal("confirm");
    }
    function onOk() {
      cleanup();
      onConfirm();
    }
    function onCancel() {
      cleanup();
    }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    openModal("confirm");
  }

  /* ---------------------------------------------------------------------- sound */

  var AudioCtxClass = global.AudioContext || global.webkitAudioContext;
  var audioCtx = null;

  function ensureAudioCtx() {
    if (!audioCtx && AudioCtxClass) audioCtx = new AudioCtxClass();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, waveform, delay) {
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = waveform || "sine";
    osc.frequency.value = freq;
    var start = ctx.currentTime + (delay || 0);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  var SOUND_DEFS = {
    key: function () {
      playTone(440, 0.05, "square");
    },
    correct: function () {
      playTone(660, 0.12);
      playTone(880, 0.14, "sine", 0.09);
    },
    present: function () {
      playTone(520, 0.1);
    },
    absent: function () {
      playTone(200, 0.08, "triangle");
    },
    invalid: function () {
      playTone(140, 0.15, "sawtooth");
    },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        playTone(f, 0.18, "sine", i * 0.1);
      });
    },
    lose: function () {
      playTone(220, 0.3, "sawtooth");
      playTone(180, 0.35, "sawtooth", 0.15);
    },
    achievement: function () {
      playTone(784, 0.1);
      playTone(988, 0.16, "sine", 0.1);
    },
    levelup: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        playTone(f, 0.15, "sine", i * 0.08);
      });
    },
  };

  function playSound(name) {
    var settings = global.WORDLE_STORAGE && global.WORDLE_STORAGE.getSettings();
    if (settings && !settings.sound) return;
    var fn = SOUND_DEFS[name];
    if (fn) {
      try {
        fn();
      } catch (e) {
        /* audio unavailable - ignore */
      }
    }
  }

  /* ---------------------------------------------------------------------- DOM primitives */

  function createOptionChipGroup(opts) {
    // opts: { label, choices: [{value, label, sub}], selected, onChange }
    var group = document.createElement("div");
    group.className = "option-group";
    var labelEl = document.createElement("div");
    labelEl.className = "option-group-label";
    labelEl.textContent = opts.label;
    group.appendChild(labelEl);

    var row = document.createElement("div");
    row.className = "option-row";
    group.appendChild(row);

    var selected = opts.selected;
    function render() {
      row.innerHTML = "";
      opts.choices.forEach(function (choice) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "option-chip" + (choice.value === selected ? " selected" : "");
        chip.innerHTML = choice.label + (choice.sub ? '<span class="chip-sub">' + choice.sub + "</span>" : "");
        chip.addEventListener("click", function () {
          selected = choice.value;
          opts.onChange(selected);
          render();
        });
        row.appendChild(chip);
      });
    }
    render();
    return group;
  }

  function createToggleRow(opts) {
    // opts: { label, sub, checked, onChange }
    var row = document.createElement("label");
    row.className = "toggle-row";

    var labelWrap = document.createElement("span");
    labelWrap.className = "toggle-row-label";
    var strong = document.createElement("span");
    strong.textContent = opts.label;
    labelWrap.appendChild(strong);
    if (opts.sub) {
      var small = document.createElement("small");
      small.textContent = opts.sub;
      labelWrap.appendChild(small);
    }
    row.appendChild(labelWrap);

    var switchEl = document.createElement("span");
    switchEl.className = "switch";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!opts.checked;
    input.addEventListener("change", function () {
      opts.onChange(input.checked);
    });
    var track = document.createElement("span");
    track.className = "switch-track";
    switchEl.appendChild(input);
    switchEl.appendChild(track);
    row.appendChild(switchEl);

    return row;
  }

  function createModeCard(mode, onClick) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "mode-card";
    card.innerHTML =
      '<span class="mode-icon">' + mode.icon + "</span>" +
      '<span class="mode-name">' + mode.name + "</span>" +
      '<span class="mode-desc">' + mode.desc + "</span>";
    card.addEventListener("click", onClick);
    return card;
  }

  global.WORDLE_UI = {
    applySettings: applySettings,
    showView: showView,
    showAlert: showAlert,
    showAchievementToast: showAchievementToast,
    buildBoards: buildBoards,
    getTile: getTile,
    getRowTiles: getRowTiles,
    setTileLetter: setTileLetter,
    clearTile: clearTile,
    flipTile: flipTile,
    shakeRow: shakeRow,
    danceRow: danceRow,
    resetKeyboard: resetKeyboard,
    updateKeyState: updateKeyState,
    openModal: openModal,
    closeModal: closeModal,
    showConfirm: showConfirm,
    createOptionChipGroup: createOptionChipGroup,
    createToggleRow: createToggleRow,
    createModeCard: createModeCard,
    playSound: playSound,
  };
})(window);
