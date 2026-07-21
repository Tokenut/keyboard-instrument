// ==========================================================================
// renderer.js — 主窗口渲染逻辑, 把键盘/声音/五线谱/UI 串起来
// ==========================================================================
(function () {
  'use strict';

  const M = window.KBI_MUSIC;
  const ENGINE = window.KBI_ENGINE;
  const SCORE = window.KBI_SCORE;
  const REC = window.KBI_RECORDER;
  const COMPOSER = window.KBI_COMPOSER;
  const MATCHER = window.KBI_MATCHER;
  const POSTER = window.KBI_POSTER;

  // DOM
  const instrumentBar = document.getElementById('instrumentBar');
  const instrumentArt = document.getElementById('instrumentArt');
  const instrumentName = document.getElementById('instrumentName');
  const noteBurst = document.getElementById('noteBurst');
  const scoreEl = document.getElementById('score');
  const scoreScroll = document.getElementById('scoreScroll');
  const quill = document.getElementById('quill');
  const startOverlay = document.getElementById('startOverlay');
  const startBtn = document.getElementById('startBtn');
  const petBtn = document.getElementById('petBtn');
  const clearScoreBtn = document.getElementById('clearScore');
  const volumeSlider = document.getElementById('volume');
  const hookStatusEl = document.getElementById('hookStatus');
  // 录制 & 结果相关
  const recordBtn = document.getElementById('recordBtn');
  const recLabel = document.getElementById('recLabel');
  const recBanner = document.getElementById('recBanner');
  const recCount = document.getElementById('recCount');
  const resultModal = document.getElementById('resultModal');
  const closeResult = document.getElementById('closeResult');

  let selectedInstrument = M.DEFAULT_INSTRUMENT;
  let audioReady = false;
  let lastSong = null;         // 最近生成的曲子
  let lastMatch = null;        // 最近的匹配结果
  let lastReason = '';
  let lastPosterCanvas = null;

  // ------------------------------------------------------------------
  // 构建乐器选择条
  // ------------------------------------------------------------------
  function buildInstrumentBar() {
    Object.values(M.INSTRUMENTS).forEach((inst) => {
      const btn = document.createElement('button');
      btn.className = 'instrument-chip';
      btn.dataset.id = inst.id;
      btn.innerHTML = `<span class="chip-emoji">${inst.emoji}</span><span class="chip-name">${inst.name}</span>`;
      btn.addEventListener('click', () => selectInstrument(inst.id));
      instrumentBar.appendChild(btn);
    });
    refreshInstrumentBar();
  }

  function refreshInstrumentBar() {
    [...instrumentBar.children].forEach((c) => {
      c.classList.toggle('active', c.dataset.id === selectedInstrument);
    });
  }

  function selectInstrument(id) {
    selectedInstrument = id;
    const inst = M.INSTRUMENTS[id];
    instrumentArt.textContent = inst.emoji;
    instrumentName.textContent = inst.name;
    refreshInstrumentBar();
    if (audioReady) ENGINE.setInstrument(id);
    // 通知桌宠
    if (window.kbi) window.kbi.notifyInstrumentChanged(id);
  }

  // ------------------------------------------------------------------
  // 播放一个音 + 视觉反馈
  //   keycode: 可选, 有则用于录制真实按键时长
  //   isRepeat: 长按重复触发, 只发声不重复记录
  // ------------------------------------------------------------------
  function triggerNote(note, keycode) {
    if (!note || !audioReady) return;
    ENGINE.playNote(note);
    SCORE.addNote(note);
    spawnNoteBurst(note);
    bounceInstrument();
    // 录制中则捕获(带 keycode 记录时长)
    if (REC.isRecording()) {
      if (keycode != null) REC.noteOn(note, keycode);
      else REC.capture(note);
      recCount.textContent = REC.currentCount();
    }
  }

  // 乐器展示区弹跳
  let bounceTimer = null;
  function bounceInstrument() {
    instrumentArt.classList.add('bounce');
    clearTimeout(bounceTimer);
    bounceTimer = setTimeout(() => instrumentArt.classList.remove('bounce'), 140);
  }

  // 冒出的小音符
  const NOTE_GLYPHS = ['♪', '♫', '♩', '♬', '𝅘𝅥𝅮'];
  function spawnNoteBurst(note) {
    const el = document.createElement('span');
    el.className = 'floating-note';
    el.textContent = NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)];
    const x = 20 + Math.random() * 60; // 百分比
    el.style.left = x + '%';
    el.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
    el.style.setProperty('--hue', Math.floor(Math.random() * 360));
    noteBurst.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ------------------------------------------------------------------
  // 全局键盘事件(来自主进程 uiohook)
  // ------------------------------------------------------------------
  const heldKeys = new Set(); // 当前按住的 keycode, 用于去重长按

  function onGlobalKey(payload) {
    const note = M.noteFromUiohook(payload.keycode);
    if (!note) return;
    // 长按会连续触发 keydown, 已按住则忽略(等松开再算)
    if (heldKeys.has(payload.keycode)) return;
    heldKeys.add(payload.keycode);
    triggerNote(note, payload.keycode);
  }

  function onGlobalKeyup(payload) {
    heldKeys.delete(payload.keycode);
    if (REC.isRecording()) REC.noteOff(payload.keycode);
  }

  // 网页内键盘(作为 fallback / 无权限时也能玩)
  function onLocalKey(e) {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const note = M.noteFromBrowserKey(e.key);
    if (note) {
      e.preventDefault();
      // 用 e.code 当作伪 keycode 配对 keyup, 记录真实时长
      triggerNote(note, 'web:' + e.code);
    }
  }

  function onLocalKeyup(e) {
    const code = 'web:' + e.code;
    heldKeys.delete(code);
    if (REC.isRecording()) REC.noteOff(code);
  }

  // ------------------------------------------------------------------
  // 启动音频(需用户手势)
  // ------------------------------------------------------------------
  async function startAudio() {
    await ENGINE.ensureStarted();
    // 采样加载状态 -> 更新 UI 提示
    ENGINE.onLoadingChange((loading) => {
      instrumentName.classList.toggle('loading', loading);
      if (loading) {
        instrumentName.dataset.orig = instrumentName.textContent;
        instrumentName.textContent = '加载音色中…';
      } else if (instrumentName.dataset.orig) {
        instrumentName.textContent = instrumentName.dataset.orig;
      }
    });
    ENGINE.setInstrument(selectedInstrument);
    audioReady = true;
    startOverlay.classList.add('hidden');
    SCORE.init(scoreEl, scoreScroll, quill);
  }

  // ------------------------------------------------------------------
  // hook 状态显示
  // ------------------------------------------------------------------
  async function refreshHookStatus() {
    if (!window.kbi) {
      setHookStatus(false, '仅网页键盘');
      return;
    }
    const ok = await window.kbi.getHookStatus();
    setHookStatus(ok, ok ? '全局监听已开' : '仅网页键盘');
  }

  function setHookStatus(ok, label) {
    hookStatusEl.classList.toggle('ok', ok);
    hookStatusEl.querySelector('.hook-label').textContent = label;
  }

  // ==================================================================
  // 录制 → 作曲 → 匹配作曲家 → 结果弹窗
  // ==================================================================
  function toggleRecord() {
    if (!audioReady) return;
    if (REC.isRecording()) {
      stopRecordingAndAnalyze();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    REC.start();
    recCount.textContent = '0';
    recordBtn.classList.add('recording');
    recLabel.textContent = '停止';
    recBanner.classList.add('show');
  }

  function stopRecordingAndAnalyze() {
    const raw = REC.stop();
    recordBtn.classList.remove('recording');
    recLabel.textContent = '录制';
    recBanner.classList.remove('show');

    if (raw.count < 3) {
      alert('至少敲 3 个音才能生成曲子哦 ♪（当前 ' + raw.count + ' 个）');
      return;
    }

    // 作曲(量化 + 音阶吸附) + 匹配
    lastSong = COMPOSER.compose(raw.events, { scale: COMPOSER.DEFAULT_SCALE });
    lastMatch = MATCHER.match(lastSong);
    lastReason = MATCHER.explain(lastMatch.features, lastMatch.best.composer);
    lastPosterCanvas = null;

    showResult();
  }

  function showResult() {
    const best = lastMatch.best;
    const c = best.composer;
    document.getElementById('composerEmoji').textContent = c.emoji || '🎼';
    document.getElementById('composerName').textContent = c.name;
    document.getElementById('composerMeta').textContent = `${c.en} · ${c.era}`;
    document.getElementById('similarity').textContent = best.similarity + '%';
    document.getElementById('composerTag').textContent = c.tag;
    document.getElementById('matchReason').textContent = '“ ' + lastReason + ' ”';
    document.getElementById('songMeta').textContent =
      `${lastSong.bpm} BPM · ${lastSong.scaleName} · ${lastSong.notes.length} 个音 · ${lastSong.totalSec.toFixed(1)}s`;

    renderMiniMelody();
    renderRunnerUps();

    // 重置海报区
    document.getElementById('posterPreview').innerHTML = '';
    document.getElementById('downloadPosterBtn').style.display = 'none';

    resultModal.classList.add('show');
  }

  function renderMiniMelody() {
    const box = document.getElementById('miniMelody');
    box.innerHTML = '';
    const notes = lastSong.notes;
    if (!notes.length) return;
    const midis = notes.map((n) => n.midi);
    const lo = Math.min(...midis), hi = Math.max(...midis);
    const span = Math.max(1, hi - lo);
    notes.slice(0, 60).forEach((n) => {
      const bar = document.createElement('div');
      bar.className = 'mm-bar';
      const t = (n.midi - lo) / span;
      bar.style.height = (10 + t * 90) + '%';
      bar.style.opacity = 0.5 + t * 0.5;
      box.appendChild(bar);
    });
  }

  function renderRunnerUps() {
    const list = document.getElementById('runnerList');
    list.innerHTML = '';
    lastMatch.ranking.slice(1, 4).forEach((r) => {
      const el = document.createElement('div');
      el.className = 'runner-chip';
      el.innerHTML = `<span>${r.composer.emoji}</span><span>${r.composer.name}</span><b>${r.similarity}%</b>`;
      list.appendChild(el);
    });
  }

  function playGeneratedSong() {
    if (!lastSong) return;
    const btn = document.getElementById('playSongBtn');
    btn.textContent = '♫ 播放中…';
    btn.disabled = true;
    ENGINE.setInstrument(selectedInstrument);
    const bars = document.querySelectorAll('#miniMelody .mm-bar');
    let idx = 0;
    ENGINE.playSong(lastSong, {
      onNote: () => {
        const b = bars[idx++];
        if (b) {
          b.classList.add('playing');
          setTimeout(() => b.classList.remove('playing'), 180);
        }
      },
      onEnd: () => {
        btn.textContent = '▶ 播放我的曲子';
        btn.disabled = false;
      },
    });
  }

  function generatePoster() {
    if (!lastMatch || !lastSong) return;
    lastPosterCanvas = POSTER.generate({
      matchResult: lastMatch,
      song: lastSong,
      instrumentName: M.INSTRUMENTS[selectedInstrument].name,
      reason: lastReason,
    });
    const preview = document.getElementById('posterPreview');
    preview.innerHTML = '';
    lastPosterCanvas.classList.add('poster-canvas');
    preview.appendChild(lastPosterCanvas);
    document.getElementById('downloadPosterBtn').style.display = '';
  }

  function closeResultModal() {
    resultModal.classList.remove('show');
    ENGINE.stopSong();
    const btn = document.getElementById('playSongBtn');
    btn.textContent = '▶ 播放我的曲子';
    btn.disabled = false;
  }

  // ------------------------------------------------------------------
  // 绑定事件
  // ------------------------------------------------------------------
  function bindEvents() {
    startBtn.addEventListener('click', startAudio);

    petBtn.addEventListener('click', async () => {
      if (window.kbi) await window.kbi.togglePetMode(true);
    });

    clearScoreBtn.addEventListener('click', () => SCORE.clear());

    // 录制 & 结果
    recordBtn.addEventListener('click', toggleRecord);
    closeResult.addEventListener('click', closeResultModal);
    resultModal.addEventListener('click', (e) => {
      if (e.target === resultModal) closeResultModal();
    });
    document.getElementById('playSongBtn').addEventListener('click', playGeneratedSong);
    document.getElementById('genPosterBtn').addEventListener('click', generatePoster);
    document.getElementById('downloadPosterBtn').addEventListener('click', () => {
      if (lastPosterCanvas) POSTER.download(lastPosterCanvas);
    });

    volumeSlider.addEventListener('input', (e) => {
      ENGINE.setVolume(parseFloat(e.target.value));
    });

    // 全局键盘(Electron)
    if (window.kbi) {
      window.kbi.onGlobalKeydown(onGlobalKey);
      if (window.kbi.onGlobalKeyup) window.kbi.onGlobalKeyup(onGlobalKeyup);
    }
    // 网页内键盘 fallback
    window.addEventListener('keydown', onLocalKey);
    window.addEventListener('keyup', onLocalKeyup);
  }

  // ------------------------------------------------------------------
  // init
  // ------------------------------------------------------------------
  function init() {
    buildInstrumentBar();
    bindEvents();
    refreshHookStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
