// Pure game-logic engine: letter evaluation, hard-mode validation, candidate filtering,
// challenge rating, and deterministic daily word selection. No DOM access in this file.
(function (global) {
  "use strict";

  var CORRECT = "correct";
  var PRESENT = "present";
  var ABSENT = "absent";

  // Two-pass evaluation: exact matches are resolved first and removed from the letter pool,
  // so a duplicate letter in the guess can only be marked "present" as many times as it
  // remains unclaimed in the answer. Fixes the classic single-pass duplicate-letter bug.
  function evaluateGuess(guess, answer) {
    var len = answer.length;
    var result = new Array(len).fill(ABSENT);
    var answerLetters = answer.split("");
    var guessLetters = guess.split("");
    var remaining = {};

    for (var i = 0; i < len; i++) {
      if (guessLetters[i] === answerLetters[i]) {
        result[i] = CORRECT;
        answerLetters[i] = null;
      }
    }

    for (i = 0; i < len; i++) {
      var letter = answerLetters[i];
      if (letter != null) {
        remaining[letter] = (remaining[letter] || 0) + 1;
      }
    }

    for (i = 0; i < len; i++) {
      if (result[i] === CORRECT) continue;
      var g = guessLetters[i];
      if (remaining[g] > 0) {
        result[i] = PRESENT;
        remaining[g]--;
      } else {
        result[i] = ABSENT;
      }
    }

    return result;
  }

  // Aggregates every prior guess's revealed constraints (green -> fixed position,
  // yellow/green -> minimum letter count) and checks whether a new guess honors all of them.
  function checkHardMode(guess, history) {
    var mustPosition = {};
    var mustInclude = {};

    history.forEach(function (turn) {
      var localCounts = {};
      for (var i = 0; i < turn.guess.length; i++) {
        var letter = turn.guess[i];
        if (turn.result[i] === CORRECT) {
          mustPosition[i] = letter;
          localCounts[letter] = (localCounts[letter] || 0) + 1;
        } else if (turn.result[i] === PRESENT) {
          localCounts[letter] = (localCounts[letter] || 0) + 1;
        }
      }
      Object.keys(localCounts).forEach(function (letter) {
        mustInclude[letter] = Math.max(mustInclude[letter] || 0, localCounts[letter]);
      });
    });

    for (var posKey in mustPosition) {
      if (!Object.prototype.hasOwnProperty.call(mustPosition, posKey)) continue;
      var pos = Number(posKey);
      var required = mustPosition[posKey];
      if (guess[pos] !== required) {
        return {
          valid: false,
          reason: "Position " + (pos + 1) + " must be " + required.toUpperCase(),
        };
      }
    }

    var guessCounts = {};
    for (var i2 = 0; i2 < guess.length; i2++) {
      guessCounts[guess[i2]] = (guessCounts[guess[i2]] || 0) + 1;
    }
    for (var letterKey in mustInclude) {
      if (!Object.prototype.hasOwnProperty.call(mustInclude, letterKey)) continue;
      var minCount = mustInclude[letterKey];
      if ((guessCounts[letterKey] || 0) < minCount) {
        return {
          valid: false,
          reason: "Your guess must contain " + letterKey.toUpperCase(),
        };
      }
    }

    return { valid: true };
  }

  // Returns every word in `pool` that is still consistent with every guess/result pair seen
  // so far. Powers the "possible words remaining" word-intelligence hint.
  function filterCandidates(pool, history) {
    if (history.length === 0) return pool.slice();
    return pool.filter(function (word) {
      return history.every(function (turn) {
        var evalResult = evaluateGuess(turn.guess, word);
        for (var i = 0; i < evalResult.length; i++) {
          if (evalResult[i] !== turn.result[i]) return false;
        }
        return true;
      });
    });
  }

  // Deterministic string hash -> stable index, used so every player sees the same
  // Daily Challenge / Survival / Marathon seed word(s) for a given date.
  function seededIndex(seedStr, poolLength) {
    var hash = 0;
    for (var i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    return hash % poolLength;
  }

  function todayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function randomWord(pool, exclude) {
    var candidates = pool;
    if (exclude) {
      candidates = pool.filter(function (w) {
        return w !== exclude;
      });
      if (candidates.length === 0) candidates = pool;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Weighted difficulty score for the Custom Challenge builder. Every modifier contributes
  // points; the total is clamped to 0-100 so the UI can show a single "CHALLENGE RATING".
  function computeChallengeRating(mods) {
    var score = 0;
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

  function countLetters(word) {
    var counts = {};
    for (var i = 0; i < word.length; i++) {
      counts[word[i]] = (counts[word[i]] || 0) + 1;
    }
    return counts;
  }

  function hasRepeatedLetter(word) {
    var counts = countLetters(word);
    return Object.keys(counts).some(function (k) {
      return counts[k] > 1;
    });
  }

  // evaluateGuess/checkHardMode/filterCandidates speak "correct"/"present"/"absent".
  // Tile and keyboard CSS speak "correct"/"wrong-location"/"wrong" (the original codebase's
  // vocabulary). These two helpers are the only place that vocabulary gets translated -
  // callers must never mix the two state sets.
  var TO_DISPLAY = { correct: "correct", present: "wrong-location", absent: "wrong" };
  var TO_ENGINE = { correct: "correct", "wrong-location": "present", wrong: "absent" };

  function toDisplayState(state) {
    return TO_DISPLAY[state] || state;
  }

  function toEngineState(state) {
    return TO_ENGINE[state] || state;
  }

  global.WORDLE_ENGINE = {
    STATES: { CORRECT: CORRECT, PRESENT: PRESENT, ABSENT: ABSENT },
    evaluateGuess: evaluateGuess,
    checkHardMode: checkHardMode,
    filterCandidates: filterCandidates,
    seededIndex: seededIndex,
    todayKey: todayKey,
    randomWord: randomWord,
    computeChallengeRating: computeChallengeRating,
    countLetters: countLetters,
    hasRepeatedLetter: hasRepeatedLetter,
    toDisplayState: toDisplayState,
    toEngineState: toEngineState,
  };
})(window);
