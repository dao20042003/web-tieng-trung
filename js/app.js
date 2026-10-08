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
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("zh"));
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

  function setView(view) {
    state.view = view;
    ["home", "study", "flash", "quiz"].forEach((name) => {
      els[name].classList.toggle("hidden", name !== view);
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
    return `<select class="topic-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm ${extraClass}">${options}</select>`;
  }

  function renderHome() {
    const level = currentLevel();
    els.crumb.textContent = level?.name || "HSK";
    els.title.textContent = "Chọn chủ đề để học";
    const all = DataStore.getVocab({ level: state.levelId });
    const masteredAll = ProgressStore.countMastered(state.levelId, all);
    const quiz = ProgressStore.getQuizStats(state.levelId);

    els.home.innerHTML = `
      <div class="grid sm:grid-cols-3 gap-3 mb-6">
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Từ vựng</p><p class="text-2xl mt-1">${all.length}</p></div>
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Đã thuộc</p><p class="text-2xl mt-1 text-gold">${masteredAll}</p></div>
        <div class="glass rounded-2xl p-4"><p class="text-xs text-paper/50">Quiz gần nhất</p><p class="text-2xl mt-1">${quiz.lastScore == null ? "—" : quiz.lastScore + "%"}</p></div>
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
                    <button data-speak="${word.hanzi}" class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                      <i data-lucide="volume-2" class="w-4 h-4"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                      <p class="hanzi text-2xl leading-none">${word.hanzi}</p>
                      <p class="text-sm text-gold/80 mt-1">${word.pinyin}</p>
                    </div>
                    <p class="text-sm text-paper/70 hidden sm:block">${word.meaning}</p>
                    <button data-master="${word.id}" class="text-xs rounded-full px-3 py-1 border ${
                      mastered ? "border-emerald-500/60 bg-emerald-900/40 text-emerald-200" : "border-white/15 text-paper/60"
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

  function renderFlash() {
    const list = words();
    const word = list[state.flashIndex] || null;
    const topic = DataStore.getTopic(state.topicId);
    els.crumb.textContent = "Flashcard";
    els.title.textContent = topic ? topic.cn : "Luyện thẻ";

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
            <div class="flip-face flip-front">
              <p class="hanzi text-6xl sm:text-7xl">${word.hanzi}</p>
              <p class="mt-4 text-gold text-xl">${word.pinyin}</p>
              <p class="mt-6 text-xs text-paper/40">Nhấn để lật thẻ</p>
            </div>
            <div class="flip-face flip-back">
              <p class="text-3xl font-medium text-center">${word.meaning}</p>
              <p class="hanzi text-4xl mt-6">${word.hanzi}</p>
              <p class="text-gold mt-2">${word.pinyin}</p>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-6 gap-2">
          <button id="flash-prev" class="glass rounded-xl px-4 py-2 text-sm">Trước</button>
          <button id="flash-speak" class="glass rounded-full w-11 h-11 flex items-center justify-center"><i data-lucide="volume-2" class="w-5 h-5"></i></button>
          <button id="flash-master" class="rounded-xl px-4 py-2 text-sm ${mastered ? "bg-emerald-800/60" : "bg-vermillion/80"}">${
            mastered ? "Bỏ đánh dấu" : "Đã thuộc"
          }</button>
          <button id="flash-next" class="glass rounded-xl px-4 py-2 text-sm">Sau</button>
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
    document.getElementById("flash-speak")?.addEventListener("click", (e) => {
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
          <p class="text-3xl mt-4">${pct}%</p>
          <p class="text-paper/60 mt-2">${quiz.correct}/${quiz.items.length} câu đúng</p>
          <div class="flex gap-2 justify-center mt-6">
            ${topicSelect()}
            <button id="quiz-retry" class="bg-vermillion/80 rounded-xl px-4 py-2 text-sm">Làm lại</button>
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
          ${q.mode !== "meaning-hanzi" ? `<button id="quiz-speak" class="mt-4 text-sm text-paper/50 flex items-center gap-1"><i data-lucide="volume-2" class="w-4 h-4"></i> Nghe</button>` : ""}
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

  function render() {
    renderLevels();
    renderProgress();
    if (state.view === "home") renderHome();
    if (state.view === "study") renderStudy();
    if (state.view === "flash") renderFlash();
    if (state.view === "quiz") renderQuiz();
    refreshIcons();
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "quiz" && !state.quiz) startQuiz();
      if (btn.dataset.view === "flash") {
        state.flashIndex = 0;
        state.flipped = false;
      }
      setView(btn.dataset.view);
    });
  });

  let searchTimer;
  els.search.addEventListener("input", (e) => {
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

  setView("home");
})();
