const ProgressStore = (() => {
  const KEY = "hsk-progress-v1";

  const emptyLevel = () => ({
    mastered: {},
    quiz: { correct: 0, total: 0, lastScore: null },
  });

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { currentLevel: 1, levels: {} };
      const parsed = JSON.parse(raw);
      return {
        currentLevel: parsed.currentLevel || 1,
        levels: parsed.levels || {},
      };
    } catch {
      return { currentLevel: 1, levels: {} };
    }
  }

  function write(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function ensureLevel(state, levelId) {
    const id = String(levelId);
    if (!state.levels[id]) state.levels[id] = emptyLevel();
    if (!state.levels[id].mastered) state.levels[id].mastered = {};
    if (!state.levels[id].quiz) state.levels[id].quiz = { correct: 0, total: 0, lastScore: null };
    return state.levels[id];
  }

  return {
    getCurrentLevel() {
      return read().currentLevel;
    },
    setCurrentLevel(levelId) {
      const state = read();
      state.currentLevel = Number(levelId);
      write(state);
    },
    isMastered(levelId, wordId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      return Boolean(level.mastered[String(wordId)]);
    },
    setMastered(levelId, wordId, mastered) {
      const state = read();
      const level = ensureLevel(state, levelId);
      const key = String(wordId);
      if (mastered) level.mastered[key] = true;
      else delete level.mastered[key];
      write(state);
    },
    toggleMastered(levelId, wordId) {
      const next = !this.isMastered(levelId, wordId);
      this.setMastered(levelId, wordId, next);
      return next;
    },
    getMasteredIds(levelId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      return Object.keys(level.mastered).map(Number);
    },
    countMastered(levelId, words) {
      const ids = new Set(this.getMasteredIds(levelId));
      return words.filter((word) => ids.has(word.id)).length;
    },
    recordQuiz(levelId, correct, total) {
      const state = read();
      const level = ensureLevel(state, levelId);
      level.quiz.correct += correct;
      level.quiz.total += total;
      level.quiz.lastScore = total ? Math.round((correct / total) * 100) : 0;
      write(state);
      return level.quiz;
    },
    getQuizStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).quiz;
    },
    resetLevel(levelId) {
      const state = read();
      state.levels[String(levelId)] = emptyLevel();
      write(state);
    },
  };
})();
