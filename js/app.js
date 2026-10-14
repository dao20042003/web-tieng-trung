(() => {
  const state = {
    view: "home",
    levelId: ProgressStore.getCurrentLevel() || 1,
    topicId: "all",
    search: "",
    filter: "all",
    flashIndex: 0,
    flipped: false,
    quiz: null,
    quizType: "cloze",
    listening: null,
    sentenceTest: null,
    reading: null,
    typing: null,
  };

  const els = {
    levelList: document.getElementById("level-list"),
    progressLabel: document.getElementById("level-progress-label"),
    progressBar: document.getElementById("level-progress-bar"),
    crumb: document.getElementById("crumb"),
    title: document.getElementById("page-title"),
    search: document.getElementById("search-input"),
    home: document.getElementById("view-home"),
    study: document.getElementById("view-study"),
    flash: document.getElementById("view-flash"),
    quiz: document.getElementById("view-quiz"),
    listening: document.getElementById("view-listening"),
    sentence: document.getElementById("view-sentence"),
    reading: document.getElementById("view-reading"),
    typing: document.getElementById("view-typing"),
  };

  function currentLevel() {
    return DataStore.getLevel(state.levelId) || DataStore.getEnabledLevels()[0];
  }

  function topics() {
    return DataStore.getTopicsByLevel(state.levelId);
  }

  function words() {
    return DataStore.getVocab({
      level: state.levelId,
      topicId: state.topicId === "all" ? undefined : state.topicId,
      search: state.search,
    }).filter((word) => {
      if (state.filter === "mastered") return ProgressStore.isMastered(state.levelId, word.id);
      if (state.filter === "learning") return !ProgressStore.isMastered(state.levelId, word.id);
      return true;
    });
  }

  let activeUtterance = null;
  let speechVoices = [];

  function loadVoices() {
    if (!window.speechSynthesis) return;
    speechVoices = window.speechSynthesis.getVoices() || [];
  }

  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  }

  function getChineseVoice() {
    if (!speechVoices.length && window.speechSynthesis) {
      loadVoices();
    }
    return (
      speechVoices.find((v) => v.lang === "zh-CN" || v.lang === "zh_CN") ||
      speechVoices.find((v) => v.lang.startsWith("zh")) ||
      null
    );
  }

  function speak(text, rate = 0.9, onEnd = null) {
    if (!window.speechSynthesis || !text) {
      if (onEnd) onEnd();
      return;
    }
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      const utter = new SpeechSynthesisUtterance(text);
      activeUtterance = utter; // Ngăn GC thu hồi mid-speech trong Chromium
      utter.lang = "zh-CN";
      utter.rate = rate;
      const voice = getChineseVoice();
      if (voice) utter.voice = voice;

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        if (activeUtterance === utter) activeUtterance = null;
        if (onEnd) onEnd();
      };

      utter.onend = finish;
      utter.onerror = () => {
        finish();
      };

      // Watchdog timeout an toàn chống trường hợp Chromium onend bị rớt
      const safeDuration = Math.max(2000, Math.min(30000, (text.length * 350) / rate + 1000));
      setTimeout(() => {
        if (!ended && activeUtterance === utter) {
          finish();
        }
      }, safeDuration);

      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.warn("speechSynthesis error:", err);
      if (onEnd) onEnd();
    }
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "check-circle" : "alert-circle";
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0 text-${type === "success" ? "emerald-400" : "vermillion"}"></i><span>${message}</span>`;
    container.appendChild(toast);
    refreshIcons();
    setTimeout(() => {
      toast.classList.add("toast-fadeout");
      setTimeout(() => toast.remove(), 320);
    }, 2800);
  }

  function setView(view) {
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
    if (state.reading) state.reading.isSpeaking = false;
    if (state.listening) state.listening.isPlaying = false;
    state.view = view;
    ["home", "study", "flash", "quiz", "listening", "sentence", "reading", "typing"].forEach((name) => {
      if (els[name]) {
        els[name].classList.toggle("hidden", name !== view);
      }
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("border-gold/40", active);
      btn.classList.toggle("bg-white/10", active);
    });
    render();
  }

  function renderLevels() {
    els.levelList.innerHTML = HSK_LEVELS.map((level) => {
      const active = level.id === state.levelId;
      const lock = level.enabled
        ? ""
        : `<i data-lucide="lock" class="w-3.5 h-3.5"></i>`;
      return `<button data-level="${level.id}" ${level.enabled ? "" : "disabled"}
        class="w-full text-left glass rounded-xl px-3 py-2.5 text-sm flex items-center justify-between
        ${active ? "border-vermillion/50 bg-white/10" : ""}
        ${level.enabled ? "" : "opacity-50 cursor-not-allowed"}">
        <span>${level.name}</span>
        <span class="text-paper/40 flex items-center gap-1">${level.enabled ? level.totalWords + " từ" : lock + " Sắp có"}</span>
      </button>`;
    }).join("");

    els.levelList.querySelectorAll("[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = DataStore.getLevel(btn.dataset.level);
        if (!level?.enabled) return;
        state.levelId = level.id;
        state.topicId = "all";
        state.quiz = null;
        state.listening = null;
        state.sentenceTest = null;
        state.reading = null;
        state.typing = null;
        ProgressStore.setCurrentLevel(level.id);
        render();
      });
    });
  }

  function renderProgress() {
    const all = DataStore.getVocab({ level: state.levelId });
    const mastered = ProgressStore.countMastered(state.levelId, all);
    const total = all.length || currentLevel()?.totalWords || 0;
    const pct = total ? Math.round((mastered / total) * 100) : 0;
    els.progressLabel.textContent = `${mastered}/${total}`;
    els.progressBar.style.width = `${pct}%`;
  }

  function topicSelect(extraClass = "") {
    const options = [`<option value="all">Tất cả chủ đề</option>`]
      .concat(topics().map((t) => `<option value="${t.id}" ${t.id === state.topicId ? "selected" : ""}>${t.name}</option>`))
      .join("");
    return `<select id="topic-select" name="topic-select" aria-label="Chọn chủ đề" class="topic-select bg-white text-black border border-white/10 rounded-xl px-3 py-2 text-sm ${extraClass}">${options}</select>`;
  }

  function renderHome() {
    const level = currentLevel();
    els.crumb.textContent = level?.name || "HSK";
    els.title.textContent = "Chọn chủ đề để học";
    const all = DataStore.getVocab({ level: state.levelId });
    const masteredAll = ProgressStore.countMastered(state.levelId, all);
    const quiz = ProgressStore.getQuizStats(state.levelId);
    const listeningStats = ProgressStore.getListeningStats(state.levelId);
    const sentenceStats = ProgressStore.getSentenceStats(state.levelId);
    const readingStats = ProgressStore.getReadingStats(state.levelId);

    els.home.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div data-goto-view="study" class="glass rounded-2xl p-4 cursor-pointer hover:border-gold/50 transition" title="Bấm để học từ vựng"><p class="text-xs text-paper/50">Từ vựng</p><p class="text-2xl mt-1">${all.length}</p></div>
        <div data-goto-view="study" class="glass rounded-2xl p-4 cursor-pointer hover:border-gold/50 transition" title="Bấm xem từ đã thuộc"><p class="text-xs text-paper/50">Đã thuộc</p><p class="text-2xl mt-1 text-gold">${masteredAll}</p></div>
        <div data-goto-view="quiz" class="glass rounded-2xl p-4 cursor-pointer hover:border-gold/50 transition" title="Bấm làm trắc nghiệm"><p class="text-xs text-paper/50">Quiz gần nhất</p><p class="text-2xl mt-1">${quiz.lastScore == null ? "—" : quiz.lastScore + "%"}</p></div>
        <div data-goto-view="listening" class="glass rounded-2xl p-4 cursor-pointer hover:border-sky-400/50 transition" title="Bấm vào Luyện nghe"><p class="text-xs text-paper/50">Luyện nghe</p><p class="text-2xl mt-1 text-sky-400">${listeningStats.lastScore == null ? "—" : listeningStats.lastScore + "%"}</p></div>
        <div data-goto-view="sentence" class="glass rounded-2xl p-4 cursor-pointer hover:border-emerald-400/50 transition" title="Bấm vào Luyện đặt câu"><p class="text-xs text-paper/50">Đặt câu</p><p class="text-2xl mt-1 text-emerald-400">${sentenceStats.lastScore == null ? "—" : sentenceStats.lastScore + "%"}</p></div>
        <div data-goto-view="reading" class="glass rounded-2xl p-4 cursor-pointer hover:border-amber-400/50 transition" title="Bấm vào Luyện đọc"><p class="text-xs text-paper/50">Bài đọc xong</p><p class="text-2xl mt-1 text-amber-400">${readingStats.count}</p></div>
      </div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        ${topics()
          .map((topic, i) => {
            const list = DataStore.getVocab({ level: state.levelId, topicId: topic.id });
            const done = ProgressStore.countMastered(state.levelId, list);
            const pct = list.length ? Math.round((done / list.length) * 100) : 0;
            return `<article class="glass rounded-3xl p-5 hover:border-gold/30 transition group">
              <div class="flex justify-between items-start">
                <span class="text-xs text-gold/80">0${i + 1}</span>
                <span class="text-xs text-paper/40">${list.length} từ</span>
              </div>
              <h3 class="hanzi text-xl mt-3">${topic.cn}</h3>
              <p class="text-sm text-paper/70 mt-1">${topic.name}</p>
              <div class="progress-bar mt-4"><span style="width:${pct}%"></span></div>
              <p class="text-[11px] text-paper/40 mt-2">${done}/${list.length} đã thuộc</p>
              <div class="flex gap-2 mt-4">
                <button data-open-study="${topic.id}" class="flex-1 bg-vermillion/80 hover:bg-vermillion rounded-xl py-2 text-sm">Học</button>
                <button data-open-flash="${topic.id}" class="px-3 glass rounded-xl" title="Flashcard"><i data-lucide="layers" class="w-4 h-4"></i></button>
                <button data-open-quiz="${topic.id}" class="px-3 glass rounded-xl" title="Quiz"><i data-lucide="list-checks" class="w-4 h-4"></i></button>
                <button data-open-listening="${topic.id}" class="px-3 glass rounded-xl text-sky-400 hover:text-sky-300" title="Luyện nghe"><i data-lucide="headphones" class="w-4 h-4"></i></button>
              </div>
            </article>`;
          })
          .join("")}
      </div>`;

    els.home.querySelectorAll("[data-goto-view]").forEach((card) => {
      card.addEventListener("click", () => {
        const v = card.dataset.gotoView;
        if (v === "listening") {
          startListening();
          setView("listening");
          playCurrentListeningWord();
          return;
        }
        if (v === "reading") {
          initReading();
          setView("reading");
          return;
        }
        if (v === "sentence") {
          startSentenceTest();
          setView("sentence");
          return;
        }
        if (v === "quiz") {
          startQuiz();
          setView("quiz");
          return;
        }
        setView(v);
      });
    });

    els.home.querySelectorAll("[data-open-study]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.topicId = btn.dataset.openStudy;
        setView("study");
      });
    });
    els.home.querySelectorAll("[data-open-flash]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.topicId = btn.dataset.openFlash;
        state.flashIndex = 0;
        state.flipped = false;
        setView("flash");
      });
    });
    els.home.querySelectorAll("[data-open-quiz]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.topicId = btn.dataset.openQuiz;
        startQuiz();
        setView("quiz");
      });
    });
    els.home.querySelectorAll("[data-open-listening]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.topicId = btn.dataset.openListening;
        startListening();
        setView("listening");
        playCurrentListeningWord();
      });
    });
  }

  function renderStudy() {
    const topic = DataStore.getTopic(state.topicId);
    els.crumb.textContent = "Học từ vựng";
    els.title.textContent = topic ? topic.name : "Toàn bộ từ vựng";
    const list = words();

    els.study.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-5">
        ${topicSelect()}
        <select id="study-filter-select" name="study-filter-select" aria-label="Lọc từ vựng" class="filter-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
          <option value="all" ${state.filter === "all" ? "selected" : ""}>Tất cả</option>
          <option value="learning" ${state.filter === "learning" ? "selected" : ""}>Chưa thuộc</option>
          <option value="mastered" ${state.filter === "mastered" ? "selected" : ""}>Đã thuộc</option>
        </select>
      </div>
      <div class="grid gap-2">
        ${
          list.length
            ? list
                .map((word) => {
                  const mastered = ProgressStore.isMastered(state.levelId, word.id);
                  return `<div class="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                    <button data-speak="${word.hanzi}" class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0 hover:bg-gold/20 text-gold transition" title="Phát âm">
                      <i data-lucide="volume-2" class="w-4 h-4"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                      <p class="hanzi text-2xl leading-none">${word.hanzi}</p>
                      <p class="text-sm text-gold/80 mt-1">${word.pinyin}</p>
                    </div>
                    <p class="text-sm text-paper/70 hidden sm:block">${word.meaning}</p>
                    <button data-master="${word.id}" class="text-xs rounded-full px-3 py-1 border transition ${
                      mastered ? "border-emerald-500/60 bg-emerald-900/40 text-emerald-200" : "border-white/15 text-paper/60 hover:border-gold/40"
                    }">${mastered ? "Đã thuộc" : "Chưa thuộc"}</button>
                  </div>`;
                })
                .join("")
            : `<p class="text-paper/50">Không có từ nào khớp bộ lọc.</p>`
        }
      </div>`;

    els.study.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      render();
    });
    els.study.querySelector(".filter-select")?.addEventListener("change", (e) => {
      state.filter = e.target.value;
      render();
    });
    els.study.querySelectorAll("[data-speak]").forEach((btn) => {
      btn.addEventListener("click", () => speak(btn.dataset.speak));
    });
    els.study.querySelectorAll("[data-master]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ProgressStore.toggleMastered(state.levelId, Number(btn.dataset.master));
        render();
      });
    });
  }

  // ================= MODULE 1: FLASHCARD =================
  function renderFlash() {
    const list = words();
    const word = list[state.flashIndex] || null;
    const topic = DataStore.getTopic(state.topicId);
    els.crumb.textContent = "Flashcard";
    els.title.textContent = topic ? topic.cn : "Luyện thẻ ghi nhớ";

    if (!word) {
      els.flash.innerHTML = `<p class="text-paper/50">Không có thẻ nào. Hãy đổi bộ lọc hoặc chủ đề.</p>`;
      return;
    }

    const mastered = ProgressStore.isMastered(state.levelId, word.id);
    els.flash.innerHTML = `
      <div class="max-w-xl mx-auto">
        <div class="flex flex-wrap gap-2 mb-5">
          ${topicSelect("flex-1")}
        </div>
        <p class="text-center text-xs text-paper/40 mb-3">${state.flashIndex + 1} / ${list.length}</p>
        <div class="flip-scene">
          <div class="flip-card ${state.flipped ? "is-flipped" : ""}" id="flash-card">
            
            <!-- Mặt trước (Front Card): Chỉ Hán tự to ở giữa, nút loa TTS, dòng hướng dẫn nhỏ (KHÔNG có Pinyin) -->
            <div class="flip-face flip-front relative select-none">
              <div class="flex-1 flex flex-col items-center justify-center w-full">
                <p class="hanzi text-6xl sm:text-7xl font-bold tracking-wide text-center drop-shadow-sm">${word.hanzi}</p>
                <button id="flash-speak-front" class="flash-speaker-btn mt-6" title="Nghe phát âm">
                  <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
                </button>
              </div>
              <p class="text-xs text-paper/40 mt-auto pt-4 flex items-center gap-1.5 tracking-wide">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5 opacity-60"></i> Nhấn để lật thẻ
              </p>
            </div>

            <!-- Mặt sau (Back Card): Hán tự nhỏ hơn phía trên -> Pinyin chuẩn thanh điệu -> Nghĩa tiếng Việt -> Nút loa TTS -->
            <div class="flip-face flip-back relative select-none">
              <div class="flex-1 flex flex-col items-center justify-center w-full text-center">
                <p class="hanzi text-3xl sm:text-4xl text-paper/75 font-medium mb-2">${word.hanzi}</p>
                <p class="text-xl sm:text-2xl text-gold font-semibold mb-3 tracking-wide">${word.pinyin}</p>
                <p class="text-2xl sm:text-3xl font-bold text-paper max-w-md leading-relaxed">${word.meaning}</p>
                <button id="flash-speak-back" class="flash-speaker-btn mt-6" title="Nghe phát âm">
                  <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
                </button>
              </div>
              <p class="text-xs text-paper/40 mt-auto pt-4 flex items-center gap-1.5 tracking-wide">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5 opacity-60"></i> Nhấn để lật lại
              </p>
            </div>

          </div>
        </div>

        <div class="flex items-center justify-between mt-6 gap-2">
          <button id="flash-prev" class="glass rounded-xl px-5 py-2.5 text-sm hover:border-gold/40 transition">Trước</button>
          <button id="flash-master" class="rounded-xl px-5 py-2.5 text-sm font-medium transition ${mastered ? "bg-emerald-800/80 text-emerald-100" : "bg-vermillion/90 text-white"}">${
            mastered ? "Bỏ đánh dấu" : "Đã thuộc"
          }</button>
          <button id="flash-next" class="glass rounded-xl px-5 py-2.5 text-sm hover:border-gold/40 transition">Sau</button>
        </div>
      </div>`;

    els.flash.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      state.flashIndex = 0;
      state.flipped = false;
      render();
    });

    const flashCardEl = document.getElementById("flash-card");
    flashCardEl?.addEventListener("click", () => {
      state.flipped = !state.flipped;
      flashCardEl.classList.toggle("is-flipped", state.flipped);
    });

    // Nút phát âm mặt trước (ngăn lật thẻ)
    document.getElementById("flash-speak-front")?.addEventListener("click", (e) => {
      e.stopPropagation();
      speak(word.hanzi);
    });

    // Nút phát âm mặt sau (ngăn lật thẻ)
    document.getElementById("flash-speak-back")?.addEventListener("click", (e) => {
      e.stopPropagation();
      speak(word.hanzi);
    });

    document.getElementById("flash-master")?.addEventListener("click", () => {
      ProgressStore.toggleMastered(state.levelId, word.id);
      render();
    });

    document.getElementById("flash-prev")?.addEventListener("click", () => {
      state.flashIndex = (state.flashIndex - 1 + list.length) % list.length;
      state.flipped = false;
      render();
    });

    document.getElementById("flash-next")?.addEventListener("click", () => {
      state.flashIndex = (state.flashIndex + 1) % list.length;
      state.flipped = false;
      render();
    });
  }

  // ================= TRẮC NGHIỆM THUẦN CHỮ HÁN (PURE HANZI QUIZ) =================
  function highlightSentenceAnswer(fullCn, answer) {
    if (!fullCn || !answer) return fullCn || "";
    const idx = fullCn.indexOf(answer);
    if (idx === -1) return fullCn;
    const before = fullCn.slice(0, idx);
    const after = fullCn.slice(idx + answer.length);
    return `${before}<span class="text-gold font-bold underline underline-offset-4 decoration-gold/60">${answer}</span>${after}`;
  }

  function renderClozePrompt(promptCn) {
    if (!promptCn) return "";
    return promptCn.replace(
      /\[ ____ \]|____/g,
      `<span class="inline-block px-3 py-0.5 mx-1.5 border-b-2 border-dashed border-gold text-gold font-bold tracking-widest">____</span>`
    );
  }

  function makeClozeQuestion(sentence, levelVocab) {
    const fullText = (sentence.correctOrder || []).join("");
    let fullWithPunc = fullText;
    if (!/[。？！,.?!]$/.test(fullWithPunc)) {
      fullWithPunc += sentence.vietnamese && sentence.vietnamese.endsWith("?") ? "？" : "。";
    }

    // Tìm các từ trong levelVocab có mặt trong câu
    const matches = levelVocab.filter((w) => w.hanzi && fullText.includes(w.hanzi));
    let targetWord = null;

    if (matches.length > 0) {
      // Ưu tiên từ có độ dài >= 2 hoặc chọn ngẫu nhiên trong các từ match
      const sorted = [...matches].sort((a, b) => b.hanzi.length - a.hanzi.length);
      const topCandidates = sorted.slice(0, Math.min(4, sorted.length));
      targetWord = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    } else {
      // Fallback: lấy token từ correctOrder (dài 1-4 ký tự, không phải dấu câu)
      const validTokens = (sentence.correctOrder || []).filter(
        (t) => t.length >= 1 && t.length <= 4 && !/[。？！,.?!，]/.test(t)
      );
      const chosenToken = validTokens.length
        ? validTokens[Math.floor(Math.random() * validTokens.length)]
        : sentence.correctOrder[0] || "好";
      const found = typeof VOCAB_DATA !== "undefined" ? VOCAB_DATA.find((w) => w.hanzi === chosenToken) : null;
      targetWord = found || {
        hanzi: chosenToken,
        pinyin: sentence.pinyin || "",
        meaning: sentence.vietnamese || "",
      };
    }

    const promptCn = fullWithPunc.replace(targetWord.hanzi, " ____ ");
    const answer = targetWord.hanzi;

    // 3 từ gây nhiễu cùng cấp độ HSK, không trùng đáp án và không xuất hiện trong câu
    const distractorPool = levelVocab.filter(
      (w) => w.hanzi !== answer && !fullText.includes(w.hanzi)
    );
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

  function startQuiz(customQuestions = null) {
    const levelVocab = DataStore.getVocab({ level: state.levelId });
    if (customQuestions && customQuestions.length) {
      state.quiz = {
        items: customQuestions,
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

    const type = state.quizType || "cloze";
    let questions = [];

    if (type === "cloze") {
      const allSentences = DataStore.getSentences({ level: state.levelId });
      let candidateSentences = allSentences;

      if (state.topicId !== "all") {
        const topicWords = DataStore.getVocab({ level: state.levelId, topicId: state.topicId });
        const matched = allSentences.filter((s) => {
          const text = (s.correctOrder || []).join("");
          return topicWords.some((w) => text.includes(w.hanzi));
        });
        if (matched.length >= 10) {
          candidateSentences = matched;
        } else {
          const rest = allSentences.filter((s) => !matched.includes(s));
          candidateSentences = matched.concat(rest);
        }
      }

      const count = Math.min(20, candidateSentences.length);
      const chosen = shuffle(candidateSentences).slice(0, count);
      questions = chosen.map((s) => makeClozeQuestion(s, levelVocab));

      if (questions.length === 0) {
        const pool = DataStore.getVocab({ level: state.levelId });
        const countPool = Math.min(20, pool.length);
        questions = shuffle(pool).slice(0, countPool).map((w) => makeListenHanziQuestion(w, levelVocab));
      }
    } else {
      const pool = DataStore.getVocab({
        level: state.levelId,
        topicId: state.topicId === "all" ? undefined : state.topicId,
      });
      const source = pool.length >= 4 ? pool : levelVocab;
      const count = Math.min(20, source.length);
      const chosen = shuffle(source).slice(0, count);
      questions = chosen.map((w) => makeListenHanziQuestion(w, levelVocab));
    }

    state.quiz = {
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

  function renderQuiz() {
    els.crumb.textContent = "Trắc nghiệm";
    const topic = DataStore.getTopic(state.topicId);
    els.title.textContent = topic ? `Trắc nghiệm Hán tự · ${topic.name}` : "Trắc nghiệm thuần chữ Hán";

    if (!state.quiz) startQuiz();
    const quiz = state.quiz;
    if (!quiz.items.length) {
      els.quiz.innerHTML = `<div class="max-w-md mx-auto glass rounded-3xl p-8 text-center text-paper/50">Không đủ dữ liệu để tạo bài trắc nghiệm.</div>`;
      return;
    }

    // Màn hình tổng kết khi hoàn thành 20/20 câu
    if (quiz.done) {
      const pct = Math.round((quiz.correct / quiz.items.length) * 100);
      let evalText = "Cần rèn luyện thêm khả năng nhận diện chữ Hán.";
      let evalColor = "text-vermillion";
      if (pct >= 90) {
        evalText = "Xuất sắc! Khả năng nhận diện chữ Hán tuyệt vời!";
        evalColor = "text-emerald-400";
      } else if (pct >= 70) {
        evalText = "Khá tốt! Bạn đã nắm vững mặt chữ Hán cấp độ này.";
        evalColor = "text-gold";
      } else if (pct >= 50) {
        evalText = "Đạt yêu cầu cơ bản, cần ôn tập thêm để phản xạ nhanh hơn.";
        evalColor = "text-amber-300";
      }

      els.quiz.innerHTML = `
        <div class="max-w-xl mx-auto glass rounded-3xl p-8 text-center relative overflow-hidden">
          <div class="seal hanzi text-3xl mx-auto mb-3">测</div>
          <h2 class="text-2xl font-bold">Hoàn thành Trắc nghiệm Hán tự!</h2>
          <p class="text-xs text-paper/50 mt-1 uppercase tracking-wider">HSK ${state.levelId} · ${state.quizType === "cloze" ? "Điền câu Hán tự" : "Nghe chọn Hán tự"} · ${quiz.items.length} câu</p>

          <div class="my-6 py-5 border-y border-white/10 flex justify-around items-center">
            <div>
              <p class="text-xs text-paper/50">Điểm số</p>
              <p class="text-3xl font-bold mt-1 text-gold">${quiz.correct} / ${quiz.items.length}</p>
            </div>
            <div class="h-10 w-px bg-white/10"></div>
            <div>
              <p class="text-xs text-paper/50">Độ chính xác</p>
              <p class="text-3xl font-bold mt-1 text-emerald-400">${pct}%</p>
            </div>
          </div>

          <p class="text-sm font-medium ${evalColor} mb-6">${evalText}</p>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button id="quiz-retry" class="flex-1 bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Làm lại lượt mới
            </button>
            ${
              quiz.wrongList.length > 0
                ? `<button id="quiz-review-wrong-btn" class="flex-1 glass border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition">
                    <i data-lucide="book-marked" class="w-4 h-4"></i> Ôn lại các câu sai (${quiz.wrongList.length})
                  </button>`
                : ""
            }
          </div>
        </div>

        ${
          quiz.showReviewModal && quiz.wrongList.length > 0
            ? `<div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="glass border border-white/20 rounded-3xl max-w-xl w-full p-6 max-h-[85vh] flex flex-col relative animate-fade-in shadow-2xl">
                  <div class="flex items-center justify-between pb-4 border-b border-white/10">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                      </div>
                      <div>
                        <h3 class="font-semibold text-base">Câu trắc nghiệm làm sai (${quiz.wrongList.length})</h3>
                        <p class="text-xs text-paper/50">Xem lại đáp án và giải thích chi tiết</p>
                      </div>
                    </div>
                    <button id="close-quiz-modal" class="p-2 rounded-xl text-paper/50 hover:text-paper hover:bg-white/10 transition">
                      <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                  </div>

                  <div class="overflow-y-auto space-y-3 py-4 flex-1 pr-1 custom-scroll">
                    ${quiz.wrongList
                      .map(
                        (item) => `
                        <div class="glass rounded-xl p-3 border border-white/5 hover:border-white/15 transition">
                          <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                              <p class="hanzi text-lg font-medium text-paper">${item.type === "cloze" ? highlightSentenceAnswer(item.fullCn, item.answer) : item.targetWord.hanzi}</p>
                              <p class="text-xs text-gold mt-1">${item.sentencePinyin}</p>
                              <p class="text-xs text-paper/70 mt-0.5">${item.sentenceVietnamese}</p>
                              <div class="mt-2 text-xs text-emerald-400 font-medium">
                                Đáp án đúng: <b class="hanzi text-gold text-sm ml-1">${item.answer}</b> ${item.targetWord.meaning ? `(${item.targetWord.meaning})` : ""}
                              </div>
                            </div>
                            <button data-review-speak="${(item.type === "cloze" ? item.fullCn : item.targetWord.hanzi).replace(/"/g, "&quot;")}" class="w-9 h-9 rounded-full bg-white/5 hover:bg-gold/20 text-gold flex items-center justify-center shrink-0 transition" title="Nghe phát âm">
                              <i data-lucide="volume-2" class="w-4 h-4"></i>
                            </button>
                          </div>
                        </div>`
                      )
                      .join("")}
                  </div>

                  <div class="pt-4 border-t border-white/10 flex gap-3">
                    <button id="quiz-retry-wrong-btn" class="flex-1 bg-amber-500/90 hover:bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition">
                      <i data-lucide="play" class="w-4 h-4"></i> Luyện lại các câu này
                    </button>
                    <button id="close-quiz-modal-btn" class="px-5 glass rounded-xl text-sm font-medium hover:bg-white/10 transition">
                      Đóng
                    </button>
                  </div>
                </div>
              </div>`
            : ""
        }
      `;

      document.getElementById("quiz-retry")?.addEventListener("click", () => {
        startQuiz();
        renderQuiz();
      });

      document.getElementById("quiz-review-wrong-btn")?.addEventListener("click", () => {
        quiz.showReviewModal = true;
        renderQuiz();
      });

      document.getElementById("close-quiz-modal")?.addEventListener("click", () => {
        quiz.showReviewModal = false;
        renderQuiz();
      });

      document.getElementById("close-quiz-modal-btn")?.addEventListener("click", () => {
        quiz.showReviewModal = false;
        renderQuiz();
      });

      document.getElementById("quiz-retry-wrong-btn")?.addEventListener("click", () => {
        const wrongItems = [...quiz.wrongList];
        startQuiz(wrongItems);
        renderQuiz();
      });

      els.quiz.querySelectorAll("[data-review-speak]").forEach((btn) => {
        btn.addEventListener("click", () => {
          speak(btn.dataset.reviewSpeak);
        });
      });

      refreshIcons();
      return;
    }

    // Màn hình làm bài (100% Chữ Hán)
    const q = quiz.items[quiz.index];
    const progressPct = Math.round(((quiz.index + 1) / quiz.items.length) * 100);

    els.quiz.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <!-- Top bar: Bộ lọc chủ đề & Thanh chuyển đổi 2 hình thức thuần Hán tự -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            ${topicSelect("text-xs py-1.5")}
          </div>

          <!-- Thanh chuyển đổi 2 hình thức thuần Hán tự -->
          <div class="flex rounded-xl glass p-0.5 border border-white/10 text-xs">
            <button data-quiz-type="cloze" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${state.quizType === "cloze" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Điền câu Hán tự</span>
            </button>
            <button data-quiz-type="listen" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${state.quizType === "listen" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"}">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
              <span>Nghe chọn Hán tự</span>
            </button>
          </div>
        </div>

        <!-- Thanh tiến độ câu hỏi -->
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span>Câu ${quiz.index + 1} / ${quiz.items.length}</span>
          <span class="text-gold font-medium">${quiz.correct} câu đúng</span>
        </div>
        <div class="progress-bar mb-5">
          <span style="width: ${progressPct}%"></span>
        </div>

        <!-- Khung nội dung câu hỏi -->
        <div class="glass rounded-3xl p-6 relative overflow-hidden">
          <!-- Thanh trạng thái & Nút gợi ý nghĩa -->
          <div class="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-white/10">
            <div class="flex items-center gap-2">
              <span class="seal hanzi text-sm">测</span>
              <span class="text-xs uppercase tracking-wider text-gold/80 font-medium">
                ${q.type === "cloze" ? "Điền từ vào câu chữ Hán" : "Nghe âm thanh chọn chữ Hán"}
              </span>
            </div>

            <div class="flex items-center gap-2">
              ${
                q.type === "cloze"
                  ? `<button id="quiz-speak-btn" class="glass px-3 py-1 rounded-xl text-xs text-paper/70 hover:text-gold transition flex items-center gap-1.5" title="Phát âm câu">
                      <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> <span>Nghe câu</span>
                    </button>`
                  : ""
              }
              <button id="quiz-hint-btn" class="glass px-3 py-1 rounded-xl text-xs ${quiz.showHint ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-paper/70 hover:text-amber-300"} transition flex items-center gap-1.5" title="Gợi ý nghĩa nếu quá khó">
                <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-300"></i>
                <span>${quiz.showHint ? "Ẩn gợi ý" : "💡 Gợi ý nghĩa"}</span>
              </button>
            </div>
          </div>

          <!-- Khung gợi ý nghĩa (Chỉ hiện khi người dùng bấm nút) -->
          ${
            quiz.showHint
              ? `<div class="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2 animate-fade-in">
                  <i data-lucide="info" class="w-4 h-4 shrink-0 text-amber-400 mt-0.5"></i>
                  <div>
                    <span class="font-semibold text-amber-300">Gợi ý nghĩa tiếng Việt:</span>
                    <p class="mt-0.5 text-paper/90 leading-relaxed">${q.type === "cloze" ? q.sentenceVietnamese : q.targetWord.meaning}</p>
                  </div>
                </div>`
              : ""
          }

          <!-- Câu hỏi trung tâm: 100% THUẦN CHỮ HÁN -->
          ${
            q.type === "cloze"
              ? `<div class="py-6 px-3 text-center">
                  <div class="hanzi text-2xl sm:text-3xl font-medium leading-relaxed text-paper">
                    ${renderClozePrompt(q.promptCn)}
                  </div>
                </div>`
              : `<div class="py-6 flex flex-col items-center justify-center text-center">
                  <button id="quiz-speaker-main-btn" class="listening-speaker-btn hover:scale-105 active:scale-95 transition" title="Bấm để nghe phát âm">
                    <i data-lucide="volume-2" class="w-12 h-12 text-gold"></i>
                  </button>
                  <p class="text-xs text-paper/50 mt-3">Bấm vào loa để nghe lại âm thanh</p>
                </div>`
          }

          <!-- 4 Nút đáp án: 100% THUẦN CHỮ HÁN -->
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
                  <button data-quiz-choice="${choice.hanzi.replace(/"/g, "&quot;")}" class="${btnClass}" ${quiz.answered ? "disabled" : ""}>
                    <span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-paper/80">${letter}</span>
                    <div class="flex-1 min-w-0">
                      <span class="hanzi text-2xl sm:text-3xl font-medium tracking-wide text-paper">${choice.hanzi}</span>
                      ${
                        quiz.answered
                          ? `<div class="text-[11px] text-paper/50 mt-0.5 flex items-center gap-1.5 animate-fade-in">
                              <span class="text-gold/80">${choice.pinyin}</span> · <span>${choice.meaning}</span>
                            </div>`
                          : ""
                      }
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>

          <!-- KHUNG GIẢI THÍCH (Chỉ mở khóa sau khi bấm chọn đáp án) -->
          ${
            quiz.answered
              ? `<div class="mt-6 pt-5 border-t border-white/10 animate-fade-in">
                  <div class="rounded-2xl p-4 border transition ${quiz.isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : "border-vermillion/50 bg-vermillion/10"}">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1.5">
                          <i data-lucide="${quiz.isCorrect ? "check-circle" : "alert-circle"}" class="w-5 h-5 shrink-0 ${quiz.isCorrect ? "text-emerald-400" : "text-vermillion"}"></i>
                          <span class="text-sm font-semibold ${quiz.isCorrect ? "text-emerald-400" : "text-vermillion"}">
                            ${quiz.isCorrect ? "Chính xác!" : `Chưa đúng! Đáp án đúng: ${q.answer}`}
                          </span>
                        </div>

                        ${
                          q.type === "cloze"
                            ? `<div class="mt-2 text-left">
                                <div class="hanzi text-xl font-medium text-paper">
                                  ${highlightSentenceAnswer(q.fullCn, q.answer)}
                                </div>
                                <p class="text-xs text-gold font-medium mt-1">${q.sentencePinyin}</p>
                                <p class="text-xs text-paper/80 mt-0.5">${q.sentenceVietnamese}</p>

                                <div class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                                  <div>
                                    <span class="text-paper/50">Từ cần điền:</span>
                                    <b class="hanzi text-gold text-base ml-1.5">${q.targetWord.hanzi}</b>
                                    <span class="text-paper/60 ml-1">(${q.targetWord.pinyin})</span>
                                    <span class="text-paper/90 ml-1.5">— ${q.targetWord.meaning}</span>
                                  </div>
                                  <button id="quiz-speak-full" class="text-gold hover:text-gold/80 flex items-center gap-1 transition" title="Nghe câu hoàn chỉnh">
                                    <i data-lucide="volume-2" class="w-4 h-4"></i> Nghe câu
                                  </button>
                                </div>
                              </div>`
                            : `<div class="mt-2 text-left flex items-center justify-between gap-4">
                                <div>
                                  <div class="flex items-baseline gap-2">
                                    <span class="hanzi text-3xl font-bold text-gold">${q.targetWord.hanzi}</span>
                                    <span class="text-sm font-semibold text-gold/90">${q.targetWord.pinyin}</span>
                                  </div>
                                  <p class="text-xs text-paper/80 mt-1">${q.targetWord.meaning}</p>
                                </div>
                                <button id="quiz-speak-full" class="w-10 h-10 rounded-full bg-white/10 hover:bg-gold/20 text-gold flex items-center justify-center shrink-0 transition" title="Nghe lại">
                                  <i data-lucide="volume-2" class="w-5 h-5"></i>
                                </button>
                              </div>`
                        }
                      </div>
                    </div>

                    <!-- Nút Câu tiếp theo -->
                    <button id="quiz-next-btn" class="w-full mt-4 bg-vermillion hover:bg-vermillion/90 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-vermillion/30 transition">
                      <span>${quiz.index + 1 >= quiz.items.length ? "Hoàn thành & Xem kết quả" : "Câu tiếp theo"}</span>
                      <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>`
              : ""
          }
        </div>
      </div>`;

    // Sự kiện chuyển đổi hình thức trắc nghiệm
    els.quiz.querySelectorAll("[data-quiz-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.quizType = btn.dataset.quizType;
        startQuiz();
        renderQuiz();
      });
    });

    // Sự kiện đổi chủ đề
    els.quiz.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      startQuiz();
      renderQuiz();
    });

    // Sự kiện gợi ý nghĩa
    document.getElementById("quiz-hint-btn")?.addEventListener("click", () => {
      quiz.showHint = !quiz.showHint;
      renderQuiz();
    });

    // Sự kiện phát âm câu hỏi
    document.getElementById("quiz-speak-btn")?.addEventListener("click", () => {
      speak(q.fullCn || q.targetWord.hanzi);
    });

    document.getElementById("quiz-speaker-main-btn")?.addEventListener("click", () => {
      speak(q.targetWord.hanzi);
    });

    document.getElementById("quiz-speak-full")?.addEventListener("click", () => {
      speak(q.type === "cloze" ? q.fullCn : q.targetWord.hanzi);
    });

    // Sự kiện chọn đáp án
    els.quiz.querySelectorAll("[data-quiz-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (quiz.answered) return;
        quiz.answered = true;
        const picked = btn.dataset.quizChoice;
        quiz.selectedHanzi = picked;
        const ok = picked === q.answer;
        quiz.isCorrect = ok;

        if (ok) {
          quiz.correct += 1;
        } else {
          quiz.wrongList.push(q);
        }

        // Tự động phát âm từ/câu khi chọn
        speak(q.type === "cloze" ? q.fullCn : q.targetWord.hanzi);
        renderQuiz();
      });
    });

    // Sự kiện chuyển câu
    document.getElementById("quiz-next-btn")?.addEventListener("click", () => {
      if (quiz.index + 1 >= quiz.items.length) {
        quiz.done = true;
        ProgressStore.recordQuiz(state.levelId, quiz.correct, quiz.items.length);
        renderQuiz();
      } else {
        quiz.index += 1;
        quiz.answered = false;
        quiz.selectedHanzi = null;
        quiz.isCorrect = null;
        quiz.showHint = false;
        renderQuiz();
        if (quiz.items[quiz.index].type === "listen") {
          speak(quiz.items[quiz.index].targetWord.hanzi);
        }
      }
    });

    refreshIcons();
  }

  // ================= MODULE: LUYỆN NGHE PHẢN XẠ (LISTENING QUIZ) =================
  function startListening(customPool = null) {
    const defaultPool = DataStore.getVocab({
      level: state.levelId,
      topicId: state.topicId === "all" ? undefined : state.topicId,
    });
    const fullLevelPool = DataStore.getVocab({ level: state.levelId });
    const sourcePool = customPool || (defaultPool.length >= 4 ? defaultPool : fullLevelPool);
    const count = Math.min(20, sourcePool.length);
    const selected = shuffle(sourcePool).slice(0, count);

    state.listening = {
      items: selected.map((word) => makeListeningQuestion(word, fullLevelPool)),
      index: 0,
      correct: 0,
      answered: false,
      selectedWordId: null,
      isCorrect: null,
      autoTimer: null,
      speed: 1.0,
      mode: "meaning", // "meaning" | "hanzi"
      isPlaying: false,
      showPinyinHint: false,
      wrongList: [],
      done: false,
      showReviewModal: false,
    };
  }

  function makeListeningQuestion(word, pool) {
    const distractorsPool = pool.filter(
      (w) => w.id !== word.id && w.hanzi !== word.hanzi && w.meaning !== word.meaning
    );
    const distractors = shuffle(distractorsPool).slice(0, 3);
    const choiceWords = shuffle([word, ...distractors]);
    return {
      word,
      choiceWords,
    };
  }

  function playCurrentListeningWord(rateOverride = null) {
    if (!state.listening || state.listening.done) return;
    const q = state.listening.items[state.listening.index];
    if (!q) return;
    const rate = rateOverride != null ? rateOverride : (state.listening.speed || 1.0);
    state.listening.isPlaying = true;
    updateListeningSpeakerUi(true);
    speak(q.word.hanzi, rate, () => {
      if (state.listening) {
        state.listening.isPlaying = false;
        updateListeningSpeakerUi(false);
      }
    });
  }

  function updateListeningSpeakerUi(isPlaying) {
    const btn = document.getElementById("listening-speaker-btn");
    const wave = document.getElementById("listening-sound-bars");
    if (btn) btn.classList.toggle("is-playing", isPlaying);
    if (wave) wave.classList.toggle("opacity-0", !isPlaying);
  }

  function advanceListening() {
    if (!state.listening) return;
    if (state.listening.autoTimer) {
      clearTimeout(state.listening.autoTimer);
      state.listening.autoTimer = null;
    }
    const lst = state.listening;
    if (lst.index + 1 >= lst.items.length) {
      lst.done = true;
      ProgressStore.recordListening(state.levelId, lst.correct, lst.items.length);
      renderListening();
    } else {
      lst.index += 1;
      lst.answered = false;
      lst.selectedWordId = null;
      lst.isCorrect = null;
      lst.showPinyinHint = false;
      renderListening();
      playCurrentListeningWord();
    }
  }

  function renderListening() {
    els.crumb.textContent = "Luyện nghe";
    const topic = DataStore.getTopic(state.topicId);
    els.title.textContent = topic ? `Luyện nghe · ${topic.name}` : "Luyện nghe phản xạ";

    if (!state.listening) {
      startListening();
      playCurrentListeningWord();
    }

    const lst = state.listening;
    if (!lst.items.length) {
      els.listening.innerHTML = `
        <div class="max-w-md mx-auto glass rounded-3xl p-8 text-center">
          <p class="text-paper/60">Không đủ từ vựng để tạo bài luyện nghe cho cấp độ này.</p>
        </div>`;
      return;
    }

    // Màn hình tổng kết khi hoàn thành 20/20 câu
    if (lst.done) {
      const pct = Math.round((lst.correct / lst.items.length) * 100);
      let evalText = "Cần rèn luyện thêm phản xạ nghe.";
      let evalColor = "text-vermillion";
      if (pct >= 90) {
        evalText = "Phản xạ xuất sắc! Khả năng nghe vượt trội!";
        evalColor = "text-emerald-400";
      } else if (pct >= 70) {
        evalText = "Khá tốt! Hãy duy trì luyện tập đều đặn!";
        evalColor = "text-gold";
      } else if (pct >= 50) {
        evalText = "Đạt yêu cầu cơ bản, cần tăng tốc độ nhận diện âm.";
        evalColor = "text-amber-300";
      }

      els.listening.innerHTML = `
        <div class="max-w-xl mx-auto glass rounded-3xl p-8 text-center relative overflow-hidden">
          <div class="seal hanzi text-3xl mx-auto mb-3">听</div>
          <h2 class="text-2xl font-bold">Hoàn thành bài luyện nghe!</h2>
          <p class="text-xs text-paper/50 mt-1 uppercase tracking-wider">HSK ${state.levelId} · ${lst.items.length} câu phản xạ</p>

          <div class="my-6 py-5 border-y border-white/10 flex justify-around items-center">
            <div>
              <p class="text-xs text-paper/50">Điểm số</p>
              <p class="text-3xl font-bold mt-1 text-gold">${lst.correct} / ${lst.items.length}</p>
            </div>
            <div class="h-10 w-px bg-white/10"></div>
            <div>
              <p class="text-xs text-paper/50">Độ chính xác</p>
              <p class="text-3xl font-bold mt-1 text-sky-400">${pct}%</p>
            </div>
          </div>

          <p class="text-sm font-medium ${evalColor} mb-6">${evalText}</p>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button id="listening-retry" class="flex-1 bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Luyện nghe lượt mới
            </button>
            ${
              lst.wrongList.length > 0
                ? `<button id="listening-review-wrong-btn" class="flex-1 glass border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition">
                    <i data-lucide="book-marked" class="w-4 h-4"></i> Ôn lại các từ nghe sai (${lst.wrongList.length})
                  </button>`
                : ""
            }
          </div>
        </div>

        ${
          lst.showReviewModal && lst.wrongList.length > 0
            ? `<div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="glass border border-white/20 rounded-3xl max-w-xl w-full p-6 max-h-[85vh] flex flex-col relative animate-fade-in shadow-2xl">
                  <div class="flex items-center justify-between pb-4 border-b border-white/10">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                      </div>
                      <div>
                        <h3 class="font-semibold text-base">Từ vựng nghe sai (${lst.wrongList.length})</h3>
                        <p class="text-xs text-paper/50">Bấm loa để nghe lại hoặc luyện tập riêng các từ này</p>
                      </div>
                    </div>
                    <button id="close-listening-modal" class="p-2 rounded-xl text-paper/50 hover:text-paper hover:bg-white/10 transition">
                      <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                  </div>

                  <div class="overflow-y-auto space-y-2 py-4 flex-1 pr-1 custom-scroll">
                    ${lst.wrongList
                      .map(
                        (item) => `
                        <div class="glass rounded-xl p-3 flex items-center justify-between gap-3 border border-white/5 hover:border-white/15 transition">
                          <div class="flex items-center gap-3">
                            <button data-review-speak="${item.word.hanzi}" class="w-9 h-9 rounded-full bg-white/5 hover:bg-gold/20 text-gold flex items-center justify-center shrink-0 transition" title="Nghe phát âm">
                              <i data-lucide="volume-2" class="w-4 h-4"></i>
                            </button>
                            <div>
                              <div class="flex items-baseline gap-2">
                                <span class="hanzi text-lg font-bold">${item.word.hanzi}</span>
                                <span class="text-xs text-gold">${item.word.pinyin}</span>
                              </div>
                              <p class="text-xs text-paper/70 mt-0.5">${item.word.meaning}</p>
                            </div>
                          </div>
                          <span class="text-[11px] px-2 py-1 rounded-md bg-vermillion/20 text-vermillion shrink-0">Nghe sai</span>
                        </div>`
                      )
                      .join("")}
                  </div>

                  <div class="pt-4 border-t border-white/10 flex gap-3">
                    <button id="listening-retry-wrong-btn" class="flex-1 bg-amber-500/90 hover:bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition">
                      <i data-lucide="play" class="w-4 h-4"></i> Luyện nghe lại nhóm từ này
                    </button>
                    <button id="close-listening-modal-btn" class="px-5 glass rounded-xl text-sm font-medium hover:bg-white/10 transition">
                      Đóng
                    </button>
                  </div>
                </div>
              </div>`
            : ""
        }
      `;

      document.getElementById("listening-retry")?.addEventListener("click", () => {
        startListening();
        renderListening();
        playCurrentListeningWord();
      });

      document.getElementById("listening-review-wrong-btn")?.addEventListener("click", () => {
        lst.showReviewModal = true;
        renderListening();
      });

      document.getElementById("close-listening-modal")?.addEventListener("click", () => {
        lst.showReviewModal = false;
        renderListening();
      });

      document.getElementById("close-listening-modal-btn")?.addEventListener("click", () => {
        lst.showReviewModal = false;
        renderListening();
      });

      document.getElementById("listening-retry-wrong-btn")?.addEventListener("click", () => {
        const wrongWords = lst.wrongList.map((item) => item.word);
        startListening(wrongWords);
        renderListening();
        playCurrentListeningWord();
      });

      els.listening.querySelectorAll("[data-review-speak]").forEach((btn) => {
        btn.addEventListener("click", () => {
          speak(btn.dataset.reviewSpeak, lst.speed);
        });
      });

      refreshIcons();
      return;
    }

    // Màn hình làm bài (Audio First)
    const q = lst.items[lst.index];
    const progressPct = Math.round(((lst.index + 1) / lst.items.length) * 100);

    els.listening.innerHTML = `
      <div class="max-w-xl mx-auto">
        <!-- Thanh trạng thái & cài đặt -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            ${topicSelect("text-xs py-1.5")}
          </div>

          <div class="flex items-center gap-2">
            <!-- Nút gợi ý phát âm khi audio không khả dụng -->
            <button id="listening-hint-btn" class="glass px-2.5 py-1 rounded-xl text-xs ${lst.showPinyinHint ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-paper/60 hover:text-amber-300"} transition flex items-center gap-1" title="Hiện phiên âm nếu không nghe được âm thanh">
              <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-300"></i>
              <span>${lst.showPinyinHint ? "Ẩn âm" : "Gợi ý âm"}</span>
            </button>

            <!-- Chọn chế độ đáp án -->
            <div class="flex rounded-xl glass p-0.5 border border-white/10 text-xs">
              <button data-listen-mode="meaning" class="px-2.5 py-1 rounded-lg transition ${lst.mode === "meaning" ? "bg-white/15 text-white font-medium" : "text-paper/60 hover:text-paper"}">
                Nghĩa Việt
              </button>
              <button data-listen-mode="hanzi" class="px-2.5 py-1 rounded-lg transition ${lst.mode === "hanzi" ? "bg-white/15 text-white font-medium" : "text-paper/60 hover:text-paper"}">
                Hán tự
              </button>
            </div>

            <!-- Tốc độ đọc -->
            <div class="flex items-center gap-1">
              <button data-listen-speed="1.0" class="speed-btn ${lst.speed === 1.0 ? "is-active" : ""}">1.0x</button>
              <button data-listen-speed="0.75" class="speed-btn ${lst.speed === 0.75 ? "is-active" : ""}">0.75x</button>
            </div>
          </div>
        </div>

        <!-- Khung gợi ý Pinyin nếu bật -->
        ${
          lst.showPinyinHint
            ? `<div class="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 text-center animate-fade-in flex items-center justify-center gap-2">
                <i data-lucide="info" class="w-4 h-4 text-amber-400 shrink-0"></i>
                <span>Phiên âm: <b class="font-mono text-amber-300 text-sm ml-1">${q.word.pinyin}</b></span>
              </div>`
            : ""
        }

        <!-- Thanh tiến độ câu hỏi -->
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span>Câu ${lst.index + 1} / ${lst.items.length}</span>
          <span class="text-emerald-400 font-medium">${lst.correct} đúng</span>
        </div>
        <div class="progress-bar mb-6">
          <span style="width: ${progressPct}%"></span>
        </div>

        <!-- Khung âm thanh trung tâm (Audio First) -->
        <div class="glass rounded-3xl p-6 text-center mb-5 flex flex-col items-center justify-center relative overflow-hidden">
          <button id="listening-speaker-btn" class="listening-speaker-btn ${lst.isPlaying ? "is-playing" : ""}" title="Bấm để nghe phát âm">
            <i data-lucide="volume-2" class="w-12 h-12 text-gold"></i>
          </button>

          <div class="mt-3 flex flex-col items-center gap-1">
            <span class="text-xs text-paper/60">Bấm vào loa để nghe lại âm thanh</span>
            <div id="listening-sound-bars" class="sound-bars ${lst.isPlaying ? "" : "opacity-0"} transition-opacity">
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
              <span class="sound-bar"></span>
            </div>
          </div>
        </div>

        <!-- Khung hiển thị kết quả sau khi trả lời -->
        <div class="mb-5 min-h-[76px]">
          ${
            !lst.answered
              ? `<div class="h-[76px] flex items-center justify-center text-paper/40 text-xs border border-dashed border-white/10 rounded-2xl bg-white/[0.02] px-4 text-center">
                  <div class="flex items-center gap-2">
                    <i data-lucide="headphones" class="w-4 h-4 text-sky-400"></i>
                    <span>Chữ Hán & Pinyin được ẩn ban đầu. Lắng nghe và chọn đáp án đúng bên dưới!</span>
                  </div>
                </div>`
              : `<div class="rounded-2xl p-4 border transition ${lst.isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : "border-vermillion/50 bg-vermillion/10"} flex items-center justify-between gap-3 animate-fade-in">
                  <div class="flex items-center gap-3">
                    <button id="listening-revealed-speak" class="w-10 h-10 rounded-full bg-white/10 hover:bg-gold/20 text-gold flex items-center justify-center shrink-0 transition" title="Nghe lại">
                      <i data-lucide="volume-2" class="w-5 h-5"></i>
                    </button>
                    <div>
                      <div class="flex items-baseline gap-2">
                        <span class="hanzi text-2xl font-bold text-paper">${q.word.hanzi}</span>
                        <span class="text-sm font-semibold text-gold">${q.word.pinyin}</span>
                      </div>
                      <p class="text-xs text-paper/80 mt-0.5">${q.word.meaning}</p>
                    </div>
                  </div>
                  ${
                    !lst.isCorrect
                      ? `<button id="listening-next-btn" class="bg-vermillion hover:bg-vermillion/90 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-vermillion/30">
                          <span>Câu tiếp theo</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        </button>`
                      : `<div class="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold shrink-0">
                          <i data-lucide="check-circle" class="w-4 h-4"></i>
                          <span>Chính xác (+1)</span>
                        </div>`
                  }
                </div>`
          }
        </div>

        <!-- 4 thẻ lựa chọn đáp án -->
        <div class="grid sm:grid-cols-2 gap-3">
          ${q.choiceWords
            .map((cw, idx) => {
              const letter = ["A", "B", "C", "D"][idx];
              const isTarget = Number(cw.id) === Number(q.word.id);
              const isPicked = lst.selectedWordId != null && Number(cw.id) === Number(lst.selectedWordId);
              let btnClass = "listen-choice-btn";
              if (lst.answered) {
                if (isTarget) {
                  btnClass += lst.isCorrect ? " is-correct" : " flash-correct";
                } else if (isPicked && !lst.isCorrect) {
                  btnClass += " is-wrong";
                }
              }

              const content =
                lst.mode === "meaning"
                  ? `<span class="text-sm font-medium leading-relaxed">${cw.meaning}</span>`
                  : `<span class="hanzi text-xl font-medium">${cw.hanzi}</span>`;

              return `<button data-listen-choice="${cw.id}" class="${btnClass}" ${lst.answered ? "disabled" : ""}>
                <span class="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-paper/80">${letter}</span>
                <div class="flex-1 min-w-0">${content}</div>
              </button>`;
            })
            .join("")}
        </div>
      </div>
    `;

    // Sự kiện nút gợi ý phiên âm
    document.getElementById("listening-hint-btn")?.addEventListener("click", () => {
      lst.showPinyinHint = !lst.showPinyinHint;
      renderListening();
    });

    // Sự kiện chọn đáp án
    els.listening.querySelectorAll("[data-listen-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (lst.answered) return;
        const pickedId = Number(btn.dataset.listenChoice);
        lst.answered = true;
        lst.selectedWordId = pickedId;
        const isOk = pickedId === Number(q.word.id);
        lst.isCorrect = isOk;

        if (isOk) {
          lst.correct += 1;
          renderListening();
          lst.autoTimer = setTimeout(advanceListening, 1200);
        } else {
          lst.wrongList.push({ word: q.word, selectedId: pickedId });
          renderListening();
        }
      });
    });

    // Sự kiện nút loa trung tâm
    document.getElementById("listening-speaker-btn")?.addEventListener("click", () => {
      playCurrentListeningWord();
    });

    // Sự kiện nút phát âm lại trên thẻ revealed
    document.getElementById("listening-revealed-speak")?.addEventListener("click", () => {
      playCurrentListeningWord();
    });

    // Sự kiện chuyển câu khi chọn sai
    document.getElementById("listening-next-btn")?.addEventListener("click", () => {
      advanceListening();
    });

    // Sự kiện thay đổi tốc độ phát
    els.listening.querySelectorAll("[data-listen-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = parseFloat(btn.dataset.listenSpeed);
        lst.speed = speed;
        renderListening();
        playCurrentListeningWord(speed);
      });
    });

    // Sự kiện đổi chế độ hiển thị (Nghĩa Việt / Hán tự)
    els.listening.querySelectorAll("[data-listen-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lst.mode = btn.dataset.listenMode;
        renderListening();
      });
    });

    // Sự kiện đổi topic
    els.listening.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      startListening();
      renderListening();
      playCurrentListeningWord();
    });

    refreshIcons();
  }

  // ================= MODULE 3: LUYỆN ĐẶT CÂU (SENTENCE BUILDING TEST) =================
  function startSentenceTest() {
    const pool = DataStore.getSentences({ level: state.levelId });
    const count = Math.min(20, pool.length);
    const selected = shuffle(pool).slice(0, count);

    state.sentenceTest = {
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
      showReviewModal: false,
    };
    loadSentenceQuestion();
  }

  function loadSentenceQuestion() {
    const test = state.sentenceTest;
    if (!test || !test.questions[test.index]) return;
    const q = test.questions[test.index];
    test.currentAnswer = [];
    test.checked = false;
    test.isCorrect = null;
    test.revealed = false;

    // Phân tách các khối từ để xáo trộn cho người dùng ghép
    const tokens = q.correctOrder.map((word, idx) => ({
      id: `${q.id}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      text: word,
      used: false,
    }));
    test.bankTokens = shuffle(tokens);
  }

  function renderSentence() {
    els.crumb.textContent = "Luyện tập ngữ pháp";
    els.title.textContent = `Luyện đặt câu ${currentLevel()?.name || "HSK"}`;

    if (!state.sentenceTest || !state.sentenceTest.questions.length) {
      startSentenceTest();
    }
    const test = state.sentenceTest;
    if (!test || !test.questions.length) {
      els.sentence.innerHTML = `<p class="text-paper/50">Không đủ dữ liệu câu hỏi cho cấp độ này.</p>`;
      return;
    }

    if (test.done) {
      renderSentenceResult();
      return;
    }

    const q = test.questions[test.index];
    const progressPct = Math.round(((test.index) / test.questions.length) * 100);

    els.sentence.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span class="font-medium text-gold">Câu ${test.index + 1} / ${test.questions.length}</span>
          <span>${test.correctCount} câu đúng</span>
        </div>
        <div class="progress-bar mb-6">
          <span style="width: ${progressPct}%"></span>
        </div>

        <div class="glass rounded-3xl p-6 sm:p-8">
          <div class="flex items-start justify-between gap-4 mb-5">
            <div>
              <p class="text-xs uppercase tracking-wider text-gold/80 font-medium">Ghép các từ theo thứ tự đúng</p>
              <h3 class="text-xl sm:text-2xl font-semibold mt-1 text-paper leading-snug">${q.vietnamese}</h3>
            </div>
            <button id="sentence-tts-btn" class="flash-speaker-btn shrink-0" title="Nghe câu tiếng Trung">
              <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
            </button>
          </div>

          <!-- Answer Zone (Vùng ghép câu) -->
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs text-paper/50">Vùng ghép câu (nhấn vào từ để gỡ bỏ):</p>
            ${
              test.currentAnswer.length && !test.checked
                ? `<button id="btn-clear-all" class="text-[11px] text-paper/40 hover:text-vermillion transition">Xóa hết</button>`
                : ""
            }
          </div>
          <div id="answer-zone" class="answer-zone ${test.currentAnswer.length ? "has-items" : ""} ${
            test.checked ? (test.isCorrect ? "sentence-correct" : "sentence-wrong") : ""
          }">
            ${
              test.currentAnswer.length
                ? test.currentAnswer
                    .map(
                      (token) =>
                        `<button data-answer-id="${token.id}" class="word-chip word-chip-answer" ${test.checked ? "disabled" : ""} title="Nhấn để gỡ">
                          <span>${token.text}</span>
                          ${!test.checked ? '<i data-lucide="x" class="w-3.5 h-3.5 opacity-60"></i>' : ''}
                        </button>`
                    )
                    .join("")
                : `<p class="text-paper/40 text-sm select-none py-2">Nhấn vào các khối từ bên dưới để ghép câu...</p>`
            }
          </div>

          <!-- Feedback & Reveal Zone -->
          ${
            test.checked
              ? `
              <div class="mt-4 p-4 rounded-2xl transition ${
                test.isCorrect ? "bg-emerald-950/40 border border-emerald-500/40" : "bg-red-950/40 border border-vermillion/40"
              }">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i data-lucide="${test.isCorrect ? "check-circle" : "x-circle"}" class="w-5 h-5 ${
                      test.isCorrect ? "text-emerald-400" : "text-vermillion"
                    }"></i>
                    <span class="font-medium text-sm ${test.isCorrect ? "text-emerald-300" : "text-red-300"}">
                      ${test.isCorrect ? "Chính xác! Thứ tự câu rất chuẩn!" : "Chưa chính xác!"}
                    </span>
                  </div>
                  <button id="feedback-tts-btn" class="text-xs text-paper/60 hover:text-gold flex items-center gap-1">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> Nghe lại
                  </button>
                </div>
                ${
                  !test.isCorrect
                    ? test.revealed
                      ? `<div class="mt-3 pt-3 border-t border-white/10">
                          <p class="text-xs text-paper/50">Đáp án chuẩn:</p>
                          <p class="hanzi text-2xl font-semibold text-gold mt-1">${q.correctOrder.join("")}</p>
                          <p class="text-sm text-paper/80 mt-0.5">${q.pinyin}</p>
                        </div>`
                      : `<button id="btn-reveal-answer" class="mt-3 text-xs text-gold underline hover:text-gold/80 flex items-center gap-1">
                          <i data-lucide="eye" class="w-3.5 h-3.5"></i> Xem đáp án
                        </button>`
                    : `<div class="mt-2 text-xs text-paper/70">${q.pinyin}</div>`
                }
              </div>`
              : ""
          }

          <!-- Word Bank (Kho từ vựng) -->
          <p class="text-xs text-paper/50 mt-6 mb-2">Kho từ vựng (nhấn để chọn):</p>
          <div class="flex flex-wrap gap-2.5 p-4 rounded-2xl bg-white/5 border border-white/10 min-h-[68px]">
            ${test.bankTokens
              .map(
                (token) =>
                  `<button data-bank-id="${token.id}" class="word-chip ${token.used ? "is-used" : ""}" ${
                    token.used || test.checked ? "disabled" : ""
                  }>
                    ${token.text}
                  </button>`
              )
              .join("")}
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-white/10">
            <button id="btn-sentence-reset" class="glass rounded-xl px-4 py-2.5 text-sm hover:border-gold/40 transition" ${
              test.checked || !test.currentAnswer.length ? "disabled opacity-40 cursor-not-allowed" : ""
            }>
              Đặt lại
            </button>
            
            <div class="flex items-center gap-2">
              ${
                !test.checked
                  ? `<button id="btn-sentence-check" class="bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-6 py-2.5 text-sm font-medium transition shadow-lg shadow-vermillion/20 ${
                      !test.currentAnswer.length ? "opacity-50 cursor-not-allowed" : ""
                    }" ${!test.currentAnswer.length ? "disabled" : ""}>
                      Kiểm tra
                    </button>`
                  : `<button id="btn-sentence-next" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-700/20">
                      <span>${test.index + 1 >= test.questions.length ? "Xem kết quả" : "Câu tiếp theo"}</span>
                      <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>`
              }
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById("sentence-tts-btn")?.addEventListener("click", () => {
      speak(q.correctOrder.join(""));
    });

    document.getElementById("feedback-tts-btn")?.addEventListener("click", () => {
      speak(q.correctOrder.join(""));
    });

    // Chọn từ trong Word Bank
    els.sentence.querySelectorAll("[data-bank-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (test.checked) return;
        const tokenId = btn.dataset.bankId;
        const token = test.bankTokens.find((t) => t.id === tokenId);
        if (!token || token.used) return;
        token.used = true;
        test.currentAnswer.push(token);
        renderSentence();
        refreshIcons();
      });
    });

    // Gỡ từ khỏi Answer Zone
    els.sentence.querySelectorAll("[data-answer-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (test.checked) return;
        const tokenId = btn.dataset.answerId;
        const tokenIndex = test.currentAnswer.findIndex((t) => t.id === tokenId);
        if (tokenIndex === -1) return;
        const [removed] = test.currentAnswer.splice(tokenIndex, 1);
        const bankToken = test.bankTokens.find((t) => t.id === removed.id);
        if (bankToken) bankToken.used = false;
        renderSentence();
        refreshIcons();
      });
    });

    // Nút Xóa hết
    document.getElementById("btn-clear-all")?.addEventListener("click", () => {
      if (test.checked) return;
      test.currentAnswer = [];
      test.bankTokens.forEach((t) => (t.used = false));
      renderSentence();
      refreshIcons();
    });

    // Nút Đặt lại
    document.getElementById("btn-sentence-reset")?.addEventListener("click", () => {
      if (test.checked) return;
      test.currentAnswer = [];
      test.bankTokens.forEach((t) => (t.used = false));
      renderSentence();
      refreshIcons();
    });

    // Nút Kiểm tra
    document.getElementById("btn-sentence-check")?.addEventListener("click", () => {
      if (test.checked || !test.currentAnswer.length) return;
      const answeredText = test.currentAnswer.map((t) => t.text).join("");
      const correctText = q.correctOrder.join("");
      test.checked = true;
      test.isCorrect = answeredText === correctText;
      if (test.isCorrect) {
        test.correctCount += 1;
        speak(correctText);
      } else {
        if (!test.wrongList.some((item) => item.id === q.id)) {
          test.wrongList.push(q);
        }
      }
      renderSentence();
      refreshIcons();
    });

    // Nút Xem đáp án
    document.getElementById("btn-reveal-answer")?.addEventListener("click", () => {
      test.revealed = true;
      renderSentence();
      refreshIcons();
    });

    // Nút Câu tiếp theo / Xem kết quả
    document.getElementById("btn-sentence-next")?.addEventListener("click", () => {
      if (test.index + 1 >= test.questions.length) {
        test.done = true;
        ProgressStore.recordSentence(state.levelId, test.correctCount, test.questions.length);
      } else {
        test.index += 1;
        loadSentenceQuestion();
      }
      renderSentence();
      refreshIcons();
    });
  }

  // Màn hình tổng kết Luyện đặt câu
  function renderSentenceResult() {
    const test = state.sentenceTest;
    const total = test.questions.length;
    const correct = test.correctCount;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    let evaluation = "Cần cố gắng hơn! Hãy xem lại các câu sai để ghi nhớ nhé.";
    let badgeColor = "text-amber-400";
    if (pct >= 90) {
      evaluation = `🎉 Xuất sắc! Bạn nắm rất vững cấu trúc câu ngữ pháp ${currentLevel()?.name || "HSK"}!`;
      badgeColor = "text-emerald-400";
    } else if (pct >= 70) {
      evaluation = "👏 Khá tốt! Bạn đã hiểu hầu hết cấu trúc câu cơ bản.";
      badgeColor = "text-gold";
    } else if (pct >= 50) {
      evaluation = "💪 Tạm ổn! Hãy luyện thêm để ghép từ chuẩn xác hơn.";
      badgeColor = "text-amber-300";
    }

    els.sentence.innerHTML = `
      <div class="max-w-xl mx-auto glass rounded-3xl p-8 sm:p-10 text-center">
        <div class="seal mx-auto mb-4 text-xl">测</div>
        <h3 class="text-2xl font-bold">Hoàn thành bài luyện đặt câu</h3>
        
        <div class="my-6 py-6 border-y border-white/10">
          <p class="text-5xl font-extrabold ${badgeColor}">${pct}%</p>
          <p class="text-paper/70 mt-2 font-medium">${correct} / ${total} câu đúng</p>
          <p class="text-sm text-paper/80 mt-3 max-w-md mx-auto leading-relaxed">${evaluation}</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button id="btn-sentence-retry" class="bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-6 py-3 text-sm font-medium transition flex items-center justify-center gap-2">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Làm bài test mới
          </button>
          ${
            test.wrongList.length
              ? `<button id="btn-sentence-review" class="glass rounded-xl px-6 py-3 text-sm font-medium hover:border-gold/50 transition flex items-center justify-center gap-2 text-gold">
                  <i data-lucide="book-open" class="w-4 h-4"></i> Xem lại ${test.wrongList.length} câu sai
                </button>`
              : ""
          }
        </div>
      </div>

      <!-- Modal Xem lại các câu sai -->
      <div id="sentence-review-modal" class="app-modal-backdrop ${test.showReviewModal ? "" : "hidden"}">
        <div class="app-modal-content">
          <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div class="flex items-center gap-2">
              <div class="seal text-sm">错</div>
              <h4 class="text-lg font-semibold">Các câu làm sai (${test.wrongList.length})</h4>
            </div>
            <button id="btn-close-review" class="glass rounded-full w-8 h-8 flex items-center justify-center text-paper/60 hover:text-paper" title="Đóng">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="space-y-3">
            ${test.wrongList
              .map(
                (item, i) => `
              <div class="glass rounded-2xl p-4 flex flex-col gap-2">
                <div class="flex items-start justify-between gap-3">
                  <span class="text-xs text-gold/80 font-mono">#${i + 1}</span>
                  <p class="text-sm font-medium flex-1 text-paper/90">${item.vietnamese}</p>
                  <button data-speak-text="${item.correctOrder.join("")}" class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold/20 text-gold shrink-0 transition" title="Nghe phát âm">
                    <i data-lucide="volume-2" class="w-4 h-4"></i>
                  </button>
                </div>
                <div class="pt-2 border-t border-white/5">
                  <p class="hanzi text-xl font-medium text-emerald-400">${item.correctOrder.join("")}</p>
                  <p class="text-xs text-paper/60 mt-0.5">${item.pinyin}</p>
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>
      </div>`;

    document.getElementById("btn-sentence-retry")?.addEventListener("click", () => {
      startSentenceTest();
      renderSentence();
      refreshIcons();
    });

    document.getElementById("btn-sentence-review")?.addEventListener("click", () => {
      test.showReviewModal = true;
      document.getElementById("sentence-review-modal")?.classList.remove("hidden");
      refreshIcons();
    });

    document.getElementById("btn-close-review")?.addEventListener("click", () => {
      test.showReviewModal = false;
      document.getElementById("sentence-review-modal")?.classList.add("hidden");
    });

    document.getElementById("sentence-review-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "sentence-review-modal") {
        test.showReviewModal = false;
        document.getElementById("sentence-review-modal")?.classList.add("hidden");
      }
    });

    els.sentence.querySelectorAll("[data-speak-text]").forEach((btn) => {
      btn.addEventListener("click", () => {
        speak(btn.dataset.speakText);
      });
    });
  }

  // ================= MODULE: LUYỆN ĐỌC HIỂU (HSK READING) =================
  function initReading(typeFilter = null) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (typeFilter) {
      if (state.reading) state.reading.typeFilter = typeFilter;
    }
    const filter = (state.reading && state.reading.typeFilter) || "all";
    const passages = DataStore.getReadings({
      level: state.levelId,
      type: filter === "all" ? undefined : filter,
    });

    state.reading = {
      typeFilter: filter,
      passages: passages,
      index: 0,
      showPinyin: false,
      isSpeaking: false,
      userClozeAnswers: {},
      activeBlank: "1",
      userQaSelection: null,
      checked: false,
      isCorrect: null,
    };
    setupCurrentReading();
  }

  function setupCurrentReading() {
    if (!state.reading || !state.reading.passages.length) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.reading.isSpeaking = false;
    const r = state.reading.passages[state.reading.index];
    state.reading.userClozeAnswers = {};
    state.reading.activeBlank = "1";
    state.reading.userQaSelection = null;
    state.reading.checked = false;
    state.reading.isCorrect = null;
    state.reading.showPinyin = false;
  }

  function renderClozePassageText(passage, userAnswers, activeBlank, checked, answers) {
    return passage.replace(/\[(\d+)\]/g, (match, num) => {
      const filled = userAnswers[num];
      const isActive = activeBlank === num && !checked;
      let statusClass = "";
      if (checked) {
        const isOk = filled === answers[num];
        statusClass = isOk ? "slot-correct" : "slot-wrong";
      }
      return `<span class="cloze-slot ${isActive ? "is-active" : ""} ${filled ? "is-filled" : ""} ${statusClass}" data-blank-id="${num}" title="${filled ? "Bấm để tháo từ" : "Bấm để chọn ô điền"}">
        <span class="text-xs text-gold/80 font-mono mr-0.5">[${num}]</span>
        <span class="hanzi text-xl">${filled || "____"}</span>
      </span>`;
    });
  }

  function renderReading() {
    els.crumb.textContent = "Luyện đọc hiểu";
    els.title.textContent = `${currentLevel()?.name || "HSK"} · Đọc hiểu & Điền từ`;

    if (!state.reading) initReading();

    const readingState = state.reading;
    const list = readingState.passages;

    if (!list.length) {
      els.reading.innerHTML = `
        <div class="max-w-md mx-auto glass rounded-3xl p-8 text-center">
          <p class="text-paper/60">Chưa có bài đọc nào cho bộ lọc này ở cấp độ hiện tại.</p>
          <button id="reading-reset-filter" class="mt-4 px-4 py-2 bg-vermillion rounded-xl text-xs font-semibold">Xem tất cả bài đọc</button>
        </div>
      `;
      document.getElementById("reading-reset-filter")?.addEventListener("click", () => {
        initReading("all");
        renderReading();
      });
      return;
    }

    const r = list[readingState.index];
    const isDone = ProgressStore.isReadingDone(state.levelId, r.id);

    // Tính tổng số bài từng loại
    const allPassages = DataStore.getReadings({ level: state.levelId });
    const countAll = allPassages.length;
    const countCloze = allPassages.filter((x) => x.type === "cloze").length;
    const countQa = allPassages.filter((x) => x.type === "qa").length;

    // Chuẩn bị văn bản phát âm sạch
    let speechPassage = r.passage;
    if (r.type === "cloze" && r.answers) {
      speechPassage = r.passage.replace(/\[(\d+)\]/g, (m, k) => r.answers[k] || "");
    }

    els.reading.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-5">
        <!-- Thanh chuyển đổi bộ lọc dạng bài đọc & Tiến độ -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex rounded-xl glass p-0.5 border border-white/10 text-xs">
            <button data-reading-filter="all" class="px-3 py-1.5 rounded-lg transition ${readingState.typeFilter === "all" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"}">
              Tất cả (${countAll})
            </button>
            <button data-reading-filter="cloze" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${readingState.typeFilter === "cloze" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Điền từ (${countCloze})
            </button>
            <button data-reading-filter="qa" class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${readingState.typeFilter === "qa" ? "bg-white/15 text-white font-medium shadow-sm" : "text-paper/60 hover:text-paper"}">
              <i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Đọc hiểu (${countQa})
            </button>
          </div>

          <div class="flex items-center gap-2 text-xs">
            ${
              isDone
                ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Đã hoàn thành
                  </span>`
                : ""
            }
            <span class="text-paper/60 font-medium">Bài ${readingState.index + 1} / ${list.length}</span>
          </div>
        </div>

        <!-- Khung hiển thị bài đọc chính -->
        <article class="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-white/10">
          <!-- Thanh công cụ hỗ trợ ngay trên đoạn văn -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
            <div class="flex items-center gap-2">
              <span class="seal hanzi text-sm">读</span>
              <div>
                <h3 class="font-bold text-base text-paper">${r.title}</h3>
                <span class="text-[11px] text-paper/50 uppercase tracking-wider">
                  ${r.type === "cloze" ? "选词填空 · Điền từ vào đoạn văn" : "阅读理解 · Đọc hiểu trả lời câu hỏi"}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="reading-speak-btn" class="glass px-3 py-1.5 rounded-xl text-xs ${readingState.isSpeaking ? "text-vermillion border-vermillion/40 bg-vermillion/10" : "text-paper/80 hover:text-gold"} transition flex items-center gap-1.5" title="${readingState.isSpeaking ? "Bấm để dừng đọc" : "Nghe phát âm toàn bài"}">
                <i data-lucide="${readingState.isSpeaking ? "square" : "volume-2"}" class="w-3.5 h-3.5 ${readingState.isSpeaking ? "text-vermillion" : "text-gold"}"></i>
                <span>${readingState.isSpeaking ? "⏹ Dừng đọc" : "🔊 Nghe đoạn văn"}</span>
              </button>

              <button id="reading-toggle-pinyin-btn" class="glass px-3 py-1.5 rounded-xl text-xs ${readingState.showPinyin ? "text-gold border-gold/40 bg-gold/10" : "text-paper/70 hover:text-paper"} transition flex items-center gap-1.5">
                <i data-lucide="languages" class="w-3.5 h-3.5"></i>
                <span>${readingState.showPinyin ? "Ẩn Pinyin" : "Hiện Pinyin"}</span>
              </button>
            </div>
          </div>

          <!-- Đoạn văn chữ Hán (Cỡ lớn 1.35rem, giãn dòng thoáng) -->
          <div class="reading-passage-box p-2 select-text">
            ${
              r.type === "cloze"
                ? renderClozePassageText(r.passage, readingState.userClozeAnswers, readingState.activeBlank, readingState.checked, r.answers)
                : r.passage
            }
          </div>

          <!-- Khung Pinyin (khi người dùng bấm Hiện Pinyin) -->
          ${
            readingState.showPinyin
              ? `<div class="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs sm:text-sm text-gold leading-relaxed font-mono animate-fade-in">
                  <div class="text-[10px] text-paper/40 uppercase tracking-wider mb-1 font-sans">Phiên âm Pinyin:</div>
                  ${r.pinyin}
                </div>`
              : ""
          }

          <!-- PHẦN TƯƠNG TÁC THEO TỪNG DẠNG BÀI TẬP -->
          ${
            r.type === "cloze"
              ? `<!-- Kho từ vựng gợi ý (Word Bank) -->
                <div class="mt-6 pt-5 border-t border-white/10">
                  <div class="flex items-center justify-between text-xs text-paper/70 mb-2.5">
                    <span class="font-medium text-gold/90 flex items-center gap-1.5">
                      <i data-lucide="layers" class="w-3.5 h-3.5"></i> Kho từ vựng (Word Bank):
                    </span>
                    <span class="text-paper/40 text-[11px]">Bấm ô trống rồi bấm từ để điền</span>
                  </div>

                  <div class="flex flex-wrap gap-2.5">
                    ${r.wordBank
                      .map((word) => {
                        const isUsed = Object.values(readingState.userClozeAnswers).includes(word);
                        return `
                          <button data-word-chip="${word}" class="reading-word-chip ${isUsed ? "is-used" : ""}" ${readingState.checked ? "disabled" : ""}>
                            <span class="hanzi">${word}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                  <p class="text-[11px] text-paper/40 mt-2 italic">* Mẹo: Bấm trực tiếp vào ô đã điền trên đoạn văn để tháo từ trả về kho.</p>
                </div>`
              : `<!-- Câu hỏi đọc hiểu và 4 đáp án -->
                <div class="mt-6 pt-5 border-t border-white/10">
                  <div class="mb-3">
                    <div class="flex items-start justify-between gap-3">
                      <p class="hanzi text-lg sm:text-xl font-medium text-paper flex items-start gap-2">
                        <span class="seal text-xs shrink-0 mt-0.5">问</span>
                        <span>${r.question}</span>
                      </p>
                      <button id="qa-speak-question-btn" class="w-8 h-8 rounded-full bg-white/5 hover:bg-gold/20 text-gold flex items-center justify-center shrink-0 transition" title="Nghe câu hỏi">
                        <i data-lucide="volume-2" class="w-4 h-4"></i>
                      </button>
                    </div>
                    ${readingState.showPinyin && r.questionPinyin ? `<p class="text-xs text-gold/80 mt-1 ml-9 font-mono">${r.questionPinyin}</p>` : ""}
                  </div>

                  <div class="grid sm:grid-cols-2 gap-3 mt-4">
                    ${r.options
                      .map((opt, idx) => {
                        const letter = ["A", "B", "C", "D"][idx];
                        let btnClass = "qa-option-btn";
                        if (readingState.userQaSelection === idx) {
                          btnClass += " is-selected";
                        }
                        if (readingState.checked) {
                          if (idx === r.correctIndex) {
                            btnClass += " is-correct";
                          } else if (readingState.userQaSelection === idx && idx !== r.correctIndex) {
                            btnClass += " is-wrong";
                          }
                        }
                        return `
                          <button data-qa-option="${idx}" class="${btnClass}" ${readingState.checked ? "disabled" : ""}>
                            <span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-paper/80">${letter}</span>
                            <span class="hanzi text-base sm:text-lg flex-1 min-w-0">${opt}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                </div>`
          }

          <!-- NÚT HÀNH ĐỘNG KIỂM TRA ĐÁP ÁN -->
          <div class="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-3">
            ${
              !readingState.checked
                ? `<button id="btn-reading-check" class="bg-vermillion hover:bg-vermillion/90 text-white font-semibold py-3 px-8 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-vermillion/30 transition">
                    <i data-lucide="check" class="w-4 h-4"></i> Kiểm tra đáp án
                  </button>`
                : `<button id="btn-reading-retry" class="glass hover:bg-white/10 text-paper font-semibold py-3 px-6 rounded-xl text-sm flex items-center justify-center gap-2 transition">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Làm lại bài này
                  </button>`
            }
          </div>

          <!-- PHẦN MỞ KHÓA GIẢI THÍCH (Sau khi kiểm tra đáp án) -->
          ${
            readingState.checked
              ? `<div class="mt-6 pt-5 border-t border-white/10 animate-fade-in space-y-3">
                  <!-- Đánh giá kết quả -->
                  <div class="p-4 rounded-2xl border ${
                    readingState.isCorrect
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-vermillion/15 border-vermillion/40 text-red-300"
                  } flex items-center gap-3">
                    <i data-lucide="${readingState.isCorrect ? "check-circle" : "alert-circle"}" class="w-5 h-5 shrink-0"></i>
                    <div class="text-xs sm:text-sm">
                      <b>${readingState.isCorrect ? "Chính xác hoàn toàn!" : "Chưa hoàn toàn chính xác!"}</b>
                      ${
                        r.type === "cloze" && !readingState.isCorrect
                          ? `<span class="block mt-0.5 text-paper/80">Đáp án chuẩn: ${Object.entries(r.answers).map(([k, v]) => `[${k}]: <b>${v}</b>`).join("  ·  ")}</span>`
                          : ""
                      }
                      ${
                        r.type === "qa" && !readingState.isCorrect
                          ? `<span class="block mt-0.5 text-paper/80">Đáp án chuẩn: <b>${["A", "B", "C", "D"][r.correctIndex]}. ${r.options[r.correctIndex]}</b></span>`
                          : ""
                      }
                    </div>
                  </div>

                  <!-- Phiên âm Pinyin toàn bài -->
                  <div class="glass rounded-2xl p-4">
                    <p class="text-[11px] text-gold font-mono uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <i data-lucide="languages" class="w-3.5 h-3.5"></i> Phiên âm Pinyin toàn bài:
                    </p>
                    <p class="text-xs sm:text-sm text-gold leading-relaxed font-mono">${r.pinyin}</p>
                  </div>

                  <!-- Bản dịch tiếng Việt -->
                  <div class="glass rounded-2xl p-4">
                    <p class="text-[11px] text-paper/50 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Bản dịch nghĩa tiếng Việt:
                    </p>
                    <p class="text-xs sm:text-sm text-paper/90 leading-relaxed">${r.translation}</p>
                  </div>
                </div>`
              : ""
          }
        </article>

        <!-- THANH ĐIỀU HƯỚNG BÀI ĐỌC (Bài trước / Bài tiếp theo) -->
        <div class="flex items-center justify-between pt-2">
          <button id="reading-prev-btn" class="glass px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 transition disabled:opacity-30 disabled:pointer-events-none" ${readingState.index === 0 ? "disabled" : ""}>
            <i data-lucide="chevron-left" class="w-4 h-4"></i> Bài trước
          </button>

          <span class="text-xs text-paper/50">
            Bài ${readingState.index + 1} / ${list.length}
          </span>

          <button id="reading-next-btn" class="glass px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 transition disabled:opacity-30 disabled:pointer-events-none" ${readingState.index === list.length - 1 ? "disabled" : ""}>
            Bài tiếp theo <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;

    // Sự kiện bộ lọc dạng bài đọc
    els.reading.querySelectorAll("[data-reading-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        initReading(btn.dataset.readingFilter);
        renderReading();
      });
    });

    // Sự kiện bấm chọn ô điền (Cloze slot)
    els.reading.querySelectorAll("[data-blank-id]").forEach((slot) => {
      slot.addEventListener("click", () => {
        if (readingState.checked) return;
        const blankId = slot.dataset.blankId;
        // Nếu đã có từ: tháo từ trả về kho
        if (readingState.userClozeAnswers[blankId]) {
          readingState.userClozeAnswers[blankId] = null;
        }
        readingState.activeBlank = blankId;
        renderReading();
      });
    });

    // Sự kiện bấm từ trong Word Bank (Cloze)
    els.reading.querySelectorAll("[data-word-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (readingState.checked) return;
        const word = chip.dataset.wordChip;
        const answersKeys = Object.keys(r.answers);

        // Nếu từ này đã dùng ở ô khác, giải phóng ô đó
        Object.keys(readingState.userClozeAnswers).forEach((k) => {
          if (readingState.userClozeAnswers[k] === word) {
            readingState.userClozeAnswers[k] = null;
          }
        });

        // Điền vào ô đang chọn hoặc ô trống đầu tiên
        let targetBlank = readingState.activeBlank;
        if (!targetBlank || readingState.userClozeAnswers[targetBlank]) {
          targetBlank = answersKeys.find((k) => !readingState.userClozeAnswers[k]);
        }

        if (targetBlank) {
          readingState.userClozeAnswers[targetBlank] = word;
          // Tìm ô trống kế tiếp để chuyển active
          const nextBlank = answersKeys.find((k) => !readingState.userClozeAnswers[k]);
          readingState.activeBlank = nextBlank || null;
        }

        renderReading();
      });
    });

    // Sự kiện chọn đáp án QA
    els.reading.querySelectorAll("[data-qa-option]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (readingState.checked) return;
        readingState.userQaSelection = parseInt(btn.dataset.qaOption, 10);
        renderReading();
      });
    });

    // Sự kiện nghe phát âm toàn bài (bật/dừng linh hoạt)
    document.getElementById("reading-speak-btn")?.addEventListener("click", () => {
      if (readingState.isSpeaking) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        readingState.isSpeaking = false;
        renderReading();
        return;
      }
      readingState.isSpeaking = true;
      renderReading();
      speak(speechPassage, 0.85, () => {
        if (state.reading) {
          state.reading.isSpeaking = false;
          renderReading();
        }
      });
    });

    // Sự kiện nghe câu hỏi đọc hiểu
    document.getElementById("qa-speak-question-btn")?.addEventListener("click", () => {
      speak(r.question, 0.9);
    });

    // Sự kiện bật/tắt Pinyin
    document.getElementById("reading-toggle-pinyin-btn")?.addEventListener("click", () => {
      readingState.showPinyin = !readingState.showPinyin;
      renderReading();
    });

    // Sự kiện Kiểm tra đáp án
    document.getElementById("btn-reading-check")?.addEventListener("click", () => {
      if (r.type === "cloze") {
        const blankKeys = Object.keys(r.answers);
        const filledCount = blankKeys.filter((k) => readingState.userClozeAnswers[k]).length;
        if (filledCount < blankKeys.length) {
          showToast(`Vui lòng điền đủ ${blankKeys.length} ô trống trước khi kiểm tra!`, "error");
          return;
        }
        const allOk = blankKeys.every((k) => readingState.userClozeAnswers[k] === r.answers[k]);
        readingState.checked = true;
        readingState.isCorrect = allOk;
        if (allOk) {
          ProgressStore.recordReading(state.levelId, r.id);
          showToast("Xuất sắc! Tất cả các vị trí điền đều chính xác!", "success");
        } else {
          showToast("Có vị trí điền chưa đúng, hãy xem đáp án chuẩn bên dưới.", "error");
        }
      } else {
        if (readingState.userQaSelection == null) {
          showToast("Vui lòng chọn 1 đáp án A, B, C hoặc D trước khi kiểm tra!", "error");
          return;
        }
        const isOk = readingState.userQaSelection === r.correctIndex;
        readingState.checked = true;
        readingState.isCorrect = isOk;
        if (isOk) {
          ProgressStore.recordReading(state.levelId, r.id);
          showToast("Chính xác! Câu trả lời rất chuẩn!", "success");
        } else {
          showToast("Đáp án chưa chính xác, hãy đối chiếu bên dưới.", "error");
        }
      }
      renderReading();
    });

    // Sự kiện Làm lại bài
    document.getElementById("btn-reading-retry")?.addEventListener("click", () => {
      setupCurrentReading();
      renderReading();
    });

    // Sự kiện Bài trước
    document.getElementById("reading-prev-btn")?.addEventListener("click", () => {
      if (readingState.index > 0) {
        readingState.index -= 1;
        setupCurrentReading();
        renderReading();
      }
    });

    // Sự kiện Bài tiếp theo
    document.getElementById("reading-next-btn")?.addEventListener("click", () => {
      if (readingState.index + 1 < list.length) {
        readingState.index += 1;
        setupCurrentReading();
        renderReading();
      }
    });

    refreshIcons();
  }

  // ================= MODULE 2: SAO LƯU & PHỤC HỒI (IMPORT/EXPORT) =================
  function initBackupRestore() {
    const fileInput = document.getElementById("import-file-input");

    const handleExport = () => {
      try {
        ProgressStore.exportProgress();
        showToast("Đã tải file sao lưu hsk_progress_backup.json!");
      } catch (err) {
        showToast("Lỗi khi xuất file sao lưu.", "error");
      }
    };

    const handleImportClick = () => {
      fileInput?.click();
    };

    document.getElementById("btn-export-sidebar")?.addEventListener("click", handleExport);
    document.getElementById("btn-export-header")?.addEventListener("click", handleExport);
    document.getElementById("btn-import-sidebar")?.addEventListener("click", handleImportClick);
    document.getElementById("btn-import-header")?.addEventListener("click", handleImportClick);

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const res = ProgressStore.importProgress(evt.target.result);
          if (res.success) {
            showToast("Khôi phục tiến độ thành công!");
            state.levelId = ProgressStore.getCurrentLevel() || 1;
            render();
          } else {
            showToast(res.error || "File sao lưu không hợp lệ.", "error");
          }
        } catch (err) {
          showToast("Lỗi khi đọc file sao lưu.", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // ================= MODULE: LUYỆN TẬP GÕ CHỮ HÁN (TYPING PRACTICE) =================
  function normalizePinyin(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ü/g, "v")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  function startTyping(customPool = null) {
    const pool = customPool && customPool.length ? customPool : DataStore.getVocab({
      level: state.levelId,
      topicId: state.topicId === "all" ? undefined : state.topicId,
    });
    const count = Math.min(20, pool.length);
    const selected = shuffle(pool).slice(0, count);

    state.typing = {
      mode: state.typing?.mode || "hanzi",
      showHintPinyin: state.typing?.showHintPinyin !== undefined ? state.typing.showHintPinyin : true,
      items: selected,
      index: 0,
      correctCount: 0,
      wrongList: [],
      done: false,
      revealed: false,
      status: "idle",
    };
  }

  function renderTyping() {
    els.crumb.textContent = "Luyện gõ bàn phím";
    els.title.textContent = "Luyện tập gõ chữ Hán";

    if (!state.typing || !state.typing.items.length) {
      startTyping();
    }
    const typing = state.typing;
    if (!typing || !typing.items.length) {
      els.typing.innerHTML = `<p class="text-paper/50">Không đủ từ vựng để tạo bài luyện gõ.</p>`;
      return;
    }

    if (typing.done) {
      const pct = Math.round((typing.correctCount / typing.items.length) * 100);
      let evaluation = "Cần luyện tập thêm để tăng tốc độ và độ chuẩn xác nhé!";
      let badgeColor = "text-amber-400";
      if (pct >= 90) {
        evaluation = "🎉 Tuyệt vời! Bạn gõ chữ Hán cực kỳ nhanh và chuẩn xác!";
        badgeColor = "text-emerald-400";
      } else if (pct >= 70) {
        evaluation = "👏 Khá tốt! Phản xạ gõ và nhớ chữ của bạn rất ổn định.";
        badgeColor = "text-gold";
      } else if (pct >= 50) {
        evaluation = "💪 Khá ổn! Hãy luyện thêm để gõ nhanh và nhớ mặt chữ sâu hơn.";
        badgeColor = "text-amber-300";
      }

      els.typing.innerHTML = `
        <div class="max-w-xl mx-auto glass rounded-3xl p-8 sm:p-10 text-center">
          <div class="seal mx-auto mb-4 text-xl">字</div>
          <h3 class="text-2xl font-bold">Hoàn thành vòng luyện gõ</h3>

          <div class="my-6 py-6 border-y border-white/10">
            <p class="text-5xl font-extrabold ${badgeColor}">${pct}%</p>
            <p class="text-paper/70 mt-2 font-medium">${typing.correctCount} / ${typing.items.length} từ gõ đúng</p>
            <p class="text-sm text-paper/80 mt-3 max-w-md mx-auto leading-relaxed">${evaluation}</p>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button id="btn-typing-retry-all" class="bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-6 py-3 text-sm font-medium transition flex items-center justify-center gap-2">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Luyện vòng mới (20 từ)
            </button>
            ${
              typing.wrongList.length
                ? `<button id="btn-typing-retry-wrong" class="glass rounded-xl px-6 py-3 text-sm font-medium hover:border-gold/50 transition flex items-center justify-center gap-2 text-gold">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i> Luyện lại ${typing.wrongList.length} từ chưa đúng
                  </button>`
                : ""
            }
          </div>
        </div>`;

      document.getElementById("btn-typing-retry-all")?.addEventListener("click", () => {
        startTyping();
        renderTyping();
        refreshIcons();
      });

      document.getElementById("btn-typing-retry-wrong")?.addEventListener("click", () => {
        startTyping(typing.wrongList);
        renderTyping();
        refreshIcons();
      });
      return;
    }

    const word = typing.items[typing.index];
    const progressPct = Math.round(((typing.index) / typing.items.length) * 100);

    els.typing.innerHTML = `
      <div class="max-w-xl mx-auto">
        <!-- Chuyển đổi chế độ gõ A / B -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div class="flex p-1 rounded-2xl bg-white/5 border border-white/10 w-full sm:w-auto">
            <button id="mode-btn-hanzi" class="mode-pill flex-1 sm:flex-initial rounded-xl px-4 py-2 text-xs flex items-center justify-center gap-1.5 ${
              typing.mode === "hanzi" ? "is-active" : ""
            }">
              <i data-lucide="type" class="w-3.5 h-3.5"></i> Chế độ A: Gõ Hán tự
            </button>
            <button id="mode-btn-pinyin" class="mode-pill flex-1 sm:flex-initial rounded-xl px-4 py-2 text-xs flex items-center justify-center gap-1.5 ${
              typing.mode === "pinyin" ? "is-active" : ""
            }">
              <i data-lucide="spell-check" class="w-3.5 h-3.5"></i> Chế độ B: Đoán Pinyin
            </button>
          </div>
          ${topicSelect("text-xs py-1.5")}
        </div>

        <!-- Tiến độ -->
        <div class="flex items-center justify-between text-xs text-paper/60 mb-2">
          <span class="font-medium text-gold">Từ ${typing.index + 1} / ${typing.items.length}</span>
          <span>${typing.correctCount} từ đúng</span>
        </div>
        <div class="progress-bar mb-6">
          <span style="width: ${progressPct}%"></span>
        </div>

        <!-- Thẻ từ mục tiêu -->
        <div class="glass rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden">
          
          <button id="typing-tts-btn" class="flash-speaker-btn absolute top-5 right-5" title="Nghe phát âm">
            <i data-lucide="volume-2" class="w-5 h-5 text-gold"></i>
          </button>

          ${
            typing.mode === "hanzi"
              ? `
              <p class="text-xs uppercase tracking-wider text-gold/80 font-medium">Nghĩa tiếng Việt</p>
              <h2 class="text-3xl sm:text-4xl font-bold mt-2 text-paper leading-snug">${word.meaning}</h2>
              
              <div class="mt-4 flex items-center justify-center gap-2">
                ${
                  typing.showHintPinyin
                    ? `<span class="text-lg text-gold font-medium bg-gold/10 border border-gold/30 px-3 py-1 rounded-full">${word.pinyin}</span>
                       <button id="btn-toggle-pinyin-hint" class="text-xs text-paper/40 hover:text-paper/70 p-1" title="Ẩn gợi ý Pinyin">
                         <i data-lucide="eye-off" class="w-4 h-4"></i>
                       </button>`
                    : `<button id="btn-toggle-pinyin-hint" class="text-xs text-gold/80 bg-white/5 border border-white/10 hover:border-gold/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition">
                         <i data-lucide="eye" class="w-3.5 h-3.5"></i> Hiện gợi ý Pinyin
                       </button>`
                }
              </div>

              <p class="text-xs text-paper/40 mt-5">
                💡 Bật bộ gõ tiếng Trung (Pinyin) trên bàn phím và gõ chữ Hán tương ứng
              </p>
              `
              : `
              <p class="text-xs uppercase tracking-wider text-gold/80 font-medium">Nhìn Hán tự đoán Pinyin</p>
              <h2 class="hanzi text-5xl sm:text-6xl font-bold mt-2 text-paper leading-none">${word.hanzi}</h2>
              <p class="text-base text-paper/70 mt-3 font-medium">${word.meaning}</p>
              <p class="text-xs text-paper/40 mt-5">
                💡 Gõ phiên âm Pinyin của từ trên (hỗ trợ cả gõ không dấu: ví dụ <code class="text-gold/80 font-mono">xuesheng</code>)
              </p>
              `
          }

          <!-- Ô nhập liệu gõ chữ -->
          <div class="mt-6 flex flex-col items-center">
            <input
              id="typing-input-field"
              name="typing-text"
              aria-label="Ô nhập từ luyện gõ"
              type="text"
              class="typing-input ${typing.status === 'correct' ? 'typing-correct' : ''} ${typing.status === 'wrong' ? 'typing-wrong' : ''}"
              placeholder="${typing.mode === 'hanzi' ? 'Gõ chữ Hán...' : 'Gõ pinyin...'}"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              ${typing.revealed ? "disabled" : ""}
            />
            <p class="text-xs text-paper/40 mt-3 text-center flex items-center gap-1.5">
              <span>Nhấn</span>
              <kbd class="px-2 py-0.5 rounded bg-white/10 text-paper/80 font-mono text-[11px] border border-white/15">Enter</kbd>
              <span>để kiểm tra hoặc tự nhận khi gõ đúng</span>
            </p>
          </div>

          <!-- Banner Xem đáp án khi cần -->
          ${
            typing.revealed
              ? `
              <div class="mt-5 p-4 rounded-2xl bg-white/5 border border-gold/40 text-center animate-pulse-once">
                <p class="text-xs text-paper/50">Đáp án chuẩn:</p>
                <p class="hanzi text-4xl font-bold text-gold mt-1">${word.hanzi}</p>
                <p class="text-lg text-paper font-semibold mt-1">${word.pinyin}</p>
                <p class="text-sm text-paper/70 mt-0.5">${word.meaning}</p>
                <button id="typing-next-btn" class="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition flex items-center gap-2 mx-auto shadow-lg shadow-emerald-700/20">
                  <span>${typing.index + 1 >= typing.items.length ? "Xem kết quả" : "Từ tiếp theo"}</span>
                  <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
              </div>`
              : `
              <div class="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-white/10">
                <button id="typing-skip-btn" class="glass rounded-xl px-4 py-2.5 text-xs text-paper/60 hover:text-gold hover:border-gold/40 transition flex items-center gap-1.5">
                  <i data-lucide="help-circle" class="w-4 h-4"></i> Xem đáp án / Bỏ qua
                </button>
                <button id="typing-check-btn" class="bg-vermillion/90 hover:bg-vermillion text-white rounded-xl px-6 py-2.5 text-sm font-medium transition shadow-lg shadow-vermillion/20">
                  Kiểm tra
                </button>
              </div>`
          }

        </div>
      </div>`;

    // Cài đặt sự kiện
    els.typing.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      startTyping();
      renderTyping();
      refreshIcons();
    });

    document.getElementById("mode-btn-hanzi")?.addEventListener("click", () => {
      if (typing.mode !== "hanzi") {
        typing.mode = "hanzi";
        typing.status = "idle";
        typing.revealed = false;
        renderTyping();
        refreshIcons();
      }
    });

    document.getElementById("mode-btn-pinyin")?.addEventListener("click", () => {
      if (typing.mode !== "pinyin") {
        typing.mode = "pinyin";
        typing.status = "idle";
        typing.revealed = false;
        renderTyping();
        refreshIcons();
      }
    });

    document.getElementById("btn-toggle-pinyin-hint")?.addEventListener("click", () => {
      typing.showHintPinyin = !typing.showHintPinyin;
      renderTyping();
      refreshIcons();
    });

    document.getElementById("typing-tts-btn")?.addEventListener("click", () => {
      speak(word.hanzi);
    });

    const inputEl = document.getElementById("typing-input-field");

    const checkMatch = (val) => {
      if (!val) return false;
      if (typing.mode === "hanzi") {
        return val.trim() === word.hanzi.trim();
      } else {
        const normVal = normalizePinyin(val);
        const normTarget = normalizePinyin(word.pinyin);
        return normVal === normTarget || val.trim().toLowerCase() === word.pinyin.trim().toLowerCase();
      }
    };

    const handleSuccess = () => {
      if (typing.status === "correct") return;
      typing.status = "correct";
      typing.correctCount += 1;
      if (inputEl) {
        inputEl.classList.remove("typing-wrong");
        inputEl.classList.add("typing-correct");
        inputEl.disabled = true;
      }
      speak(word.hanzi);
      setTimeout(() => {
        if (typing.index + 1 >= typing.items.length) {
          typing.done = true;
        } else {
          typing.index += 1;
          typing.status = "idle";
          typing.revealed = false;
        }
        renderTyping();
        refreshIcons();
      }, 500);
    };

    const handleWrong = () => {
      typing.status = "wrong";
      if (inputEl) {
        inputEl.classList.remove("typing-wrong");
        void inputEl.offsetWidth;
        inputEl.classList.add("typing-wrong");
      }
    };

    inputEl?.addEventListener("input", (e) => {
      const val = e.target.value;
      if (checkMatch(val)) {
        handleSuccess();
      } else {
        if (typing.status === "wrong") {
          typing.status = "idle";
          inputEl.classList.remove("typing-wrong");
        }
      }
    });

    inputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = inputEl.value;
        if (!val.trim()) return;
        if (checkMatch(val)) {
          handleSuccess();
        } else {
          handleWrong();
        }
      }
    });

    document.getElementById("typing-check-btn")?.addEventListener("click", () => {
      const val = inputEl?.value || "";
      if (!val.trim()) return;
      if (checkMatch(val)) {
        handleSuccess();
      } else {
        handleWrong();
      }
    });

    document.getElementById("typing-skip-btn")?.addEventListener("click", () => {
      typing.revealed = true;
      if (!typing.wrongList.some((w) => w.id === word.id)) {
        typing.wrongList.push(word);
      }
      speak(word.hanzi);
      renderTyping();
      refreshIcons();
    });

    document.getElementById("typing-next-btn")?.addEventListener("click", () => {
      if (typing.index + 1 >= typing.items.length) {
        typing.done = true;
      } else {
        typing.index += 1;
        typing.status = "idle";
        typing.revealed = false;
      }
      renderTyping();
      refreshIcons();
    });

    setTimeout(() => {
      const field = document.getElementById("typing-input-field");
      if (field && !typing.revealed) {
        field.focus();
      }
    }, 60);
  }

  // ================= MAIN RENDER =================
  function render() {
    renderLevels();
    renderProgress();
    if (state.view === "home") renderHome();
    if (state.view === "study") renderStudy();
    if (state.view === "flash") renderFlash();
    if (state.view === "quiz") renderQuiz();
    if (state.view === "listening") renderListening();
    if (state.view === "sentence") renderSentence();
    if (state.view === "reading") renderReading();
    if (state.view === "typing") renderTyping();
    refreshIcons();
  }

  // Khởi tạo điều hướng
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      if (v === "listening") {
        if (!state.listening || state.listening.done) startListening();
        setView("listening");
        if (!state.listening.answered && !state.listening.done) {
          playCurrentListeningWord();
        }
        return;
      }
      if (v === "reading") {
        if (!state.reading) initReading();
        setView("reading");
        return;
      }
      if (v === "quiz") {
        if (!state.quiz || state.quiz.done) startQuiz();
        setView("quiz");
        return;
      }
      if (v === "sentence") {
        if (!state.sentenceTest || state.sentenceTest.done) startSentenceTest();
        setView("sentence");
        return;
      }
      if (v === "typing") {
        if (!state.typing || state.typing.done) startTyping();
        setView("typing");
        return;
      }
      if (v === "flash") {
        state.flashIndex = 0;
        state.flipped = false;
      }
      setView(v);
    });
  });

  // Tìm kiếm từ vựng
  let searchTimer;
  els.search?.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      if (state.view === "home") setView("study");
      else render();
    }, 160);
  });

  window.speechSynthesis?.addEventListener("voiceschanged", () => {});

  const enabled = DataStore.getEnabledLevels();
  if (!enabled.find((l) => l.id === state.levelId)) {
    state.levelId = enabled[0]?.id || 1;
  }

  initBackupRestore();
  setView("home");
})();
