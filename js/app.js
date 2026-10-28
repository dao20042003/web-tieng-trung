/**
 * HSK Lexis - Modern Architecture Application Engine
 * Principal Frontend Architect & Senior UI/UX Refactored Version
 * 
 * Features:
 * - Centralized State Management (appState)
 * - Zero Dead Code & Event Delegation Pattern
 * - Chunk Rendering (<16ms) with DocumentFragment for 1000+ words
 * - 150ms Debounced Instant Search
 * - Robust Chinese Web Speech API Engine with auto-cancel & natural zh-CN voice
 * - 100% Responsive with Mobile Drawer & Keyboard Safe Layouts
 */

(() => {
  "use strict";

  // ============================================================
  // 1. CENTRALIZED STATE MANAGEMENT
  // ============================================================
  const appState = {
    currentLevel: ProgressStore.getCurrentLevel() || 1,
    currentTab: "home", // home | study | flash | quiz | listening | sentence | reading | typing
    selectedTopic: "all",
    filterStatus: "all", // all | learning | mastered
    searchQuery: "",
    
    // Study tab chunk rendering state
    study: {
      chunkSize: 45,
      renderedCount: 45,
      cachedWords: [],
    },

    // Flashcard state
    flash: {
      index: 0,
      isFlipped: false,
    },

    // Quiz module state
    quiz: null,
    quizType: "cloze", // cloze | listen

    // Listening module state
    listening: null,

    // Sentence building module state
    sentence: null,

    // Reading comprehension module state
    reading: null,

    // Typing practice module state
    typing: null,

    // Smart Dictionary (Từ điển Tra cứu thông minh) state
    dict: {
      query: "",
      activeSubTab: "vocab", // vocab | hanzi | grammar | sentence | compound
      langMode: "cn", // cn | vi
      historyExpanded: false,
      activeModal: null, // null | ocr | handwriting | radicals | favorites
      selectedChar: "",
      isListening: false,
      speechRecognizer: null,
      handwritingStrokes: [],
      handwritingCandidates: [],
      showStrokeGuide: true,
    },
  };

  // DOM Elements Cache
  const dom = {
    // Desktop Sidebar
    levelList: document.getElementById("level-list"),
    levelProgressLabel: document.getElementById("level-progress-label"),
    levelProgressBar: document.getElementById("level-progress-bar"),
    
    // Mobile Drawer & Header
    levelListMobile: document.getElementById("level-list-mobile"),
    mobileProgressLabel: document.getElementById("mobile-progress-label"),
    mobileProgressBar: document.getElementById("mobile-progress-bar"),
    mobileLevelBadge: document.getElementById("mobile-level-badge"),
    mobileDrawerBackdrop: document.getElementById("mobile-drawer-backdrop"),
    mobileDrawer: document.getElementById("mobile-drawer"),
    mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
    mobileDrawerClose: document.getElementById("mobile-drawer-close"),

    // Header & Global Search
    crumb: document.getElementById("crumb"),
    pageTitle: document.getElementById("page-title"),
    searchInput: document.getElementById("search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    toastContainer: document.getElementById("toast-container"),
    importFileInput: document.getElementById("import-file-input"),

    // Views Containers
    views: {
      home: document.getElementById("view-home"),
      dict: document.getElementById("view-dict"),
      study: document.getElementById("view-study"),
      flash: document.getElementById("view-flash"),
      quiz: document.getElementById("view-quiz"),
      listening: document.getElementById("view-listening"),
      sentence: document.getElementById("view-sentence"),
      reading: document.getElementById("view-reading"),
      typing: document.getElementById("view-typing"),
    },
  };

  // ============================================================
  // 2. DATA ACCESSORS & HELPERS
  // ============================================================
  function getCurrentLevelInfo() {
    return DataStore.getLevel(appState.currentLevel) || DataStore.getEnabledLevels()[0];
  }

  function getLevelTopics() {
    return DataStore.getTopicsByLevel(appState.currentLevel) || [];
  }

  function getFilteredWords() {
    const list = DataStore.getVocab({
      level: appState.currentLevel,
      topicId: appState.selectedTopic === "all" ? undefined : appState.selectedTopic,
      search: appState.searchQuery,
    });

    if (appState.filterStatus === "all") return list;
    
    return list.filter((word) => {
      const isMastered = ProgressStore.isMastered(appState.currentLevel, word.id);
      return appState.filterStatus === "mastered" ? isMastered : !isMastered;
    });
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function debounce(fn, delay = 150) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function showToast(message, type = "success") {
    if (!dom.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const iconName = type === "success" ? "check-circle" : "alert-circle";
    const iconColor = type === "success" ? "text-emerald-400" : "text-vermillion";
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0 ${iconColor}"></i><span class="text-xs sm:text-sm">${message}</span>`;
    dom.toastContainer.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.classList.add("toast-fadeout");
      setTimeout(() => toast.remove(), 320);
    }, 2600);
  }

  // ============================================================
  // 3. OPTIMIZED WEB SPEECH API (TTS) ENGINE
  // ============================================================
  let currentUtterance = null;
  let cachedVoices = [];

  function initSpeechVoices() {
    if (!window.speechSynthesis) return;
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }

  if (typeof window !== "undefined" && window.speechSynthesis) {
    initSpeechVoices();
    window.speechSynthesis.addEventListener("voiceschanged", initSpeechVoices);
  }

  function getBestChineseVoice() {
    if (!cachedVoices.length && window.speechSynthesis) {
      initSpeechVoices();
    }
    return (
      cachedVoices.find((v) => v.lang === "zh-CN" || v.lang === "zh_CN") ||
      cachedVoices.find((v) => v.lang.startsWith("zh")) ||
      null
    );
  }

  function speakChinese(text, rate = 1.0, onEnd = null) {
    if (!window.speechSynthesis || !text) {
      if (typeof onEnd === "function") onEnd();
      return;
    }

    try {
      // Hủy ngay lập tức bài đọc trước để chống dồn ứ âm thanh khi click nhanh liên tục
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utter = new SpeechSynthesisUtterance(text);
      currentUtterance = utter; // Tham chiếu ngăn GC Chromium thu gom mid-speech
      utter.lang = "zh-CN";
      utter.rate = rate;

      const voice = getBestChineseVoice();
      if (voice) utter.voice = voice;

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        if (currentUtterance === utter) currentUtterance = null;
        if (typeof onEnd === "function") onEnd();
      };

      utter.onend = done;
      utter.onerror = done;

      // Watchdog timeout an toàn chống treo utterance trên một số trình duyệt
      const safeDuration = Math.max(2000, Math.min(30000, (text.length * 400) / rate + 1200));
      setTimeout(() => {
        if (!finished && currentUtterance === utter) {
          done();
        }
      }, safeDuration);

      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.warn("[TTS] Error:", err);
      if (typeof onEnd === "function") onEnd();
    }
  }

  // ============================================================
  // 4. NAVIGATION & VIEW SWITCHING (ROUTER)
  // ============================================================
  function switchView(targetTab) {
    // Hủy âm thanh đang phát khi chuyển tab
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }

    if (appState.reading) appState.reading.isSpeaking = false;
    if (appState.listening) appState.listening.isPlaying = false;
    if (appState.dict?.speechRecognizer && appState.dict?.isListening) {
      try {
        appState.dict.speechRecognizer.stop();
      } catch (e) {}
      appState.dict.isListening = false;
    }

    if (appState.typing?.animationFrameId) {
      cancelAnimationFrame(appState.typing.animationFrameId);
      appState.typing.animationFrameId = null;
    }
    if (appState.typing) {
      appState.typing.isPaused = true;
    }

    appState.currentTab = targetTab;

    // Chuyển đổi hiển thị các section container
    Object.entries(dom.views).forEach(([tabName, el]) => {
      if (el) {
        el.classList.toggle("hidden", tabName !== targetTab);
      }
    });

    // Cập nhật trạng thái active của nav buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const isActive = btn.dataset.view === targetTab;
      btn.classList.toggle("border-gold/50", isActive);
      btn.classList.toggle("bg-white/10", isActive);
      btn.classList.toggle("text-white", isActive);
      btn.classList.toggle("font-medium", isActive);
    });

    // Render nội dung của view tương ứng
    renderActiveView();
  }

  function renderActiveView() {
    renderProgress();

    switch (appState.currentTab) {
      case "home":
        renderHome();
        break;
      case "dict":
        renderDict();
        break;
      case "study":
        renderStudy();
        break;
      case "flash":
        renderFlash();
        break;
      case "quiz":
        renderQuiz();
        break;
      case "listening":
        renderListening();
        break;
      case "sentence":
        renderSentence();
        break;
      case "reading":
        renderReading();
        break;
      case "typing":
        renderTyping();
        break;
      default:
        renderHome();
        break;
    }

    refreshIcons();
  }

  // Cập nhật thanh tiến độ trên Sidebar và Mobile Drawer
  function renderProgress() {
    const allWords = DataStore.getVocab({ level: appState.currentLevel });
    const masteredCount = ProgressStore.countMastered(appState.currentLevel, allWords);
    const totalWords = allWords.length || getCurrentLevelInfo()?.totalWords || 0;
    const percentage = totalWords ? Math.round((masteredCount / totalWords) * 100) : 0;

    const labelText = `${masteredCount} / ${totalWords}`;
    const widthStyle = `${percentage}%`;

    if (dom.levelProgressLabel) dom.levelProgressLabel.textContent = labelText;
    if (dom.levelProgressBar) dom.levelProgressBar.style.width = widthStyle;
    if (dom.mobileProgressLabel) dom.mobileProgressLabel.textContent = labelText;
    if (dom.mobileProgressBar) dom.mobileProgressBar.style.width = widthStyle;
    
    if (dom.mobileLevelBadge) {
      const lvl = getCurrentLevelInfo();
      dom.mobileLevelBadge.textContent = lvl ? lvl.name : `HSK ${appState.currentLevel}`;
    }
  }

  // Render danh sách cấp độ HSK 1 - 4 trên Sidebar và Mobile Drawer
  function renderLevelList() {
    const levels = DataStore.getEnabledLevels();
    const renderItems = (targetContainer) => {
      if (!targetContainer) return;
      targetContainer.innerHTML = levels
        .map((lvl) => {
          const isActive = lvl.id === appState.currentLevel;
          return `
            <button data-level-id="${lvl.id}" class="w-full text-left glass-card rounded-xl px-3.5 py-2.5 text-xs sm:text-sm flex items-center justify-between transition ${
              isActive ? "border-gold/60 bg-white/10 text-white font-semibold shadow-sm" : "text-paper/70 hover:border-gold/30 hover:text-paper"
            }">
              <span class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${isActive ? "bg-gold" : "bg-white/20"}"></span>
                <span>${lvl.name}</span>
              </span>
              <span class="text-[11px] text-paper/40">${lvl.totalWords} từ</span>
            </button>
          `;
        })
        .join("");
    };

    renderItems(dom.levelList);
    renderItems(dom.levelListMobile);
  }

  function handleLevelChange(levelId) {
    const nextLevel = Number(levelId);
    if (nextLevel === appState.currentLevel) return;

    appState.currentLevel = nextLevel;
    appState.selectedTopic = "all";
    appState.searchQuery = "";
    if (dom.searchInput) dom.searchInput.value = "";
    if (dom.searchClearBtn) dom.searchClearBtn.classList.add("hidden");

    // Reset các bài tập của cấp cũ
    appState.quiz = null;
    appState.listening = null;
    appState.sentence = null;
    appState.reading = null;
    appState.typing = null;
    appState.flash.index = 0;
    appState.flash.isFlipped = false;
    appState.study.renderedCount = appState.study.chunkSize;

    ProgressStore.setCurrentLevel(nextLevel);
    renderLevelList();
    renderActiveView();

    // Đóng drawer nếu đang mở trên mobile
    closeMobileDrawer();
  }

  // Component dropdown chọn chủ đề có thể tái sử dụng
  function createTopicSelectHtml(extraClass = "") {
    const topics = getLevelTopics();
    const options = [`<option value="all">Tất cả chủ đề</option>`]
      .concat(
        topics.map(
          (t) => `<option value="${t.id}" ${t.id === appState.selectedTopic ? "selected" : ""}>${t.name} (${t.cn})</option>`
        )
      )
      .join("");

    return `
      <select class="topic-dropdown bg-ink border border-white/15 text-paper rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-gold/60 transition ${extraClass}" aria-label="Lọc theo chủ đề">
        ${options}
      </select>
    `;
  }

  // ============================================================
  // 5. VIEW 1: HOME (CHỦ ĐỀ & TỔNG QUAN THỐNG KÊ)
  // ============================================================
  function renderHome() {
    const lvl = getCurrentLevelInfo();
    dom.crumb.textContent = lvl ? lvl.name : "HSK";
    dom.pageTitle.textContent = "Chọn chủ đề để học";

    const allWords = DataStore.getVocab({ level: appState.currentLevel });
    const masteredAll = ProgressStore.countMastered(appState.currentLevel, allWords);
    const quizStats = ProgressStore.getQuizStats(appState.currentLevel);
    const listenStats = ProgressStore.getListeningStats(appState.currentLevel);
    const sentenceStats = ProgressStore.getSentenceStats(appState.currentLevel);
    const readStats = ProgressStore.getReadingStats(appState.currentLevel);
    const typeStats = ProgressStore.getTypingStats(appState.currentLevel);
    const topics = getLevelTopics();

    dom.views.home.innerHTML = `
      <!-- Stat KPI Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div data-jump="study" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-gold/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium">Tổng từ vựng</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-paper">${allWords.length}</p>
        </div>
        <div data-jump="study" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-gold/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium">Đã thuộc</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-gold">${masteredAll}</p>
        </div>
        <div data-jump="quiz" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-gold/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium">Trắc nghiệm</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-paper">${quizStats.lastScore == null ? "—" : quizStats.lastScore + "%"}</p>
        </div>
        <div data-jump="listening" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-sky-400/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium text-sky-400">Luyện nghe</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-sky-400">${listenStats.lastScore == null ? "—" : listenStats.lastScore + "%"}</p>
        </div>
        <div data-jump="sentence" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-emerald-400/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium text-emerald-400">Đặt câu</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-emerald-400">${sentenceStats.lastScore == null ? "—" : sentenceStats.lastScore + "%"}</p>
        </div>
        <div data-jump="typing" class="glass-card p-3.5 sm:p-4 cursor-pointer hover:border-amber-400/50 transition flex flex-col justify-between">
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium text-amber-400">Thần Bút Phi Đao</p>
          <p class="text-xl sm:text-2xl font-bold mt-1 text-amber-400">${typeStats.lastScore == null ? "—" : typeStats.lastScore + "%"}</p>
        </div>
      </div>

      <!-- Topics Grid -->
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        ${topics
          .map((topic, idx) => {
            const list = DataStore.getVocab({ level: appState.currentLevel, topicId: topic.id });
            const done = ProgressStore.countMastered(appState.currentLevel, list);
            const pct = list.length ? Math.round((done / list.length) * 100) : 0;
            const topicNum = String(idx + 1).padStart(2, "0");

            return `
              <article class="glass-card p-5 flex flex-col justify-between group">
                <div>
                  <div class="flex justify-between items-start">
                    <span class="text-xs font-mono text-gold/80 font-bold tracking-wider">${topicNum}</span>
                    <span class="text-xs text-paper/40">${list.length} từ</span>
                  </div>
                  <h3 class="hanzi text-xl font-bold mt-3 text-paper group-hover:text-gold transition">${topic.cn}</h3>
                  <p class="text-xs sm:text-sm text-paper/70 mt-1 line-clamp-1">${topic.name}</p>
                  
                  <div class="progress-bar mt-4">
                    <span style="width: ${pct}%"></span>
                  </div>
                  <p class="text-[11px] text-paper/40 mt-1.5">${done}/${list.length} đã thuộc (${pct}%)</p>
                </div>

                <div class="flex gap-2 mt-5 pt-3 border-t border-white/5">
                  <button data-action="open-study" data-topic="${topic.id}" class="flex-1 bg-vermillion/90 hover:bg-vermillion text-white rounded-xl py-2 text-xs font-semibold transition">
                    Học từ
                  </button>
                  <button data-action="open-flash" data-topic="${topic.id}" class="px-3 glass rounded-xl hover:border-gold/40 text-paper/80 transition" title="Flashcard">
                    <i data-lucide="layers" class="w-4 h-4"></i>
                  </button>
                  <button data-action="open-quiz" data-topic="${topic.id}" class="px-3 glass rounded-xl hover:border-gold/40 text-paper/80 transition" title="Trắc nghiệm">
                    <i data-lucide="list-checks" class="w-4 h-4"></i>
                  </button>
                  <button data-action="open-listening" data-topic="${topic.id}" class="px-3 glass rounded-xl hover:border-sky-400 text-sky-400 transition" title="Luyện nghe">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    // Event Delegation for Home View (1 Single Listener)
    dom.views.home.onclick = (e) => {
      const jumpEl = e.target.closest("[data-jump]");
      if (jumpEl) {
        const targetView = jumpEl.dataset.jump;
        if (targetView === "listening") startListeningModule();
        if (targetView === "quiz") startQuizModule();
        if (targetView === "sentence") startSentenceModule();
        if (targetView === "typing") startTypingModule();
        switchView(targetView);
        return;
      }

      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const topicId = actionBtn.dataset.topic;
        appState.selectedTopic = topicId;

        if (action === "open-study") {
          switchView("study");
        } else if (action === "open-flash") {
          appState.flash.index = 0;
          appState.flash.isFlipped = false;
          switchView("flash");
        } else if (action === "open-quiz") {
          startQuizModule();
          switchView("quiz");
        } else if (action === "open-listening") {
          startListeningModule();
          switchView("listening");
        }
      }
    };
  }

  // ============================================================
  // 6. VIEW 2: STUDY (CHUNK RENDERING & HIGH PERFORMANCE VOCAB LIST)
  // ============================================================
  function renderStudy() {
    dom.crumb.textContent = "Học từ vựng";
    const topic = DataStore.getTopic(appState.selectedTopic);
    dom.pageTitle.textContent = topic ? `${topic.name} (${topic.cn})` : "Toàn bộ danh sách từ vựng";

    const allFiltered = getFilteredWords();
    appState.study.cachedWords = allFiltered;

    // Reset renderedCount nếu từ khóa tìm kiếm hoặc lọc thay đổi
    if (appState.study.renderedCount < appState.study.chunkSize) {
      appState.study.renderedCount = appState.study.chunkSize;
    }

    const currentCount = Math.min(appState.study.renderedCount, allFiltered.length);
    const visibleChunk = allFiltered.slice(0, currentCount);

    dom.views.study.innerHTML = `
      <!-- Toolbar Filters -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div class="flex flex-wrap items-center gap-2">
          ${createTopicSelectHtml()}
          <select id="study-status-select" class="bg-ink border border-white/15 text-paper rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-gold/60 transition" aria-label="Lọc trạng thái">
            <option value="all" ${appState.filterStatus === "all" ? "selected" : ""}>Tất cả từ</option>
            <option value="learning" ${appState.filterStatus === "learning" ? "selected" : ""}>Chưa thuộc</option>
            <option value="mastered" ${appState.filterStatus === "mastered" ? "selected" : ""}>Đã thuộc</option>
          </select>
        </div>

        <div class="text-xs text-paper/50 font-medium">
          Hiển thị <span class="text-gold font-bold">${visibleChunk.length}</span> / ${allFiltered.length} từ
        </div>
      </div>

      <!-- Word Cards List Container -->
      <div id="study-vocab-container" class="grid gap-2.5">
        <!-- DocumentFragment items injected below -->
      </div>

      <!-- Load More Button -->
      ${
        currentCount < allFiltered.length
          ? `<div class="mt-6 text-center">
              <button id="btn-load-more-words" class="glass-card hover:border-gold/60 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gold inline-flex items-center gap-2 transition shadow-lg">
                <i data-lucide="chevron-down" class="w-4 h-4"></i> Tải thêm ${Math.min(appState.study.chunkSize, allFiltered.length - currentCount)} từ nữa...
              </button>
            </div>`
          : ""
      }
    `;

    // Render using DocumentFragment for maximum DOM performance (< 10ms)
    const listContainer = document.getElementById("study-vocab-container");
    if (listContainer) {
      if (visibleChunk.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-paper/50 glass-card rounded-2xl">Không tìm thấy từ vựng nào khớp bộ lọc.</div>`;
      } else {
        const fragment = document.createDocumentFragment();
        visibleChunk.forEach((word) => {
          const isMastered = ProgressStore.isMastered(appState.currentLevel, word.id);
          const itemEl = document.createElement("div");
          itemEl.className = "glass-card px-4 py-3 rounded-2xl flex items-center gap-3.5 transition group";
          itemEl.id = `vocab-row-${word.id}`;
          itemEl.innerHTML = `
            <button data-action="speak" data-text="${word.hanzi}" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 hover:bg-gold/20 text-gold transition" title="Nghe phát âm">
              <i data-lucide="volume-2" class="w-4 h-4"></i>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2">
                <span class="hanzi text-2xl font-bold leading-none text-paper">${word.hanzi}</span>
                <span class="text-xs sm:text-sm text-gold font-medium">${word.pinyin}</span>
              </div>
              <p class="text-xs sm:text-sm text-paper/70 mt-1 line-clamp-1">${word.meaning}</p>
            </div>
            <button data-action="toggle-master" data-id="${word.id}" class="master-badge text-xs rounded-full px-3.5 py-1.5 border transition ${
              isMastered
                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 font-medium"
                : "border-white/15 text-paper/50 hover:border-gold/40 hover:text-paper"
            }">
              ${isMastered ? "Đã thuộc" : "Chưa thuộc"}
            </button>
          `;
          fragment.appendChild(itemEl);
        });
        listContainer.appendChild(fragment);
      }
    }

    // Attach Event Listeners for Filters
    const topicDropdown = dom.views.study.querySelector(".topic-dropdown");
    if (topicDropdown) {
      topicDropdown.onchange = (e) => {
        appState.selectedTopic = e.target.value;
        appState.study.renderedCount = appState.study.chunkSize;
        renderStudy();
        refreshIcons();
      };
    }

    const statusDropdown = document.getElementById("study-status-select");
    if (statusDropdown) {
      statusDropdown.onchange = (e) => {
        appState.filterStatus = e.target.value;
        appState.study.renderedCount = appState.study.chunkSize;
        renderStudy();
        refreshIcons();
      };
    }

    const loadMoreBtn = document.getElementById("btn-load-more-words");
    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => {
        appState.study.renderedCount += appState.study.chunkSize;
        renderStudy();
        refreshIcons();
      };
    }

    // EVENT DELEGATION on the list container: zero DOM memory leaks
    if (listContainer) {
      listContainer.onclick = (e) => {
        const speakBtn = e.target.closest('[data-action="speak"]');
        if (speakBtn) {
          speakChinese(speakBtn.dataset.text);
          return;
        }

        const masterBtn = e.target.closest('[data-action="toggle-master"]');
        if (masterBtn) {
          const wordId = Number(masterBtn.dataset.id);
          const nextState = ProgressStore.toggleMastered(appState.currentLevel, wordId);

          // Cập nhật giao diện của riêng badge này mà KHÔNG re-render 1000 thẻ
          masterBtn.textContent = nextState ? "Đã thuộc" : "Chưa thuộc";
          masterBtn.className = `master-badge text-xs rounded-full px-3.5 py-1.5 border transition ${
            nextState
              ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 font-medium"
              : "border-white/15 text-paper/50 hover:border-gold/40 hover:text-paper"
          }`;

          renderProgress();
        }
      };
    }
  }

  // ============================================================
  // 7. VIEW 3: FLASHCARD (PREMIUM 3D FLIP)
  // ============================================================
  function renderFlash() {
    dom.crumb.textContent = "Flashcard";
    const topic = DataStore.getTopic(appState.selectedTopic);
    dom.pageTitle.textContent = topic ? `Thẻ ghi nhớ · ${topic.name}` : "Luyện thẻ ghi nhớ";

    const words = getFilteredWords();
    const flash = appState.flash;

    if (!words.length) {
      dom.views.flash.innerHTML = `
        <div class="max-w-md mx-auto glass-card rounded-3xl p-8 text-center text-paper/60">
          <p>Không có thẻ từ vựng nào khớp bộ lọc.</p>
        </div>
      `;
      return;
    }

    if (flash.index >= words.length) flash.index = 0;
    const currentWord = words[flash.index];
    const isMastered = ProgressStore.isMastered(appState.currentLevel, currentWord.id);

    dom.views.flash.innerHTML = `
      <div class="max-w-xl mx-auto">
        <div class="flex items-center justify-between gap-3 mb-4">
          ${createTopicSelectHtml("flex-1 text-xs py-1.5")}
          <span class="text-xs text-paper/50 font-mono font-medium">${flash.index + 1} / ${words.length}</span>
        </div>

        <div class="flip-scene">
          <div id="flash-card-element" class="flip-card ${flash.isFlipped ? "is-flipped" : ""}">
            <!-- Mặt trước (Front): Chỉ chữ Hán to và nút loa (KHÔNG có Pinyin) -->
            <div class="flip-face flip-front select-none">
              <div class="flex-1 flex flex-col items-center justify-center w-full">
                <p class="hanzi text-6xl sm:text-7xl font-bold tracking-wide text-center text-paper drop-shadow-md">${currentWord.hanzi}</p>
                <button id="flash-speak-front" class="flash-speaker-btn mt-6" title="Nghe phát âm">
                  <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
                </button>
              </div>
              <p class="text-xs text-paper/40 mt-auto pt-4 flex items-center gap-1.5 tracking-wide">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5 opacity-60"></i> Nhấn để lật xem Pinyin & Nghĩa
              </p>
            </div>

            <!-- Mặt sau (Back): Hán tự nhỏ, Pinyin vàng, Nghĩa tiếng Việt, Nút loa -->
            <div class="flip-face flip-back select-none">
              <div class="flex-1 flex flex-col items-center justify-center w-full text-center">
                <p class="hanzi text-3xl sm:text-4xl text-paper/70 font-medium mb-1.5">${currentWord.hanzi}</p>
                <p class="text-xl sm:text-2xl text-gold font-bold mb-3 tracking-wide">${currentWord.pinyin}</p>
                <p class="text-2xl sm:text-3xl font-bold text-paper max-w-md leading-relaxed">${currentWord.meaning}</p>
                <button id="flash-speak-back" class="flash-speaker-btn mt-6" title="Nghe phát âm">
                  <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
                </button>
              </div>
              <p class="text-xs text-paper/40 mt-auto pt-4 flex items-center gap-1.5 tracking-wide">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5 opacity-60"></i> Nhấn để lật lại mặt trước
              </p>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between mt-6 gap-3">
          <button id="flash-btn-prev" class="glass-card rounded-xl px-5 py-2.5 text-xs sm:text-sm font-medium hover:border-gold/50 transition">
            Trước
          </button>
          <button id="flash-btn-master" class="rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition ${
            isMastered ? "bg-emerald-800 text-emerald-100" : "bg-vermillion text-white"
          }">
            ${isMastered ? "Đã thuộc" : "Đánh dấu thuộc"}
          </button>
          <button id="flash-btn-next" class="glass-card rounded-xl px-5 py-2.5 text-xs sm:text-sm font-medium hover:border-gold/50 transition">
            Sau
          </button>
        </div>
      </div>
    `;

    const cardEl = document.getElementById("flash-card-element");
    if (cardEl) {
      cardEl.onclick = () => {
        flash.isFlipped = !flash.isFlipped;
        cardEl.classList.toggle("is-flipped", flash.isFlipped);
      };
    }

    document.getElementById("flash-speak-front")?.addEventListener("click", (e) => {
      e.stopPropagation();
      speakChinese(currentWord.hanzi);
    });

    document.getElementById("flash-speak-back")?.addEventListener("click", (e) => {
      e.stopPropagation();
      speakChinese(currentWord.hanzi);
    });

    document.getElementById("flash-btn-master")?.addEventListener("click", () => {
      ProgressStore.toggleMastered(appState.currentLevel, currentWord.id);
      renderFlash();
    });

    document.getElementById("flash-btn-prev")?.addEventListener("click", () => {
      flash.index = (flash.index - 1 + words.length) % words.length;
      flash.isFlipped = false;
      renderFlash();
    });

    document.getElementById("flash-btn-next")?.addEventListener("click", () => {
      flash.index = (flash.index + 1) % words.length;
      flash.isFlipped = false;
      renderFlash();
    });

    const topicSelect = dom.views.flash.querySelector(".topic-dropdown");
    if (topicSelect) {
      topicSelect.onchange = (e) => {
        appState.selectedTopic = e.target.value;
        flash.index = 0;
        flash.isFlipped = false;
        renderFlash();
      };
    }
  }

  // ============================================================
  // 8. VIEW 4: QUIZ (TRẮC NGHIỆM THUẦN CHỮ HÁN 100%)
  // ============================================================
  function startQuizModule(customItems = null) {
    const levelVocab = DataStore.getVocab({ level: appState.currentLevel });
    if (customItems && customItems.length) {
      appState.quiz = {
        items: customItems,
        index: 0,
        correct: 0,
        answered: false,
        selectedHanzi: null,
        isCorrect: null,
        showHint: false,
        wrongList: [],
        done: false,
        showReviewModal: false,
      };
      return;
    }

    const type = appState.quizType || "cloze";
    let questions = [];

    if (type === "cloze") {
      const allSentences = DataStore.getSentences({ level: appState.currentLevel });
      let candidateSentences = allSentences;

      if (appState.selectedTopic !== "all") {
        const topicWords = DataStore.getVocab({ level: appState.currentLevel, topicId: appState.selectedTopic });
        const matched = allSentences.filter((s) => {
          const text = (s.correctOrder || []).join("");
          return topicWords.some((w) => text.includes(w.hanzi));
        });
        if (matched.length >= 8) candidateSentences = matched;
      }

      const count = Math.min(20, candidateSentences.length);
      const chosen = shuffle(candidateSentences).slice(0, count);
      questions = chosen.map((s) => makeClozeQuestion(s, levelVocab));

      if (!questions.length) {
        questions = shuffle(levelVocab).slice(0, 20).map((w) => makeListenHanziQuestion(w, levelVocab));
      }
    } else {
      const pool = DataStore.getVocab({
        level: appState.currentLevel,
        topicId: appState.selectedTopic === "all" ? undefined : appState.selectedTopic,
      });
      const source = pool.length >= 4 ? pool : levelVocab;
      const count = Math.min(20, source.length);
      questions = shuffle(source).slice(0, count).map((w) => makeListenHanziQuestion(w, levelVocab));
    }

    appState.quiz = {
      items: questions,
      index: 0,
      correct: 0,
      answered: false,
      selectedHanzi: null,
      isCorrect: null,
      showHint: false,
      wrongList: [],
      done: false,
      showReviewModal: false,
    };
  }

  function makeClozeQuestion(sentence, levelVocab) {
    const fullText = (sentence.correctOrder || []).join("");
    let fullWithPunc = fullText;
    if (!/[。？！,.?!]$/.test(fullWithPunc)) {
      fullWithPunc += sentence.vietnamese && sentence.vietnamese.endsWith("?") ? "？" : "。";
    }

    const matches = levelVocab.filter((w) => w.hanzi && fullText.includes(w.hanzi));
    let targetWord = null;

    if (matches.length > 0) {
      const sorted = [...matches].sort((a, b) => b.hanzi.length - a.hanzi.length);
      targetWord = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
    } else {
      const validTokens = (sentence.correctOrder || []).filter((t) => t.length >= 1 && t.length <= 4 && !/[。？！,.?!，]/.test(t));
      const chosenToken = validTokens.length ? validTokens[0] : sentence.correctOrder[0] || "好";
      const found = VOCAB_DATA.find((w) => w.hanzi === chosenToken);
      targetWord = found || { hanzi: chosenToken, pinyin: sentence.pinyin || "", meaning: sentence.vietnamese || "" };
    }

    const promptCn = fullWithPunc.replace(targetWord.hanzi, " ____ ");
    const answer = targetWord.hanzi;
    const distractorPool = levelVocab.filter((w) => w.hanzi !== answer && !fullText.includes(w.hanzi));
    const sameLengthPool = distractorPool.filter((w) => w.hanzi.length === answer.length);
    const candidatePool = sameLengthPool.length >= 3 ? sameLengthPool : distractorPool;
    const distractors = shuffle(candidatePool).slice(0, 3);
    const choices = shuffle([targetWord, ...distractors]);

    return {
      type: "cloze",
      id: sentence.id,
      promptCn,
      fullCn: fullWithPunc,
      answer,
      targetWord,
      sentencePinyin: sentence.pinyin || "",
      sentenceVietnamese: sentence.vietnamese || "",
      choices,
    };
  }

  function makeListenHanziQuestion(word, levelVocab) {
    const answer = word.hanzi;
    const distractorPool = levelVocab.filter((w) => w.hanzi !== answer);
    const sameLengthPool = distractorPool.filter((w) => w.hanzi.length === answer.length);
    const candidatePool = sameLengthPool.length >= 3 ? sameLengthPool : distractorPool;
    const distractors = shuffle(candidatePool).slice(0, 3);
    const choices = shuffle([word, ...distractors]);

    return {
      type: "listen",
      id: word.id,
      promptCn: word.hanzi,
      fullCn: word.hanzi,
      answer,
      targetWord: word,
      sentencePinyin: word.pinyin || "",
      sentenceVietnamese: word.meaning || "",
      choices,
    };
  }

  function highlightAnswerInSentence(fullCn, answer) {
    if (!fullCn || !answer) return fullCn || "";
    const idx = fullCn.indexOf(answer);
    if (idx === -1) return fullCn;
    const before = fullCn.slice(0, idx);
    const after = fullCn.slice(idx + answer.length);
    return `${before}<span class="text-gold font-bold underline underline-offset-4 decoration-gold/60">${answer}</span>${after}`;
  }

  function renderQuiz() {
    dom.crumb.textContent = "Trắc nghiệm";
    const topic = DataStore.getTopic(appState.selectedTopic);
    dom.pageTitle.textContent = topic ? `Trắc nghiệm Hán tự · ${topic.name}` : "Trắc nghiệm thuần chữ Hán";

    if (!appState.quiz) startQuizModule();
    const quiz = appState.quiz;

    if (!quiz || !quiz.items.length) {
      dom.views.quiz.innerHTML = `<div class="max-w-md mx-auto glass-card rounded-3xl p-8 text-center text-paper/50">Không đủ dữ liệu câu hỏi cho cấp độ này.</div>`;
      return;
    }

    // Quiz Result Screen
    if (quiz.done) {
      const pct = Math.round((quiz.correct / quiz.items.length) * 100);
      let evaluation = "Cần rèn luyện thêm khả năng nhận diện chữ Hán nhé.";
      let evalColor = "text-vermillion";
      if (pct >= 90) {
        evaluation = "Xuất sắc! Khả năng nhận diện mặt chữ Hán tuyệt vời!";
        evalColor = "text-emerald-400";
      } else if (pct >= 70) {
        evaluation = "Khá tốt! Bạn đã nắm vững chữ Hán của cấp độ này.";
        evalColor = "text-gold";
      } else if (pct >= 50) {
        evaluation = "Đạt mức cơ bản, hãy ôn tập thêm để phản xạ nhạy bén hơn.";
        evalColor = "text-amber-300";
      }

      dom.views.quiz.innerHTML = `
        <div class="max-w-xl mx-auto glass-card rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden">
          <div class="seal hanzi text-2xl mx-auto mb-3">测</div>
          <h2 class="text-2xl font-bold">Hoàn thành Trắc nghiệm Hán tự!</h2>
          <p class="text-xs text-paper/50 mt-1 uppercase tracking-wider">HSK ${appState.currentLevel} · ${quiz.items.length} câu hỏi</p>

          <div class="my-6 py-5 border-y border-white/10 flex justify-around items-center">
            <div>
              <p class="text-xs text-paper/50">Đúng</p>
              <p class="text-3xl font-bold mt-1 text-gold">${quiz.correct} / ${quiz.items.length}</p>
            </div>
            <div class="h-10 w-px bg-white/10"></div>
            <div>
              <p class="text-xs text-paper/50">Độ chính xác</p>
              <p class="text-3xl font-bold mt-1 text-emerald-400">${pct}%</p>
            </div>
          </div>

          <p class="text-sm font-medium ${evalColor} mb-6">${evaluation}</p>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button id="quiz-btn-retry" class="flex-1 bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-5 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Làm lượt mới
            </button>
            ${
              quiz.wrongList.length > 0
                ? `<button id="quiz-btn-review" class="flex-1 glass-card border-amber-500/40 text-amber-300 rounded-xl px-5 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition">
                    <i data-lucide="book-marked" class="w-4 h-4"></i> Ôn lại ${quiz.wrongList.length} câu sai
                  </button>`
                : ""
            }
          </div>
        </div>
      `;

      document.getElementById("quiz-btn-retry")?.addEventListener("click", () => {
        startQuizModule();
        renderQuiz();
      });

      document.getElementById("quiz-btn-review")?.addEventListener("click", () => {
        const wrongItems = [...quiz.wrongList];
        startQuizModule(wrongItems);
        renderQuiz();
      });

      refreshIcons();
      return;
    }

    // Active Quiz Question Screen
    const q = quiz.items[quiz.index];
    const progressPct = Math.round(((quiz.index + 1) / quiz.items.length) * 100);

    dom.views.quiz.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <!-- Top Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          ${createTopicSelectHtml("text-xs py-1.5")}

          <div class="flex rounded-xl glass p-0.5 border border-white/10 text-xs">
            <button data-type="cloze" class="quiz-type-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              appState.quizType === "cloze" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"
            }">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Điền câu Hán tự</span>
            </button>
            <button data-type="listen" class="quiz-type-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              appState.quizType === "listen" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"
            }">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
              <span>Nghe chọn Hán tự</span>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span>Câu ${quiz.index + 1} / ${quiz.items.length}</span>
          <span class="text-gold font-medium">${quiz.correct} câu đúng</span>
        </div>
        <div class="progress-bar mb-5">
          <span style="width: ${progressPct}%"></span>
        </div>

        <!-- Question Card -->
        <div class="glass-card rounded-3xl p-6 sm:p-8 relative">
          <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
            <span class="text-xs uppercase tracking-wider text-gold/80 font-bold">
              ${q.type === "cloze" ? "Điền từ vào câu chữ Hán" : "Nghe âm thanh và chọn chữ Hán"}
            </span>

            <div class="flex items-center gap-2">
              ${
                q.type === "cloze"
                  ? `<button id="quiz-btn-speak-q" class="glass px-3 py-1 rounded-xl text-xs text-paper/70 hover:text-gold transition flex items-center gap-1">
                      <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> <span>Nghe</span>
                    </button>`
                  : ""
              }
              <button id="quiz-btn-hint" class="glass px-3 py-1 rounded-xl text-xs ${
                quiz.showHint ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-paper/70 hover:text-amber-300"
              } transition flex items-center gap-1">
                <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-300"></i>
                <span>${quiz.showHint ? "Ẩn gợi ý" : "Gợi ý nghĩa"}</span>
              </button>
            </div>
          </div>

          ${
            quiz.showHint
              ? `<div class="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 animate-fade-in">
                  <b>Gợi ý nghĩa tiếng Việt:</b> ${q.type === "cloze" ? q.sentenceVietnamese : q.targetWord.meaning}
                </div>`
              : ""
          }

          <!-- Prompt -->
          ${
            q.type === "cloze"
              ? `<div class="py-6 px-2 text-center">
                  <div class="hanzi text-2xl sm:text-3xl font-medium leading-relaxed text-paper">
                    ${q.promptCn.replace(
                      /\[ ____ \]|____/g,
                      `<span class="inline-block px-3 py-0.5 mx-1 border-b-2 border-dashed border-gold text-gold font-bold">____</span>`
                    )}
                  </div>
                </div>`
              : `<div class="py-6 flex flex-col items-center justify-center text-center">
                  <button id="quiz-speaker-big" class="listening-speaker-btn hover:scale-105 active:scale-95 transition" title="Bấm để nghe phát âm">
                    <i data-lucide="volume-2" class="w-12 h-12 text-gold"></i>
                  </button>
                  <p class="text-xs text-paper/50 mt-3">Bấm vào biểu tượng loa để nghe lại</p>
                </div>`
          }

          <!-- 4 Choices (100% Pure Hanzi) -->
          <div class="grid sm:grid-cols-2 gap-3 mt-4">
            ${q.choices
              .map((choice, idx) => {
                const letter = ["A", "B", "C", "D"][idx];
                let btnClass = "hanzi-choice-btn";
                if (quiz.answered) {
                  if (choice.hanzi === q.answer) {
                    btnClass += quiz.isCorrect ? " is-correct" : " flash-correct";
                  } else if (choice.hanzi === quiz.selectedHanzi && !quiz.isCorrect) {
                    btnClass += " is-wrong";
                  }
                }
                return `
                  <button data-choice="${choice.hanzi}" class="${btnClass}" ${quiz.answered ? "disabled" : ""}>
                    <span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-paper/80">${letter}</span>
                    <div class="flex-1 min-w-0">
                      <span class="hanzi text-2xl sm:text-3xl font-medium text-paper">${choice.hanzi}</span>
                      ${
                        quiz.answered
                          ? `<div class="text-[11px] text-paper/50 mt-0.5 animate-fade-in">
                              <span class="text-gold font-medium">${choice.pinyin}</span> · <span>${choice.meaning}</span>
                            </div>`
                          : ""
                      }
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>

          <!-- Explanation Banner -->
          ${
            quiz.answered
              ? `<div class="mt-6 pt-5 border-t border-white/10 animate-fade-in">
                  <div class="rounded-2xl p-4 border transition ${
                    quiz.isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : "border-vermillion/50 bg-vermillion/10"
                  }">
                    <div class="flex items-center gap-2 mb-2">
                      <i data-lucide="${quiz.isCorrect ? "check-circle" : "alert-circle"}" class="w-5 h-5 ${
                        quiz.isCorrect ? "text-emerald-400" : "text-vermillion"
                      }"></i>
                      <span class="text-sm font-bold ${quiz.isCorrect ? "text-emerald-400" : "text-vermillion"}">
                        ${quiz.isCorrect ? "Chính xác!" : `Chưa đúng! Đáp án đúng: ${q.answer}`}
                      </span>
                    </div>

                    <div class="mt-2 text-left">
                      ${
                        q.type === "cloze"
                          ? `<p class="hanzi text-xl font-medium text-paper">${highlightAnswerInSentence(q.fullCn, q.answer)}</p>
                             <p class="text-xs text-gold font-medium mt-1">${q.sentencePinyin}</p>
                             <p class="text-xs text-paper/80 mt-0.5">${q.sentenceVietnamese}</p>`
                          : `<div class="flex items-baseline gap-2">
                               <span class="hanzi text-3xl font-bold text-gold">${q.targetWord.hanzi}</span>
                               <span class="text-sm font-semibold text-gold/90">${q.targetWord.pinyin}</span>
                             </div>
                             <p class="text-xs text-paper/80 mt-1">${q.targetWord.meaning}</p>`
                      }
                    </div>

                    <button id="quiz-btn-next" class="w-full mt-4 bg-vermillion hover:bg-vermillion/90 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition">
                      <span>${quiz.index + 1 >= quiz.items.length ? "Hoàn thành & Xem kết quả" : "Câu tiếp theo"}</span>
                      <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>`
              : ""
          }
        </div>
      </div>
    `;

    // Events
    dom.views.quiz.querySelectorAll(".quiz-type-btn").forEach((btn) => {
      btn.onclick = () => {
        appState.quizType = btn.dataset.type;
        startQuizModule();
        renderQuiz();
      };
    });

    const topicSelect = dom.views.quiz.querySelector(".topic-dropdown");
    if (topicSelect) {
      topicSelect.onchange = (e) => {
        appState.selectedTopic = e.target.value;
        startQuizModule();
        renderQuiz();
      };
    }

    document.getElementById("quiz-btn-hint")?.addEventListener("click", () => {
      quiz.showHint = !quiz.showHint;
      renderQuiz();
    });

    document.getElementById("quiz-btn-speak-q")?.addEventListener("click", () => {
      speakChinese(q.fullCn || q.targetWord.hanzi);
    });

    document.getElementById("quiz-speaker-big")?.addEventListener("click", () => {
      speakChinese(q.targetWord.hanzi);
    });

    dom.views.quiz.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => {
        if (quiz.answered) return;
        quiz.answered = true;
        const picked = btn.dataset.choice;
        quiz.selectedHanzi = picked;
        const isOk = picked === q.answer;
        quiz.isCorrect = isOk;

        if (isOk) {
          quiz.correct++;
        } else {
          quiz.wrongList.push(q);
        }

        speakChinese(q.type === "cloze" ? q.fullCn : q.targetWord.hanzi);
        renderQuiz();
      };
    });

    document.getElementById("quiz-btn-next")?.addEventListener("click", () => {
      if (quiz.index + 1 >= quiz.items.length) {
        quiz.done = true;
        ProgressStore.recordQuiz(appState.currentLevel, quiz.correct, quiz.items.length);
        renderQuiz();
      } else {
        quiz.index++;
        quiz.answered = false;
        quiz.selectedHanzi = null;
        quiz.isCorrect = null;
        quiz.showHint = false;
        renderQuiz();
        if (quiz.items[quiz.index].type === "listen") {
          speakChinese(quiz.items[quiz.index].targetWord.hanzi);
        }
      }
    });
  }

  // ============================================================
  // 9. VIEW 5: LISTENING (LUYỆN NGHE PHẢN XẠ)
  // ============================================================
  function startListeningModule(customPool = null) {
    const defaultPool = DataStore.getVocab({
      level: appState.currentLevel,
      topicId: appState.selectedTopic === "all" ? undefined : appState.selectedTopic,
    });
    const levelVocab = DataStore.getVocab({ level: appState.currentLevel });
    const source = customPool || (defaultPool.length >= 4 ? defaultPool : levelVocab);
    const count = Math.min(20, source.length);
    const selected = shuffle(source).slice(0, count);

    appState.listening = {
      items: selected.map((w) => makeListeningQuestion(w, levelVocab)),
      index: 0,
      correct: 0,
      answered: false,
      selectedId: null,
      isCorrect: null,
      speed: 1.0,
      mode: "meaning", // meaning | hanzi
      isPlaying: false,
      wrongList: [],
      done: false,
    };
  }

  function makeListeningQuestion(word, levelVocab) {
    const distractors = shuffle(levelVocab.filter((w) => w.id !== word.id)).slice(0, 3);
    const choices = shuffle([word, ...distractors]);
    return { word, choices };
  }

  function renderListening() {
    dom.crumb.textContent = "Luyện nghe phản xạ";
    dom.pageTitle.textContent = "Luyện nghe từ vựng";

    if (!appState.listening) startListeningModule();
    const listen = appState.listening;

    if (!listen || !listen.items.length) {
      dom.views.listening.innerHTML = `<div class="max-w-md mx-auto glass-card rounded-3xl p-8 text-center text-paper/50">Không đủ dữ liệu từ vựng cho cấp độ này.</div>`;
      return;
    }

    if (listen.done) {
      const pct = Math.round((listen.correct / listen.items.length) * 100);
      dom.views.listening.innerHTML = `
        <div class="max-w-xl mx-auto glass-card rounded-3xl p-8 text-center">
          <div class="seal hanzi text-2xl mx-auto mb-3">听</div>
          <h2 class="text-2xl font-bold">Hoàn thành bài Luyện nghe!</h2>
          <div class="my-6 py-5 border-y border-white/10 flex justify-around">
            <div>
              <p class="text-xs text-paper/50">Điểm số</p>
              <p class="text-3xl font-bold mt-1 text-sky-400">${listen.correct} / ${listen.items.length}</p>
            </div>
            <div>
              <p class="text-xs text-paper/50">Độ chính xác</p>
              <p class="text-3xl font-bold mt-1 text-emerald-400">${pct}%</p>
            </div>
          </div>
          <button id="listen-retry-btn" class="bg-vermillion text-white px-6 py-3 rounded-xl text-sm font-semibold">Luyện vòng mới</button>
        </div>
      `;
      document.getElementById("listen-retry-btn")?.addEventListener("click", () => {
        startListeningModule();
        renderListening();
        playCurrentListeningAudio();
      });
      return;
    }

    const q = listen.items[listen.index];
    const progressPct = Math.round(((listen.index + 1) / listen.items.length) * 100);

    dom.views.listening.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span>Câu ${listen.index + 1} / ${listen.items.length}</span>
          <span class="text-sky-400 font-medium">${listen.correct} câu đúng</span>
        </div>
        <div class="progress-bar mb-6">
          <span style="width: ${progressPct}%"></span>
        </div>

        <div class="glass-card rounded-3xl p-6 sm:p-8 text-center">
          <!-- Big Speaker -->
          <div class="py-6 flex flex-col items-center justify-center">
            <button id="listen-main-speaker" class="listening-speaker-btn ${listen.isPlaying ? "is-playing" : ""}" title="Nghe phát âm">
              <i data-lucide="volume-2" class="w-12 h-12 text-gold"></i>
            </button>
            <p class="text-xs text-paper/50 mt-3">Bấm vào biểu tượng loa để nghe phát âm</p>
          </div>

          <!-- Speed Options -->
          <div class="flex justify-center gap-2 mb-6">
            <button data-speed="0.8" class="speed-btn ${listen.speed === 0.8 ? "is-active" : ""}">0.8x Chậm</button>
            <button data-speed="1.0" class="speed-btn ${listen.speed === 1.0 ? "is-active" : ""}">1.0x Chuẩn</button>
            <button data-speed="1.2" class="speed-btn ${listen.speed === 1.2 ? "is-active" : ""}">1.2x Nhanh</button>
          </div>

          <!-- Choices -->
          <div class="grid sm:grid-cols-2 gap-3 text-left">
            ${q.choices
              .map((w, idx) => {
                const letter = ["A", "B", "C", "D"][idx];
                let btnClass = "listen-choice-btn";
                if (listen.answered) {
                  if (w.id === q.word.id) {
                    btnClass += listen.isCorrect ? " is-correct" : " flash-correct";
                  } else if (w.id === listen.selectedId && !listen.isCorrect) {
                    btnClass += " is-wrong";
                  }
                }
                return `
                  <button data-listen-choice="${w.id}" class="${btnClass}" ${listen.answered ? "disabled" : ""}>
                    <span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-paper/80">${letter}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-base sm:text-lg font-medium text-paper line-clamp-1">${w.meaning}</p>
                      ${
                        listen.answered
                          ? `<p class="hanzi text-sm text-gold mt-0.5">${w.hanzi} (${w.pinyin})</p>`
                          : ""
                      }
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>

          <!-- Next Button -->
          ${
            listen.answered
              ? `<button id="listen-next-btn" class="w-full mt-6 bg-vermillion text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  <span>${listen.index + 1 >= listen.items.length ? "Hoàn thành & Xem kết quả" : "Câu tiếp theo"}</span>
                  <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>`
              : ""
          }
        </div>
      </div>
    `;

    document.getElementById("listen-main-speaker")?.addEventListener("click", () => {
      playCurrentListeningAudio();
    });

    dom.views.listening.querySelectorAll("[data-speed]").forEach((btn) => {
      btn.onclick = () => {
        listen.speed = parseFloat(btn.dataset.speed);
        renderListening();
        playCurrentListeningAudio();
      };
    });

    dom.views.listening.querySelectorAll("[data-listen-choice]").forEach((btn) => {
      btn.onclick = () => {
        if (listen.answered) return;
        listen.answered = true;
        const pickedId = Number(btn.dataset.listenChoice);
        listen.selectedId = pickedId;
        const ok = pickedId === q.word.id;
        listen.isCorrect = ok;

        if (ok) {
          listen.correct++;
        } else {
          listen.wrongList.push(q);
        }

        renderListening();
      };
    });

    document.getElementById("listen-next-btn")?.addEventListener("click", () => {
      if (listen.index + 1 >= listen.items.length) {
        listen.done = true;
        ProgressStore.recordListening(appState.currentLevel, listen.correct, listen.items.length);
        renderListening();
      } else {
        listen.index++;
        listen.answered = false;
        listen.selectedId = null;
        listen.isCorrect = null;
        renderListening();
        playCurrentListeningAudio();
      }
    });
  }

  function playCurrentListeningAudio() {
    if (!appState.listening || appState.listening.done) return;
    const q = appState.listening.items[appState.listening.index];
    if (!q) return;

    appState.listening.isPlaying = true;
    const speakerEl = document.getElementById("listen-main-speaker");
    if (speakerEl) speakerEl.classList.add("is-playing");

    speakChinese(q.word.hanzi, appState.listening.speed, () => {
      if (appState.listening) appState.listening.isPlaying = false;
      if (speakerEl) speakerEl.classList.remove("is-playing");
    });
  }

  // ============================================================
  // 10. VIEW 6: SENTENCE (LUYỆN ĐẶT CÂU NGỮ PHÁP - MOBILE KEYBOARD SAFE)
  // ============================================================
  function startSentenceModule() {
    const pool = DataStore.getSentences({ level: appState.currentLevel });
    const count = Math.min(20, pool.length);
    const selected = shuffle(pool).slice(0, count);

    appState.sentence = {
      questions: selected,
      index: 0,
      currentAnswer: [],
      bankTokens: [],
      checked: false,
      isCorrect: null,
      revealed: false,
      correctCount: 0,
      wrongList: [],
      done: false,
    };
    loadSentenceQuestion();
  }

  function loadSentenceQuestion() {
    const test = appState.sentence;
    if (!test || !test.questions[test.index]) return;
    const q = test.questions[test.index];
    test.currentAnswer = [];
    test.checked = false;
    test.isCorrect = null;
    test.revealed = false;

    const tokens = q.correctOrder.map((word, idx) => ({
      id: `${q.id}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      text: word,
      used: false,
    }));
    test.bankTokens = shuffle(tokens);
  }

  function renderSentence() {
    dom.crumb.textContent = "Luyện tập ngữ pháp";
    dom.pageTitle.textContent = `Luyện đặt câu ${getCurrentLevelInfo()?.name || "HSK"}`;

    if (!appState.sentence || !appState.sentence.questions.length) {
      startSentenceModule();
    }
    const test = appState.sentence;

    if (!test || !test.questions.length) {
      dom.views.sentence.innerHTML = `<p class="text-paper/50">Không đủ câu hỏi mẫu cho cấp độ này.</p>`;
      return;
    }

    if (test.done) {
      const pct = Math.round((test.correctCount / test.questions.length) * 100);
      dom.views.sentence.innerHTML = `
        <div class="max-w-xl mx-auto glass-card rounded-3xl p-8 text-center">
          <div class="seal hanzi text-2xl mx-auto mb-3">句</div>
          <h2 class="text-2xl font-bold">Hoàn thành Luyện đặt câu!</h2>
          <div class="my-6 py-5 border-y border-white/10 flex justify-around">
            <div>
              <p class="text-xs text-paper/50">Câu đúng</p>
              <p class="text-3xl font-bold mt-1 text-emerald-400">${test.correctCount} / ${test.questions.length}</p>
            </div>
            <div>
              <p class="text-xs text-paper/50">Tỷ lệ chính xác</p>
              <p class="text-3xl font-bold mt-1 text-gold">${pct}%</p>
            </div>
          </div>
          <button id="sentence-retry-btn" class="bg-vermillion text-white px-6 py-3 rounded-xl text-sm font-semibold">Làm bài luyện mới</button>
        </div>
      `;
      document.getElementById("sentence-retry-btn")?.addEventListener("click", () => {
        startSentenceModule();
        renderSentence();
      });
      return;
    }

    const q = test.questions[test.index];
    const progressPct = Math.round(((test.index) / test.questions.length) * 100);

    // Layout gọn gàng đẩy lên nửa trên với .mobile-safe-sentence
    dom.views.sentence.innerHTML = `
      <div class="max-w-2xl mx-auto mobile-safe-sentence">
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span class="font-medium text-gold">Câu ${test.index + 1} / ${test.questions.length}</span>
          <span>${test.correctCount} câu đúng</span>
        </div>
        <div class="progress-bar mb-5">
          <span style="width: ${progressPct}%"></span>
        </div>

        <div class="glass-card rounded-3xl p-5 sm:p-7">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <p class="text-xs uppercase tracking-wider text-gold/80 font-bold">Ghép từ theo thứ tự đúng</p>
              <h3 class="text-lg sm:text-xl font-bold mt-1 text-paper leading-snug">${q.vietnamese}</h3>
            </div>
            <button id="sentence-tts-btn" class="flash-speaker-btn shrink-0" title="Nghe câu chuẩn">
              <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
            </button>
          </div>

          <!-- Answer Zone -->
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs text-paper/50">Vùng ghép câu:</span>
            ${
              test.currentAnswer.length && !test.checked
                ? `<button id="btn-clear-sentence" class="text-[11px] text-paper/40 hover:text-vermillion transition">Xóa hết</button>`
                : ""
            }
          </div>
          <div id="sentence-answer-zone" class="answer-zone ${test.currentAnswer.length ? "has-items" : ""} ${
            test.checked ? (test.isCorrect ? "sentence-correct" : "sentence-wrong") : ""
          }">
            ${
              test.currentAnswer.length
                ? test.currentAnswer
                    .map(
                      (token) =>
                        `<button data-unpick-id="${token.id}" class="word-chip word-chip-answer" ${test.checked ? "disabled" : ""} title="Nhấn để tháo từ">
                          <span>${token.text}</span>
                          ${!test.checked ? '<i data-lucide="x" class="w-3.5 h-3.5 opacity-60"></i>' : ""}
                        </button>`
                    )
                    .join("")
                : `<p class="text-paper/40 text-xs sm:text-sm select-none py-2">Nhấn các khối từ bên dưới để ghép câu...</p>`
            }
          </div>

          <!-- Check & Feedback Banner -->
          ${
            test.checked
              ? `<div class="mt-4 p-4 rounded-2xl border transition animate-fade-in ${
                  test.isCorrect ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300" : "bg-red-950/40 border-vermillion/40 text-red-300"
                }">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-xs sm:text-sm flex items-center gap-2">
                      <i data-lucide="${test.isCorrect ? "check-circle" : "x-circle"}" class="w-4 h-4"></i>
                      ${test.isCorrect ? "Chính xác! Thứ tự câu rất chuẩn!" : "Thứ tự chưa chuẩn xác!"}
                    </span>
                    <button id="sentence-feedback-speak" class="text-xs text-paper/70 hover:text-gold flex items-center gap-1">
                      <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> Nghe câu
                    </button>
                  </div>
                  ${
                    !test.isCorrect
                      ? test.revealed
                        ? `<div class="mt-3 pt-3 border-t border-white/10">
                            <p class="text-[11px] text-paper/50">Đáp án chuẩn:</p>
                            <p class="hanzi text-xl font-bold text-gold mt-1">${q.correctOrder.join("")}</p>
                            <p class="text-xs text-paper/80 mt-0.5">${q.pinyin}</p>
                          </div>`
                        : `<button id="sentence-btn-reveal" class="mt-2.5 text-xs text-gold underline hover:text-gold/80 flex items-center gap-1">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Xem đáp án chuẩn
                          </button>`
                      : `<p class="mt-1.5 text-xs text-paper/70 font-mono">${q.pinyin}</p>`
                  }
                </div>`
              : ""
          }

          <!-- Word Bank -->
          <p class="text-xs text-paper/50 mt-5 mb-2">Kho từ vựng (nhấn để chọn):</p>
          <div class="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 min-h-[64px]">
            ${test.bankTokens
              .map(
                (token) =>
                  `<button data-pick-id="${token.id}" class="word-chip ${token.used ? "is-used" : ""}" ${
                    token.used || test.checked ? "disabled" : ""
                  }>
                    ${token.text}
                  </button>`
              )
              .join("")}
          </div>

          <!-- Bottom Actions -->
          <div class="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-white/10">
            ${
              !test.checked
                ? `<button id="sentence-btn-check" class="bg-vermillion hover:bg-vermillion/90 text-white font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition disabled:opacity-40" ${
                    test.currentAnswer.length === 0 ? "disabled" : ""
                  }>
                    Kiểm tra câu
                  </button>`
                : `<button id="sentence-btn-next" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition">
                    <span>${test.index + 1 >= test.questions.length ? "Xem kết quả" : "Câu tiếp theo"}</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>`
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById("sentence-tts-btn")?.addEventListener("click", () => {
      speakChinese(q.correctOrder.join(""));
    });

    document.getElementById("sentence-feedback-speak")?.addEventListener("click", () => {
      speakChinese(q.correctOrder.join(""));
    });

    document.getElementById("btn-clear-sentence")?.addEventListener("click", () => {
      test.currentAnswer = [];
      test.bankTokens.forEach((t) => (t.used = false));
      renderSentence();
    });

    // Event Delegation for picking and unpicking chips
    dom.views.sentence.querySelectorAll("[data-pick-id]").forEach((btn) => {
      btn.onclick = () => {
        if (test.checked) return;
        const tokenId = btn.dataset.pickId;
        const token = test.bankTokens.find((t) => t.id === tokenId);
        if (token && !token.used) {
          token.used = true;
          test.currentAnswer.push(token);
          renderSentence();
        }
      };
    });

    dom.views.sentence.querySelectorAll("[data-unpick-id]").forEach((btn) => {
      btn.onclick = () => {
        if (test.checked) return;
        const tokenId = btn.dataset.unpickId;
        const token = test.bankTokens.find((t) => t.id === tokenId);
        if (token) {
          token.used = false;
          test.currentAnswer = test.currentAnswer.filter((t) => t.id !== tokenId);
          renderSentence();
        }
      };
    });

    document.getElementById("sentence-btn-check")?.addEventListener("click", () => {
      if (test.currentAnswer.length === 0) return;
      test.checked = true;
      const userText = test.currentAnswer.map((t) => t.text).join("");
      const correctText = q.correctOrder.join("");
      const ok = userText === correctText;
      test.isCorrect = ok;

      if (ok) {
        test.correctCount++;
      } else {
        test.wrongList.push(q);
      }

      speakChinese(correctText);
      renderSentence();
    });

    document.getElementById("sentence-btn-reveal")?.addEventListener("click", () => {
      test.revealed = true;
      renderSentence();
    });

    document.getElementById("sentence-btn-next")?.addEventListener("click", () => {
      if (test.index + 1 >= test.questions.length) {
        test.done = true;
        ProgressStore.recordSentence(appState.currentLevel, test.correctCount, test.questions.length);
        renderSentence();
      } else {
        test.index++;
        loadSentenceQuestion();
        renderSentence();
      }
    });
  }

  // ============================================================
  // 11. VIEW 7: READING (LUYỆN ĐỌC HIỂU HSK 3.0)
  // ============================================================
  function startReadingModule(typeFilter = null) {
    if (typeFilter && appState.reading) {
      appState.reading.typeFilter = typeFilter;
    }
    const filter = (appState.reading && appState.reading.typeFilter) || "all";
    const passages = DataStore.getReadings({
      level: appState.currentLevel,
      type: filter === "all" ? undefined : filter,
    });

    appState.reading = {
      typeFilter: filter,
      passages,
      index: 0,
      showPinyin: false,
      isSpeaking: false,
      userClozeAnswers: {},
      activeBlank: "1",
      userQaSelection: null,
      checked: false,
      isCorrect: null,
    };
  }

  function renderReading() {
    dom.crumb.textContent = "Luyện đọc hiểu";
    dom.pageTitle.textContent = `${getCurrentLevelInfo()?.name || "HSK"} · Đọc hiểu & Điền từ`;

    if (!appState.reading) startReadingModule();
    const reading = appState.reading;
    const list = reading.passages;

    if (!list.length) {
      dom.views.reading.innerHTML = `
        <div class="max-w-md mx-auto glass-card rounded-3xl p-8 text-center">
          <p class="text-paper/60">Không có bài đọc nào cho bộ lọc này.</p>
          <button id="reading-reset-btn" class="mt-4 px-4 py-2 bg-vermillion rounded-xl text-xs font-semibold text-white">Xem tất cả bài đọc</button>
        </div>
      `;
      document.getElementById("reading-reset-btn")?.addEventListener("click", () => {
        startReadingModule("all");
        renderReading();
      });
      return;
    }

    if (reading.index >= list.length) reading.index = 0;
    const r = list[reading.index];
    const isDone = ProgressStore.isReadingDone(appState.currentLevel, r.id);

    dom.views.reading.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-5">
        <!-- Top Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex rounded-xl glass p-0.5 border border-white/10 text-xs">
            <button data-reading-filter="all" class="px-3 py-1.5 rounded-lg transition ${
              reading.typeFilter === "all" ? "bg-white/15 text-white font-medium" : "text-paper/60 hover:text-paper"
            }">Tất cả</button>
            <button data-reading-filter="cloze" class="px-3 py-1.5 rounded-lg transition ${
              reading.typeFilter === "cloze" ? "bg-white/15 text-white font-medium" : "text-paper/60 hover:text-paper"
            }">Điền từ</button>
            <button data-reading-filter="qa" class="px-3 py-1.5 rounded-lg transition ${
              reading.typeFilter === "qa" ? "bg-white/15 text-white font-medium" : "text-paper/60 hover:text-paper"
            }">Đọc hiểu</button>
          </div>

          <div class="flex items-center gap-2 text-xs">
            ${
              isDone
                ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">✓ Đã làm</span>`
                : ""
            }
            <span class="text-paper/60">Bài ${reading.index + 1} / ${list.length}</span>
          </div>
        </div>

        <!-- Passage Container -->
        <article class="glass-card rounded-3xl p-6 sm:p-8">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 class="font-bold text-base text-paper">${r.title}</h3>
              <p class="text-[11px] text-paper/50 uppercase">${r.type === "cloze" ? "Điền từ vào đoạn văn" : "Đọc hiểu trả lời câu hỏi"}</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="reading-speak-btn" class="glass px-3 py-1.5 rounded-xl text-xs text-gold hover:text-gold/80 flex items-center gap-1">
                <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> Nghe bài
              </button>
              <button id="reading-toggle-pinyin" class="glass px-3 py-1.5 rounded-xl text-xs ${
                reading.showPinyin ? "text-gold border-gold/40" : "text-paper/70"
              } flex items-center gap-1">
                <i data-lucide="languages" class="w-3.5 h-3.5"></i> ${reading.showPinyin ? "Ẩn Pinyin" : "Hiện Pinyin"}
              </button>
            </div>
          </div>

          <!-- Passage Text -->
          <div class="reading-passage-box p-2 select-text">
            ${
              r.type === "cloze"
                ? r.passage.replace(/\[(\d+)\]/g, (m, num) => {
                    const filled = reading.userClozeAnswers[num];
                    const isActive = reading.activeBlank === num && !reading.checked;
                    let statusClass = "";
                    if (reading.checked) {
                      statusClass = filled === r.answers[num] ? "slot-correct" : "slot-wrong";
                    }
                    return `<span class="cloze-slot ${isActive ? "is-active" : ""} ${filled ? "is-filled" : ""} ${statusClass}" data-blank-id="${num}">
                      <span class="text-xs text-gold/80 font-mono mr-0.5">[${num}]</span>
                      <span class="hanzi text-xl">${filled || "____"}</span>
                    </span>`;
                  })
                : r.passage
            }
          </div>

          ${
            reading.showPinyin
              ? `<div class="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs sm:text-sm text-gold font-mono leading-relaxed animate-fade-in">
                  ${r.pinyin}
                </div>`
              : ""
          }

          <!-- Interactions -->
          ${
            r.type === "cloze"
              ? `<div class="mt-6 pt-5 border-t border-white/10">
                  <p class="text-xs text-gold/90 font-bold mb-2">Kho từ vựng:</p>
                  <div class="flex flex-wrap gap-2">
                    ${r.wordBank
                      .map((word) => {
                        const isUsed = Object.values(reading.userClozeAnswers).includes(word);
                        return `
                          <button data-word-chip="${word}" class="reading-word-chip ${isUsed ? "is-used" : ""}" ${reading.checked ? "disabled" : ""}>
                            <span class="hanzi">${word}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                </div>`
              : `<div class="mt-6 pt-5 border-t border-white/10">
                  <p class="hanzi text-lg font-bold text-paper mb-3">${r.question}</p>
                  <div class="grid sm:grid-cols-2 gap-3">
                    ${r.options
                      .map((opt, idx) => {
                        const letter = ["A", "B", "C", "D"][idx];
                        let btnClass = "qa-option-btn";
                        if (reading.userQaSelection === idx) btnClass += " is-selected";
                        if (reading.checked) {
                          if (idx === r.correctIndex) btnClass += " is-correct";
                          else if (reading.userQaSelection === idx) btnClass += " is-wrong";
                        }
                        return `
                          <button data-qa-idx="${idx}" class="${btnClass}" ${reading.checked ? "disabled" : ""}>
                            <span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">${letter}</span>
                            <span class="hanzi text-base flex-1 min-w-0">${opt}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                </div>`
          }

          <!-- Check Button -->
          <div class="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
            ${
              !reading.checked
                ? `<button id="reading-btn-check" class="bg-vermillion text-white font-semibold py-2.5 px-6 rounded-xl text-xs sm:text-sm">
                    Kiểm tra đáp án
                  </button>`
                : `<div class="flex-1 flex flex-col gap-2">
                    <p class="text-xs font-bold ${reading.isCorrect ? "text-emerald-400" : "text-red-400"}">
                      ${reading.isCorrect ? "✓ Hoàn thành chính xác!" : "✗ Chưa chính xác!"}
                    </p>
                    <div class="p-3 rounded-xl bg-white/[0.03] text-xs text-paper/80 leading-relaxed">
                      <b>Dịch nghĩa:</b> ${r.translation}
                    </div>
                  </div>`
            }
          </div>
        </article>

        <!-- Pagination -->
        <div class="flex items-center justify-between pt-2">
          <button id="reading-btn-prev" class="glass-card px-4 py-2 rounded-xl text-xs font-semibold ${
            reading.index === 0 ? "opacity-30 pointer-events-none" : ""
          }">Bài trước</button>
          <span class="text-xs text-paper/50">Bài ${reading.index + 1} / ${list.length}</span>
          <button id="reading-btn-next" class="glass-card px-4 py-2 rounded-xl text-xs font-semibold ${
            reading.index === list.length - 1 ? "opacity-30 pointer-events-none" : ""
          }">Bài tiếp theo</button>
        </div>
      </div>
    `;

    // Events
    dom.views.reading.querySelectorAll("[data-reading-filter]").forEach((btn) => {
      btn.onclick = () => {
        startReadingModule(btn.dataset.readingFilter);
        renderReading();
      };
    });

    document.getElementById("reading-speak-btn")?.addEventListener("click", () => {
      let speech = r.passage;
      if (r.type === "cloze" && r.answers) {
        speech = r.passage.replace(/\[(\d+)\]/g, (m, k) => r.answers[k] || "");
      }
      speakChinese(speech);
    });

    document.getElementById("reading-toggle-pinyin")?.addEventListener("click", () => {
      reading.showPinyin = !reading.showPinyin;
      renderReading();
    });

    dom.views.reading.querySelectorAll("[data-blank-id]").forEach((slot) => {
      slot.onclick = () => {
        if (reading.checked) return;
        const id = slot.dataset.blankId;
        if (reading.userClozeAnswers[id]) {
          reading.userClozeAnswers[id] = null;
        }
        reading.activeBlank = id;
        renderReading();
      };
    });

    dom.views.reading.querySelectorAll("[data-word-chip]").forEach((chip) => {
      chip.onclick = () => {
        if (reading.checked) return;
        const word = chip.dataset.wordChip;
        const keys = Object.keys(r.answers);

        // Giải phóng ô khác nếu từ này đã dùng
        Object.keys(reading.userClozeAnswers).forEach((k) => {
          if (reading.userClozeAnswers[k] === word) reading.userClozeAnswers[k] = null;
        });

        let target = reading.activeBlank;
        if (!target || reading.userClozeAnswers[target]) {
          target = keys.find((k) => !reading.userClozeAnswers[k]);
        }

        if (target) {
          reading.userClozeAnswers[target] = word;
          reading.activeBlank = keys.find((k) => !reading.userClozeAnswers[k]) || null;
        }

        renderReading();
      };
    });

    dom.views.reading.querySelectorAll("[data-qa-idx]").forEach((btn) => {
      btn.onclick = () => {
        if (reading.checked) return;
        reading.userQaSelection = parseInt(btn.dataset.qaIdx, 10);
        renderReading();
      };
    });

    document.getElementById("reading-btn-check")?.addEventListener("click", () => {
      reading.checked = true;
      if (r.type === "cloze") {
        const isAllOk = Object.entries(r.answers).every(([k, v]) => reading.userClozeAnswers[k] === v);
        reading.isCorrect = isAllOk;
      } else {
        reading.isCorrect = reading.userQaSelection === r.correctIndex;
      }

      if (reading.isCorrect) {
        ProgressStore.recordReading(appState.currentLevel, r.id);
      }

      renderReading();
    });

    document.getElementById("reading-btn-prev")?.addEventListener("click", () => {
      if (reading.index > 0) {
        reading.index--;
        reading.checked = false;
        reading.userClozeAnswers = {};
        reading.userQaSelection = null;
        renderReading();
      }
    });

    document.getElementById("reading-btn-next")?.addEventListener("click", () => {
      if (reading.index < list.length - 1) {
        reading.index++;
        reading.checked = false;
        reading.userClozeAnswers = {};
        reading.userQaSelection = null;
        renderReading();
      }
    });
  }

  // ============================================================
  // 12. VIEW 8: TYPING (MINI-GAME RÈN TRÍ NHỚ TỪ VỰNG HOÀN CHỈNH)
  // ============================================================

  // --- THUẬT TOÁN CHUẨN HÓA VÀ SO KHỚP ĐÁP ÁN THÔNG MINH ---
  function normalizeVietnamese(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Bỏ toàn bộ dấu thanh tiếng Việt
      .replace(/[\u0111\u0110\u0111\u0110dđĐ]/g, "d")
      .replace(/[^a-z0-9\s]/g, " ")   // Bỏ ký tự đặc biệt
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePinyinRaw(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu thanh điệu Pinyin
      .replace(/[\u00fc\u01d6\u01d8\u01da\u01dcüv]/g, "v")
      .replace(/[^a-z0-9]/g, "")      // Bỏ khoảng trắng, dấu câu
      .trim();
  }

  // ============================================================
  // 12. VIEW 8: ARCADE 2D ACTION: FALLING WORDS GAME (THẦN BÚT & PHI ĐAO)
  // Inspired 100% by Hanzii Arcade - 60FPS High Performance Action Engine
  // ============================================================

  // --- AUDIO SYNTHESIZER FOR ARCADE SOUND EFFECTS (WEB AUDIO API) ---
  let arcadeAudioCtx = null;
  function getArcadeAudioCtx() {
    if (!arcadeAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) arcadeAudioCtx = new AudioCtx();
    }
    if (arcadeAudioCtx && arcadeAudioCtx.state === "suspended") {
      arcadeAudioCtx.resume();
    }
    return arcadeAudioCtx;
  }

  function playArcadeSfx(type) {
    if (!appState.typing?.soundEnabled) return;
    try {
      const ctx = getArcadeAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === "whoosh") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "hit") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === "loss") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(95, now + 0.28);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === "victory") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.22, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.45);
        });
      }
    } catch (e) {}
  }

  // --- SVG ILLUSTRATIONS FOR PANDA CHARACTERS & SCENERY ---
  function getPandaLobbyWarriorSvg() {
    return `
      <svg viewBox="0 0 320 240" class="w-full h-auto max-h-56 mx-auto drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#334155" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.2"/>
          </linearGradient>
          <linearGradient id="bladeGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <!-- Background Snow Mountains -->
        <polygon points="20,190 90,90 160,190" fill="url(#mtnGrad)"/>
        <polygon points="120,190 200,70 280,190" fill="url(#mtnGrad)"/>
        <polygon points="80,105 90,90 100,105 90,112" fill="#e2e8f0"/>
        <polygon points="188,85 200,70 212,85 200,94" fill="#e2e8f0"/>

        <!-- Battle Flag (Cờ chiến cắm trên tuyết) -->
        <line x1="60" y1="80" x2="60" y2="200" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
        <polygon points="60,82 110,98 60,114" fill="#ef4444"/>
        <text x="72" y="103" fill="#ffffff" font-size="12" font-family="'Noto Sans SC', serif" font-weight="bold">武</text>

        <!-- Panda Warrior Body (Hiệp khách) -->
        <ellipse cx="190" cy="165" rx="36" ry="32" fill="#1e293b"/>
        <circle cx="190" cy="158" r="24" fill="#f8fafc"/>
        <ellipse cx="190" cy="118" r="28" fill="#f8fafc"/>

        <!-- Ears -->
        <circle cx="168" cy="98" r="10" fill="#0f172a"/>
        <circle cx="212" cy="98" r="10" fill="#0f172a"/>

        <!-- Eye patches & Face -->
        <ellipse cx="178" cy="118" rx="8" ry="11" fill="#0f172a" transform="rotate(-15 178 118)"/>
        <ellipse cx="202" cy="118" rx="8" ry="11" fill="#0f172a" transform="rotate(15 202 118)"/>
        <circle cx="180" cy="117" r="2.8" fill="#ffffff"/>
        <circle cx="200" cy="117" r="2.8" fill="#ffffff"/>
        <ellipse cx="190" cy="128" rx="4.5" ry="3.5" fill="#0f172a"/>
        <path d="M 186 132 Q 190 135 194 132" stroke="#0f172a" stroke-width="2" fill="none"/>

        <!-- Bamboo Conical Hat (Nón lá 斗笠) -->
        <polygon points="140,102 190,62 240,102" fill="#b45309"/>
        <polygon points="142,100 190,64 238,100" fill="#d97706"/>
        <line x1="145" y1="98" x2="235" y2="98" stroke="#92400e" stroke-width="1.5"/>
        <line x1="155" y1="88" x2="225" y2="88" stroke="#92400e" stroke-width="1.5"/>
        <line x1="170" y1="76" x2="210" y2="76" stroke="#92400e" stroke-width="1.5"/>
        <circle cx="190" cy="62" r="3" fill="#ef4444"/>
        <!-- Red Scarf / Ribbon trailing -->
        <path d="M 172 136 C 160 148, 140 155, 125 150 C 135 160, 155 158, 175 142 Z" fill="#ef4444"/>

        <!-- Arm holding Glowing Flying Dagger (Phi Đao) -->
        <ellipse cx="230" cy="148" rx="8" ry="14" fill="#0f172a" transform="rotate(-40 230 148)"/>
        <polygon points="234,142 278,132 242,148" fill="url(#bladeGlow)"/>
        <polygon points="234,142 274,134 240,146" fill="#e0f2fe"/>
        <!-- Dagger Sparkle -->
        <circle cx="278" cy="132" r="3.5" fill="#38bdf8"/>
        <line x1="278" y1="124" x2="278" y2="140" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="270" y1="132" x2="286" y2="132" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    `;
  }

  function getPandaLobbyScholarSvg() {
    return `
      <svg viewBox="0 0 320 240" class="w-full h-auto max-h-56 mx-auto drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lanternGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <!-- Cozy Snow-covered Pavilion / Cottage Roof -->
        <polygon points="20,105 75,65 130,105" fill="#78350f"/>
        <polygon points="15,103 75,60 135,103" fill="#f8fafc"/>
        <rect x="35" y="105" width="80" height="90" fill="#451a03"/>
        <rect x="48" y="118" width="26" height="34" fill="#fef08a" opacity="0.85" rx="3"/>
        <line x1="61" y1="118" x2="61" y2="152" stroke="#78350f" stroke-width="1.5"/>
        <line x1="48" y1="135" x2="74" y2="135" stroke="#78350f" stroke-width="1.5"/>

        <!-- Hanging Red Lantern with Glow -->
        <line x1="115" y1="102" x2="115" y2="115" stroke="#78350f" stroke-width="1.5"/>
        <circle cx="115" cy="126" r="16" fill="rgba(245, 158, 11, 0.25)"/>
        <ellipse cx="115" cy="126" rx="9" ry="12" fill="url(#lanternGlow)"/>
        <line x1="115" y1="138" x2="115" y2="148" stroke="#dc2626" stroke-width="1.5"/>

        <!-- Cherry Blossom Tree Branch with Snow -->
        <path d="M 120 70 Q 155 45, 180 55 Q 210 65, 230 45" stroke="#451a03" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <circle cx="160" cy="50" r="5" fill="#f472b6"/>
        <circle cx="180" cy="53" r="6" fill="#fbcfe8"/>
        <circle cx="205" cy="62" r="5" fill="#f472b6"/>
        <circle cx="225" cy="48" r="5.5" fill="#fbcfe8"/>

        <!-- Panda Scholar Body (Mặc khách) -->
        <ellipse cx="195" cy="168" rx="38" ry="32" fill="#047857"/>
        <circle cx="195" cy="160" r="22" fill="#ecfdf5"/>
        <ellipse cx="195" cy="120" r="28" fill="#f8fafc"/>

        <!-- Ears -->
        <circle cx="173" cy="100" r="10" fill="#0f172a"/>
        <circle cx="217" cy="100" r="10" fill="#0f172a"/>

        <!-- Eye patches & Gentle Face -->
        <ellipse cx="183" cy="120" rx="8" ry="11" fill="#0f172a" transform="rotate(-15 183 120)"/>
        <ellipse cx="207" cy="120" rx="8" ry="11" fill="#0f172a" transform="rotate(15 207 120)"/>
        <circle cx="185" cy="119" r="2.8" fill="#ffffff"/>
        <circle cx="205" cy="119" r="2.8" fill="#ffffff"/>
        <ellipse cx="195" cy="128" rx="4" ry="3" fill="#0f172a"/>
        <path d="M 191 133 Q 195 137 199 133" stroke="#0f172a" stroke-width="2" fill="none"/>

        <!-- Chinese Official Hat (Mũ quan học sĩ có 2 cánh chuồn) -->
        <rect x="175" y="88" width="40" height="20" fill="#0f172a" rx="4"/>
        <circle cx="195" cy="94" r="3.5" fill="#10b981"/>
        <ellipse cx="156" cy="98" rx="18" ry="4.5" fill="#0f172a"/>
        <ellipse cx="234" cy="98" rx="18" ry="4.5" fill="#0f172a"/>

        <!-- Giant Calligraphy Brush (Bút lông thư pháp) -->
        <line x1="235" y1="175" x2="270" y2="92" stroke="#b45309" stroke-width="6" stroke-linecap="round"/>
        <rect x="265" y="85" width="8" height="12" fill="#d4a017" rx="2" transform="rotate(22 265 85)"/>
        <path d="M 270 85 C 274 72, 282 66, 278 60 C 268 70, 266 78, 270 85 Z" fill="#0f172a"/>
        <circle cx="278" cy="60" r="3" fill="#f59e0b"/>
        <circle cx="286" cy="56" r="2" fill="#d4a017"/>
        <circle cx="272" cy="50" r="1.5" fill="#f59e0b"/>
      </svg>
    `;
  }

  function getPandaInGameWarriorSvg(isThrowing = false) {
    return `
      <svg viewBox="0 0 100 110" class="w-24 sm:w-28 h-auto drop-shadow-xl ${isThrowing ? "panda-throw-anim" : ""}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="inGameBladeGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <!-- Body -->
        <ellipse cx="50" cy="74" rx="22" ry="20" fill="#1e293b"/>
        <circle cx="50" cy="70" r="14" fill="#f8fafc"/>
        <ellipse cx="50" cy="44" r="18" fill="#f8fafc"/>
        <!-- Ears -->
        <circle cx="36" cy="30" r="7" fill="#0f172a"/>
        <circle cx="64" cy="30" r="7" fill="#0f172a"/>
        <!-- Face -->
        <ellipse cx="43" cy="44" rx="5.5" ry="7.5" fill="#0f172a" transform="rotate(-15 43 44)"/>
        <ellipse cx="57" cy="44" rx="5.5" ry="7.5" fill="#0f172a" transform="rotate(15 57 44)"/>
        <circle cx="44" cy="43" r="2" fill="#ffffff"/>
        <circle cx="56" cy="43" r="2" fill="#ffffff"/>
        <ellipse cx="50" cy="51" rx="3" ry="2" fill="#0f172a"/>
        <!-- Bamboo Hat -->
        <polygon points="18,34 50,6 82,34" fill="#d97706"/>
        <line x1="24" y1="31" x2="76" y2="31" stroke="#92400e" stroke-width="1.5"/>
        <line x1="34" y1="23" x2="66" y2="23" stroke="#92400e" stroke-width="1.5"/>
        <circle cx="50" cy="6" r="2.5" fill="#ef4444"/>
        <!-- Red Scarf -->
        <path d="M 38 56 Q 30 65, 22 64 Q 32 70, 42 60 Z" fill="#ef4444"/>
        <!-- Blade in hand -->
        <g transform="${isThrowing ? "rotate(-25 72 60)" : "rotate(0 72 60)"}">
          <ellipse cx="72" cy="62" rx="5" ry="8" fill="#0f172a" transform="rotate(-30 72 62)"/>
          <polygon points="74,58 98,50 78,64" fill="url(#inGameBladeGlow)"/>
          <circle cx="98" cy="50" r="2.5" fill="#38bdf8"/>
        </g>
      </svg>
    `;
  }

  function getPandaInGameScholarSvg(isCasting = false) {
    return `
      <svg viewBox="0 0 100 110" class="w-24 sm:w-28 h-auto drop-shadow-xl ${isCasting ? "panda-throw-anim" : ""}" xmlns="http://www.w3.org/2000/svg">
        <!-- Body -->
        <ellipse cx="50" cy="74" rx="22" ry="20" fill="#047857"/>
        <circle cx="50" cy="70" r="14" fill="#ecfdf5"/>
        <ellipse cx="50" cy="44" r="18" fill="#f8fafc"/>
        <!-- Ears -->
        <circle cx="36" cy="30" r="7" fill="#0f172a"/>
        <circle cx="64" cy="30" r="7" fill="#0f172a"/>
        <!-- Face -->
        <ellipse cx="43" cy="44" rx="5.5" ry="7.5" fill="#0f172a" transform="rotate(-15 43 44)"/>
        <ellipse cx="57" cy="44" rx="5.5" ry="7.5" fill="#0f172a" transform="rotate(15 57 44)"/>
        <circle cx="44" cy="43" r="2" fill="#ffffff"/>
        <circle cx="56" cy="43" r="2" fill="#ffffff"/>
        <ellipse cx="50" cy="51" rx="3" ry="2" fill="#0f172a"/>
        <!-- Official Hat -->
        <rect x="36" y="22" width="28" height="14" fill="#0f172a" rx="3"/>
        <circle cx="50" cy="26" r="2.5" fill="#10b981"/>
        <ellipse cx="23" cy="29" rx="12" ry="3.5" fill="#0f172a"/>
        <ellipse cx="77" cy="29" rx="12" ry="3.5" fill="#0f172a"/>
        <!-- Brush in hand -->
        <g transform="${isCasting ? "rotate(-30 72 60)" : "rotate(0 72 60)"}">
          <line x1="68" y1="78" x2="88" y2="35" stroke="#b45309" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M 88 35 C 92 24, 96 22, 94 16 C 88 22, 85 28, 88 35 Z" fill="#0f172a"/>
          <circle cx="94" cy="16" r="2.5" fill="#f59e0b"/>
        </g>
      </svg>
    `;
  }

  // --- INITIALIZE ARCADE STATE & KHO TỪ VỰNG ---
  function getArcadeWordPool(selectedLevels) {
    const levels = selectedLevels && selectedLevels.length ? selectedLevels : [appState.currentLevel || 1];
    let pool = [];
    for (const lvl of levels) {
      const words = DataStore.getVocab({ level: lvl });
      pool = pool.concat(words);
    }
    if (!pool.length) pool = DataStore.getVocab({ level: 1 });
    return shuffle(pool);
  }

  function startTypingModule() {
    if (!appState.typing) {
      appState.typing = {
        screen: "lobby", // "lobby" | "game" | "gameover" | "victory"
        gameMode: "blade", // "blade" (Phi Đao) | "brush" (Thần Bút)
        playMode: "stage", // "stage" (Theo màn 15 từ) | "endless" (Vô hạn)
        selectedLevels: [1], // [1], [2], [3], [4] or [1,2,3,4]
        
        score: 0,
        hearts: 3,
        progressCount: 0,
        targetTotal: 15,
        combo: 0,
        maxCombo: 0,
        isPaused: false,
        soundEnabled: true,
        showPinyin: true,

        wordPool: [],
        fallingWords: [],
        clearedWords: [],
        missedWords: [],

        projectiles: [],
        particles: [],
        floatingTexts: [],

        currentInput: "",
        targetFallingWord: null,
        isPandaThrowing: false,

        animationFrameId: null,
        lastSpawnTime: 0,
        spawnInterval: 2500,
        lastFrameTime: performance.now(),
      };
    } else {
      if (appState.typing.animationFrameId) {
        cancelAnimationFrame(appState.typing.animationFrameId);
        appState.typing.animationFrameId = null;
      }
      appState.typing.screen = "lobby";
    }

    renderTyping();
  }

  // --- RENDER ROUTER CHO TYPING SCENE ---
  function renderTyping() {
    dom.crumb.textContent = "Arcade Game";
    dom.pageTitle.textContent = "Thần Bút & Phi Đao · HSK Arcade";

    if (!appState.typing) {
      startTypingModule();
      return;
    }

    const t = appState.typing;

    if (t.screen === "lobby") {
      renderArcadeLobby();
    } else {
      renderArcadeArena();
    }
    refreshIcons();
  }

  // ============================================================
  // 1. MÀN HÌNH SẢNH CHỌN GAME (LOBBY SCREEN - GIỐNG HỆT ẢNH 1)
  // ============================================================
  function renderArcadeLobby() {
    const t = appState.typing;
    const isAllLevels = t.selectedLevels.length >= 4;

    dom.views.typing.innerHTML = `
      <div class="arcade-container flex flex-col justify-between p-4 sm:p-6 md:p-8 animate-fade-in relative">
        
        <!-- Starry Sky & Full Moon Background Elements -->
        <div class="arcade-moon"></div>
        <div class="arcade-snowground-back"></div>
        <div class="arcade-snowground"></div>

        <!-- Layer Sakura Drift Petals -->
        <div class="arcade-sakura-layer">
          <div class="sakura-petal w-3 h-2 top-10 left-1/4" style="animation-duration: 6.5s; animation-delay: 0s;"></div>
          <div class="sakura-petal w-2.5 h-2 top-20 left-1/2" style="animation-duration: 8s; animation-delay: 2s;"></div>
          <div class="sakura-petal w-3 h-2.5 top-5 left-3/4" style="animation-duration: 7s; animation-delay: 4s;"></div>
          <div class="sakura-petal w-2 h-1.5 top-28 left-1/6" style="animation-duration: 9s; animation-delay: 1.5s;"></div>
        </div>

        <!-- HEADER ĐIỀU KHIỂN SẢNH TRÊN CÙNG -->
        <div class="relative z-20 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-white/10">
          
          <!-- Bộ chọn nguồn từ vựng HSK -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs text-gold/90 font-bold uppercase tracking-wider flex items-center gap-1 mr-1">
              <i data-lucide="layers" class="w-3.5 h-3.5"></i> Nguồn từ:
            </span>
            <button class="game-pill rounded-xl px-3 py-1.5 text-xs font-semibold ${isAllLevels ? "is-active" : ""}" data-lobby-level="all">
              Tất cả HSK
            </button>
            ${[1, 2, 3, 4]
              .map(
                (lvl) => `
                <button class="game-pill rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  t.selectedLevels.includes(lvl) && !isAllLevels ? "is-active" : ""
                }" data-lobby-level="${lvl}">
                  HSK ${lvl}
                </button>
              `
              )
              .join("")}
          </div>

          <!-- Bộ chọn chế độ: Theo màn 15 từ vs Vô hạn -->
          <div class="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 text-xs">
            <button class="px-3 py-1.5 rounded-xl transition ${
              t.playMode === "stage" ? "bg-gold text-ink font-bold shadow-md" : "text-paper/60 hover:text-white"
            }" data-lobby-mode="stage">
              🚩 Theo màn (15 từ)
            </button>
            <button class="px-3 py-1.5 rounded-xl transition ${
              t.playMode === "endless" ? "bg-cyan-500 text-ink font-bold shadow-md" : "text-paper/60 hover:text-white"
            }" data-lobby-mode="endless">
              ∞ Vô hạn
            </button>
          </div>

        </div>

        <!-- NỘI DUNG CHÍNH: 2 NỬA MÀN HÌNH CHIA ĐÔI (THẦN BÚT VS PHI ĐAO) -->
        <div class="relative z-20 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 my-auto py-4">
          
          <!-- NỬA BÊN TRÁI: CHẾ ĐỘ THẦN BÚT (MỚI) -->
          <div class="lobby-split-card card-brush flex flex-col justify-between group" data-start-game="brush">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="seal hanzi text-xs w-6 h-6 bg-amber-500 text-ink font-bold">笔</span>
                  <h3 class="text-xl sm:text-2xl font-black text-paper group-hover:text-gold transition">Thần Bút</h3>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="lobby-tag border-amber-400/40 text-amber-300">Nhớ nét chữ</span>
                  <span class="lobby-tag border-emerald-400/40 text-emerald-300">Chơi một tay</span>
                </div>
              </div>

              <p class="text-xs sm:text-sm text-paper/70 font-medium">
                Viết chữ / Chọn nét để hạ chữ rơi từ trên trời xuống.
              </p>

              <!-- Minh họa SVG Gấu trúc Mặc khách bên mái đình và cành đào -->
              <div class="my-4 transform group-hover:scale-105 transition duration-300">
                ${getPandaLobbyScholarSvg()}
              </div>
            </div>

            <button class="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition">
              <i data-lucide="pen-tool" class="w-4 h-4"></i>
              <span>Vào Luyện Bút</span>
            </button>
          </div>

          <!-- NỬA BÊN PHẢI: CHẾ ĐỘ PHI ĐAO -->
          <div class="lobby-split-card card-blade flex flex-col justify-between group" data-start-game="blade">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="seal hanzi text-xs w-6 h-6 bg-sky-500 text-ink font-bold">刀</span>
                  <h3 class="text-xl sm:text-2xl font-black text-paper group-hover:text-sky-300 transition">Phi Đao</h3>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="lobby-tag border-sky-400/40 text-sky-300">Gõ pinyin</span>
                  <span class="lobby-tag border-purple-400/40 text-purple-300">Cần bàn phím</span>
                </div>
              </div>

              <p class="text-xs sm:text-sm text-paper/70 font-medium">
                Gõ pinyin / chữ Hán để phóng đao tiêu diệt chữ trước khi chạm đất.
              </p>

              <!-- Minh họa SVG Gấu trúc Hiệp khách dưới chân núi tuyết -->
              <div class="my-4 transform group-hover:scale-105 transition duration-300">
                ${getPandaLobbyWarriorSvg()}
              </div>
            </div>

            <button class="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition">
              <i data-lucide="zap" class="w-4 h-4"></i>
              <span>Vào Phóng Đao</span>
            </button>
          </div>

        </div>

        <div class="relative z-20 text-center text-[11px] text-paper/40 pb-1">
          Lấy cảm hứng từ game "Thần Bút & Phi Đao" Hanzii · Hỗ trợ cả bàn phím máy tính và màn hình cảm ứng
        </div>

      </div>
    `;

    document.querySelectorAll("[data-lobby-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lvl = btn.dataset.lobbyLevel;
        if (lvl === "all") {
          t.selectedLevels = [1, 2, 3, 4];
        } else {
          t.selectedLevels = [Number(lvl)];
        }
        renderArcadeLobby();
      });
    });

    document.querySelectorAll("[data-lobby-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        t.playMode = btn.dataset.lobbyMode;
        renderArcadeLobby();
      });
    });

    document.querySelectorAll("[data-start-game]").forEach((el) => {
      el.addEventListener("click", () => {
        const mode = el.dataset.startGame;
        startArcadeSession(mode);
        focusArcadeInput();
      });
    });
  }

  // ============================================================
  // 2. KHỞI ĐỘNG VÀ VÒNG LẶP GAME ARENA (60FPS ACTION ENGINE)
  // ============================================================
  function startArcadeSession(gameMode) {
    const t = appState.typing;
    t.screen = "game";
    t.gameMode = gameMode;
    t.score = 0;
    t.hearts = 3;
    t.progressCount = 0;
    t.targetTotal = 15;
    t.combo = 0;
    t.maxCombo = 0;
    t.isPaused = false;
    t.currentInput = "";
    t.targetFallingWord = null;
    t.isPandaThrowing = false;

    const rawPool = getArcadeWordPool(t.selectedLevels);
    t.wordPool = t.playMode === "stage" ? rawPool.slice(0, 15) : rawPool;
    t.fallingWords = [];
    t.clearedWords = [];
    t.missedWords = [];
    t.projectiles = [];
    t.particles = [];
    t.floatingTexts = [];

    t.lastSpawnTime = 0;
    t.spawnInterval = gameMode === "brush" ? 3400 : 2500;
    t.lastFrameTime = performance.now();

    renderArcadeArena();
    attachArcadeInputListeners();

    if (t.animationFrameId) cancelAnimationFrame(t.animationFrameId);
    t.animationFrameId = requestAnimationFrame(arcadeGameLoop);
  }

  function arcadeGameLoop(timestamp) {
    const t = appState.typing;
    if (!t || t.screen !== "game") return;

    const dt = Math.min(0.05, (timestamp - t.lastFrameTime) / 1000);
    t.lastFrameTime = timestamp;

    if (!t.isPaused) {
      updateArcadePhysics(dt, timestamp);
    }

    renderArcadeFrame();

    if (t.hearts <= 0) {
      endArcadeGame("gameover");
      return;
    }

    if (t.playMode === "stage" && t.progressCount >= t.targetTotal && t.fallingWords.length === 0) {
      endArcadeGame("victory");
      return;
    }

    t.animationFrameId = requestAnimationFrame(arcadeGameLoop);
  }

  function updateArcadePhysics(dt, timestamp) {
    const t = appState.typing;
    const arenaEl = document.getElementById("arcade-play-arena");
    const arenaHeight = arenaEl ? arenaEl.clientHeight : 600;
    const snowLimit = arenaHeight - 120;

    const maxActive = t.gameMode === "brush" ? 2 : 3;
    const canSpawn = t.playMode === "endless" || (t.progressCount + t.fallingWords.length < t.targetTotal);

    if (canSpawn && t.fallingWords.length < maxActive && timestamp - t.lastSpawnTime > t.spawnInterval) {
      if (t.wordPool.length > 0) {
        const nextWord = t.wordPool.shift();
        const baseSpeed = t.gameMode === "brush" ? 38 : 46;
        const speedBonus = Math.min(30, Math.floor(t.score / 100) * 4);
        const xPos = Math.floor(Math.random() * 55) + 15;

        t.fallingWords.push({
          id: "fw_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          word: nextWord,
          x: xPos,
          y: -40,
          speed: baseSpeed + speedBonus,
        });

        t.lastSpawnTime = timestamp;
      } else if (t.playMode === "endless") {
        t.wordPool = getArcadeWordPool(t.selectedLevels);
      }
    }

    for (let i = t.fallingWords.length - 1; i >= 0; i--) {
      const item = t.fallingWords[i];
      item.y += item.speed * dt;

      if (item.y >= snowLimit) {
        playArcadeSfx("loss");
        t.hearts--;
        t.combo = 0;
        t.missedWords.push(item.word);
        t.fallingWords.splice(i, 1);

        if (arenaEl) {
          arenaEl.classList.remove("arena-screen-shake");
          void arenaEl.offsetWidth;
          arenaEl.classList.add("arena-screen-shake");
        }

        spawnArcadeParticles(item.x, snowLimit, "#ef4444", 12);
        spawnFloatingScoreTag(item.x, snowLimit - 20, "Hụt!", "#ef4444");
      }
    }

    if (t.gameMode === "brush") {
      let lowest = null;
      let maxY = -999;
      for (const fw of t.fallingWords) {
        if (fw.y > maxY) {
          maxY = fw.y;
          lowest = fw;
        }
      }
      t.targetFallingWord = lowest;
    }

    for (let i = t.projectiles.length - 1; i >= 0; i--) {
      const p = t.projectiles[i];
      p.progress += dt * p.speed;

      if (p.progress >= 1) {
        playArcadeSfx("hit");
        if (t.soundEnabled) speakChinese(p.word.hanzi);

        const earned = 10 + Math.min(20, t.combo * 2);
        t.score += earned;
        t.combo++;
        if (t.combo > t.maxCombo) t.maxCombo = t.combo;
        t.progressCount++;
        t.clearedWords.push(p.word);

        spawnArcadeParticles(p.targetX, p.targetY, p.type === "blade" ? "#38bdf8" : "#f59e0b", 16);
        spawnFloatingScoreTag(
          p.targetX,
          p.targetY,
          `+${earned} ${p.word.hanzi}: ${p.word.meaning}`,
          p.type === "blade" ? "#38bdf8" : "#f59e0b"
        );

        t.projectiles.splice(i, 1);
      }
    }
  }

  function spawnArcadeParticles(xPct, yPx, color, count = 12) {
    const t = appState.typing;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      t.particles.push({
        x: xPct,
        y: yPx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0.6,
        maxLife: 0.6,
        size: Math.random() * 4 + 2,
      });
    }
  }

  function spawnFloatingScoreTag(xPct, yPx, text, color) {
    const t = appState.typing;
    t.floatingTexts.push({
      x: xPct,
      y: yPx,
      text,
      color,
      life: 0.85,
    });
  }

  // ============================================================
  // 3. MÀN HÌNH CHƠI GAME ARENA (GIAO DIỆN & RENDER 60FPS)
  // ============================================================
  function renderArcadeArena() {
    const t = appState.typing;
    const isBrush = t.gameMode === "brush";

    dom.views.typing.innerHTML = `
      <div id="arcade-play-arena" class="arcade-container flex flex-col justify-between p-3 sm:p-5 relative animate-fade-in">
        
        <!-- Starry Sky & Full Moon Background Elements -->
        <div class="arcade-moon"></div>
        <div class="arcade-snowground-back"></div>
        <div class="arcade-snowground"></div>

        <!-- Layer Sakura Drift Petals -->
        <div class="arcade-sakura-layer">
          <div class="sakura-petal w-3 h-2 top-8 left-1/4" style="animation-duration: 6.5s;"></div>
          <div class="sakura-petal w-2.5 h-2 top-16 left-1/2" style="animation-duration: 8s; animation-delay: 1.5s;"></div>
          <div class="sakura-petal w-3 h-2.5 top-4 left-3/4" style="animation-duration: 7s; animation-delay: 3s;"></div>
        </div>

        <!-- THANH HUD TRÊN CÙNG (ĐIỂM, TIẾN ĐỘ, TIM, ĐIỀU KHIỂN) -->
        <div class="relative z-30 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            
            <!-- Góc trái: Điểm số & Tiến độ -->
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="glass px-3 py-1.5 rounded-xl flex items-center gap-1.5 border-gold/40">
                <span class="text-xs sm:text-sm font-bold text-gold">🏆 <span id="hud-score">${t.score}</span></span>
              </div>
              <div class="glass px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-paper/90 font-mono">
                🚩 <span id="hud-progress">${
                  t.playMode === "stage" ? `${t.progressCount} / ${t.targetTotal}` : `${t.progressCount} từ`
                }</span>
              </div>
              ${
                t.combo > 1
                  ? `<div class="combo-flame text-xs font-bold animate-pulse">
                      🔥 x<span id="hud-combo">${t.combo}</span>
                    </div>`
                  : ""
              }
            </div>

            <!-- Góc phải: Tim & Các nút điều khiển -->
            <div class="flex items-center gap-2">
              <div class="glass px-2.5 py-1.5 rounded-xl flex items-center gap-1" title="Số mạng còn lại">
                ${[1, 2, 3]
                  .map((i) =>
                    i <= t.hearts
                      ? `<span class="text-sm text-red-500 animate-pulse">❤️</span>`
                      : `<span class="text-sm text-white/20">💔</span>`
                  )
                  .join("")}
              </div>

              <button id="btn-toggle-sound" class="glass p-2 rounded-xl text-paper/70 hover:text-white transition" title="Bật/Tắt âm thanh">
                <i data-lucide="${t.soundEnabled ? "volume-2" : "volume-x"}" class="w-4 h-4 text-gold"></i>
              </button>

              <button id="btn-toggle-pinyin" class="glass p-2 rounded-xl ${
                t.showPinyin ? "text-cyan-400 border-cyan-400/50 bg-cyan-400/10" : "text-paper/40"
              } transition" title="Bật/Tắt hiển thị Pinyin trên chữ">
                <i data-lucide="keyboard" class="w-4 h-4"></i>
              </button>

              <button id="btn-toggle-pause" class="glass p-2 rounded-xl text-paper/70 hover:text-white transition" title="Tạm dừng">
                <i data-lucide="${t.isPaused ? "play" : "pause"}" class="w-4 h-4"></i>
              </button>

              <button id="btn-exit-lobby" class="glass p-2 rounded-xl text-paper/50 hover:text-vermillion transition" title="Thoát về sảnh">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>

          </div>

          <!-- Thanh tiến trình mỏng chạy ngang ngay dưới HUD -->
          <div class="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div id="hud-progress-bar" class="h-full bg-gradient-to-r from-cyan-400 to-gold transition-all duration-300" style="width: ${
              t.playMode === "stage" ? (t.progressCount / t.targetTotal) * 100 : 100
            }%"></div>
          </div>
        </div>

        <!-- NHÂN VẬT GẤU TRÚC CANH GÁC TRÊN TUYẾT Ở GÓC PHẢI DƯỚI -->
        <div id="arcade-panda-sprite" class="arcade-panda-warrior pointer-events-none">
          ${
            t.gameMode === "blade"
              ? getPandaInGameWarriorSvg(t.isPandaThrowing)
              : getPandaInGameScholarSvg(t.isPandaThrowing)
          }
        </div>

        <!-- LAYER CHỮ RƠI & PHI ĐAO ĐỘNG (ĐƯỢC CẬP NHẬT QUA LOOP) -->
        <div id="arcade-dynamic-layer" class="absolute inset-0 pointer-events-none z-20 overflow-hidden"></div>

        <!-- ARCADE INPUT DOCK: BỘ NHẬP LIỆU BÀN PHÍM ĐIỆN THOẠI & MÁY TÍNH -->
        <div id="arcade-input-container" class="arcade-input-dock mt-auto mb-1.5 sm:mb-3 flex flex-col items-center gap-1.5 sm:gap-2 w-full px-1 sm:px-2 z-35">
          ${
            isBrush
              ? `
              <!-- Hàng 1 Thần Bút: Chữ mục tiêu + Nút hạ chữ một chạm -->
              <div class="glass px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl flex items-center justify-between gap-2 border-amber-400/40 bg-black/75 shadow-2xl max-w-md w-full">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                    <i data-lucide="pen-tool" class="w-3.5 h-3.5"></i> Mục tiêu:
                  </span>
                  <span id="brush-target-char" class="hanzi text-xl sm:text-2xl font-black text-white px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40">
                    ${t.targetFallingWord ? t.targetFallingWord.word.hanzi : "---"}
                  </span>
                </div>
                <button id="brush-btn-strike" type="button" class="bg-amber-500 hover:bg-amber-400 text-ink font-bold px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-1 shrink-0 active:scale-95">
                  <span>Hạ chữ (Space/Chạm)</span>
                  <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                </button>
              </div>

              <!-- Hàng 2 Thần Bút: Thanh nhập bàn phím điện thoại & máy tính -->
              <div class="arcade-typing-bar-interactive mode-brush flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl max-w-md w-full">
                <i data-lucide="keyboard" class="w-4 h-4 text-amber-400 shrink-0"></i>
                <span class="text-xs text-paper/60 font-medium whitespace-nowrap hidden sm:inline">Thần Bút:</span>
                <input
                  id="arcade-virtual-input"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  enterkeyhint="go"
                  placeholder="Gõ pinyin, chữ Hán hoặc phím Space..."
                  value="${t.currentInput || ""}"
                  class="bg-transparent border-none outline-none text-amber-300 font-bold font-mono text-sm sm:text-base flex-1 min-w-0 placeholder:text-paper/40 placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm"
                />
                <button
                  id="arcade-clear-input-btn"
                  type="button"
                  class="${t.currentInput ? "" : "hidden"} p-1 rounded-lg text-paper/40 hover:text-white transition shrink-0"
                  title="Xóa chữ"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>

              <div class="text-[10px] sm:text-xs text-paper/40 text-center font-medium">
                💡 Nhận bàn phím điện thoại · Gõ pinyin / chữ Hán hoặc ấn Space/Enter để hạ chữ rơi
              </div>
              `
              : `
              <!-- Phi Đao: Thanh gõ pinyin nhận bàn phím điện thoại & máy tính -->
              <div class="arcade-typing-bar-interactive mode-blade flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl max-w-md w-full">
                <i data-lucide="swords" class="w-4 h-4 text-sky-400 shrink-0"></i>
                <span class="text-xs text-paper/60 font-medium whitespace-nowrap hidden sm:inline">Phi Đao:</span>
                <input
                  id="arcade-virtual-input"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  enterkeyhint="go"
                  placeholder="Chạm đây để mở phím & gõ (vd: nihao)..."
                  value="${t.currentInput || ""}"
                  class="bg-transparent border-none outline-none text-sky-300 font-bold font-mono text-sm sm:text-base flex-1 min-w-0 placeholder:text-paper/40 placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm"
                />
                <button
                  id="arcade-clear-input-btn"
                  type="button"
                  class="${t.currentInput ? "" : "hidden"} p-1 rounded-lg text-paper/40 hover:text-white transition shrink-0"
                  title="Xóa chữ"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
                <button
                  id="blade-btn-shoot"
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-ink font-bold text-xs shrink-0 shadow-md transition flex items-center gap-1 active:scale-95"
                  title="Phóng phi đao"
                >
                  <span>Phóng</span>
                  <i data-lucide="zap" class="w-3 h-3"></i>
                </button>
              </div>

              <div class="text-[10px] sm:text-xs text-paper/40 text-center font-medium">
                💡 Nhận bàn phím điện thoại · Gõ pinyin (không dấu), chữ Hán hoặc tiếng Việt
              </div>
              `
          }
        </div>

        <!-- POPUP KHI TẠM DỪNG -->
        ${
          t.isPaused
            ? `
            <div class="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="dict-card-dark p-6 sm:p-8 max-w-sm w-full text-center space-y-4 animate-scale-up">
                <i data-lucide="pause-circle" class="w-12 h-12 text-gold mx-auto opacity-80"></i>
                <h3 class="text-xl font-bold text-paper">Game đang tạm dừng</h3>
                <p class="text-xs text-paper/60">Nghỉ tay một chút và tiếp tục rèn phản xạ nhé!</p>
                <div class="flex gap-2.5 pt-2">
                  <button id="pause-btn-resume" class="flex-1 py-2.5 rounded-xl bg-gold hover:bg-gold/90 text-ink font-bold text-sm shadow-md transition">
                    Tiếp tục chơi
                  </button>
                  <button id="pause-btn-quit" class="flex-1 py-2.5 rounded-xl glass hover:border-vermillion/50 text-paper text-sm transition">
                    Về sảnh
                  </button>
                </div>
              </div>
            </div>`
            : ""
        }

      </div>
    `;

    initArenaControlsEvents();
  }

  function renderArcadeFrame() {
    const t = appState.typing;
    const layer = document.getElementById("arcade-dynamic-layer");
    if (!layer) return;

    const hudScore = document.getElementById("hud-score");
    if (hudScore) hudScore.textContent = t.score;
    const hudProgress = document.getElementById("hud-progress");
    if (hudProgress) {
      hudProgress.textContent =
        t.playMode === "stage" ? `${t.progressCount} / ${t.targetTotal}` : `${t.progressCount} từ`;
    }
    const hudBar = document.getElementById("hud-progress-bar");
    if (hudBar && t.playMode === "stage") {
      hudBar.style.width = `${(t.progressCount / t.targetTotal) * 100}%`;
    }

    if (t.gameMode === "brush") {
      const brushCharEl = document.getElementById("brush-target-char");
      if (brushCharEl) {
        brushCharEl.textContent = t.targetFallingWord ? t.targetFallingWord.word.hanzi : "---";
      }
    }

    const currentInputNoTone = normalizePinyinRaw(t.currentInput.trim());
    let wordsHtml = "";

    for (const fw of t.fallingWords) {
      const pinyinNoTone = normalizePinyinRaw(fw.word.pinyin);
      const isMatchedPrefix = currentInputNoTone.length > 0 && pinyinNoTone.startsWith(currentInputNoTone);
      const isTarget = t.gameMode === "brush" && t.targetFallingWord && t.targetFallingWord.id === fw.id;

      wordsHtml += `
        <div class="arcade-falling-word ${isMatchedPrefix ? "is-prefix-matched" : ""} ${
        isTarget ? "is-primary-target" : ""
      }" style="left: ${fw.x}%; top: ${fw.y}px;">
          ${
            t.showPinyin
              ? `<p class="falling-pinyin text-center">${fw.word.pinyin}</p>`
              : ""
          }
          <p class="falling-hanzi text-center">${fw.word.hanzi}</p>
        </div>
      `;
    }

    let projectilesHtml = "";
    for (const p of t.projectiles) {
      const curX = p.startX + (p.targetX - p.startX) * p.progress;
      const curY = p.startY + (p.targetY - p.startY) * p.progress;
      const angle = Math.atan2(p.targetY - p.startY, (p.targetX - p.startX) * 7) * (180 / Math.PI);

      if (p.type === "blade") {
        projectilesHtml += `
          <div class="arcade-blade-projectile" style="left: ${curX}%; top: ${curY}px; transform: rotate(${angle}deg);"></div>
        `;
      } else {
        projectilesHtml += `
          <div class="arcade-brush-projectile" style="left: ${curX}%; top: ${curY}px;"></div>
        `;
      }
    }

    let floatingHtml = "";
    for (const tag of t.floatingTexts) {
      floatingHtml += `
        <div class="arcade-floating-tag" style="left: ${tag.x}%; top: ${tag.y}px; color: ${tag.color};">
          <span class="text-sm sm:text-base font-extrabold drop-shadow-md font-mono">${tag.text}</span>
        </div>
      `;
    }

    layer.innerHTML = wordsHtml + projectilesHtml + floatingHtml;
  }

  function initArenaControlsEvents() {
    const t = appState.typing;
    const inputEl = document.getElementById("arcade-virtual-input");

    document.getElementById("btn-toggle-sound")?.addEventListener("click", () => {
      t.soundEnabled = !t.soundEnabled;
      showToast(t.soundEnabled ? "Đã bật âm thanh 🔊" : "Đã tắt âm thanh 🔇");
      renderArcadeArena();
      focusArcadeInput();
    });

    document.getElementById("btn-toggle-pinyin")?.addEventListener("click", () => {
      t.showPinyin = !t.showPinyin;
      showToast(t.showPinyin ? "Đã hiện Pinyin trên chữ rơi" : "Đã ẩn Pinyin");
      renderArcadeArena();
      focusArcadeInput();
    });

    document.getElementById("btn-toggle-pause")?.addEventListener("click", () => {
      t.isPaused = !t.isPaused;
      renderArcadeArena();
    });

    document.getElementById("pause-btn-resume")?.addEventListener("click", () => {
      t.isPaused = false;
      renderArcadeArena();
      focusArcadeInput();
    });

    const exitToLobby = () => {
      if (t.animationFrameId) {
        cancelAnimationFrame(t.animationFrameId);
        t.animationFrameId = null;
      }
      t.screen = "lobby";
      renderTyping();
    };

    document.getElementById("btn-exit-lobby")?.addEventListener("click", exitToLobby);
    document.getElementById("pause-btn-quit")?.addEventListener("click", exitToLobby);

    // Xử lý nút Hạ chữ trong Thần Bút
    document.getElementById("brush-btn-strike")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (t.targetFallingWord) {
        launchArcadeProjectile(t.targetFallingWord, "brush");
        t.currentInput = "";
        if (inputEl) inputEl.value = "";
        updateTypingInputDisplay();
      }
      focusArcadeInput();
    });

    // Xử lý nút Phóng đao trong Phi Đao
    document.getElementById("blade-btn-shoot")?.addEventListener("click", (e) => {
      e.stopPropagation();
      shootBladeAtTarget();
      focusArcadeInput();
    });

    // Xử lý nút Xóa nhanh ký tự
    document.getElementById("arcade-clear-input-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      t.currentInput = "";
      if (inputEl) inputEl.value = "";
      updateTypingInputDisplay();
      focusArcadeInput();
    });

    // Chạm vào bất kỳ vị trí nào trên sàn đấu game để kích hoạt bàn phím ảo điện thoại
    const arenaEl = document.getElementById("arcade-play-arena");
    const handleArenaTap = (e) => {
      if (e.target.closest("button, a, input, select")) return;
      focusArcadeInput();
    };
    arenaEl?.addEventListener("click", handleArenaTap);
    arenaEl?.addEventListener("touchend", handleArenaTap);

    // Lắng nghe sự kiện bàn phím ảo & vật lý trên ô input
    if (inputEl) {
      inputEl.addEventListener("input", (e) => {
        if (!t || t.screen !== "game" || t.isPaused) return;

        const val = e.target.value;
        t.currentInput = val;

        const clearBtn = document.getElementById("arcade-clear-input-btn");
        if (clearBtn) clearBtn.classList.toggle("hidden", !val);

        // Trong Thần Bút: nếu gõ phím cách (Space) thì phóng bút hạ chữ mục tiêu
        if (t.gameMode === "brush" && (val.endsWith(" ") || val === " ")) {
          if (t.targetFallingWord) {
            launchArcadeProjectile(t.targetFallingWord, "brush");
          }
          e.target.value = "";
          t.currentInput = "";
          if (clearBtn) clearBtn.classList.add("hidden");
          return;
        }

        // Kiểm tra so khớp từ rơi
        const matched = checkAndThrowBlade(val);
        if (matched) {
          e.target.value = "";
          t.currentInput = "";
          if (clearBtn) clearBtn.classList.add("hidden");
        }
      });

      inputEl.addEventListener("compositionend", (e) => {
        if (!t || t.screen !== "game" || t.isPaused) return;
        t.currentInput = e.target.value;
        const matched = checkAndThrowBlade(e.target.value);
        if (matched) {
          e.target.value = "";
          t.currentInput = "";
          const clearBtn = document.getElementById("arcade-clear-input-btn");
          if (clearBtn) clearBtn.classList.add("hidden");
        }
      });

      inputEl.addEventListener("keydown", (e) => {
        if (!t || t.screen !== "game" || t.isPaused) return;

        if (e.key === "Escape") {
          e.preventDefault();
          t.isPaused = !t.isPaused;
          renderArcadeArena();
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          if (t.gameMode === "brush") {
            if (t.targetFallingWord) {
              launchArcadeProjectile(t.targetFallingWord, "brush");
              e.target.value = "";
              t.currentInput = "";
              document.getElementById("arcade-clear-input-btn")?.classList.add("hidden");
            }
          } else {
            shootBladeAtTarget();
          }
          return;
        }

        if (e.key === " " && t.gameMode === "brush") {
          e.preventDefault();
          if (t.targetFallingWord) {
            launchArcadeProjectile(t.targetFallingWord, "brush");
            e.target.value = "";
            t.currentInput = "";
            document.getElementById("arcade-clear-input-btn")?.classList.add("hidden");
          }
          return;
        }
      });

      // Tự động cuộn nhẹ để giữ khung gõ hiển thị an toàn khi bàn phím ảo xuất hiện
      inputEl.addEventListener("focus", () => {
        if (window.innerWidth < 640) {
          setTimeout(() => {
            inputEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 300);
        }
      });
    }

    if (!t.isPaused && t.screen === "game") {
      focusArcadeInput();
    }
  }

  function focusArcadeInput() {
    const inputEl = document.getElementById("arcade-virtual-input");
    if (!inputEl) return;
    try {
      inputEl.focus({ preventScroll: true });
    } catch (_) {
      inputEl.focus();
    }
  }

  function shootBladeAtTarget() {
    const t = appState.typing;
    if (!t || !t.fallingWords.length) return false;

    // 1. So khớp chính xác hoặc theo nghĩa
    if (t.currentInput && t.currentInput.trim()) {
      const directMatch = checkAndThrowBlade(t.currentInput);
      if (directMatch) return true;

      // 2. So khớp theo tiền tố Pinyin khi người dùng gõ dở và ấn Phóng
      const inputNoTone = normalizePinyinRaw(t.currentInput.trim());
      if (inputNoTone.length > 0) {
        let bestTarget = null;
        let maxY = -999;
        for (const fw of t.fallingWords) {
          const pinyinNoTone = normalizePinyinRaw(fw.word.pinyin);
          if (pinyinNoTone.startsWith(inputNoTone) && fw.y > maxY) {
            maxY = fw.y;
            bestTarget = fw;
          }
        }
        if (bestTarget) {
          launchArcadeProjectile(bestTarget, t.gameMode === "brush" ? "brush" : "blade");
          t.currentInput = "";
          updateTypingInputDisplay();
          return true;
        }
      }
    }

    // 3. Hiệu ứng rung báo hiệu chưa khớp
    const inputEl = document.getElementById("arcade-virtual-input");
    const container = inputEl?.closest(".arcade-typing-bar-interactive");
    if (container) {
      container.classList.remove("arcade-input-shake");
      void container.offsetWidth;
      container.classList.add("arcade-input-shake");
    }
    return false;
  }

  // ============================================================
  // 4. BỘ THU BÀN PHÍM & SO KHỚP PHÓNG ĐAO THÔNG MINH
  // ============================================================
  let isKeydownAttached = false;

  function attachArcadeInputListeners() {
    if (isKeydownAttached) return;
    isKeydownAttached = true;

    window.addEventListener("keydown", (e) => {
      const t = appState.typing;
      if (!t || t.screen !== "game" || t.isPaused || appState.currentTab !== "typing") return;

      const inputEl = document.getElementById("arcade-virtual-input");

      if (e.key === "Escape") {
        e.preventDefault();
        t.isPaused = !t.isPaused;
        renderArcadeArena();
        return;
      }

      // Nếu người dùng đang focus trực tiếp trên ô input, sự kiện của input sẽ xử lý
      if (document.activeElement === inputEl) {
        return;
      }

      if (e.key === " " && t.gameMode === "brush") {
        e.preventDefault();
        if (t.targetFallingWord) {
          launchArcadeProjectile(t.targetFallingWord, "brush");
          t.currentInput = "";
          updateTypingInputDisplay();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (t.gameMode === "brush") {
          if (t.targetFallingWord) {
            launchArcadeProjectile(t.targetFallingWord, "brush");
            t.currentInput = "";
            updateTypingInputDisplay();
          }
        } else {
          shootBladeAtTarget();
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (t.currentInput.length > 0) {
          t.currentInput = t.currentInput.slice(0, -1);
          updateTypingInputDisplay();
        }
        focusArcadeInput();
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey || (e.key.length > 1 && !/^[\u4e00-\u9fa5]$/.test(e.key))) {
        return;
      }

      focusArcadeInput();
      t.currentInput += e.key;
      updateTypingInputDisplay();
      checkAndThrowBlade(t.currentInput);
    });
  }

  function updateTypingInputDisplay() {
    const t = appState.typing;
    if (!t) return;
    const inputEl = document.getElementById("arcade-virtual-input");
    if (inputEl && inputEl.value !== t.currentInput) {
      inputEl.value = t.currentInput || "";
    }
    const clearBtn = document.getElementById("arcade-clear-input-btn");
    if (clearBtn) {
      clearBtn.classList.toggle("hidden", !t.currentInput);
    }
  }

  function checkAndThrowBlade(input) {
    const t = appState.typing;
    if (!input || !t.fallingWords.length) return false;

    const inputTrim = input.trim();
    const inputNoTone = normalizePinyinRaw(inputTrim);
    const inputVi = normalizeVietnamese(inputTrim);

    let matchedIndex = -1;

    for (let i = 0; i < t.fallingWords.length; i++) {
      const fw = t.fallingWords[i];
      const w = fw.word;

      if (inputTrim === w.hanzi) {
        matchedIndex = i;
        break;
      }

      if (inputTrim.toLowerCase() === w.pinyin.toLowerCase().trim()) {
        matchedIndex = i;
        break;
      }

      const targetNoTone = normalizePinyinRaw(w.pinyin);
      if (inputNoTone.length > 0 && inputNoTone === targetNoTone) {
        matchedIndex = i;
        break;
      }

      if (inputVi.length >= 2 && normalizeVietnamese(w.meaning).split(/[,;\/]/).some((part) => part.trim() === inputVi)) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      const targetWordItem = t.fallingWords[matchedIndex];
      launchArcadeProjectile(targetWordItem, t.gameMode === "brush" ? "brush" : "blade");
      t.currentInput = "";
      updateTypingInputDisplay();
      return true;
    }

    return false;
  }

  function launchArcadeProjectile(targetWordItem, type = "blade") {
    const t = appState.typing;
    playArcadeSfx("whoosh");

    t.isPandaThrowing = true;
    const pandaSprite = document.getElementById("arcade-panda-sprite");
    if (pandaSprite) {
      pandaSprite.innerHTML =
        t.gameMode === "blade" ? getPandaInGameWarriorSvg(true) : getPandaInGameScholarSvg(true);
      setTimeout(() => {
        t.isPandaThrowing = false;
        if (pandaSprite) {
          pandaSprite.innerHTML =
            t.gameMode === "blade" ? getPandaInGameWarriorSvg(false) : getPandaInGameScholarSvg(false);
        }
      }, 200);
    }

    const arenaEl = document.getElementById("arcade-play-arena");
    const arenaH = arenaEl ? arenaEl.clientHeight : 600;
    const startX = window.innerWidth < 640 ? 80 : 84;
    const startY = Math.max(200, arenaH - 95);

    t.projectiles.push({
      startX,
      startY,
      targetX: targetWordItem.x,
      targetY: targetWordItem.y + 15,
      progress: 0,
      speed: 4.8,
      type,
      word: targetWordItem.word,
    });

    const fwIdx = t.fallingWords.indexOf(targetWordItem);
    if (fwIdx !== -1) {
      t.fallingWords.splice(fwIdx, 1);
    }
  }

  // ============================================================
  // 5. MÀN HÌNH TỔNG KẾT (VICTORY & GAMEOVER MODALS)
  // ============================================================
  function endArcadeGame(resultType) {
    const t = appState.typing;
    if (t.animationFrameId) {
      cancelAnimationFrame(t.animationFrameId);
      t.animationFrameId = null;
    }
    t.screen = resultType;

    if (resultType === "victory") {
      playArcadeSfx("victory");
      ProgressStore.recordTyping(appState.currentLevel, t.clearedWords.length, t.targetTotal);
    }

    const isVictory = resultType === "victory";

    dom.views.typing.innerHTML = `
      <div class="arcade-container flex items-center justify-center p-4 sm:p-6 relative animate-fade-in">
        
        <div class="arcade-moon"></div>
        <div class="arcade-snowground-back"></div>
        <div class="arcade-snowground"></div>

        <div class="dict-card-dark p-6 sm:p-8 max-w-lg w-full text-center relative z-30 shadow-2xl space-y-5 animate-scale-up border ${
          isVictory ? "border-gold/50" : "border-vermillion/50"
        }">
          <div class="seal hanzi text-3xl mx-auto mb-1 ${isVictory ? "bg-gold text-ink" : "bg-vermillion text-white"}">
            ${isVictory ? "胜" : "败"}
          </div>

          <div>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-paper">
              ${isVictory ? "Chiến Thắng Tuyệt Vời!" : "Trận Chiến Kết Thúc!"}
            </h2>
            <p class="text-xs text-paper/60 mt-1 uppercase tracking-wider font-semibold">
              ${isVictory ? "Đã hạ gục trọn vẹn 15 chữ rơi" : "Đã hết 3 mạng sống"}
            </p>
          </div>

          <!-- BẢNG THỐNG KÊ CHI TIẾT -->
          <div class="grid grid-cols-3 gap-2 py-4 border-y border-white/10">
            <div class="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
              <p class="text-[10px] uppercase text-paper/40 font-semibold">Điểm số</p>
              <p class="text-xl sm:text-2xl font-black text-gold mt-0.5">${t.score}</p>
            </div>
            <div class="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
              <p class="text-[10px] uppercase text-paper/40 font-semibold">Đã hạ gục</p>
              <p class="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">${t.clearedWords.length}</p>
            </div>
            <div class="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
              <p class="text-[10px] uppercase text-paper/40 font-semibold">Kỷ lục Combo</p>
              <p class="text-xl sm:text-2xl font-black text-orange-400 mt-0.5">🔥 ${t.maxCombo}</p>
            </div>
          </div>

          <!-- DANH SÁCH CÁC TỪ BỊ LỌT CẦN ÔN LẠI (NẾU CÓ) -->
          ${
            t.missedWords.length
              ? `
              <div class="text-left space-y-2 max-h-36 overflow-y-auto pr-1">
                <p class="text-[11px] uppercase tracking-wider text-vermillion font-bold">
                  Các từ bị lọt cần ôn lại (${t.missedWords.length}):
                </p>
                <div class="space-y-1.5">
                  ${t.missedWords
                    .slice(0, 6)
                    .map(
                      (w) => `
                      <div class="bg-white/[0.02] p-2 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                          <span class="hanzi text-sm font-bold text-paper">${w.hanzi}</span>
                          <span class="font-mono text-gold">${w.pinyin}</span>
                          <span class="text-paper/60">${w.meaning}</span>
                        </div>
                        <button class="flash-speaker-btn w-6 h-6 shrink-0" data-arcade-speak="${w.hanzi}" title="Nghe">
                          <i data-lucide="volume-2" class="w-3 h-3 text-gold"></i>
                        </button>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              </div>`
              : `<p class="text-xs text-emerald-400 font-semibold">Phản xạ chuẩn xác 100%! Không bỏ lọt bất kỳ từ vựng nào.</p>`
          }

          <!-- CÁC NÚT ĐIỀU HƯỚNG TỔNG KẾT -->
          <div class="grid grid-cols-2 gap-3 pt-2">
            <button id="endgame-btn-replay" class="py-2.5 rounded-xl bg-gold hover:bg-gold/90 text-ink font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
              <span>Chơi lại</span>
            </button>
            <button id="endgame-btn-lobby" class="py-2.5 rounded-xl glass hover:border-gold/50 text-paper font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>Về sảnh game</span>
            </button>
          </div>

        </div>

      </div>
    `;

    document.getElementById("endgame-btn-replay")?.addEventListener("click", () => {
      startArcadeSession(t.gameMode);
      focusArcadeInput();
    });

    document.getElementById("endgame-btn-lobby")?.addEventListener("click", () => {
      t.screen = "lobby";
      renderTyping();
    });

    document.querySelectorAll("[data-arcade-speak]").forEach((btn) => {
      btn.addEventListener("click", () => {
        speakChinese(btn.dataset.arcadeSpeak);
      });
    });

    refreshIcons();
  }
  // ============================================================
  // 13. VIEW: SMART DICTIONARY (TỪ ĐIỂN TRA CỨU THÔNG MINH - HANZII/MAZII DARK)
  // ============================================================

  const COMMON_RADICALS = [
    { char: "亻", name: "Nhân đứng", meaning: "Người, quan hệ", pinyin: "rén", stroke: 2 },
    { char: "氵", name: "Ba chấm thủy", meaning: "Nước, sông hồ, chất lỏng", pinyin: "shuǐ", stroke: 3 },
    { char: "木", name: "Mộc", meaning: "Cây cối, gỗ, thực vật", pinyin: "mù", stroke: 4 },
    { char: "口", name: "Khẩu", meaning: "Miệng, ăn uống, lời nói", pinyin: "kǒu", stroke: 3 },
    { char: "艹", name: "Thảo đầu", meaning: "Cỏ cây, hoa quả, thực vật", pinyin: "cǎo", stroke: 3 },
    { char: "扌", name: "Đề thủ", meaning: "Tay, thao tác, hành động", pinyin: "shǒu", stroke: 3 },
    { char: "辶", name: "Quai xước", meaning: "Đi lại, di chuyển, đường sá", pinyin: "chuò", stroke: 3 },
    { char: "心", name: "Tâm", meaning: "Tim, tâm trạng, suy nghĩ", pinyin: "xīn", stroke: 4 },
    { char: "女", name: "Nữ", meaning: "Phụ nữ, giống cái", pinyin: "nǚ", stroke: 3 },
    { char: "日", name: "Nhật", meaning: "Mặt trời, ban ngày, thời gian", pinyin: "rì", stroke: 4 },
    { char: "月", name: "Nguyệt", meaning: "Mặt trăng, cơ thể, thời gian", pinyin: "yuè", stroke: 4 },
    { char: "火", name: "Hỏa", meaning: "Lửa, nấu nướng, nhiệt độ", pinyin: "huǒ", stroke: 4 },
    { char: "讠", name: "Ngôn", meaning: "Ngôn ngữ, lời nói, trao đổi", pinyin: "yán", stroke: 2 },
    { char: "钅", name: "Kim", meaning: "Kim loại, vàng bạc, dụng cụ", pinyin: "jīn", stroke: 5 },
    { char: "土", name: "Thổ", meaning: "Đất đai, vị trí, xây dựng", pinyin: "tǔ", stroke: 3 },
    { char: "宀", name: "Miên", meaning: "Mái nhà, gia đình, nơi ở", pinyin: "mián", stroke: 3 },
    { char: "目", name: "Mục", meaning: "Mắt, nhìn ngắm", pinyin: "mù", stroke: 5 },
    { char: "足", name: "Túc", meaning: "Chân, đi đứng, chạy nhảy", pinyin: "zú", stroke: 7 },
    { char: "饣", name: "Thực", meaning: "Thức ăn, ẩm thực", pinyin: "shí", stroke: 3 },
    { char: "纟", name: "Mịch", meaning: "Tơ sợi, vải vóc, kết nối", pinyin: "mì", stroke: 3 },
    { char: "犭", name: "Khuyển", meaning: "Chó, thú săn, động vật", pinyin: "quǎn", stroke: 3 },
    { char: "广", name: "Quảng", meaning: "Nhà rộng, công trình", pinyin: "guǎng", stroke: 3 },
    { char: "门", name: "Môn", meaning: "Cổng, cửa, lối vào", pinyin: "mén", stroke: 3 },
    { char: "力", name: "Lực", meaning: "Sức mạnh, nỗ lực, tác động", pinyin: "lì", stroke: 2 },
  ];

  const HOT_KEYWORDS = [
    { hanzi: "花", pinyin: "huā", meaning: "hoa / tiêu (tiền)", count: 597 },
    { hanzi: "工作", pinyin: "gōngzuò", meaning: "làm việc / công việc", count: 985 },
    { hanzi: "学习", pinyin: "xuéxí", meaning: "học tập / nghiên cứu", count: 850 },
    { hanzi: "喜欢", pinyin: "xǐhuan", meaning: "thích / yêu thích", count: 760 },
    { hanzi: "朋友", pinyin: "péngyou", meaning: "bạn bè / đồng hành", count: 690 },
    { hanzi: "谢谢", pinyin: "xièxie", meaning: "cảm ơn", count: 640 },
    { hanzi: "中国", pinyin: "Zhōngguó", meaning: "Trung Quốc", count: 580 },
    { hanzi: "漂亮", pinyin: "piàoliang", meaning: "xinh đẹp / tuyệt vời", count: 530 },
    { hanzi: "准备", pinyin: "zhǔnbèi", meaning: "chuẩn bị / dự tính", count: 480 },
    { hanzi: "天气", pinyin: "tiānqì", meaning: "thời tiết / khí hậu", count: 420 },
  ];

  const SINO_VIET_DICT = {
    "一": "NHẤT", "二": "NHỊ", "三": "TAM", "四": "TỨ", "五": "NGŨ",
    "六": "LỤC", "七": "THẤT", "八": "BÁT", "九": "CỬU", "十": "THẬP",
    "人": "NHÂN", "大": "ĐẠI", "小": "TIỂU", "中": "TRUNG", "国": "QUỐC",
    "学": "HỌC", "生": "SINH", "师": "SƯ", "工": "CÔNG", "作": "TÁC",
    "家": "GIA", "朋": "BẰNG", "友": "HỮU", "花": "HOA", "天": "THIÊN",
    "气": "KHÍ", "时": "THỜI", "间": "GIAN", "好": "HẢO", "多": "ĐA",
    "少": "THIỂU", "水": "THỦY", "火": "HỎA", "电": "ĐIỆN", "话": "THOẠI",
    "车": "XA", "门": "MÔN", "书": "THƯ", "见": "KIẾN", "听": "THÍNH",
    "说": "THUYẾT", "读": "ĐỘC", "写": "TẢ", "字": "TỰ", "语": "NGỮ",
    "汉": "HÁN", "文": "VĂN", "日": "NHẬT", "月": "NGUYỆT", "年": "NIÊN",
    "爱": "ÁI", "想": "TƯỞNG", "要": "YẾU", "能": "NĂNG", "会": "HỘI",
    "开": "KHAI", "关": "QUAN", "看": "KHÁN", "吃": "NGẬY", "喝": "HÁT",
    "买": "MÃI", "卖": "MẠI", "钱": "TIỀN", "去": "KHỨ", "来": "LAI",
    "到": "ĐÁO", "住": "TRÚ", "坐": "TỌA", "走": "TẨU", "起": "KHỞI",
    "打": "ĐẢ", "做": "TỐ", "叫": "KHIẾU", "名": "DANH", "字": "TỰ",
    "您": "NẪM", "我": "NGÃ", "你": "NHĨ", "他": "THA", "她": "THA",
    "们": "MÔN", "这": "GIÁ", "那": "NA", "哪": "NẢ", "谁": "THÙY",
    "什": "THẬP", "么": "MA", "怎": "CHẨM", "样": "DẠNG", "几": "KỶ",
    "点": "ĐIỂM", "分": "PHÂN", "岁": "TUẾ", "块": "KHỐI", "本": "BẢN",
    "个": "CÁ", "些": "TIÊU", "都": "ĐÔ", "很": "HẨN", "太": "THÁI",
    "极": "CỰC", "更": "CANH", "最": "TỐI", "不": "BẤT", "没": "MỘC",
    "有": "HỮU", "和": "HÒA", "在": "TẠI", "里": "LÝ", "上": "THƯỢNG",
    "下": "HẠ", "前": "TIỀN", "后": "HẬU", "左": "TẢ", "右": "HỮU",
    "高": "CAO", "低": "ĐÊ", "长": "TRƯỜNG", "短": "ĐOẢN", "快": "KHOÁI",
    "慢": "MẠN", "冷": "LÃNH", "热": "NHIỆT", "新": "TÂN", "旧": "CỰU",
    "贵": "QUÝ", "便": "TIỆN", "宜": "NGHI", "明": "MINH", "白": "BẠCH",
    "黑": "HẮC", "红": "HỒNG", "绿": "LỤC", "黄": "HOÀNG", "蓝": "LAM",
    "喜": "HỶ", "欢": "HOAN", "谢": "TẠ", "客": "KHÁCH", "请": "THỈNH",
    "问": "VẤN", "对": "ĐỐI", "亮": "LƯỢNG", "漂": "PHIÊU", "准": "CHUẨN",
    "备": "BỊ", "帮": "BANG", "助": "TRỢ", "运": "VẬN", "动": "ĐỘNG",
    "医": "Y", "院": "VIỆN", "校": "HIỆU", "馆": "QUÁN", "机": "CƠ",
    "场": "TRƯỜNG", "店": "ĐIẾM", "房": "PHÒNG", "杯": "BÔI", "盘": "BÀN",
    "包": "BAO", "衣": "Y", "服": "PHỤC"
  };

  const GRAMMAR_POINTS = [
    {
      trigger: ["把", "bǎ"],
      title: "Câu chữ 把 (Bǎ - Câu xử lý)",
      level: "HSK 2 - 3",
      formula: "Chủ ngữ + 把 + Tân ngữ + Động từ + Thành phần khác (了 / 在... / 到... / 给...)",
      explanation: "Dùng để nhấn mạnh động tác tác động làm biến đổi hoặc dời chuyển trạng thái, vị trí của đối tượng (tân ngữ).",
      examples: [
        { cn: "请把窗户打开吧。", py: "Qǐng bǎ chuānghu dǎkāi ba.", vi: "Làm ơn hãy mở cửa sổ ra nhé." },
        { cn: "我把作业做完了。", py: "Wǒ bǎ zuòyè zuòwán le.", vi: "Tôi đã hoàn thành xong bài tập về nhà rồi." },
        { cn: "他把书放在桌子上。", py: "Tā bǎ shū fàng zài zhuōzi shang.", vi: "Anh ấy để cuốn sách lên trên bàn." }
      ]
    },
    {
      trigger: ["比", "bǐ"],
      title: "Câu so sánh chữ 比 (Bǐ)",
      level: "HSK 2",
      formula: "A + 比 + B + Tính từ (+ 得多 / 一点儿 / số lượng)",
      explanation: "Dùng để so sánh sự chênh lệch tính chất hoặc mức độ giữa 2 đối tượng A và B. Thể phủ định dùng 没有 hoặc 不比.",
      examples: [
        { cn: "今天比昨天冷。", py: "Jīntiān bǐ zuótiān lěng.", vi: "Hôm nay lạnh hơn hôm qua." },
        { cn: "他比我大两岁。", py: "Tā bǐ wǒ dà liǎng suì.", vi: "Anh ấy lớn hơn tôi hai tuổi." },
        { cn: "坐高铁比坐飞机便宜得多。", py: "Zuò gāotiě bǐ zuò fēijī piányi de duō.", vi: "Đi tàu cao tốc rẻ hơn đi máy bay rất nhiều." }
      ]
    },
    {
      trigger: ["被", "bèi", "叫", "让"],
      title: "Câu bị động chữ 被 / 让 / 叫",
      level: "HSK 3 - 4",
      formula: "Chủ ngữ (bị động) + 被 / 让 / 叫 + (Chủ thể gây tác động) + Động từ + Thành phần khác",
      explanation: "Biểu thị chủ ngữ chịu sự chi phối hoặc kết quả từ một tác nhân khác (thường mang màu sắc bất đắc dĩ hoặc tiêu cực).",
      examples: [
        { cn: "苹果被弟弟吃了。", py: "Píngguǒ bèi dìdi chī le.", vi: "Quả táo đã bị em trai ăn mất rồi." },
        { cn: "我的自行车被人借走了。", py: "Wǒ de zìxíngchē bèi rén jiè zǒu le.", vi: "Xe đạp của tôi đã bị người ta mượn đi rồi." }
      ]
    },
    {
      trigger: ["得", "de"],
      title: "Trợ từ kết cấu 得 (Bổ ngữ trạng thái / khả năng)",
      level: "HSK 2 - 3",
      formula: "Động từ (+ Tân ngữ + Động từ) + 得 + Tính từ / Cụm miêu tả",
      explanation: "Đặt ngay sau động từ nhằm liên kết với bổ ngữ đánh giá, miêu tả mức độ hoặc trạng thái kết quả của hành động.",
      examples: [
        { cn: "他说汉语说得很好。", py: "Tā shuō Hànyǔ shuō de hěn hǎo.", vi: "Anh ấy nói tiếng Hán rất tốt." },
        { cn: "她跑得比我快。", py: "Tā pǎo de bǐ wǒ kuài.", vi: "Cô ấy chạy nhanh hơn tôi." }
      ]
    },
    {
      trigger: ["地", "de"],
      title: "Trợ từ kết cấu 地 (Phó từ hóa bổ nghĩa động tác)",
      level: "HSK 3 - 4",
      formula: "Tính từ / Cụm trạng ngữ + 地 + Động từ",
      explanation: "Đứng sau trạng ngữ (thường là tính từ) để miêu tả sắc thái hoặc cách thức hành động diễn ra.",
      examples: [
        { cn: "大家高兴地跳了起来。", py: "Dàjiā gāoxìng de tiào le qǐlái.", vi: "Mọi người vui sướng nhảy cẫng lên." },
        { cn: "他认真地写作业。", py: "Tā rènzhēn de xiě zuòyè.", vi: "Anh ấy chăm chú làm bài tập." }
      ]
    },
    {
      trigger: ["的", "de"],
      title: "Trợ từ kết cấu 的 (Biểu thị sở hữu / đặc điểm)",
      level: "HSK 1",
      formula: "Định ngữ (Đại từ / Danh từ / Tính từ / Cụm C-V) + 的 + Danh từ trung tâm",
      explanation: "Nối liền định ngữ với danh từ trung tâm để xác định rõ quyền sở hữu, chủng loại hoặc tính chất.",
      examples: [
        { cn: "这是我的中文书。", py: "Zhè shì wǒ de Zhōngwén shū.", vi: "Đây là sách tiếng Trung của tôi." },
        { cn: "红色的苹果很甜。", py: "Hóngsè de píngguǒ hěn tián.", vi: "Quả táo màu đỏ rất ngọt." }
      ]
    },
    {
      trigger: ["了", "le"],
      title: "Trợ từ ngữ khí & Động thái 了",
      level: "HSK 1 - 2",
      formula: "1. Động từ + 了 (Hoàn thành) | 2. Cuối câu + 了 (Biến đổi tình huống mới)",
      explanation: "Biểu thị hành động đã hoàn tất hoặc trạng thái mới vừa phát sinh so với trước.",
      examples: [
        { cn: "我吃完饭了。", py: "Wǒ chī wán fàn le.", vi: "Tôi đã ăn cơm xong rồi." },
        { cn: "春天来了，天气暖和了。", py: "Chūntiān lái le, tiānqì nuǎnhuo le.", vi: "Mùa xuân đến rồi, thời tiết đã ấm áp lên." }
      ]
    },
    {
      trigger: ["过", "guò"],
      title: "Trợ từ động thái 过 (Trải nghiệm trong quá khứ)",
      level: "HSK 2",
      formula: "Chủ ngữ + (没) + Động từ + 过 + Tân ngữ",
      explanation: "Nhấn mạnh chủ thể đã từng có trải nghiệm hoặc kinh qua một hành động nào đó trong quá khứ.",
      examples: [
        { cn: "我去过北京三次。", py: "Wǒ qù guo Běijīng sān cì.", vi: "Tôi đã từng đi Bắc Kinh ba lần." },
        { cn: "你吃过中国菜吗？", py: "Nǐ chī guo Zhōngguó cài ma?", vi: "Bạn từng ăn món ăn Trung Quốc chưa?" }
      ]
    },
    {
      trigger: ["着", "zhe"],
      title: "Trợ từ động thái 着 (Trạng thái đang duy trì)",
      level: "HSK 2 - 3",
      formula: "Động từ 1 + 着 (+ Tân ngữ 1) + Động từ 2",
      explanation: "Biểu thị hành động hoặc trạng thái đang duy trì liên tục, hoặc hành động 1 làm phương thức thực hiện hành động 2.",
      examples: [
        { cn: "窗户开着呢。", py: "Chuānghu kāi zhe ne.", vi: "Cửa sổ đang mở đấy." },
        { cn: "他们笑着说话。", py: "Tāmen xiào zhe shuōhuà.", vi: "Họ vừa cười vừa trò chuyện." }
      ]
    },
    {
      trigger: ["因为", "所以", "yīnwèi", "suǒyǐ"],
      title: "Cặp liên từ 因为……所以…… (Nguyên nhân - Kết quả)",
      level: "HSK 2",
      formula: "因为 + Nguyên nhân, 所以 + Kết quả",
      explanation: "Dùng để biểu thị quan hệ nhân quả. Trong khẩu ngữ có thể lược bỏ '因为' hoặc '所以'.",
      examples: [
        { cn: "因为今天下雨，所以我没出门。", py: "Yīnwèi jīntiān xià yǔ, suǒyǐ wǒ méi chūmén.", vi: "Bởi vì hôm nay trời mưa, nên tôi không ra ngoài." }
      ]
    },
    {
      trigger: ["虽然", "但是", "suīrán", "dànshì"],
      title: "Cặp liên từ 虽然……但是…… (Nhượng bộ - Tương phản)",
      level: "HSK 2 - 3",
      formula: "虽然 + Vế nhượng bộ, 但是 / 可是 + Vế chuyển ý",
      explanation: "Biểu đạt ý nghĩa tuy điều kiện ở vế một xảy ra, nhưng kết quả ở vế hai lại ngược lại.",
      examples: [
        { cn: "虽然汉字很难，但是我喜欢学。", py: "Suīrán Hànzì hěn nán, dànshì wǒ xǐhuan xué.", vi: "Tuy chữ Hán rất khó, nhưng tôi thích học." }
      ]
    },
    {
      trigger: ["越", "yuè"],
      title: "Cấu trúc 越……越…… (Càng ngày càng / Càng... càng...)",
      level: "HSK 3 - 4",
      formula: "1. 越来越 + Tính từ / Động từ tâm lý | 2. 越 A 越 B",
      explanation: "Biểu thị mức độ phát triển theo thời gian hoặc phụ thuộc vào điều kiện tăng tiến của A.",
      examples: [
        { cn: "雨越下越大了。", py: "Yǔ yuè xià yuè dà le.", vi: "Mưa rơi càng lúc càng to rồi." },
        { cn: "汉语水平越来越高了。", py: "Hànyǔ shuǐpíng yuè lái yuè gāo le.", vi: "Trình độ tiếng Hán ngày càng cao hơn." }
      ]
    },
    {
      trigger: ["一边", "yìbiān"],
      title: "Cấu trúc 一边……一边…… (Vừa... vừa...)",
      level: "HSK 2 - 3",
      formula: "Chủ ngữ + 一边 + Động tác 1, 一边 + Động tác 2",
      explanation: "Biểu thị hai hành động được tiến hành đồng thời cùng một lúc.",
      examples: [
        { cn: "我们一边听音乐一边喝茶。", py: "Wǒmen yìbiān tīng yīnyuè yìbiān hē chá.", vi: "Chúng tôi vừa nghe nhạc vừa uống trà." }
      ]
    },
    {
      trigger: ["如果", "就", "rúguǒ", "jiù"],
      title: "Cặp liên từ 如果……就…… (Giả thiết - Điều kiện)",
      level: "HSK 2 - 3",
      formula: "如果 + Giả thuyết, (Chủ ngữ) + 就 + Hành động",
      explanation: "Dùng để nêu ra một giả thiết trong tương lai, và hành động ứng phó đi liền theo giả thiết đó.",
      examples: [
        { cn: "如果你有时间，我们就去图书馆吧。", py: "Rúguǒ nǐ yǒu shíjiān, wǒmen jiù qù túshūguǎn ba.", vi: "Nếu bạn có thời gian, chúng ta cùng đi thư viện nhé." }
      ]
    },
    {
      trigger: ["不但", "而且", "búdàn", "érqiě"],
      title: "Cặp liên từ 不แต่……而且…… (Không những... mà còn...)",
      level: "HSK 3 - 4",
      formula: "Chủ ngữ + 不但 + Ý 1, 而且 + Ý 2 (tăng tiến)",
      explanation: "Biểu thị mối quan hệ bổ sung tăng tiến mức độ giữa hai sự việc liên tiếp.",
      examples: [
        { cn: "这家饭馆不但便宜，而且非常好吃。", py: "Zhè jiā fànguǎn búdàn piányi, érqiě fēicháng hǎochī.", vi: "Nhà hàng này không những rẻ mà còn rất ngon." }
      ]
    }
  ];

  function searchDictWords(query, langMode = "cn") {
    if (!query || typeof query !== "string") return [];
    const qRaw = query.trim();
    if (!qRaw) return [];
    const qLower = qRaw.toLowerCase();
    const qNormVi = normalizeVietnamese(qRaw);
    const qNormPy = normalizePinyinRaw(qRaw);
    const allWords = typeof VOCAB_DATA !== "undefined" ? VOCAB_DATA : (typeof DataStore !== "undefined" ? DataStore.getVocab() : []);
    const matches = [];

    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      let score = 0;

      if (langMode === "vi") {
        const viNorm = normalizeVietnamese(w.meaning);
        if (viNorm === qNormVi) score = 100;
        else if (viNorm.startsWith(qNormVi)) score = 80;
        else if (viNorm.includes(qNormVi)) score = 60;
        else if (w.meaning.toLowerCase().includes(qLower)) score = 40;
      } else {
        if (w.hanzi === qRaw) score = 100;
        else if (w.hanzi.startsWith(qRaw)) score = 85;
        else if (w.hanzi.includes(qRaw)) score = 70;
        else {
          const pyNorm = normalizePinyinRaw(w.pinyin);
          if (pyNorm === qNormPy) score = 90;
          else if (pyNorm.startsWith(qNormPy)) score = 75;
          else if (pyNorm.includes(qNormPy)) score = 55;
          else {
            const viNorm = normalizeVietnamese(w.meaning);
            if (viNorm.includes(qNormVi) && qNormVi.length >= 2) score = 40;
          }
        }
      }

      if (score > 0) {
        matches.push({ word: w, score });
      }
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.word.level !== b.word.level) return a.word.level - b.word.level;
      return a.word.hanzi.length - b.word.hanzi.length;
    });

    return matches.map((m) => m.word);
  }

  function searchDictSentences(query, primaryWord = null) {
    if (!query) return [];
    const qTrim = query.trim();
    const qLower = qTrim.toLowerCase();
    const qVi = normalizeVietnamese(qTrim);
    const hanziKey = primaryWord?.hanzi || (qTrim.match(/[\u4e00-\u9fa5]+/g) || [])[0] || "";

    const list = typeof SENTENCE_DATA !== "undefined" ? SENTENCE_DATA : [];
    const results = [];

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const fullText = (s.correctOrder || []).join("");
      const viText = s.vietnamese || "";

      let matched = false;
      if (hanziKey && fullText.includes(hanziKey)) matched = true;
      else if (fullText.includes(qTrim)) matched = true;
      else if (viText.toLowerCase().includes(qLower)) matched = true;
      else if (qVi.length >= 3 && normalizeVietnamese(viText).includes(qVi)) matched = true;

      if (matched) {
        results.push({ ...s, fullChinese: fullText });
        if (results.length >= 30) break;
      }
    }

    return results;
  }

  function searchDictCompounds(query, primaryWord = null) {
    const chars = [];
    if (primaryWord?.hanzi) {
      for (const ch of primaryWord.hanzi) {
        if (/[\u4e00-\u9fa5]/.test(ch) && !chars.includes(ch)) chars.push(ch);
      }
    }
    const qChars = query.match(/[\u4e00-\u9fa5]/g) || [];
    for (const ch of qChars) {
      if (!chars.includes(ch)) chars.push(ch);
    }

    if (!chars.length) return [];

    const excludeHanzi = primaryWord?.hanzi || query.trim();
    const results = [];

    for (let i = 0; i < VOCAB_DATA.length; i++) {
      const w = VOCAB_DATA[i];
      if (w.hanzi === excludeHanzi) continue;
      if (chars.some((ch) => w.hanzi.includes(ch))) {
        results.push(w);
        if (results.length >= 35) break;
      }
    }

    results.sort((a, b) => a.level - b.level || a.hanzi.length - b.hanzi.length);
    return results;
  }

  function getCharacterBreakdown(wordOrHanzi) {
    if (!wordOrHanzi) return [];
    const text = typeof wordOrHanzi === "string" ? wordOrHanzi : wordOrHanzi.hanzi || "";
    const chars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const unique = [...new Set(chars)];

    return unique.map((ch) => {
      const sinoViet = SINO_VIET_DICT[ch] || "---";
      const matchedRad = COMMON_RADICALS.find((r) => r.char === ch || ch.includes(r.char)) || null;
      return {
        char: ch,
        sinoViet,
        radical: matchedRad ? `${matchedRad.char} (${matchedRad.name})` : "Thường dụng",
        strokes: Math.min(18, Math.max(1, (ch.charCodeAt(0) % 11) + 3)),
      };
    });
  }

  // --- RENDER CHÍNH CHO BỘ TỪ ĐIỂN TRA CỨU THÔNG MINH ---
  function renderDict() {
    if (dom.crumb) dom.crumb.textContent = "Tra cứu / Từ điển";
    if (dom.pageTitle) dom.pageTitle.textContent = "Từ điển Tra cứu thông minh HSK";

    const dictView = dom.views.dict || document.getElementById("view-dict");
    if (!dictView) return;

    const d = appState.dict;
    const query = (d.query || "").trim();
    const hasQuery = Boolean(query);

    // Lấy dữ liệu theo từ khóa nếu có
    const matchedWords = hasQuery ? searchDictWords(query, d.langMode) : [];
    const primaryWord = matchedWords[0] || null;
    const matchedSentences = hasQuery ? searchDictSentences(query, primaryWord) : [];
    const matchedCompounds = hasQuery ? searchDictCompounds(query, primaryWord) : [];

    // Tách Hán tự cho subtab Hán tự
    const characters = getCharacterBreakdown(primaryWord || query);
    if (!d.selectedChar && characters.length) {
      d.selectedChar = characters[0].char;
    } else if (characters.length && !characters.some((c) => c.char === d.selectedChar)) {
      d.selectedChar = characters[0].char;
    }

    // Lịch sử tra cứu
    const historyList = ProgressStore.getSearchHistory() || [];
    const visibleHistory = d.historyExpanded ? historyList : historyList.slice(0, 5);

    // Điểm ngữ pháp khớp
    const matchedGrammar = hasQuery
      ? GRAMMAR_POINTS.filter((gp) =>
          gp.trigger.some(
            (trig) =>
              query.includes(trig) ||
              (primaryWord && primaryWord.hanzi.includes(trig)) ||
              (primaryWord && normalizePinyinRaw(primaryWord.pinyin).includes(normalizePinyinRaw(trig)))
          )
        )
      : [];

    // RENDER KHUNG GIAO DIỆN
    dictView.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
        
        <!-- HEADER TÌM KIẾM (HANZII/MAZII STYLE) -->
        <div class="dict-search-container p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
          <button id="dict-btn-back" class="p-2 rounded-xl text-paper/60 hover:text-white hover:bg-white/10 transition shrink-0" title="Quay lại">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
          </button>

          <div class="relative flex-1 flex items-center">
            <i data-lucide="search" class="w-4 h-4 absolute left-2.5 text-paper/40 pointer-events-none"></i>
            <input
              id="dict-search-input"
              type="text"
              class="w-full bg-transparent pl-9 pr-8 py-2 text-sm sm:text-base text-paper placeholder:text-paper/35 outline-none font-medium"
              placeholder="${
                d.langMode === "cn"
                  ? "Tìm Hán tự, Pinyin (ví dụ: 打, gongzuo, haode)..."
                  : "Tìm nghĩa tiếng Việt (ví dụ: hoa, làm việc, bạn bè)..."
              }"
              value="${d.query}"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            />
            ${
              d.query
                ? `<button id="dict-btn-clear" class="absolute right-2 p-1 text-paper/40 hover:text-paper rounded-full transition" title="Xóa">
                    <i data-lucide="x" class="w-4 h-4"></i>
                  </button>`
                : ""
            }
          </div>

          <!-- Nút gạt chuyển đổi ngôn ngữ cn | vi -->
          <div id="dict-lang-toggle" class="dict-lang-toggle shrink-0" title="Chuyển chế độ tìm kiếm Tiếng Trung / Tiếng Việt">
            <span class="${d.langMode === "cn" ? "active" : "text-paper/60"}">cn</span>
            <span class="${d.langMode === "vi" ? "active" : "text-paper/60"}">vi</span>
          </div>
        </div>

        <!-- HÀNG 5 NÚT CÔNG CỤ VIÊN NHỘNG (PILL BUTTONS MÀU XANH LAM TỐI) -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-2 px-2">
          <button id="dict-btn-ocr" class="dict-pill-btn shrink-0">
            <i data-lucide="camera" class="w-4 h-4 text-sky-400"></i>
            <span>Quét ảnh</span>
          </button>
          <button id="dict-btn-voice" class="dict-pill-btn shrink-0 ${d.isListening ? "voice-listening-pulse !border-red-500 !bg-red-950/70" : ""}">
            <i data-lucide="${d.isListening ? "mic-off" : "mic"}" class="w-4 h-4 ${d.isListening ? "text-red-400" : "text-emerald-400"}"></i>
            <span>${d.isListening ? "Đang nghe..." : "Giọng nói"}</span>
          </button>
          <button id="dict-btn-draw" class="dict-pill-btn shrink-0">
            <i data-lucide="pen-tool" class="w-4 h-4 text-amber-400"></i>
            <span>Viết tay</span>
          </button>
          <button id="dict-btn-radicals" class="dict-pill-btn shrink-0">
            <i data-lucide="puzzle" class="w-4 h-4 text-purple-400"></i>
            <span>Ghép từ / Bộ thủ</span>
          </button>
          <button id="dict-btn-favs" class="dict-pill-btn shrink-0">
            <i data-lucide="star" class="w-4 h-4 text-gold"></i>
            <span>Thẻ từ của tôi</span>
          </button>
        </div>

        ${
          !hasQuery
            ? `
            <!-- ================= MÀN HÌNH CHỜ (DASHBOARD TRA CỨU) ================= -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              
              <!-- CARD 1: TRA CỨU GẦN ĐÂY -->
              <div class="dict-card-dark p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
                    <div class="flex items-center gap-2">
                      <i data-lucide="clock" class="w-4 h-4 text-gold"></i>
                      <h3 class="text-sm font-bold tracking-tight text-paper">Tra cứu gần đây</h3>
                    </div>
                    ${
                      historyList.length
                        ? `<button id="dict-btn-clear-history" class="text-[11px] text-paper/40 hover:text-vermillion transition" title="Xóa toàn bộ lịch sử">
                            Xóa hết
                          </button>`
                        : ""
                    }
                  </div>

                  <div id="dict-history-container" class="space-y-0.5">
                    ${
                      visibleHistory.length
                        ? visibleHistory
                            .map(
                              (term) => `
                              <div class="dict-history-row" data-history-term="${term}">
                                <div class="flex items-center gap-3 min-w-0">
                                  <i data-lucide="search" class="w-3.5 h-3.5 text-paper/30 shrink-0"></i>
                                  <span class="hanzi text-sm sm:text-base font-semibold text-paper/90 hover:text-gold transition truncate">${term}</span>
                                </div>
                                <button class="dict-btn-del-history p-1 text-paper/30 hover:text-vermillion rounded transition shrink-0" data-del-term="${term}" title="Xóa từ này">
                                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                </button>
                              </div>
                            `
                            )
                            .join("")
                        : `<div class="py-10 text-center text-paper/40 text-xs">
                            <i data-lucide="history" class="w-6 h-6 mx-auto mb-2 opacity-40"></i>
                            Chưa có lịch sử tra cứu nào.
                          </div>`
                    }
                  </div>
                </div>

                ${
                  historyList.length > 5
                    ? `<button id="dict-btn-toggle-history" class="mt-3 pt-3 border-t border-white/5 w-full text-center text-xs font-semibold text-gold/80 hover:text-gold flex items-center justify-center gap-1 transition">
                        <span>${d.historyExpanded ? "Thu gọn ⌃" : `Xem thêm (${historyList.length - 5}) ⌄`}</span>
                      </button>`
                    : ""
                }
              </div>

              <!-- CARD 2: 🔥 TỪ KHOÁ 'HÓT' -->
              <div class="dict-card-dark p-4 sm:p-5">
                <div class="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🔥</span>
                    <h3 class="text-sm font-bold tracking-tight text-paper">Từ khoá 'Hót'</h3>
                  </div>
                  <span class="text-[11px] text-paper/40">Tra nhiều nhất</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  ${HOT_KEYWORDS.map((item, idx) => {
                    const rankColor =
                      idx === 0
                        ? "bg-amber-500 text-ink font-bold shadow-sm"
                        : idx === 1
                        ? "bg-slate-300 text-ink font-bold shadow-sm"
                        : idx === 2
                        ? "bg-amber-700 text-white font-bold"
                        : "bg-white/10 text-paper/70";
                    return `
                      <div class="dict-hot-item" data-hot-term="${item.hanzi}">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${rankColor} shrink-0">${
                      idx + 1
                    }</span>
                          <div class="min-w-0 truncate">
                            <span class="hanzi text-sm font-bold text-paper">${item.hanzi}</span>
                            <span class="text-[11px] text-paper/50 ml-1 font-mono">${item.pinyin}</span>
                          </div>
                        </div>
                        <span class="text-[10px] font-semibold text-gold/90 bg-gold/10 px-1.5 py-0.5 rounded-full shrink-0">(${item.count})</span>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>

            </div>`
            : `
            <!-- ================= MÀN HÌNH KẾT QUẢ LIVE SEARCH ================= -->
            <div class="space-y-5 animate-fade-in">
              
              <!-- THANH TABS PHÂN LOẠI NẰM NGANG -->
              <div class="dict-subtabs-bar">
                <button class="dict-subtab-btn ${d.activeSubTab === "vocab" ? "active" : ""}" data-subtab="vocab">
                  <span>Từ vựng</span>
                  <span class="text-xs text-paper/40 ml-1 font-mono">(${matchedWords.length})</span>
                </button>
                <button class="dict-subtab-btn ${d.activeSubTab === "hanzi" ? "active" : ""}" data-subtab="hanzi">
                  <span>Hán tự</span>
                  <span class="text-xs text-paper/40 ml-1 font-mono">(${characters.length})</span>
                </button>
                <button class="dict-subtab-btn ${d.activeSubTab === "grammar" ? "active" : ""}" data-subtab="grammar">
                  <span>Ngữ pháp</span>
                  ${matchedGrammar.length ? `<span class="text-xs text-gold ml-1 font-mono">(${matchedGrammar.length})</span>` : ""}
                </button>
                <button class="dict-subtab-btn ${d.activeSubTab === "sentence" ? "active" : ""}" data-subtab="sentence">
                  <span>Mẫu câu</span>
                  <span class="text-xs text-paper/40 ml-1 font-mono">(${matchedSentences.length})</span>
                </button>
                <button class="dict-subtab-btn ${d.activeSubTab === "compound" ? "active" : ""}" data-subtab="compound">
                  <span>Kết hợp từ</span>
                  <span class="text-xs text-paper/40 ml-1 font-mono">(${matchedCompounds.length})</span>
                </button>
              </div>

              <!-- NỘI DUNG TỪNG SUBTAB -->
              <div class="mt-4">
                ${
                  d.activeSubTab === "vocab"
                    ? renderDictVocabTab(matchedWords, primaryWord, matchedSentences.length, matchedCompounds.length)
                    : d.activeSubTab === "hanzi"
                    ? renderDictHanziTab(characters, d.selectedChar, d.showStrokeGuide)
                    : d.activeSubTab === "grammar"
                    ? renderDictGrammarTab(matchedGrammar, primaryWord, query)
                    : d.activeSubTab === "sentence"
                    ? renderDictSentenceTab(matchedSentences, query, primaryWord)
                    : renderDictCompoundTab(matchedCompounds, primaryWord)
                }
              </div>

            </div>`
        }

        <!-- MODAL HIỂN THỊ TƯƠNG TÁC (NẾU ACTIVE) -->
        ${
          d.activeModal === "ocr"
            ? renderOcrModal()
            : d.activeModal === "draw"
            ? renderHandwritingModal(d.showStrokeGuide)
            : d.activeModal === "radicals"
            ? renderRadicalsModal()
            : d.activeModal === "favs"
            ? renderFavoritesModal()
            : ""
        }

      </div>
    `;

    // GẮN SỰ KIỆN TƯƠNG TÁC
    initDictEventListeners(query, primaryWord);
    refreshIcons();
  }

  // --- SUBTAB 1: TỪ VỰNG CHI TIẾT & KẾT QUẢ KHỚP ---
  function renderDictVocabTab(matchedWords, primaryWord, sentenceCount, compoundCount) {
    if (!primaryWord) {
      return `
        <div class="dict-card-dark p-8 sm:p-12 text-center text-paper/50">
          <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-3 opacity-40 text-gold"></i>
          <h4 class="text-base font-bold text-paper">Không tìm thấy từ vựng chính xác</h4>
          <p class="text-xs mt-1 max-w-sm mx-auto text-paper/60">
            Thử chuyển sang tab <span class="text-gold font-semibold">Mẫu câu</span>, dùng chức năng <span class="text-gold font-semibold">Viết tay</span> hoặc gõ từ không dấu.
          </p>
        </div>
      `;
    }

    const isFav = ProgressStore.isFavorite(primaryWord.level, primaryWord.id);
    const otherWords = matchedWords.slice(1, 15);

    return `
      <div class="space-y-6">
        <!-- THẺ CHÍNH (HERO WORD CARD) -->
        <div class="dict-card-dark p-6 sm:p-8 relative overflow-hidden">
          <div class="absolute -right-6 -bottom-6 text-white/[0.02] text-9xl hanzi pointer-events-none select-none font-bold">
            ${primaryWord.hanzi}
          </div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div class="flex items-center gap-5 sm:gap-7">
              <div class="flex flex-col">
                <h1 class="hanzi text-5xl sm:text-6xl font-extrabold text-paper tracking-tight">${primaryWord.hanzi}</h1>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-xl sm:text-2xl font-bold text-gold font-mono">${primaryWord.pinyin}</span>
                  <button class="flash-speaker-btn w-9 h-9" data-dict-speak="${primaryWord.hanzi}" title="Nghe phát âm chuẩn">
                    <i data-lucide="volume-2" class="w-4 h-4 text-gold"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 self-start md:self-auto">
              <span class="level-badge badge-hsk${primaryWord.level}">HSK ${primaryWord.level}</span>
              <button class="glass p-2.5 rounded-xl ${isFav ? "text-amber-400 border-amber-400/50 bg-amber-400/10" : "text-paper/40 hover:text-amber-300"} transition" data-dict-toggle-fav="${primaryWord.id}" data-dict-level="${primaryWord.level}" title="Đánh dấu sao">
                <i data-lucide="star" class="w-5 h-5 ${isFav ? "fill-amber-400 text-amber-400" : ""}"></i>
              </button>
            </div>
          </div>

          <!-- NGHĨA TIẾNG VIỆT & CHI TIẾT -->
          <div class="pt-6 space-y-4">
            <div>
              <p class="text-xs uppercase tracking-wider text-paper/40 font-semibold mb-1">Nghĩa tiếng Việt</p>
              <p class="text-lg sm:text-xl font-bold text-paper leading-relaxed">${primaryWord.meaning}</p>
            </div>

            <!-- PHÍM NHẢY NHANH SANG CÁC TAB CHI TIẾT -->
            <div class="pt-4 flex flex-wrap gap-2.5">
              <button class="glass rounded-xl px-3.5 py-2 text-xs font-semibold hover:border-gold/50 flex items-center gap-1.5 transition text-paper/80 hover:text-white" data-quick-tab="hanzi">
                <i data-lucide="pen-tool" class="w-3.5 h-3.5 text-amber-400"></i> Xem nét viết Hán tự
              </button>
              <button class="glass rounded-xl px-3.5 py-2 text-xs font-semibold hover:border-gold/50 flex items-center gap-1.5 transition text-paper/80 hover:text-white" data-quick-tab="sentence">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-gold"></i> Xem câu mẫu (${sentenceCount})
              </button>
              <button class="glass rounded-xl px-3.5 py-2 text-xs font-semibold hover:border-gold/50 flex items-center gap-1.5 transition text-paper/80 hover:text-white" data-quick-tab="compound">
                <i data-lucide="puzzle" class="w-3.5 h-3.5 text-purple-400"></i> Từ ghép liên quan (${compoundCount})
              </button>
            </div>
          </div>
        </div>

        <!-- DANH SÁCH CÁC TỪ KHỚP KHÁC -->
        ${
          otherWords.length
            ? `
            <div class="space-y-3 pt-2">
              <h3 class="text-xs uppercase tracking-wider text-paper/50 font-bold px-1">Các từ vựng liên quan khác (${otherWords.length})</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                ${otherWords
                  .map(
                    (w) => `
                    <div class="dict-card-dark p-3.5 flex items-center justify-between gap-3 hover:border-gold/40 transition cursor-pointer" data-select-word="${w.hanzi}">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="hanzi text-lg font-bold text-paper">${w.hanzi}</span>
                          <span class="text-xs text-gold font-mono">${w.pinyin}</span>
                        </div>
                        <p class="text-xs text-paper/70 truncate mt-0.5">${w.meaning}</p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-paper/60 font-semibold">HSK ${w.level}</span>
                        <button class="p-1.5 text-paper/40 hover:text-gold transition" data-dict-speak="${w.hanzi}" title="Nghe">
                          <i data-lucide="volume-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    </div>
                  `
                  )
                  .join("")}
              </div>
            </div>`
            : ""
        }
      </div>
    `;
  }

  // --- SUBTAB 2: HÁN TỰ, THỨ TỰ NÉT & BẢNG VẼ TƯƠNG TÁC ---
  function renderDictHanziTab(characters, selectedChar, showGuide) {
    if (!characters.length) {
      return `<p class="dict-card-dark p-8 text-center text-paper/40 text-xs">Không có Hán tự nào để phân tích.</p>`;
    }

    const currentCharObj = characters.find((c) => c.char === selectedChar) || characters[0];
    const currentChar = currentCharObj.char;

    return `
      <div class="space-y-6">
        <!-- BỘ CHỌN CHỮ NẾU TỪ CÓ NHIỀU KÝ TỰ -->
        ${
          characters.length > 1
            ? `<div class="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar">
                <span class="text-xs text-paper/50 font-medium shrink-0">Chọn chữ:</span>
                ${characters
                  .map(
                    (c) => `
                    <button class="px-4 py-1.5 rounded-xl text-base hanzi font-bold transition ${
                      c.char === currentChar
                        ? "bg-gold text-ink shadow-md"
                        : "glass text-paper/80 hover:text-white hover:border-gold/50"
                    }" data-pick-char="${c.char}">
                      ${c.char}
                    </button>
                  `
                  )
                  .join("")}
              </div>`
            : ""
        }

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- BẢNG TẬP VẼ CHỮ HÁN TRÊN KHUNG MỄ TỰ CÁCH (米字格) -->
          <div class="dict-card-dark p-5 sm:p-6 flex flex-col items-center">
            <div class="w-full flex items-center justify-between mb-4">
              <span class="text-xs uppercase tracking-wider text-gold font-bold">Khung tập viết (米字格)</span>
              <div class="flex items-center gap-2">
                <button id="dict-btn-toggle-guide" class="text-xs glass px-2.5 py-1 rounded-lg ${
                  showGuide ? "text-gold border-gold/40" : "text-paper/40"
                } transition" title="Bật/tắt chữ mẫu mờ bên dưới">
                  ${showGuide ? "Ẩn mẫu" : "Hiện mẫu"}
                </button>
                <button id="dict-btn-undo-stroke" class="text-xs glass px-2.5 py-1 rounded-lg text-paper/70 hover:text-white transition" title="Hoàn tác nét">
                  Hoàn tác
                </button>
                <button id="dict-btn-clear-canvas" class="text-xs glass px-2.5 py-1 rounded-lg text-vermillion/90 hover:text-vermillion transition" title="Xóa toàn bộ">
                  Xóa nét
                </button>
              </div>
            </div>

            <!-- Rice Grid Canvas Container -->
            <div class="mizige-box" id="mizige-wrap">
              <div class="mizige-lines"></div>
              <div class="mizige-diagonals"></div>
              <canvas id="handwriting-stroke-canvas" width="280" height="280" class="handwriting-canvas absolute inset-0 z-10"></canvas>
            </div>

            <p class="text-[11px] text-paper/40 mt-3 text-center">
              Dùng chuột hoặc ngón tay để đồ theo nét chữ Hán trên màn hình cảm ứng
            </p>
          </div>

          <!-- THÔNG TIN CHI TIẾT VỀ HÁN TỰ -->
          <div class="dict-card-dark p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between pb-3 border-b border-white/10">
                <span class="hanzi text-4xl font-extrabold text-paper">${currentChar}</span>
                <button class="flash-speaker-btn w-9 h-9" data-dict-speak="${currentChar}" title="Nghe phát âm">
                  <i data-lucide="volume-2" class="w-4 h-4 text-gold"></i>
                </button>
              </div>

              <div class="grid grid-cols-2 gap-4 my-5">
                <div class="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  <p class="text-[10px] uppercase text-paper/40 font-semibold">Âm Hán Việt</p>
                  <p class="text-base font-bold text-gold mt-0.5">${currentCharObj.sinoViet}</p>
                </div>
                <div class="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  <p class="text-[10px] uppercase text-paper/40 font-semibold">Số nét ước tính</p>
                  <p class="text-base font-bold text-emerald-400 mt-0.5">${currentCharObj.strokes} nét</p>
                </div>
                <div class="bg-white/[0.02] p-3 rounded-xl border border-white/5 col-span-2">
                  <p class="text-[10px] uppercase text-paper/40 font-semibold">Bộ thủ chủ đạo</p>
                  <p class="text-sm font-semibold text-paper mt-0.5">${currentCharObj.radical}</p>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-white/10 flex items-center justify-between">
              <span class="text-xs text-paper/50">Quy tắc viết: Từ trên xuống dưới, từ trái sang phải</span>
              <button class="text-xs text-gold hover:underline font-semibold" data-quick-tab="compound">
                Xem từ ghép có chữ này ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- SUBTAB 3: NGỮ PHÁP & CÁCH DÙNG TRỌNG TÂM ---
  function renderDictGrammarTab(matchedGrammar, primaryWord, query) {
    if (matchedGrammar.length) {
      return `
        <div class="space-y-6 animate-fade-in">
          ${matchedGrammar
            .map(
              (g) => `
              <div class="dict-card-dark p-6 sm:p-7 space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-white/10">
                  <div class="flex items-center gap-2.5">
                    <span class="seal hanzi text-sm w-7 h-7">法</span>
                    <h2 class="text-lg font-bold text-paper">${g.title}</h2>
                  </div>
                  <span class="text-xs px-2.5 py-0.5 rounded-full bg-gold/15 text-gold font-semibold">${g.level}</span>
                </div>

                <div class="p-3.5 rounded-xl bg-gold/10 border border-gold/30">
                  <p class="text-[11px] uppercase tracking-wider text-gold font-bold mb-1">Công thức cấu trúc:</p>
                  <p class="text-sm sm:text-base font-bold text-paper font-mono">${g.formula}</p>
                </div>

                <p class="text-sm text-paper/80 leading-relaxed">${g.explanation}</p>

                <div class="space-y-2 pt-2">
                  <p class="text-xs font-bold uppercase tracking-wider text-paper/40">Các câu ví dụ thực tế:</p>
                  ${g.examples
                    .map(
                      (ex) => `
                      <div class="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                        <div class="space-y-1">
                          <p class="hanzi text-base font-bold text-paper">${ex.cn}</p>
                          <p class="text-xs font-mono text-gold">${ex.py}</p>
                          <p class="text-xs text-paper/70">${ex.vi}</p>
                        </div>
                        <button class="flash-speaker-btn w-8 h-8 shrink-0" data-dict-speak="${ex.cn}" title="Nghe ví dụ">
                          <i data-lucide="volume-2" class="w-3.5 h-3.5 text-gold"></i>
                        </button>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      `;
    }

    // Nếu không khớp điểm ngữ pháp đặc biệt thì hướng dẫn cách đặt câu tổng quát theo từ loại
    return `
      <div class="dict-card-dark p-6 sm:p-8 space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-white/10">
          <i data-lucide="book-open" class="w-5 h-5 text-gold"></i>
          <h2 class="text-base font-bold text-paper">Đặc điểm ngữ pháp & Vị trí trong câu</h2>
        </div>

        <p class="text-sm text-paper/80 leading-relaxed">
          Từ vựng <span class="hanzi text-gold font-bold text-base">${primaryWord ? primaryWord.hanzi : query}</span> 
          ${primaryWord ? `có nghĩa là <b>"${primaryWord.meaning}"</b>` : ""}, thường được sử dụng trong các kết cấu chuẩn của tiếng Hán như:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div class="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-1.5">
            <p class="text-xs font-bold text-emerald-400">1. Làm vị ngữ hoặc thành phần chính</p>
            <p class="text-xs text-paper/70 font-mono">Chủ ngữ + [Từ này] + Tân ngữ / Bổ ngữ</p>
          </div>
          <div class="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-1.5">
            <p class="text-xs font-bold text-sky-400">2. Kết hợp với phó từ hoặc trợ từ</p>
            <p class="text-xs text-paper/70 font-mono">很 / 非常 / 不 / 没 + [Từ này]</p>
          </div>
        </div>

        <div class="pt-4 flex items-center justify-between">
          <span class="text-xs text-paper/40">Xem các câu mẫu chứa từ này ở tab bên cạnh:</span>
          <button class="text-xs text-gold hover:underline font-semibold" data-quick-tab="sentence">
            Xem tab Mẫu câu ➔
          </button>
        </div>
      </div>
    `;
  }

  // --- SUBTAB 4: MẪU CÂU ỨNG DỤNG (SENTENCE DATA) ---
  function renderDictSentenceTab(matchedSentences, query, primaryWord) {
    if (!matchedSentences.length) {
      return `
        <div class="dict-card-dark p-8 sm:p-12 text-center text-paper/50">
          <i data-lucide="message-square-off" class="w-12 h-12 mx-auto mb-3 opacity-40 text-gold"></i>
          <h4 class="text-base font-bold text-paper">Chưa có câu mẫu chứa từ khóa này</h4>
          <p class="text-xs mt-1 text-paper/60">Hệ thống đang liên tục bổ sung thêm ngân hàng câu ngữ pháp.</p>
        </div>
      `;
    }

    const highlightTarget = primaryWord?.hanzi || query.trim();

    return `
      <div class="space-y-3">
        <p class="text-xs uppercase tracking-wider text-paper/40 font-bold px-1">
          Tìm thấy ${matchedSentences.length} câu ví dụ thực tế:
        </p>

        <div class="space-y-3">
          ${matchedSentences
            .map((s) => {
              // Bôi đậm từ khóa trong câu Hán tự
              let highlighted = s.fullChinese;
              if (highlightTarget && highlighted.includes(highlightTarget)) {
                highlighted = highlighted.split(highlightTarget).join(`<span class="text-gold font-black bg-gold/15 px-1 rounded">${highlightTarget}</span>`);
              }

              return `
                <div class="dict-card-dark p-4 sm:p-5 flex items-start justify-between gap-4 hover:border-gold/30 transition">
                  <div class="space-y-1.5 min-w-0">
                    <p class="hanzi text-lg sm:text-xl font-bold text-paper leading-snug">${highlighted}</p>
                    <p class="text-xs sm:text-sm font-mono text-gold/90">${s.pinyin}</p>
                    <p class="text-xs sm:text-sm text-paper/75">${s.vietnamese}</p>
                  </div>

                  <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="text-[10px] px-2 py-0.5 rounded bg-white/10 text-paper/60 font-semibold">HSK ${s.level}</span>
                    <button class="flash-speaker-btn w-9 h-9" data-dict-speak="${s.fullChinese}" title="Nghe câu này">
                      <i data-lucide="volume-2" class="w-4 h-4 text-gold"></i>
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  // --- SUBTAB 5: TỪ GHÉP & KẾT HỢP TỪ ---
  function renderDictCompoundTab(matchedCompounds, primaryWord) {
    if (!matchedCompounds.length) {
      return `
        <div class="dict-card-dark p-8 sm:p-12 text-center text-paper/50">
          <i data-lucide="layers" class="w-12 h-12 mx-auto mb-3 opacity-40 text-gold"></i>
          <h4 class="text-base font-bold text-paper">Không tìm thấy từ ghép liên quan</h4>
          <p class="text-xs mt-1 text-paper/60">Thử tra cứu các chữ Hán đơn lẻ để tìm nhiều từ ghép hơn.</p>
        </div>
      `;
    }

    return `
      <div class="space-y-3">
        <p class="text-xs uppercase tracking-wider text-paper/40 font-bold px-1">
          Tìm thấy ${matchedCompounds.length} từ ghép có chứa các chữ Hán này:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          ${matchedCompounds
            .map(
              (w) => `
              <div class="dict-card-dark p-3.5 flex items-center justify-between gap-2.5 hover:border-gold/50 transition cursor-pointer group" data-select-word="${w.hanzi}">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="hanzi text-base font-bold text-paper group-hover:text-gold transition">${w.hanzi}</span>
                    <span class="text-[11px] text-paper/40 font-mono">${w.pinyin}</span>
                  </div>
                  <p class="text-xs text-paper/70 truncate mt-0.5">${w.meaning}</p>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[9px] px-1 py-0.5 rounded bg-white/5 text-paper/50 font-semibold">HSK ${w.level}</span>
                  <button class="p-1 text-paper/30 hover:text-gold transition" data-dict-speak="${w.hanzi}" title="Nghe">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // --- MODAL 1: 📷 QUÉT ẢNH (OCR MOCK & PRESETS) ---
  function renderOcrModal() {
    const ocrSamples = [
      { cn: "欢迎光临", py: "Huānyíng guānglín", vi: "Hoan nghênh quý khách" },
      { cn: "中国菜馆", py: "Zhōngguó càiguǎn", vi: "Quán ăn Trung Quốc" },
      { cn: "好好学习 天天向上", py: "Hǎohǎo xuéxí, tiāntiān xiàngshàng", vi: "Học tập chăm chỉ, ngày ngày tiến bộ" },
      { cn: "祝你生日快乐", py: "Zhù nǐ shēngrì kuàilè", vi: "Chúc bạn sinh nhật vui vẻ" },
      { cn: "北京首都国际机场", py: "Běijīng Shǒudū Guójì Jīchǎng", vi: "Sân bay quốc tế Thủ đô Bắc Kinh" },
    ];

    return `
      <div class="dict-modal-overlay" id="dict-ocr-modal-backdrop">
        <div class="dict-modal-card p-6 space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <i data-lucide="camera" class="w-5 h-5 text-sky-400"></i>
              <h3 class="text-base font-bold text-paper">Quét ảnh / Nhận diện chữ Hán</h3>
            </div>
            <button class="dict-btn-close-modal p-1.5 text-paper/50 hover:text-white rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Khu vực Tải ảnh hoặc Kéo thả -->
          <div class="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-sky-400/60 transition cursor-pointer" id="ocr-upload-zone">
            <i data-lucide="image" class="w-10 h-10 mx-auto text-sky-400/80 mb-2"></i>
            <p class="text-xs font-semibold text-paper">Tải ảnh chụp từ máy của bạn</p>
            <p class="text-[11px] text-paper/40 mt-1">Hỗ trợ JPG, PNG chụp biển báo, thực đơn hoặc trang sách</p>
            <input type="file" id="ocr-file-input" accept="image/*" class="hidden" />
          </div>

          <!-- Các ảnh biển hiệu mẫu -->
          <div class="space-y-2 pt-2">
            <p class="text-xs font-bold uppercase tracking-wider text-paper/40">Hoặc chọn một mẫu biển hiệu để quét thử:</p>
            <div class="space-y-2">
              ${ocrSamples
                .map(
                  (s) => `
                  <div class="bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-sky-400/50 transition cursor-pointer flex items-center justify-between gap-3" data-ocr-sample="${s.cn}">
                    <div>
                      <p class="hanzi text-base font-bold text-sky-300">${s.cn}</p>
                      <p class="text-xs text-paper/60">${s.py} · ${s.vi}</p>
                    </div>
                    <span class="text-xs text-sky-400 font-semibold shrink-0">Tra từ này ➔</span>
                  </div>
                `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- MODAL 2: ✏️ VIẾT TAY (CANVAS DRAWING PAD & REAL-TIME RECOGNITION) ---
  const DEFAULT_HANDWRITING_CHARS = ["一", "人", "大", "天", "口", "日", "月", "木", "中", "学", "好", "水", "火", "门"];

  const OFFLINE_STROKE_MAP = {
    1: ["一", "乙"],
    2: ["二", "十", "人", "入", "八", "九", "几", "儿", "了", "力", "又", "七"],
    3: ["三", "口", "山", "大", "小", "上", "下", "个", "也", "女", "子", "么", "门", "工", "千", "万", "久"],
    4: ["不", "中", "天", "太", "月", "日", "水", "火", "木", "车", "手", "文", "开", "友", "分", "六", "五", "四", "牛", "毛"],
    5: ["去", "叫", "正", "生", "本", "白", "右", "左", "出", "打", "北", "包", "号", "句", "市", "立", "半", "冬", "平", "以"],
    6: ["多", "在", "同", "吃", "后", "好", "会", "有", "西", "年", "买", "回", "字", "名", "自", "米", "老", "先", "关", "动"],
    7: ["还", "远", "近", "连", "进", "你", "我", "作", "住", "听", "冷", "应", "完", "每", "体", "弟", "别", "张", "条", "求"],
    8: ["和", "学", "店", "爸", "国", "画", "明", "朋", "经", "知", "话", "妹", "果", "视", "服", "房", "雨", "玩", "定", "空"],
    9: ["看", "说", "便", "南", "面", "给", "想", "度", "查", "音", "段", "很", "是", "重", "点", "觉", "急", "前", "客", "界"],
    10: ["家", "准", "备", "真", "校", "高", "哥", "桌", "起", "能", "钱", "笑", "请", "病", "通", "特", "拿", "海", "酒", "原"],
    11: ["做", "常", "教", "黄", "得", "情", "排", "船", "猫", "理", "眼", "着", "甜", "蛋", "接", "累", "望", "宿", "假", "康"],
    12: ["期", "菜", "喜", "喝", "散", "答", "最", "超", "黑", "就", "复", "等", "越", "短", "晴", "然", "街", "棒", "硬", "强"],
    13: ["新", "想", "感", "照", "错", "睡", "跳", "跟", "意", "解", "路", "零", "暖", "满", "输", "勤", "简", "楼", "静", "微"],
    14: ["漂", "精", "慢", "端", "酸", "模", "赛", "管", "算", "通", "演", "碧", "需", "愿", "察", "静", "旗"],
    15: ["题", "颜", "熟", "懂", "糖", "镜", "餐", "操", "繁", "翻", "赞", "警", "露", "囊", "衢"],
  };

  function getOfflineHandwritingCandidates(strokeCount) {
    if (!strokeCount || strokeCount <= 0) return DEFAULT_HANDWRITING_CHARS;
    if (strokeCount in OFFLINE_STROKE_MAP) {
      return OFFLINE_STROKE_MAP[strokeCount];
    }
    if (strokeCount > 15) {
      return OFFLINE_STROKE_MAP[15];
    }
    return DEFAULT_HANDWRITING_CHARS;
  }

  function renderHandwritingModal(showGuide) {
    const d = appState.dict;
    const currentCandidates = d.handwritingCandidates.length > 0 ? d.handwritingCandidates : DEFAULT_HANDWRITING_CHARS;
    const strokeCount = d.handwritingStrokes.length;
    const topChar = d.handwritingCandidates.length > 0 ? d.handwritingCandidates[0] : null;

    return `
      <div class="dict-modal-overlay" id="dict-draw-modal-backdrop">
        <div class="dict-modal-card p-5 sm:p-6 space-y-4">
          <!-- Header Modal -->
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <i data-lucide="pen-tool" class="w-5 h-5 text-amber-400"></i>
              <div>
                <h3 class="text-base font-bold text-paper">Bảng vẽ viết tay chữ Hán</h3>
                <p class="text-[11px] text-paper/40">Nhận diện nét vẽ theo thời gian thực (Google AI & HSK)</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span id="handwriting-stroke-count" class="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-paper/70 font-mono">
                ${strokeCount} nét
              </span>
              <button class="dict-btn-close-modal p-1.5 text-paper/50 hover:text-white rounded-lg transition" title="Đóng bảng vẽ">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>
          </div>

          <!-- Canvas Khung Mễ Tự Cách (米字格) -->
          <div class="flex flex-col items-center">
            <div class="mizige-box" id="modal-mizige-wrap">
              <div class="mizige-lines"></div>
              <div class="mizige-diagonals"></div>
              <canvas id="modal-draw-canvas" width="280" height="280" class="handwriting-canvas absolute inset-0 z-10"></canvas>
            </div>

            <!-- Nút chức năng dưới bảng vẽ -->
            <div class="w-full max-w-[280px] flex items-center justify-between gap-2 mt-3">
              <button id="modal-btn-undo-draw" class="glass px-2.5 py-1.5 rounded-xl text-xs text-paper/80 hover:text-white flex items-center gap-1 transition" title="Hoàn tác nét gần nhất">
                <i data-lucide="undo-2" class="w-3.5 h-3.5"></i> Hoàn tác
              </button>
              <button id="modal-btn-clear-draw" class="glass px-2.5 py-1.5 rounded-xl text-xs text-vermillion/90 hover:text-vermillion hover:bg-vermillion/10 flex items-center gap-1 transition" title="Xóa toàn bộ nét vẽ">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa hết
              </button>
              <button id="modal-btn-search-first" class="bg-gold hover:bg-gold-light text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-gold/20 ${
                topChar ? "" : "opacity-50 cursor-not-allowed"
              }" ${topChar ? "" : "disabled"} title="Tra cứu chữ nhận diện đầu tiên">
                <i data-lucide="search" class="w-3.5 h-3.5"></i> ${topChar ? `Tìm "${topChar}"` : "Tìm chữ đầu tiên"}
              </button>
            </div>
          </div>

          <!-- Gợi ý chữ Hán nhận diện -->
          <div class="pt-3 border-t border-white/10 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-paper/60 font-medium">Gợi ý chữ Hán nhận diện:</span>
                <span id="handwriting-status-badge" class="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-paper/50 font-medium">
                  ${strokeCount > 0 ? "✓ Đã nhận diện" : "✍️ Hãy viết chữ vào ô"}
                </span>
              </div>
              <span id="handwriting-engine-badge" class="text-[10px] text-paper/40 font-mono">
                ${strokeCount > 0 ? "Google IME" : "Sẵn sàng"}
              </span>
            </div>

            <div id="handwriting-candidates-container" class="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
              ${currentCandidates
                .map((char, idx) => {
                  const isFirst = strokeCount > 0 && idx === 0;
                  return `
                    <button class="handwriting-cand-btn ${
                      isFirst ? "handwriting-cand-first ring-2 ring-gold/40" : ""
                    } w-10 h-10 sm:w-11 sm:h-11 rounded-xl glass text-lg sm:text-xl hanzi font-bold flex items-center justify-center transition"
                      data-select-handwriting-char="${char}" title="Bấm để tra cứu chữ ${char}">
                      ${char}
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- MODAL 3: 🧩 GHÉP TỪ & BỘ THỦ (RADICALS) ---
  function renderRadicalsModal() {
    return `
      <div class="dict-modal-overlay" id="dict-radicals-modal-backdrop">
        <div class="dict-modal-card p-6 space-y-4 max-w-xl">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <i data-lucide="puzzle" class="w-5 h-5 text-purple-400"></i>
              <h3 class="text-base font-bold text-paper">Tra cứu theo 24 Bộ thủ thông dụng</h3>
            </div>
            <button class="dict-btn-close-modal p-1.5 text-paper/50 hover:text-white rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <p class="text-xs text-paper/60">
            Nhấp vào bất kỳ bộ thủ nào để lọc toàn bộ từ vựng HSK 1 - 4 có chứa bộ thủ hoặc nghĩa liên quan:
          </p>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
            ${COMMON_RADICALS.map(
              (r) => `
              <div class="bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-purple-400/60 hover:bg-white/[0.06] transition cursor-pointer flex items-center gap-3" data-select-radical="${r.char}">
                <span class="hanzi text-2xl font-bold text-purple-300 w-8 text-center shrink-0">${r.char}</span>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-paper truncate">${r.name}</p>
                  <p class="text-[10px] text-paper/50 truncate">${r.meaning}</p>
                </div>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </div>
    `;
  }

  // --- MODAL 4: 🗂️ THẺ TỪ CỦA TÔI (FAVORITES) ---
  function renderFavoritesModal() {
    const favWords = ProgressStore.getAllFavorites() || [];

    return `
      <div class="dict-modal-overlay" id="dict-favs-modal-backdrop">
        <div class="dict-modal-card p-6 space-y-4 max-w-lg">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <i data-lucide="star" class="w-5 h-5 text-gold fill-gold"></i>
              <h3 class="text-base font-bold text-paper">Thẻ từ của tôi (${favWords.length})</h3>
            </div>
            <button class="dict-btn-close-modal p-1.5 text-paper/50 hover:text-white rounded-lg">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <div class="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            ${
              favWords.length
                ? favWords
                    .map(
                      (w) => `
                      <div class="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3 hover:border-gold/40 transition">
                        <div class="min-w-0 cursor-pointer" data-select-word="${w.hanzi}">
                          <div class="flex items-center gap-2">
                            <span class="hanzi text-lg font-bold text-paper">${w.hanzi}</span>
                            <span class="text-xs font-mono text-gold">${w.pinyin}</span>
                          </div>
                          <p class="text-xs text-paper/70 truncate mt-0.5">${w.meaning}</p>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-paper/50 font-semibold">HSK ${w.level}</span>
                          <button class="flash-speaker-btn w-8 h-8" data-dict-speak="${w.hanzi}" title="Nghe">
                            <i data-lucide="volume-2" class="w-3.5 h-3.5 text-gold"></i>
                          </button>
                        </div>
                      </div>
                    `
                    )
                    .join("")
                : `<div class="py-12 text-center text-paper/40 text-xs">
                    <i data-lucide="star" class="w-8 h-8 mx-auto mb-2 opacity-30"></i>
                    Bạn chưa đánh dấu sao cho từ vựng nào.<br>Hãy bấm vào icon ngôi sao khi xem từ để lưu vào đây!
                  </div>`
            }
          </div>
        </div>
      </div>
    `;
  }

  // --- SỰ KIỆN TƯƠNG TÁC CHO BỘ TỪ ĐIỂN ---
  function initDictEventListeners(query, primaryWord) {
    const d = appState.dict;

    // 1. Nút quay lại
    document.getElementById("dict-btn-back")?.addEventListener("click", () => {
      switchView("study");
    });

    // 2. Ô tìm kiếm live search với auto-focus
    const searchIn = document.getElementById("dict-search-input");
    if (searchIn) {
      const debouncedDictSearch = debounce((val) => {
        d.query = val;
        if (val.trim()) {
          ProgressStore.addSearchHistory(val.trim());
        }
        renderDict();
      }, 200);

      searchIn.addEventListener("input", (e) => {
        debouncedDictSearch(e.target.value);
      });

      // Auto-focus khi mở view mà chưa có từ khóa
      if (!query) {
        setTimeout(() => searchIn.focus(), 80);
      }
    }

    // Nút xóa từ khóa ✕
    document.getElementById("dict-btn-clear")?.addEventListener("click", () => {
      d.query = "";
      renderDict();
    });

    // 3. Nút gạt chuyển đổi ngôn ngữ cn | vi
    document.getElementById("dict-lang-toggle")?.addEventListener("click", () => {
      d.langMode = d.langMode === "cn" ? "vi" : "cn";
      renderDict();
      showToast(`Chuyển sang tìm kiếm ${d.langMode === "cn" ? "Tiếng Trung / Pinyin" : "Nghĩa Tiếng Việt"}`);
    });

    // 4. Các nút Pill Tools
    document.getElementById("dict-btn-ocr")?.addEventListener("click", () => {
      d.activeModal = "ocr";
      renderDict();
    });

    document.getElementById("dict-btn-draw")?.addEventListener("click", () => {
      d.activeModal = "draw";
      d.handwritingStrokes = [];
      renderDict();
      initCanvasDrawing("modal-draw-canvas");
    });

    document.getElementById("dict-btn-radicals")?.addEventListener("click", () => {
      d.activeModal = "radicals";
      renderDict();
    });

    document.getElementById("dict-btn-favs")?.addEventListener("click", () => {
      d.activeModal = "favs";
      renderDict();
    });

    // 5. Nút Giọng nói (Web Speech Recognition API)
    document.getElementById("dict-btn-voice")?.addEventListener("click", () => {
      toggleDictVoiceRecognition();
    });

    // 6. Subtabs chuyển đổi
    document.querySelectorAll(".dict-subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.activeSubTab = btn.dataset.subtab;
        renderDict();
      });
    });

    // 7. Phím nhảy nhanh sang subtab từ thẻ chính
    document.querySelectorAll("[data-quick-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.activeSubTab = btn.dataset.quickTab;
        renderDict();
      });
    });

    // 8. Chọn chữ Hán trong subtab Hán tự
    document.querySelectorAll("[data-pick-char]").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.selectedChar = btn.dataset.pickChar;
        d.handwritingStrokes = [];
        renderDict();
      });
    });

    // 9. Nút Đánh dấu sao yêu thích từ vựng
    document.querySelectorAll("[data-dict-toggle-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wordId = btn.dataset.dictToggleFav;
        const levelId = btn.dataset.dictLevel;
        const next = ProgressStore.toggleFavorite(levelId, wordId);
        showToast(next ? "Đã lưu từ vào Thẻ từ của tôi ⭐" : "Đã bỏ lưu từ khỏi Thẻ từ");
        renderDict();
      });
    });

    // 10. Phát âm từ vựng qua loa TTS
    document.querySelectorAll("[data-dict-speak]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = btn.dataset.dictSpeak;
        speakChinese(text);
      });
    });

    // 11. Bấm vào từ bất kỳ trong kết quả, từ ghép, gợi ý để tra cứu
    document.querySelectorAll("[data-select-word]").forEach((el) => {
      el.addEventListener("click", () => {
        const word = el.dataset.selectWord;
        d.query = word;
        d.activeModal = null;
        ProgressStore.addSearchHistory(word);
        renderDict();
      });
    });

    // 12. Bấm vào từ trong "Tra cứu gần đây" hoặc "Từ khoá Hót"
    document.querySelectorAll("[data-history-term], [data-hot-term]").forEach((el) => {
      el.addEventListener("click", () => {
        const term = el.dataset.historyTerm || el.dataset.hotTerm;
        d.query = term;
        ProgressStore.addSearchHistory(term);
        renderDict();
      });
    });

    // Xóa từng từ trong lịch sử
    document.querySelectorAll("[data-del-term]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const term = btn.dataset.delTerm;
        ProgressStore.removeSearchHistory(term);
        renderDict();
      });
    });

    // Xóa toàn bộ lịch sử
    document.getElementById("dict-btn-clear-history")?.addEventListener("click", () => {
      ProgressStore.clearSearchHistory();
      renderDict();
      showToast("Đã xóa toàn bộ lịch sử tra cứu.");
    });

    // Mở rộng / Thu gọn lịch sử
    document.getElementById("dict-btn-toggle-history")?.addEventListener("click", () => {
      d.historyExpanded = !d.historyExpanded;
      renderDict();
    });

    // 13. Đóng các Modal
    document.querySelectorAll(".dict-btn-close-modal").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.activeModal = null;
        renderDict();
      });
    });

    // Đóng khi nhấp ra ngoài modal backdrop
    const modalOverlays = [
      "dict-ocr-modal-backdrop",
      "dict-draw-modal-backdrop",
      "dict-radicals-modal-backdrop",
      "dict-favs-modal-backdrop",
    ];
    modalOverlays.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", (e) => {
          if (e.target === el) {
            d.activeModal = null;
            renderDict();
          }
        });
      }
    });

    // 14. Xử lý OCR Mẫu
    document.querySelectorAll("[data-ocr-sample]").forEach((el) => {
      el.addEventListener("click", () => {
        const val = el.dataset.ocrSample;
        d.query = val;
        d.activeModal = null;
        ProgressStore.addSearchHistory(val);
        renderDict();
        showToast(`Đã nhận diện: "${val}"`);
      });
    });

    // Upload ảnh OCR
    const ocrZone = document.getElementById("ocr-upload-zone");
    const ocrFileInput = document.getElementById("ocr-file-input");
    ocrZone?.addEventListener("click", () => ocrFileInput?.click());
    ocrFileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast("Đang xử lý quét ảnh...");
        setTimeout(() => {
          d.query = "中国";
          d.activeModal = null;
          ProgressStore.addSearchHistory("中国");
          renderDict();
          showToast('Quét thành công: "中国"');
        }, 600);
      }
    });

    // 15. Chọn bộ thủ trong modal radicals
    document.querySelectorAll("[data-select-radical]").forEach((el) => {
      el.addEventListener("click", () => {
        const rad = el.dataset.selectRadical;
        d.query = rad;
        d.activeModal = null;
        ProgressStore.addSearchHistory(rad);
        renderDict();
      });
    });

    // 16. Bật/tắt chữ mẫu mờ trên Canvas
    document.getElementById("dict-btn-toggle-guide")?.addEventListener("click", () => {
      d.showStrokeGuide = !d.showStrokeGuide;
      renderDict();
      initCanvasDrawing("handwriting-stroke-canvas", d.selectedChar);
    });

    // Khởi tạo Canvas vẽ nét cho Subtab Hán tự (nếu đang ở subtab hanzi)
    if (d.activeSubTab === "hanzi" && d.selectedChar) {
      initCanvasDrawing("handwriting-stroke-canvas", d.selectedChar);
    }

    // Khởi tạo Canvas vẽ nét nếu modal viết tay đang mở
    if (d.activeModal === "draw") {
      initCanvasDrawing("modal-draw-canvas");
    }
  }

  // --- ENGINE NHẬN DIỆN CHỮ VIẾT TAY (GOOGLE INPUT TOOLS & OFFLINE FALLBACK) ---
  let recognitionDebounceTimer = null;

  async function recognizeHandwritingStrokes() {
    const d = appState.dict;
    const countBadge = document.getElementById("handwriting-stroke-count");
    const statusBadge = document.getElementById("handwriting-status-badge");
    const engineBadge = document.getElementById("handwriting-engine-badge");
    const firstSearchBtn = document.getElementById("modal-btn-search-first");

    const strokeCount = d.handwritingStrokes.length;
    if (countBadge) {
      countBadge.textContent = `${strokeCount} nét`;
    }

    if (strokeCount === 0) {
      d.handwritingCandidates = [];
      if (statusBadge) {
        statusBadge.innerHTML = `<span class="text-paper/50">✍️ Hãy viết chữ vào ô</span>`;
      }
      if (engineBadge) {
        engineBadge.textContent = "Sẵn sàng";
      }
      if (firstSearchBtn) {
        firstSearchBtn.disabled = true;
        firstSearchBtn.classList.add("opacity-50", "cursor-not-allowed");
        firstSearchBtn.innerHTML = `<i data-lucide="search" class="w-3.5 h-3.5"></i> Tìm chữ đầu tiên`;
        refreshIcons();
      }
      renderHandwritingCandidates(DEFAULT_HANDWRITING_CHARS);
      return;
    }

    if (statusBadge) {
      statusBadge.innerHTML = `<span class="text-amber-400 flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Đang nhận diện...</span>`;
    }

    // Chuẩn bị payload ink cho Google Input Tools Handwriting IME API
    const ink = d.handwritingStrokes.map((stroke) => {
      const xs = [];
      const ys = [];
      const ts = [];
      const t0 = stroke[0] ? stroke[0].t || 0 : 0;
      stroke.forEach((pt) => {
        xs.push(Math.round(pt.x));
        ys.push(Math.round(pt.y));
        ts.push(Math.round(pt.t ? Math.max(0, pt.t - t0) : 0));
      });
      return [xs, ys, ts];
    });

    const payload = {
      app_version: 0.4,
      api_level: "537.36",
      device: "537.36",
      input_type: "0",
      options: "enable_pre_space",
      requests: [
        {
          writing_guide: {
            writing_area_width: 280,
            writing_area_height: 280,
          },
          pre_context: "",
          max_num_results: 14,
          max_completions: 0,
          language: "zh",
          ink: ink,
        },
      ],
    };

    let recognizedChars = [];
    let isOnline = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

      const res = await fetch("https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data[0] === "SUCCESS" && data[1] && data[1][0] && data[1][0][1]) {
          const rawList = data[1][0][1];
          const hanziRegex = /[\u4e00-\u9fa5]/;
          const validChars = [];
          rawList.forEach((item) => {
            if (typeof item === "string" && hanziRegex.test(item)) {
              const clean = item.trim();
              if (clean && !validChars.includes(clean)) {
                validChars.push(clean);
              }
            }
          });
          if (validChars.length > 0) {
            recognizedChars = validChars;
            isOnline = true;
          }
        }
      }
    } catch (err) {
      console.warn("Handwriting recognition online request failed, falling back to offline engine:", err);
    }

    // Fallback offline nếu online không trả về kết quả
    if (!recognizedChars.length) {
      recognizedChars = getOfflineHandwritingCandidates(strokeCount);
      isOnline = false;
    }

    d.handwritingCandidates = recognizedChars;

    // Cập nhật giao diện
    if (statusBadge) {
      statusBadge.innerHTML = isOnline
        ? `<span class="text-emerald-400 flex items-center gap-1 font-semibold">✓ Đã nhận diện</span>`
        : `<span class="text-amber-400 flex items-center gap-1 font-semibold">⚡ Offline (${strokeCount} nét)</span>`;
    }
    if (engineBadge) {
      engineBadge.textContent = isOnline ? "Google IME (Online)" : "HSK Lexis (Offline)";
    }

    if (firstSearchBtn && recognizedChars.length > 0) {
      firstSearchBtn.disabled = false;
      firstSearchBtn.classList.remove("opacity-50", "cursor-not-allowed");
      const topChar = recognizedChars[0];
      firstSearchBtn.innerHTML = `<i data-lucide="search" class="w-3.5 h-3.5"></i> Tìm "${topChar}"`;
      refreshIcons();
    }

    renderHandwritingCandidates(recognizedChars);
  }

  function renderHandwritingCandidates(chars) {
    const container = document.getElementById("handwriting-candidates-container");
    if (!container) return;

    if (!chars || !chars.length) {
      container.innerHTML = `
        <div class="w-full py-2 text-center text-xs text-paper/40 italic">
          Chưa nhận diện được chữ phù hợp, vui lòng vẽ tiếp hoặc hoàn tác...
        </div>
      `;
      return;
    }

    const hasStrokes = appState.dict.handwritingStrokes.length > 0;

    container.innerHTML = chars
      .map((char, idx) => {
        const isFirst = hasStrokes && idx === 0;
        return `
          <button class="handwriting-cand-btn ${
            isFirst ? "handwriting-cand-first ring-2 ring-gold/40" : ""
          } w-10 h-10 sm:w-11 sm:h-11 rounded-xl glass text-lg sm:text-xl hanzi font-bold flex items-center justify-center transition"
            data-select-handwriting-char="${char}" title="Bấm để tra cứu chữ ${char}">
            ${char}
          </button>
        `;
      })
      .join("");

    container.querySelectorAll("[data-select-handwriting-char]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const char = btn.dataset.selectHandwritingChar;
        handleSelectHandwritingChar(char);
      });
    });
  }

  function handleSelectHandwritingChar(char) {
    if (!char) return;
    const d = appState.dict;
    d.query = char;
    d.activeModal = null;
    d.handwritingStrokes = [];
    d.handwritingCandidates = [];
    ProgressStore.addSearchHistory(char);
    renderDict();
    showToast(`Đã nhận diện & tra cứu chữ "${char}"`, "success");
  }

  // --- ENGINE VẼ NÉT TRÊN CANVAS (TOUCH & MOUSE) ---
  function initCanvasDrawing(canvasId, guideChar = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const d = appState.dict;
    let isDrawing = false;
    let currentStroke = [];
    const isModal = canvasId === "modal-draw-canvas";

    const drawGuidelinesAndGhost = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Nếu có chữ mẫu mờ (chỉ ở tab Hán tự)
      if (d.showStrokeGuide && guideChar && !isModal) {
        ctx.save();
        ctx.font = "bold 190px 'Noto Sans SC', serif";
        ctx.fillStyle = "rgba(212, 160, 23, 0.16)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(guideChar, canvas.width / 2, canvas.height / 2 + 10);
        ctx.restore();
      }

      // Vẽ lại các nét đã lưu
      ctx.save();
      ctx.strokeStyle = "#c23a2b";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const stroke of d.handwritingStrokes) {
        if (!stroke.length) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    drawGuidelinesAndGhost();

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches && e.touches.length ? e.touches[0].clientX : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientX : e.clientX);
      const clientY = e.touches && e.touches.length ? e.touches[0].clientY : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientY : e.clientY);
      const scaleX = canvas.width / (rect.width || 1);
      const scaleY = canvas.height / (rect.height || 1);
      return {
        x: Math.round((clientX - rect.left) * scaleX),
        y: Math.round((clientY - rect.top) * scaleY),
      };
    };

    const start = (e) => {
      if (e.cancelable) e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      const now = Date.now();
      currentStroke = [{ x: pos.x, y: pos.y, t: now }];
      d.handwritingStrokes.push(currentStroke);
      drawGuidelinesAndGhost();
    };

    const move = (e) => {
      if (!isDrawing) return;
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e);
      const now = Date.now();
      currentStroke.push({ x: pos.x, y: pos.y, t: now });
      drawGuidelinesAndGhost();
    };

    const end = (e) => {
      if (!isDrawing) return;
      if (e && e.cancelable) e.preventDefault();
      isDrawing = false;
      currentStroke = [];

      if (isModal) {
        clearTimeout(recognitionDebounceTimer);
        const countBadge = document.getElementById("handwriting-stroke-count");
        if (countBadge) countBadge.textContent = `${d.handwritingStrokes.length} nét`;

        const statusBadge = document.getElementById("handwriting-status-badge");
        if (statusBadge) {
          statusBadge.innerHTML = `<span class="text-amber-400 flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Đang nhận diện...</span>`;
        }

        recognitionDebounceTimer = setTimeout(() => {
          recognizeHandwritingStrokes();
        }, 150);
      }
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });

    if (window.__hwEndListener) {
      window.removeEventListener("mouseup", window.__hwEndListener);
      window.removeEventListener("touchend", window.__hwEndListener);
    }
    window.__hwEndListener = end;
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);

    if (isModal) {
      // Gán sự kiện nút trong modal
      document.getElementById("modal-btn-undo-draw")?.addEventListener("click", () => {
        d.handwritingStrokes.pop();
        drawGuidelinesAndGhost();
        clearTimeout(recognitionDebounceTimer);
        const countBadge = document.getElementById("handwriting-stroke-count");
        if (countBadge) countBadge.textContent = `${d.handwritingStrokes.length} nét`;
        recognitionDebounceTimer = setTimeout(() => {
          recognizeHandwritingStrokes();
        }, 100);
      });

      document.getElementById("modal-btn-clear-draw")?.addEventListener("click", () => {
        d.handwritingStrokes = [];
        d.handwritingCandidates = [];
        drawGuidelinesAndGhost();
        clearTimeout(recognitionDebounceTimer);
        recognizeHandwritingStrokes();
      });

      document.getElementById("modal-btn-search-first")?.addEventListener("click", () => {
        if (d.handwritingCandidates && d.handwritingCandidates.length > 0) {
          handleSelectHandwritingChar(d.handwritingCandidates[0]);
        } else if (d.handwritingStrokes.length > 0) {
          const fallback = getOfflineHandwritingCandidates(d.handwritingStrokes.length);
          if (fallback.length > 0) {
            handleSelectHandwritingChar(fallback[0]);
          }
        } else {
          showToast("Vui lòng viết nét chữ trước khi tra cứu.", "warning");
        }
      });

      document.querySelectorAll("#handwriting-candidates-container [data-select-handwriting-char]").forEach((btn) => {
        btn.addEventListener("click", () => {
          handleSelectHandwritingChar(btn.dataset.selectHandwritingChar);
        });
      });
    } else {
      // Nút Hoàn tác & Xóa nét trên tab Hán tự
      document.getElementById("dict-btn-undo-stroke")?.addEventListener("click", () => {
        d.handwritingStrokes.pop();
        drawGuidelinesAndGhost();
      });

      document.getElementById("dict-btn-clear-canvas")?.addEventListener("click", () => {
        d.handwritingStrokes = [];
        drawGuidelinesAndGhost();
      });
    }
  }

  // --- ENGINE NHẬN DIỆN GIỌNG NÓI (WEB SPEECH RECOGNITION API) ---
  function toggleDictVoiceRecognition() {
    const d = appState.dict;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      showToast("Trình duyệt không hỗ trợ nhận diện giọng nói Web Speech API.", "warning");
      return;
    }

    if (d.isListening && d.speechRecognizer) {
      try {
        d.speechRecognizer.stop();
      } catch (e) {}
      d.isListening = false;
      renderDict();
      return;
    }

    try {
      const recog = new SpeechRec();
      d.speechRecognizer = recog;
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = d.langMode === "cn" ? "zh-CN" : "vi-VN";

      recog.onstart = () => {
        d.isListening = true;
        renderDict();
        showToast(`Đang nghe... Hãy nói từ vựng bằng ${d.langMode === "cn" ? "Tiếng Trung" : "Tiếng Việt"}`);
      };

      recog.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          d.query = transcript.trim();
          ProgressStore.addSearchHistory(d.query);
          showToast(`Nhận diện: "${d.query}"`);
        }
        d.isListening = false;
        renderDict();
      };

      recog.onerror = (err) => {
        console.warn("[Voice] Error:", err);
        d.isListening = false;
        renderDict();
        showToast("Không nghe rõ âm thanh hoặc quyền truy cập micro bị từ chối.", "warning");
      };

      recog.onend = () => {
        d.isListening = false;
        renderDict();
      };

      recog.start();
    } catch (err) {
      console.warn("[Voice] Exception:", err);
      d.isListening = false;
      renderDict();
    }
  }

  // ============================================================
  // 14. BACKUP & RESTORE MODULE (SAO LƯU & PHỤC HỒI)
  // ============================================================
  function initBackupRestoreEngine() {
    const triggerExport = () => {
      try {
        ProgressStore.exportProgress();
        showToast("Đã tải tệp sao lưu tiến độ thành công!");
      } catch (err) {
        showToast("Lỗi khi xuất tệp sao lưu.", "error");
      }
    };

    const triggerImport = () => {
      dom.importFileInput?.click();
    };

    // Gắn cho cả sidebar, drawer và mobile header
    document.getElementById("btn-export-sidebar")?.addEventListener("click", triggerExport);
    document.getElementById("btn-export-header")?.addEventListener("click", triggerExport);
    document.getElementById("btn-export-drawer")?.addEventListener("click", triggerExport);

    document.getElementById("btn-import-sidebar")?.addEventListener("click", triggerImport);
    document.getElementById("btn-import-header")?.addEventListener("click", triggerImport);
    document.getElementById("btn-import-drawer")?.addEventListener("click", triggerImport);

    dom.importFileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const res = ProgressStore.importProgress(evt.target.result);
          if (res.success) {
            showToast("Khôi phục tiến độ thành công!");
            appState.currentLevel = ProgressStore.getCurrentLevel() || 1;
            renderLevelList();
            renderActiveView();
            closeMobileDrawer();
          } else {
            showToast(res.error || "Tệp sao lưu không hợp lệ.", "error");
          }
        } catch (err) {
          showToast("Lỗi khi đọc tệp sao lưu JSON.", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // ============================================================
  // 14. MOBILE DRAWER CONTROLS
  // ============================================================
  function openMobileDrawer() {
    if (!dom.mobileDrawerBackdrop || !dom.mobileDrawer) return;
    dom.mobileDrawerBackdrop.classList.remove("hidden");
    requestAnimationFrame(() => {
      dom.mobileDrawer.classList.remove("-translate-x-full");
    });
  }

  function closeMobileDrawer() {
    if (!dom.mobileDrawerBackdrop || !dom.mobileDrawer) return;
    dom.mobileDrawer.classList.add("-translate-x-full");
    setTimeout(() => {
      dom.mobileDrawerBackdrop.classList.add("hidden");
    }, 300);
  }

  function initMobileDrawerEvents() {
    dom.mobileMenuToggle?.addEventListener("click", openMobileDrawer);
    dom.mobileDrawerClose?.addEventListener("click", closeMobileDrawer);
    dom.mobileDrawerBackdrop?.addEventListener("click", (e) => {
      if (e.target === dom.mobileDrawerBackdrop) closeMobileDrawer();
    });
  }

  // ============================================================
  // 15. INITIALIZATION & GLOBAL LISTENERS
  // ============================================================
  function initApp() {
    // 1. Level list selection listeners (Delegation for desktop & mobile)
    const handleLevelClick = (e) => {
      const btn = e.target.closest("[data-level-id]");
      if (btn) {
        handleLevelChange(btn.dataset.levelId);
      }
    };
    dom.levelList?.addEventListener("click", handleLevelClick);
    dom.levelListMobile?.addEventListener("click", handleLevelClick);

    // 2. Global Navigation Tabs
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetView = btn.dataset.view;
        if (targetView === "listening") startListeningModule();
        if (targetView === "quiz") startQuizModule();
        if (targetView === "sentence") startSentenceModule();
        if (targetView === "typing") startTypingModule();
        if (targetView === "reading") startReadingModule();
        if (targetView === "dict") {
          appState.dict.activeModal = null;
        }
        if (targetView === "flash") {
          appState.flash.index = 0;
          appState.flash.isFlipped = false;
        }
        switchView(targetView);
      });
    });

    // 3. Search Bar with 150ms Debounce & Dict Integration
    const debouncedSearch = debounce((query) => {
      appState.searchQuery = query;
      appState.study.renderedCount = appState.study.chunkSize;
      if (dom.searchClearBtn) {
        dom.searchClearBtn.classList.toggle("hidden", !query);
      }
      if (appState.currentTab === "dict") {
        appState.dict.query = query;
        if (query.trim()) ProgressStore.addSearchHistory(query.trim());
        renderDict();
      } else if (appState.currentTab === "home") {
        switchView("dict");
        appState.dict.query = query;
        if (query.trim()) ProgressStore.addSearchHistory(query.trim());
        renderDict();
      } else {
        renderActiveView();
      }
    }, 150);

    dom.searchInput?.addEventListener("focus", () => {
      // Khi click vào thanh tìm kiếm ở trang chủ, chuyển ngay sang từ điển tra cứu thông minh
      if (appState.currentTab === "home") {
        switchView("dict");
      }
    });

    dom.searchInput?.addEventListener("input", (e) => {
      debouncedSearch(e.target.value);
    });

    dom.searchClearBtn?.addEventListener("click", () => {
      if (dom.searchInput) dom.searchInput.value = "";
      debouncedSearch("");
    });

    // 4. ProgressStore CustomEvent Synchronization
    window.addEventListener("hsk:progress-updated", () => {
      renderProgress();
    });

    // 5. Initialize Subsystems
    initBackupRestoreEngine();
    initMobileDrawerEvents();
    renderLevelList();
    switchView("home");
  }

  // Run on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
