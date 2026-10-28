/**
 * HSK Lexis - Centralized Progress Storage Manager
 * Quản lý lưu trữ tiến độ học tập, từ yêu thích và thống kê các chế độ luyện tập.
 * Hỗ trợ đồng bộ hóa thời gian thực thông qua Event Dispatcher.
 */

/**
 * Chuẩn hóa từ khóa tìm kiếm: loại bỏ khoảng trắng và toàn bộ dấu câu tiếng Trung & tiếng Anh ở 2 đầu
 */
function cleanSearchQuery(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^[。，！？、.,!?;:"'“”‘’()（）\[\]【】\s]+/g, "")
    .replace(/[。，！？、.,!?;:"'“”‘’()（）\[\]【】\s]+$/g, "")
    .trim();
}
window.cleanSearchQuery = cleanSearchQuery;

const ProgressStore = (() => {
  const STORAGE_KEY = "hsk-progress-v2";
  const LEGACY_KEY = "hsk-progress-v1";

  const emptyLevel = () => ({
    mastered: {},
    favorites: {},
    quiz: { correct: 0, total: 0, lastScore: null },
    sentence: { correct: 0, total: 0, lastScore: null },
    listening: { correct: 0, total: 0, lastScore: null },
    reading: { completed: {}, count: 0 },
    typing: { correct: 0, total: 0, lastScore: null },
  });

  // Đọc dữ liệu với try-catch an toàn và tự động migrate từ phiên bản cũ
  function read() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Kiểm tra xem có dữ liệu từ phiên bản v1 cũ không
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          raw = legacyRaw;
          // Tự động sao lưu sang key mới
          localStorage.setItem(STORAGE_KEY, legacyRaw);
        }
      }

      if (!raw) {
        return { currentLevel: 1, levels: {} };
      }

      const parsed = JSON.parse(raw);
      return {
        currentLevel: Number(parsed.currentLevel) || 1,
        levels: parsed.levels && typeof parsed.levels === "object" ? parsed.levels : {},
      };
    } catch (err) {
      console.warn("[ProgressStore] Lỗi đọc dữ liệu localStorage:", err);
      return { currentLevel: 1, levels: {} };
    }
  }

  // Ghi dữ liệu an toàn với try-catch (chống lỗi QuotaExceededError)
  function write(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("[ProgressStore] Không thể lưu vào localStorage:", err);
    }
  }

  // Đảm bảo cấu trúc dữ liệu của một cấp độ luôn đầy đủ các trường
  function ensureLevel(state, levelId) {
    const id = String(levelId);
    if (!state.levels[id]) {
      state.levels[id] = emptyLevel();
    }
    const lvl = state.levels[id];
    if (!lvl.mastered || typeof lvl.mastered !== "object") lvl.mastered = {};
    if (!lvl.favorites || typeof lvl.favorites !== "object") lvl.favorites = {};
    if (!lvl.quiz) lvl.quiz = { correct: 0, total: 0, lastScore: null };
    if (!lvl.sentence) lvl.sentence = { correct: 0, total: 0, lastScore: null };
    if (!lvl.listening) lvl.listening = { correct: 0, total: 0, lastScore: null };
    if (!lvl.reading) lvl.reading = { completed: {}, count: 0 };
    if (!lvl.reading.completed || typeof lvl.reading.completed !== "object") lvl.reading.completed = {};
    if (typeof lvl.reading.count !== "number") lvl.reading.count = Object.keys(lvl.reading.completed).length;
    if (!lvl.typing) lvl.typing = { correct: 0, total: 0, lastScore: null };
    return lvl;
  }

  // Bắn CustomEvent để đồng bộ ngay lập tức cho Sidebar và các thành phần khác
  function emitChange(type, detail = {}) {
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("hsk:progress-updated", {
            detail: { type, ...detail, timestamp: Date.now() },
          })
        );
      }
    } catch (e) {
      // Bỏ qua nếu môi trường không hỗ trợ CustomEvent
    }
  }

  return {
    getCurrentLevel() {
      return read().currentLevel;
    },

    setCurrentLevel(levelId) {
      const state = read();
      state.currentLevel = Number(levelId);
      write(state);
      emitChange("level-change", { levelId: state.currentLevel });
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
      if (mastered) {
        level.mastered[key] = true;
      } else {
        delete level.mastered[key];
      }
      write(state);
      emitChange("mastered", { levelId: Number(levelId), wordId: Number(wordId), mastered: Boolean(mastered) });
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
      if (!Array.isArray(words)) return 0;
      const ids = new Set(this.getMasteredIds(levelId));
      let count = 0;
      for (let i = 0; i < words.length; i++) {
        if (ids.has(words[i].id)) count++;
      }
      return count;
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
      if (next) {
        level.favorites[key] = true;
      } else {
        delete level.favorites[key];
      }
      write(state);
      emitChange("favorite", { levelId: Number(levelId), wordId: Number(wordId), favorite: next });
      return next;
    },

    recordQuiz(levelId, correct, total) {
      const state = read();
      const level = ensureLevel(state, levelId);
      level.quiz.correct += correct;
      level.quiz.total += total;
      level.quiz.lastScore = total ? Math.round((correct / total) * 100) : 0;
      write(state);
      emitChange("quiz", { levelId: Number(levelId), ...level.quiz });
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
      emitChange("sentence", { levelId: Number(levelId), ...level.sentence });
      return level.sentence;
    },

    getSentenceStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).sentence;
    },

    recordListening(levelId, correct, total) {
      const state = read();
      const level = ensureLevel(state, levelId);
      level.listening.correct += correct;
      level.listening.total += total;
      level.listening.lastScore = total ? Math.round((correct / total) * 100) : 0;
      write(state);
      emitChange("listening", { levelId: Number(levelId), ...level.listening });
      return level.listening;
    },

    getListeningStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).listening || { correct: 0, total: 0, lastScore: null };
    },

    recordReading(levelId, readingId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      const key = String(readingId);
      if (!level.reading.completed[key]) {
        level.reading.completed[key] = true;
        level.reading.count = Object.keys(level.reading.completed).length;
        write(state);
        emitChange("reading", { levelId: Number(levelId), ...level.reading });
      }
      return level.reading;
    },

    isReadingDone(levelId, readingId) {
      const state = read();
      const level = ensureLevel(state, levelId);
      return Boolean(level.reading?.completed?.[String(readingId)]);
    },

    getReadingStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).reading || { completed: {}, count: 0 };
    },

    recordTyping(levelId, correct, total) {
      const state = read();
      const level = ensureLevel(state, levelId);
      level.typing.correct += correct;
      level.typing.total += total;
      level.typing.lastScore = total ? Math.round((correct / total) * 100) : 0;
      write(state);
      emitChange("typing", { levelId: Number(levelId), ...level.typing });
      return level.typing;
    },

    getTypingStats(levelId) {
      const state = read();
      return ensureLevel(state, levelId).typing || { correct: 0, total: 0, lastScore: null };
    },

    resetLevel(levelId) {
      const state = read();
      state.levels[String(levelId)] = emptyLevel();
      write(state);
      emitChange("reset", { levelId: Number(levelId) });
    },

    exportProgress() {
      const state = read();
      const exportData = {
        version: "2.0",
        appName: "HSK Lexis",
        exportedAt: new Date().toISOString(),
        data: state,
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hsk_progress_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          return { success: false, error: "Tệp sao lưu thiếu cấu trúc dữ liệu các cấp độ (levels)." };
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
              listening: lvlData.listening || { correct: 0, total: 0, lastScore: null },
              reading:
                lvlData.reading && typeof lvlData.reading === "object"
                  ? {
                      completed:
                        lvlData.reading.completed && typeof lvlData.reading.completed === "object"
                          ? { ...lvlData.reading.completed }
                          : {},
                      count: Number(lvlData.reading.count) || 0,
                    }
                  : { completed: {}, count: 0 },
              typing: lvlData.typing || { correct: 0, total: 0, lastScore: null },
            };
          }
        }
        write(cleanState);
        emitChange("import", { levelId: cleanState.currentLevel });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || "Lỗi xử lý tệp sao lưu JSON." };
      }
    },

    // ================= TỪ ĐIỂN: LỊCH SỬ TRA CỨU & THẺ TỪ CỦA TÔI =================
    getSearchHistory() {
      try {
        const defaultList = ["打", "起", "话", "工作", "朋友", "喜欢"];
        const raw = localStorage.getItem("hsk-search-history");
        if (!raw) return defaultList;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return defaultList;

        // Tự động làm sạch các mục bị dính dấu câu (。, ., ?, ,...) đã lưu trong localStorage
        const cleaned = [];
        let modified = false;
        for (const item of parsed) {
          const c = cleanSearchQuery(item);
          if (c) {
            if (!cleaned.includes(c)) {
              cleaned.push(c);
            }
          }
          if (c !== item) {
            modified = true;
          }
        }
        if (modified || cleaned.length !== parsed.length) {
          localStorage.setItem("hsk-search-history", JSON.stringify(cleaned));
        }
        return cleaned.length > 0 ? cleaned : defaultList;
      } catch {
        return ["打", "起", "话", "工作", "朋友"];
      }
    },

    addSearchHistory(term) {
      if (!term || typeof term !== "string") return;
      const clean = cleanSearchQuery(term);
      if (!clean) return;
      try {
        let history = this.getSearchHistory().filter((x) => x !== clean);
        history.unshift(clean);
        if (history.length > 15) history = history.slice(0, 15);
        localStorage.setItem("hsk-search-history", JSON.stringify(history));
      } catch (e) {
        console.warn("[DictStore] Failed to save search history:", e);
      }
    },

    removeSearchHistory(term) {
      try {
        const clean = cleanSearchQuery(term);
        let history = this.getSearchHistory().filter((x) => x !== clean && x !== term);
        localStorage.setItem("hsk-search-history", JSON.stringify(history));
        return history;
      } catch {
        return [];
      }
    },

    clearSearchHistory() {
      try {
        localStorage.removeItem("hsk-search-history");
      } catch (e) {}
    },

    getAllFavorites() {
      const state = read();
      const favList = [];
      for (const [lvlId, lvlData] of Object.entries(state.levels)) {
        if (lvlData && lvlData.favorites) {
          for (const wordId of Object.keys(lvlData.favorites)) {
            if (lvlData.favorites[wordId]) {
              const word = DataStore.getVocabById(Number(wordId));
              if (word) favList.push(word);
            }
          }
        }
      }
      return favList;
    },
  };
})();
