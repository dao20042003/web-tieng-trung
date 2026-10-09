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
    sentenceTest: null,
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
    sentence: document.getElementById("view-sentence"),
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

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-CN";
    utter.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("zh"));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
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
    state.view = view;
    ["home", "study", "flash", "quiz", "sentence"].forEach((name) => {
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
    return `<select class="topic-select bg-white text-black border border-white/10 rounded-xl px-3 py-2 text-sm ${extraClass}">${options}</select>`;
  }

  function renderHome() {
    const level = currentLevel();
    els.crumb.textContent = level?.name || "HSK";
    els.title.textContent = "Chọn chủ đề để học";
    const all = DataStore.getVocab({ level: state.levelId });
    const masteredAll = ProgressStore.countMastered(state.levelId, all);
    const quiz = ProgressStore.getQuizStats(state.levelId);
    const sentenceStats = ProgressStore.getSentenceStats(state.levelId);

    els.home.innerHTML = `
      <div class="grid sm:grid-cols-4 gap-3 mb-6">
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Từ vựng</p><p class="text-2xl mt-1">${all.length}</p></div>
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Đã thuộc</p><p class="text-2xl mt-1 text-gold">${masteredAll}</p></div>
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Quiz gần nhất</p><p class="text-2xl mt-1">${quiz.lastScore == null ? "—" : quiz.lastScore + "%"}</p></div>
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Đặt câu gần nhất</p><p class="text-2xl mt-1 text-emerald-400">${sentenceStats.lastScore == null ? "—" : sentenceStats.lastScore + "%"}</p></div>
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
              </div>
            </article>`;
          })
          .join("")}
      </div>`;

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
  }

  function renderStudy() {
    const topic = DataStore.getTopic(state.topicId);
    els.crumb.textContent = "Học từ vựng";
    els.title.textContent = topic ? topic.name : "Toàn bộ từ vựng";
    const list = words();

    els.study.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-5">
        ${topicSelect()}
        <select class="filter-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
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

    document.getElementById("flash-card")?.addEventListener("click", () => {
      state.flipped = !state.flipped;
      render();
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

  // ================= TRẮC NGHIỆM (QUIZ) =================
  function startQuiz() {
    const pool = DataStore.getVocab({
      level: state.levelId,
      topicId: state.topicId === "all" ? undefined : state.topicId,
    });
    const count = Math.min(10, pool.length);
    const selected = shuffle(pool).slice(0, count);
    state.quiz = {
      items: selected.map((word) => makeQuestion(word, pool)),
      index: 0,
      correct: 0,
      answered: false,
      done: false,
    };
  }

  function makeQuestion(word, pool) {
    const modes = ["hanzi-meaning", "meaning-hanzi", "pinyin-meaning"];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    let prompt;
    let answer;
    let pick;
    if (mode === "hanzi-meaning") {
      prompt = word.hanzi;
      answer = word.meaning;
      pick = (w) => w.meaning;
    } else if (mode === "meaning-hanzi") {
      prompt = word.meaning;
      answer = word.hanzi;
      pick = (w) => w.hanzi;
    } else {
      prompt = word.pinyin;
      answer = word.meaning;
      pick = (w) => w.meaning;
    }
    const distractors = shuffle(pool.filter((w) => w.id !== word.id && pick(w) !== answer))
      .slice(0, 3)
      .map(pick);
    const choices = shuffle([answer, ...distractors]);
    const labels = {
      "hanzi-meaning": "Nghĩa của từ này là gì?",
      "meaning-hanzi": "Hán tự nào mang nghĩa này?",
      "pinyin-meaning": "Pinyin này nghĩa là gì?",
    };
    return { word, mode, prompt, answer, choices, label: labels[mode] };
  }

  function renderQuiz() {
    els.crumb.textContent = "Trắc nghiệm";
    const topic = DataStore.getTopic(state.topicId);
    els.title.textContent = topic ? `Quiz · ${topic.name}` : "Quiz tổng hợp";

    if (!state.quiz) startQuiz();
    const quiz = state.quiz;
    if (!quiz.items.length) {
      els.quiz.innerHTML = `<p class="text-paper/50">Không đủ từ để tạo bài quiz.</p>`;
      return;
    }

    if (quiz.done) {
      const pct = Math.round((quiz.correct / quiz.items.length) * 100);
      els.quiz.innerHTML = `
        <div class="max-w-lg mx-auto glass rounded-3xl p-8 text-center">
          <p class="hanzi text-4xl">完成</p>
          <p class="text-4xl font-bold mt-4 text-gold">${pct}%</p>
          <p class="text-paper/60 mt-2">${quiz.correct}/${quiz.items.length} câu đúng</p>
          <div class="flex gap-2 justify-center mt-6">
            ${topicSelect()}
            <button id="quiz-retry" class="bg-vermillion/80 rounded-xl px-5 py-2 text-sm font-medium">Làm lại</button>
          </div>
        </div>`;
      els.quiz.querySelector(".topic-select")?.addEventListener("change", (e) => {
        state.topicId = e.target.value;
        startQuiz();
        render();
      });
      document.getElementById("quiz-retry")?.addEventListener("click", () => {
        startQuiz();
        render();
      });
      return;
    }

    const q = quiz.items[quiz.index];
    els.quiz.innerHTML = `
      <div class="max-w-xl mx-auto">
        <div class="flex gap-2 mb-5">${topicSelect("flex-1")}</div>
        <p class="text-xs text-paper/40">Câu ${quiz.index + 1} / ${quiz.items.length}</p>
        <div class="glass rounded-3xl p-6 mt-3">
          <p class="text-sm text-gold/80">${q.label}</p>
          <p class="hanzi text-5xl mt-4 ${q.mode === "meaning-hanzi" ? "text-2xl font-sans" : ""}">${q.prompt}</p>
          ${q.mode !== "meaning-hanzi" ? `<button id="quiz-speak" class="mt-4 text-sm text-paper/50 flex items-center gap-1 hover:text-gold transition"><i data-lucide="volume-2" class="w-4 h-4"></i> Nghe</button>` : ""}
          <div class="grid gap-2 mt-6">
            ${q.choices
              .map(
                (choice) =>
                  `<button data-choice="${choice.replace(/"/g, "&quot;")}" class="choice-btn glass rounded-xl px-4 py-3 text-left">${choice}</button>`
              )
              .join("")}
          </div>
        </div>
      </div>`;

    els.quiz.querySelector(".topic-select")?.addEventListener("change", (e) => {
      state.topicId = e.target.value;
      startQuiz();
      render();
    });
    document.getElementById("quiz-speak")?.addEventListener("click", () => speak(q.word.hanzi));
    els.quiz.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (quiz.answered) return;
        quiz.answered = true;
        const picked = btn.dataset.choice;
        const ok = picked === q.answer;
        if (ok) quiz.correct += 1;
        els.quiz.querySelectorAll("[data-choice]").forEach((b) => {
          if (b.dataset.choice === q.answer) b.classList.add("is-correct");
          if (b === btn && !ok) b.classList.add("is-wrong");
          b.disabled = true;
        });
        setTimeout(() => {
          if (quiz.index + 1 >= quiz.items.length) {
            quiz.done = true;
            ProgressStore.recordQuiz(state.levelId, quiz.correct, quiz.items.length);
          } else {
            quiz.index += 1;
            quiz.answered = false;
          }
          render();
        }, 750);
      });
    });
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
    els.title.textContent = "Luyện đặt câu HSK 1";

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
      evaluation = "🎉 Xuất sắc! Bạn nắm rất vững cấu trúc câu ngữ pháp HSK 1!";
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

  // ================= MAIN RENDER =================
  function render() {
    renderLevels();
    renderProgress();
    if (state.view === "home") renderHome();
    if (state.view === "study") renderStudy();
    if (state.view === "flash") renderFlash();
    if (state.view === "quiz") renderQuiz();
    if (state.view === "sentence") renderSentence();
    refreshIcons();
  }

  // Khởi tạo điều hướng
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      if (v === "quiz" && !state.quiz) startQuiz();
      if (v === "sentence" && !state.sentenceTest) startSentenceTest();
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
