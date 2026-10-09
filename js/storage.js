const ProgressStore = (() => {
  const KEY = "hsk-progress-v1";

  const emptyLevel = () => ({
    mastered: {},
    favorites: {},
    quiz: { correct: 0, total: 0, lastScore: null },
    sentence: { correct: 0, total: 0, lastScore: null },
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
    if (!state.levels[id].favorites) state.levels[id].favorites = {};
    if (!state.levels[id].quiz) state.levels[id].quiz = { correct: 0, total: 0, lastScore: null };
    if (!state.levels[id].sentence) state.levels[id].sentence = { correct: 0, total: 0, lastScore: null };
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
    isFavorite(levelId, wordId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      return Boolean(level.favorites[String(wordId)]);
    },
    toggleFavorite(levelId, wordId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      const key = String(wordId);
      const next = !level.favorites[key];
      if (next) level.favorites[key] = true;
      else delete level.favorites[key];
      write(state);
      return next;
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
    recordSentence(levelId, correct, total) {
      const state = read();
      const level = ensureLevel(state, levelId);
      level.sentence.correct += correct;
      level.sentence.total += total;
      level.sentence.lastScore = total ? Math.round((correct / total) * 100) : 0;
      write(state);
      return level.sentence;
    },
    getSentenceStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).sentence;
    },
    resetLevel(levelId) {
      const state = read();
      state.levels[String(levelId)] = emptyLevel();
      write(state);
    },
    exportProgress() {
      const state = read();
      const exportData = {
        version: "1.0",
        appName: "HSK Lexis",
        exportedAt: new Date().toISOString(),
        data: state,
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hsk_progress_backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    },
    importProgress(jsonInput) {
      try {
        let parsed = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
        if (!parsed || typeof parsed !== "object") {
          return { success: false, error: "Dữ liệu JSON không hợp lệ." };
        }
        const stateData = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        if (!stateData.levels || typeof stateData.levels !== "object") {
          return { success: false, error: "File sao lưu thiếu dữ liệu các cấp độ (levels)." };
        }
        const cleanState = {
          currentLevel: Number(stateData.currentLevel) || 1,
          levels: {},
        };
        for (const [lvlId, lvlData] of Object.entries(stateData.levels)) {
          if (lvlData && typeof lvlData === "object") {
            cleanState.levels[String(lvlId)] = {
              mastered: lvlData.mastered && typeof lvlData.mastered === "object" ? { ...lvlData.mastered } : {},
              favorites: lvlData.favorites && typeof lvlData.favorites === "object" ? { ...lvlData.favorites } : {},
              quiz: lvlData.quiz || { correct: 0, total: 0, lastScore: null },
              sentence: lvlData.sentence || { correct: 0, total: 0, lastScore: null },
            };
          }
        }
        write(cleanState);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || "Lỗi đọc file JSON." };
      }
    },
  };
})();
