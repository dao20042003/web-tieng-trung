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
          <p class="text-[11px] text-paper/50 uppercase tracking-wider font-medium text-amber-400">Luyện gõ</p>
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
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
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
      .replace(/ü/g, "v")
      .replace(/[^a-z0-9]/g, "")      // Bỏ khoảng trắng, dấu câu
      .trim();
  }

  function checkHanziMatch(input, targetWord) {
    if (!input || !targetWord) return false;
    return input.trim() === targetWord.hanzi.trim();
  }

  function checkVietnameseMatch(input, targetWord) {
    if (!input || !targetWord || !targetWord.meaning) return false;
    const inputNorm = normalizeVietnamese(input);
    if (!inputNorm) return false;

    // 1. Loại bỏ các chú thích trong ngoặc đơn (...) hoặc ngoặc vuông [...]
    const cleanMeaning = targetWord.meaning
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ");

    // 2. Tách các nghĩa con độc lập theo dấu phẩy, chấm phẩy, gạch chéo hoặc từ 'hoặc', 'hay'
    const parts = cleanMeaning
      .split(/[,;\/|]|(?:\s+(?:hoặc|hay)\s+)/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    parts.push(cleanMeaning.trim());

    // 3. So khớp với từng nghĩa con
    for (const part of parts) {
      const partNorm = normalizeVietnamese(part);
      if (!partNorm) continue;

      // Khớp chính xác
      if (inputNorm === partNorm) return true;

      // Bỏ tiền tố thông dụng nếu có (ví dụ: "con mèo" -> người gõ "mèo" vẫn đúng)
      const strippedPart = partNorm.replace(/^(con|cai|chiec|su|viec|nguoi|lam|bi|duoc)\s+/g, "").trim();
      if (inputNorm === strippedPart) return true;
    }

    return false;
  }

  function checkPinyinMatch(input, targetWord) {
    if (!input || !targetWord || !targetWord.pinyin) return false;
    const inputTrim = input.trim().toLowerCase();
    const targetTrim = targetWord.pinyin.trim().toLowerCase();

    // 1. Khớp nguyên bản hoặc khớp khi bỏ khoảng trắng
    if (inputTrim === targetTrim || inputTrim.replace(/\s+/g, "") === targetTrim.replace(/\s+/g, "")) {
      return true;
    }

    const inputNoTone = normalizePinyinRaw(input);
    const targetNoTone = normalizePinyinRaw(targetWord.pinyin);

    // 2. Chấp nhận Pinyin không dấu (ví dụ anpai == anpai) hoặc bỏ số thanh điệu (an1pai2 -> anpai)
    const inputNoNum = inputNoTone.replace(/[0-9]/g, "");
    const targetNoNum = targetNoTone.replace(/[0-9]/g, "");

    if (inputNoTone === targetNoTone || inputNoNum === targetNoNum) {
      return true;
    }

    // 3. Nếu từ vựng có nhiều biến thể đọc cách nhau bởi '/'
    if (targetWord.pinyin.includes("/")) {
      const variants = targetWord.pinyin.split("/").map((v) => normalizePinyinRaw(v));
      const variantsNoNum = variants.map((v) => v.replace(/[0-9]/g, ""));
      if (variants.includes(inputNoTone) || variantsNoNum.includes(inputNoNum)) {
        return true;
      }
    }

    return false;
  }

  // --- QUẢN LÝ KHO TỪ VỰNG MINI-GAME VÀ RETRY QUEUE ---
  function getTypingPool(selectedLevels) {
    const levels = selectedLevels && selectedLevels.length ? selectedLevels : [appState.currentLevel];
    let pool = [];
    for (const lvl of levels) {
      const words = DataStore.getVocab({ level: lvl });
      pool = pool.concat(words);
    }
    return pool.length ? pool : DataStore.getVocab({ level: 1 });
  }

  function startTypingModule(options = {}) {
    const defaultLevels = appState.typing?.selectedLevels?.length
      ? appState.typing.selectedLevels
      : [appState.currentLevel];

    const playMode = options.playMode || appState.typing?.playMode || "endless"; // "endless" | "match20"
    const gameMode = options.gameMode || appState.typing?.gameMode || "triad";   // "triad" | "rapid"

    const selectedLevels = options.selectedLevels || defaultLevels;
    const pool = getTypingPool(selectedLevels);

    let matchItems = [];
    if (playMode === "match20") {
      matchItems = shuffle(pool).slice(0, 20);
    }

    appState.typing = {
      selectedLevels: [...selectedLevels],
      playMode,
      gameMode,

      // Endless & Retry Queue
      retryQueue: appState.typing?.retryQueue || [], // [{ word, cooldown: 3..5 }]
      historyIds: [],

      // Match 20
      matchItems,
      matchIndex: 0,
      done: false,

      // Stats
      typedCount: appState.typing?.typedCount || 0,
      correctCount: appState.typing?.correctCount || 0,
      totalAttempts: appState.typing?.totalAttempts || 0,
      combo: appState.typing?.combo || 0,
      maxCombo: appState.typing?.maxCombo || 0,
      showComboAnimation: false,

      // Current Word & Question State
      currentWord: null,
      isRetryWord: false,

      // Triad 3-step state
      step: 1, // 1: Hán tự -> 2: Tiếng Việt -> 3: Pinyin
      step1Done: false,
      step2Done: false,
      step3Done: false,
      step1Val: "",
      step2Val: "",
      step3Val: "",

      // Rapid state
      rapidVal: "",
      showHintPinyin: false,

      // Gợi ý & Bỏ qua
      showHint: false,
      revealed: false,
      status: "idle", // "idle" | "correct" | "wrong"
    };

    pullNextTypingWord();
  }

  function pullNextTypingWord() {
    const t = appState.typing;
    if (!t) return;

    t.step = 1;
    t.step1Done = false;
    t.step2Done = false;
    t.step3Done = false;
    t.step1Val = "";
    t.step2Val = "";
    t.step3Val = "";
    t.rapidVal = "";
    t.showHint = false;
    t.revealed = false;
    t.status = "idle";
    t.showComboAnimation = false;

    // Chế độ 🎯 Đấu 20 từ
    if (t.playMode === "match20") {
      if (t.matchIndex >= t.matchItems.length) {
        t.done = true;
        ProgressStore.recordTyping(appState.currentLevel, t.correctCount, t.matchItems.length);
        return;
      }
      t.currentWord = t.matchItems[t.matchIndex];
      t.isRetryWord = false;
      return;
    }

    // Chế độ ∞ Vô hạn (Endless Mode)
    // 1. Giảm cooldown trong Smart Retry Queue
    for (let i = 0; i < t.retryQueue.length; i++) {
      t.retryQueue[i].cooldown--;
    }

    // 2. Tìm từ chưa thuộc đã đến lượt ưu tiên xuất hiện lại (cooldown <= 0)
    const readyIdx = t.retryQueue.findIndex((item) => item.cooldown <= 0);
    if (readyIdx !== -1) {
      const retryItem = t.retryQueue.splice(readyIdx, 1)[0];
      t.currentWord = retryItem.word;
      t.isRetryWord = true;
      return;
    }

    // 3. Rút ngẫu nhiên từ kho từ vựng đã chọn (tránh trùng từ vừa xuất hiện gần đây)
    const pool = getTypingPool(t.selectedLevels);
    const available = pool.filter((w) => !t.historyIds.slice(-12).includes(w.id));
    const candidateList = available.length ? available : pool;
    const picked = candidateList[Math.floor(Math.random() * candidateList.length)];

    t.currentWord = picked;
    t.isRetryWord = false;

    t.historyIds.push(picked.id);
    if (t.historyIds.length > 30) t.historyIds.shift();
  }

  function renderTyping() {
    dom.crumb.textContent = "Mini-Game Từ vựng";
    dom.pageTitle.textContent = "Luyện gõ rèn phản xạ chữ Hán";

    if (!appState.typing || !appState.typing.currentWord) {
      startTypingModule();
    }
    const t = appState.typing;

    if (!t || (!t.currentWord && !t.done)) {
      dom.views.typing.innerHTML = `<p class="text-paper/50 p-8 text-center">Không đủ từ vựng để khởi động game.</p>`;
      return;
    }

    // Màn hình Tổng kết khi hoàn thành Chế độ Đấu 20 từ
    if (t.done && t.playMode === "match20") {
      const total = t.matchItems.length || 20;
      const pct = Math.round((t.correctCount / total) * 100);
      let badge = "🎉 Xuất sắc! Phản xạ từ vựng của bạn cực kỳ nhạy bén!";
      let badgeColor = "text-emerald-400";
      if (pct < 60) {
        badge = "💪 Cần rèn luyện thêm để nhớ từ sâu hơn nhé!";
        badgeColor = "text-amber-400";
      }

      dom.views.typing.innerHTML = `
        <div class="max-w-xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center animate-fade-in">
          <div class="seal hanzi text-3xl mx-auto mb-3">胜</div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-paper">Hoàn thành Đấu 20 từ!</h2>
          <p class="text-xs text-paper/50 mt-1 uppercase tracking-wider">HSK Lexis Typing Challenge</p>

          <div class="my-6 py-6 border-y border-white/10 grid grid-cols-3 gap-2">
            <div>
              <p class="text-[11px] text-paper/50 uppercase">Đúng</p>
              <p class="text-2xl sm:text-3xl font-black mt-1 text-emerald-400">${t.correctCount}/${total}</p>
            </div>
            <div>
              <p class="text-[11px] text-paper/50 uppercase">Độ chính xác</p>
              <p class="text-2xl sm:text-3xl font-black mt-1 text-gold">${pct}%</p>
            </div>
            <div>
              <p class="text-[11px] text-paper/50 uppercase">Kỷ lục Combo</p>
              <p class="text-2xl sm:text-3xl font-black mt-1 text-orange-400">🔥 ${t.maxCombo}</p>
            </div>
          </div>

          <p class="text-sm font-semibold ${badgeColor} mb-8">${badge}</p>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button id="typing-game-btn-replay" class="bg-vermillion hover:bg-vermillion/90 text-white font-semibold rounded-xl px-6 py-3 text-sm flex items-center justify-center gap-2 shadow-lg transition">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Đấu vòng 20 từ mới
            </button>
            <button id="typing-game-btn-to-endless" class="glass-card hover:border-gold text-paper font-semibold rounded-xl px-6 py-3 text-sm flex items-center justify-center gap-2 transition">
              <i data-lucide="infinity" class="w-4 h-4 text-gold"></i> Chuyển sang Vô hạn
            </button>
          </div>
        </div>
      `;

      document.getElementById("typing-game-btn-replay")?.addEventListener("click", () => {
        startTypingModule({ playMode: "match20" });
        renderTyping();
        refreshIcons();
      });

      document.getElementById("typing-game-btn-to-endless")?.addEventListener("click", () => {
        startTypingModule({ playMode: "endless" });
        renderTyping();
        refreshIcons();
      });

      refreshIcons();
      return;
    }

    const word = t.currentWord;
    const accuracy = t.totalAttempts > 0 ? Math.round((t.correctCount / t.totalAttempts) * 100) : 100;
    const isAllLevels = t.selectedLevels.length === 4;

    // Giao diện Game HUD & Layout Safe-Zone cho bàn phím ảo
    dom.views.typing.innerHTML = `
      <div class="max-w-2xl mx-auto mobile-safe-typing space-y-4">
        
        <!-- GAME HUD: BỘ CHỌN NGUỒN CẤP ĐỘ HSK TRỰC TIẾP TRONG GAME -->
        <div class="glass-card p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs text-paper/50 font-medium mr-1 flex items-center gap-1">
              <i data-lucide="database" class="w-3.5 h-3.5 text-gold"></i> Nguồn từ:
            </span>
            <button data-level-select="all" class="game-pill rounded-lg px-2.5 py-1 text-xs font-semibold ${isAllLevels ? "is-active" : ""}">
              Tất cả HSK
            </button>
            ${[1, 2, 3, 4]
              .map(
                (lvl) => `
                <button data-level-select="${lvl}" class="game-pill rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  t.selectedLevels.includes(lvl) && !isAllLevels ? "is-active" : ""
                }">
                  HSK ${lvl}
                </button>
              `
              )
              .join("")}
          </div>

          <!-- Switcher Kiểu chơi: Vô hạn vs Đấu 20 từ -->
          <div class="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button data-play-mode="endless" class="px-2.5 py-1 rounded-lg transition ${
              t.playMode === "endless" ? "bg-white/15 text-white font-bold shadow-sm" : "text-paper/60 hover:text-paper"
            }" title="Chơi liên tục không giới hạn">
              ∞ Vô hạn
            </button>
            <button data-play-mode="match20" class="px-2.5 py-1 rounded-lg transition ${
              t.playMode === "match20" ? "bg-white/15 text-white font-bold shadow-sm" : "text-paper/60 hover:text-paper"
            }" title="Thử thách vòng 20 từ">
              🎯 Đấu 20 từ
            </button>
          </div>
        </div>

        <!-- STATS BAR TRỰC QUAN -->
        <div class="grid grid-cols-4 gap-2 text-center">
          <div class="glass-card p-2.5 rounded-xl">
            <p class="text-[10px] text-paper/50 uppercase font-medium">
              ${t.playMode === "endless" ? "Đã gõ" : "Tiến độ"}
            </p>
            <p class="text-sm sm:text-base font-bold text-paper mt-0.5 font-mono">
              ${t.playMode === "endless" ? `${t.typedCount} từ` : `${t.matchIndex + 1} / 20`}
            </p>
          </div>
          <div class="glass-card p-2.5 rounded-xl relative overflow-hidden">
            <p class="text-[10px] text-paper/50 uppercase font-medium">Combo</p>
            <p class="text-sm sm:text-base font-bold text-orange-400 mt-0.5 flex items-center justify-center gap-1">
              🔥 <span class="font-mono">${t.combo}</span>
            </p>
          </div>
          <div class="glass-card p-2.5 rounded-xl">
            <p class="text-[10px] text-paper/50 uppercase font-medium">Kỷ lục</p>
            <p class="text-sm sm:text-base font-bold text-gold mt-0.5 flex items-center justify-center gap-1">
              🏆 <span class="font-mono">${t.maxCombo}</span>
            </p>
          </div>
          <div class="glass-card p-2.5 rounded-xl">
            <p class="text-[10px] text-paper/50 uppercase font-medium">Chính xác</p>
            <p class="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 font-mono">
              ${accuracy}%
            </p>
          </div>
        </div>

        <!-- GAME CARD CHÍNH -->
        <div class="glass-card rounded-3xl p-5 sm:p-7 relative overflow-hidden">
          
          <!-- Thanh chọn 2 Chế độ gõ: Tam Hợp 3 Bước vs 1 Ô Phản Xạ -->
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10 gap-2">
            <div class="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button data-game-mode="triad" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                t.gameMode === "triad" ? "bg-gold/20 text-gold border border-gold/40 font-bold" : "text-paper/60 hover:text-paper"
              }">
                <i data-lucide="layers" class="w-3.5 h-3.5"></i> <span>Tam Hợp 3 Bước</span>
              </button>
              <button data-game-mode="rapid" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                t.gameMode === "rapid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold" : "text-paper/60 hover:text-paper"
              }">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i> <span>Gõ Nhanh 1 Ô</span>
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              ${
                t.isRetryWord
                  ? `<span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <i data-lucide="refresh-cw" class="w-3 h-3 animate-spin-slow"></i> Ôn lại từ chưa thuộc
                    </span>`
                  : `<span class="text-[11px] text-paper/40 font-mono">HSK ${word.level}</span>`
              }
            </div>
          </div>

          <!-- PROMPT AREA (ĐỀ BÀI) -->
          <div class="flex items-start justify-between gap-3 mb-5">
            <div>
              ${
                t.gameMode === "triad"
                  ? `<div class="flex items-center gap-2">
                      <span class="seal hanzi text-xs w-6 h-6">听</span>
                      <p class="text-xs uppercase tracking-wider text-gold font-bold">Nghe âm thanh & Hoàn thành 3 bước</p>
                    </div>
                    <p class="text-xs text-paper/60 mt-1">Gõ theo thứ tự: 1. Chữ Hán ➔ 2. Tiếng Việt ➔ 3. Pinyin</p>`
                  : `<p class="text-xs uppercase tracking-wider text-emerald-400 font-bold">Nghĩa tiếng Việt</p>
                    <h3 class="text-2xl sm:text-3xl font-extrabold text-paper mt-1 leading-snug">${word.meaning}</h3>`
              }
            </div>

            <!-- Nút Loa Nghe lại & Nút Xem gợi ý -->
            <div class="flex items-center gap-2 shrink-0">
              <button id="typing-btn-speak" class="flash-speaker-btn w-10 h-10" title="Nghe phát âm (zh-CN)">
                <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
              </button>
              <button id="typing-btn-hint" class="glass px-3 py-2 rounded-xl text-xs ${
                t.showHint ? "text-amber-300 border-amber-500/50 bg-amber-500/10" : "text-paper/60 hover:text-amber-300"
              } transition flex items-center gap-1" title="Xem gợi ý nếu quên từ">
                <i data-lucide="lightbulb" class="w-4 h-4 text-amber-300"></i>
                <span class="hidden sm:inline">${t.showHint ? "Ẩn" : "Gợi ý"}</span>
              </button>
            </div>
          </div>

          <!-- HỘP GỢI Ý KHI NGƯỜI DÙNG BẤM HINT -->
          ${
            t.showHint
              ? `<div class="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 animate-fade-in flex items-center justify-between gap-3">
                  <div class="space-y-1">
                    <p><b>Gợi ý Hán tự:</b> <span class="hanzi text-base text-gold ml-1">${word.hanzi[0]}... (${word.hanzi.length} chữ)</span></p>
                    <p><b>Gợi ý Nghĩa:</b> <span class="text-paper/90 ml-1">${word.meaning}</span></p>
                    <p><b>Gợi ý Pinyin:</b> <span class="font-mono text-gold ml-1">${word.pinyin}</span></p>
                  </div>
                  <span class="text-[10px] text-paper/40 italic">Nhấn vào ô để tiếp tục gõ</span>
                </div>`
              : ""
          }

          <!-- HIỆU ỨNG COMBO BURST POPUP -->
          ${
            t.showComboAnimation
              ? `<div class="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                  <div class="combo-pop-burst flex flex-col items-center gap-2 text-center">
                    <span class="text-5xl">🔥</span>
                    <span class="text-2xl sm:text-3xl font-black text-gold drop-shadow-lg tracking-wider">+1 COMBO STREAK!</span>
                    <span class="text-xs text-paper/80 font-medium">Xuất sắc! Tiếp tục giữ phong độ!</span>
                  </div>
                </div>`
              : ""
          }

          <!-- INPUT FORM CONTAINER -->
          ${
            t.gameMode === "triad"
              ? `<!-- CHẾ ĐỘ 1: GÕ TAM HỢP 3 BƯỚC -->
                <div class="space-y-3">
                  
                  <!-- Ô 1: Tiếng Hán -->
                  <div class="triad-step-card ${t.step === 1 ? "step-active" : ""} ${t.step1Done ? "step-done" : ""}">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-bold flex items-center gap-1.5 ${t.step1Done ? "text-emerald-400" : "text-paper/60"}">
                        <span class="w-4 h-4 rounded-full bg-white/10 inline-flex items-center justify-center text-[10px]">1</span>
                        <span>Tiếng Hán (Chữ Hán):</span>
                      </span>
                      ${t.step1Done ? '<span class="text-emerald-400 font-bold flex items-center gap-1 text-[11px]"><i data-lucide="check" class="w-3.5 h-3.5"></i> Đã khớp</span>' : '<span class="text-paper/30 text-[10px]">Gõ chữ Hán</span>'}
                    </div>
                    <div class="relative flex items-center">
                      <input
                        id="triad-input-1"
                        type="text"
                        class="triad-step-input hanzi text-xl sm:text-2xl"
                        placeholder="1. Gõ chữ Hán tương ứng..."
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        value="${t.step1Val}"
                        ${t.step1Done || t.revealed ? "disabled" : ""}
                      />
                    </div>
                  </div>

                  <!-- Ô 2: Tiếng Việt -->
                  <div class="triad-step-card ${t.step === 2 ? "step-active" : ""} ${t.step2Done ? "step-done" : ""} ${t.step < 2 && !t.revealed ? "step-disabled" : ""}">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-bold flex items-center gap-1.5 ${t.step2Done ? "text-emerald-400" : "text-paper/60"}">
                        <span class="w-4 h-4 rounded-full bg-white/10 inline-flex items-center justify-center text-[10px]">2</span>
                        <span>Tiếng Việt (Nghĩa từ):</span>
                      </span>
                      ${t.step2Done ? '<span class="text-emerald-400 font-bold flex items-center gap-1 text-[11px]"><i data-lucide="check" class="w-3.5 h-3.5"></i> Đã khớp</span>' : '<span class="text-paper/30 text-[10px]">Có hoặc không dấu</span>'}
                    </div>
                    <div class="relative flex items-center">
                      <input
                        id="triad-input-2"
                        type="text"
                        class="triad-step-input text-base sm:text-lg"
                        placeholder="${t.step < 2 && !t.revealed ? "Hoàn thành bước 1 để mở khóa..." : "2. Gõ nghĩa tiếng Việt (chấp nhận không dấu)..."}"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        value="${t.step2Val}"
                        ${t.step < 2 || t.step2Done || t.revealed ? "disabled" : ""}
                      />
                    </div>
                  </div>

                  <!-- Ô 3: Phiên âm Pinyin -->
                  <div class="triad-step-card ${t.step === 3 ? "step-active" : ""} ${t.step3Done ? "step-done" : ""} ${t.step < 3 && !t.revealed ? "step-disabled" : ""}">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-bold flex items-center gap-1.5 ${t.step3Done ? "text-emerald-400" : "text-paper/60"}">
                        <span class="w-4 h-4 rounded-full bg-white/10 inline-flex items-center justify-center text-[10px]">3</span>
                        <span>Phiên âm (Pinyin):</span>
                      </span>
                      ${t.step3Done ? '<span class="text-emerald-400 font-bold flex items-center gap-1 text-[11px]"><i data-lucide="check" class="w-3.5 h-3.5"></i> Đã khớp</span>' : '<span class="text-paper/30 text-[10px]">dajia / da4jia1 / dàjiā</span>'}
                    </div>
                    <div class="relative flex items-center">
                      <input
                        id="triad-input-3"
                        type="text"
                        class="triad-step-input font-mono text-base sm:text-lg"
                        placeholder="${t.step < 3 && !t.revealed ? "Hoàn thành bước 2 để mở khóa..." : "3. Gõ pinyin (hỗ trợ gõ không dấu)..."}"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        value="${t.step3Val}"
                        ${t.step < 3 || t.step3Done || t.revealed ? "disabled" : ""}
                      />
                    </div>
                  </div>
                </div>`
              : `<!-- CHẾ ĐỘ 2: GÕ NHANH CHỮ HÁN 1 Ô -->
                <div class="flex flex-col items-center py-2">
                  <div class="w-full max-w-md">
                    <input
                      id="rapid-input-field"
                      type="text"
                      class="typing-input hanzi text-3xl text-center ${t.status === "correct" ? "typing-correct" : ""} ${t.status === "wrong" ? "typing-wrong" : ""}"
                      placeholder="Gõ chữ Hán..."
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                      spellcheck="false"
                      value="${t.rapidVal}"
                      ${t.revealed ? "disabled" : ""}
                    />
                  </div>
                  <p class="text-xs text-paper/40 mt-3 flex items-center gap-1.5">
                    <span>Nhấn</span>
                    <kbd class="px-1.5 py-0.5 rounded bg-white/10 text-paper/80 font-mono text-[10px]">Enter</kbd>
                    <span>để kiểm tra hoặc tự bắt khi gõ đúng</span>
                  </p>
                </div>`
          }

          <!-- KHUNG XEM ĐÁP ÁN (KHI BẤM BỎ QUA HOẶC HOÀN THÀNH) -->
          ${
            t.revealed
              ? `<div class="mt-5 p-4 rounded-2xl bg-white/[0.04] border border-gold/40 text-center animate-fade-in">
                  <p class="text-[11px] text-paper/50 uppercase tracking-wider font-semibold">Đáp án chuẩn của từ này:</p>
                  <p class="hanzi text-3xl sm:text-4xl font-bold text-gold mt-1.5">${word.hanzi}</p>
                  <p class="text-base text-paper font-semibold mt-1 font-mono">${word.pinyin}</p>
                  <p class="text-xs sm:text-sm text-paper/80 mt-1">${word.meaning}</p>
                  
                  <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-3">
                    <button id="typing-btn-next-word" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-6 py-2.5 text-xs sm:text-sm flex items-center gap-2 shadow-lg transition">
                      <span>Tiếp tục từ mới</span>
                      <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>`
              : `<div class="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-white/10">
                  <button id="typing-btn-skip" class="text-xs text-paper/50 hover:text-gold flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5 transition" title="Bỏ qua từ này (từ sẽ xuất hiện lại sau 3-5 lượt)">
                    <i data-lucide="skip-forward" class="w-3.5 h-3.5"></i> Bỏ qua (Xem đáp án)
                  </button>
                  <button id="typing-btn-submit-step" class="bg-vermillion hover:bg-vermillion/90 text-white font-semibold px-5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition">
                    Kiểm tra (Enter)
                  </button>
                </div>`
          }

        </div>
      </div>
    `;

    // --- GẮN SỰ KIỆN TƯƠNG TÁC MINI-GAME ---

    // 1. Bộ chọn Cấp độ HSK
    dom.views.typing.querySelectorAll("[data-level-select]").forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.levelSelect;
        if (val === "all") {
          t.selectedLevels = [1, 2, 3, 4];
        } else {
          const lvl = Number(val);
          if (t.selectedLevels.includes(lvl)) {
            // Không cho bỏ hết cấp độ
            if (t.selectedLevels.length > 1) {
              t.selectedLevels = t.selectedLevels.filter((x) => x !== lvl);
            }
          } else {
            t.selectedLevels.push(lvl);
            t.selectedLevels.sort();
          }
        }
        startTypingModule({ selectedLevels: t.selectedLevels, playMode: t.playMode, gameMode: t.gameMode });
        renderTyping();
        refreshIcons();
      };
    });

    // 2. Chuyển đổi Kiểu chơi (Endless vs Match 20)
    dom.views.typing.querySelectorAll("[data-play-mode]").forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.dataset.playMode;
        if (mode !== t.playMode) {
          startTypingModule({ playMode: mode, gameMode: t.gameMode, selectedLevels: t.selectedLevels });
          renderTyping();
          refreshIcons();
        }
      };
    });

    // 3. Chuyển đổi 2 Chế độ gõ (Tam Hợp vs 1 Ô)
    dom.views.typing.querySelectorAll("[data-game-mode]").forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.dataset.gameMode;
        if (mode !== t.gameMode) {
          t.gameMode = mode;
          t.step = 1;
          t.step1Done = false;
          t.step2Done = false;
          t.step3Done = false;
          t.revealed = false;
          renderTyping();
          refreshIcons();
        }
      };
    });

    // 4. Phát âm & Gợi ý
    document.getElementById("typing-btn-speak")?.addEventListener("click", () => {
      speakChinese(word.hanzi);
    });

    document.getElementById("typing-btn-hint")?.addEventListener("click", () => {
      t.showHint = !t.showHint;
      renderTyping();
      refreshIcons();
    });

    // 5. Bỏ qua (Xem đáp án) -> Ghim từ vào Smart Retry Queue
    const handleSkip = () => {
      t.revealed = true;
      t.combo = 0; // Reset combo khi bỏ qua

      // Ghim từ vào hàng đợi ưu tiên để xuất hiện lại sau 3-5 câu
      if (!t.retryQueue.some((item) => item.word.id === word.id)) {
        t.retryQueue.push({
          word,
          cooldown: Math.floor(Math.random() * 3) + 3, // 3 đến 5 lượt tiếp theo
        });
      }

      speakChinese(word.hanzi);
      renderTyping();
      refreshIcons();
    };

    document.getElementById("typing-btn-skip")?.addEventListener("click", handleSkip);

    // 6. Nút Tiếp tục từ mới (Sau khi xem đáp án)
    const handleNextWord = () => {
      t.typedCount++;
      if (t.playMode === "match20") t.matchIndex++;
      pullNextTypingWord();
      renderTyping();
      refreshIcons();
      // Tự động phát âm từ mới ở chế độ Tam Hợp
      if (t.gameMode === "triad" && t.currentWord) {
        speakChinese(t.currentWord.hanzi);
      }
    };

    document.getElementById("typing-btn-next-word")?.addEventListener("click", handleNextWord);

    // --- LOGIC GÕ PHÍM VÀ CHẤM ĐIỂM ---

    // A. XỬ LÝ CHẾ ĐỘ 1: TAM HỢP 3 BƯỚC
    if (t.gameMode === "triad" && !t.revealed) {
      const in1 = document.getElementById("triad-input-1");
      const in2 = document.getElementById("triad-input-2");
      const in3 = document.getElementById("triad-input-3");

      const checkStep1 = () => {
        if (t.step1Done) return true;
        const val = in1?.value || "";
        if (checkHanziMatch(val, word)) {
          t.step1Done = true;
          t.step1Val = val.trim();
          t.step = 2;
          in1.classList.add("input-success-flash");
          in1.disabled = true;
          if (in2) {
            in2.disabled = false;
            in2.focus();
          }
          renderTyping();
          refreshIcons();
          return true;
        } else {
          in1?.classList.add("typing-wrong");
          setTimeout(() => in1?.classList.remove("typing-wrong"), 400);
          return false;
        }
      };

      const checkStep2 = () => {
        if (t.step2Done) return true;
        const val = in2?.value || "";
        if (checkVietnameseMatch(val, word)) {
          t.step2Done = true;
          t.step2Val = val.trim();
          t.step = 3;
          in2.classList.add("input-success-flash");
          in2.disabled = true;
          if (in3) {
            in3.disabled = false;
            in3.focus();
          }
          renderTyping();
          refreshIcons();
          return true;
        } else {
          in2?.classList.add("typing-wrong");
          setTimeout(() => in2?.classList.remove("typing-wrong"), 400);
          return false;
        }
      };

      const checkStep3 = () => {
        if (t.step3Done) return true;
        const val = in3?.value || "";
        if (checkPinyinMatch(val, word)) {
          t.step3Done = true;
          t.step3Val = val.trim();
          in3.classList.add("input-success-flash");
          in3.disabled = true;

          // HOÀN THÀNH XUẤT SẮC CẢ 3 BƯỚC!
          t.correctCount++;
          t.totalAttempts++;
          t.combo++;
          if (t.combo > t.maxCombo) t.maxCombo = t.combo;
          t.showComboAnimation = true;

          speakChinese(word.hanzi);
          renderTyping();
          refreshIcons();

          setTimeout(() => {
            t.typedCount++;
            if (t.playMode === "match20") t.matchIndex++;
            pullNextTypingWord();
            renderTyping();
            refreshIcons();
            if (t.currentWord) speakChinese(t.currentWord.hanzi);
          }, 650);

          return true;
        } else {
          in3?.classList.add("typing-wrong");
          setTimeout(() => in3?.classList.remove("typing-wrong"), 400);
          return false;
        }
      };

      // Tự động nhận diện khi gõ đúng
      in1?.addEventListener("input", (e) => {
        if (checkHanziMatch(e.target.value, word)) checkStep1();
      });

      in2?.addEventListener("input", (e) => {
        if (checkVietnameseMatch(e.target.value, word)) checkStep2();
      });

      in3?.addEventListener("input", (e) => {
        if (checkPinyinMatch(e.target.value, word)) checkStep3();
      });

      // Nhấn Enter để chuyển ô
      in1?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          checkStep1();
        }
      });

      in2?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          checkStep2();
        }
      });

      in3?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          checkStep3();
        }
      });

      document.getElementById("typing-btn-submit-step")?.addEventListener("click", () => {
        if (t.step === 1) checkStep1();
        else if (t.step === 2) checkStep2();
        else if (t.step === 3) checkStep3();
      });

      // Auto-focus vào ô đang hoạt động
      setTimeout(() => {
        if (t.step === 1 && in1 && !in1.disabled) in1.focus();
        else if (t.step === 2 && in2 && !in2.disabled) in2.focus();
        else if (t.step === 3 && in3 && !in3.disabled) in3.focus();
      }, 70);
    }

    // B. XỬ LÝ CHẾ ĐỘ 2: GÕ NHANH CHỮ HÁN (1 Ô)
    if (t.gameMode === "rapid" && !t.revealed) {
      const rapidIn = document.getElementById("rapid-input-field");

      const handleRapidCorrect = () => {
        if (t.status === "correct") return;
        t.status = "correct";
        t.correctCount++;
        t.totalAttempts++;
        t.combo++;
        if (t.combo > t.maxCombo) t.maxCombo = t.combo;

        if (rapidIn) {
          rapidIn.classList.add("typing-correct");
          rapidIn.disabled = true;
        }

        speakChinese(word.hanzi);

        setTimeout(() => {
          t.typedCount++;
          if (t.playMode === "match20") t.matchIndex++;
          pullNextTypingWord();
          renderTyping();
          refreshIcons();
        }, 400);
      };

      const handleRapidWrong = () => {
        t.status = "wrong";
        t.combo = 0; // Đứt combo khi gõ sai
        if (rapidIn) {
          rapidIn.classList.remove("typing-wrong");
          void rapidIn.offsetWidth;
          rapidIn.classList.add("typing-wrong");
        }
      };

      rapidIn?.addEventListener("input", (e) => {
        if (checkHanziMatch(e.target.value, word)) {
          handleRapidCorrect();
        }
      });

      rapidIn?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (checkHanziMatch(rapidIn.value, word)) {
            handleRapidCorrect();
          } else {
            handleRapidWrong();
          }
        }
      });

      document.getElementById("typing-btn-submit-step")?.addEventListener("click", () => {
        if (checkHanziMatch(rapidIn?.value, word)) handleRapidCorrect();
        else handleRapidWrong();
      });

      setTimeout(() => {
        if (rapidIn && !rapidIn.disabled) rapidIn.focus();
      }, 70);
    }

    // Phím tắt Enter khi đang ở khung Xem đáp án
    if (t.revealed) {
      const onEnterNext = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          window.removeEventListener("keydown", onEnterNext);
          handleNextWord();
        }
      };
      window.addEventListener("keydown", onEnterNext, { once: true });
    }
  }


  // ============================================================
  // 13. BACKUP & RESTORE MODULE (SAO LƯU & PHỤC HỒI)
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
        if (targetView === "flash") {
          appState.flash.index = 0;
          appState.flash.isFlipped = false;
        }
        switchView(targetView);
      });
    });

    // 3. Search Bar with 150ms Debounce
    const debouncedSearch = debounce((query) => {
      appState.searchQuery = query;
      appState.study.renderedCount = appState.study.chunkSize;
      if (dom.searchClearBtn) {
        dom.searchClearBtn.classList.toggle("hidden", !query);
      }
      if (appState.currentTab === "home") {
        switchView("study");
      } else {
        renderActiveView();
      }
    }, 150);

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
