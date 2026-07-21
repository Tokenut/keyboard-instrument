// ==========================================================================
// renderer.js — 主窗口渲染逻辑, 把键盘/声音/五线谱/UI 串起来
// ==========================================================================
(function () {
  'use strict';

  const M = window.KBI_MUSIC;
  const ENGINE = window.KBI_ENGINE;
  const SCORE = window.KBI_SCORE;

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

  let selectedInstrument = M.DEFAULT_INSTRUMENT;
  let audioReady = false;

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
  // ------------------------------------------------------------------
  function triggerNote(note) {
    if (!note || !audioReady) return;
    ENGINE.playNote(note);
    SCORE.addNote(note);
    spawnNoteBurst(note);
    bounceInstrument();
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
  function onGlobalKey(payload) {
    const note = M.noteFromUiohook(payload.keycode);
    if (note) triggerNote(note);
  }

  // 网页内键盘(作为 fallback / 无权限时也能玩)
  function onLocalKey(e) {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const note = M.noteFromBrowserKey(e.key);
    if (note) {
      e.preventDefault();
      triggerNote(note);
    }
  }

  // ------------------------------------------------------------------
  // 启动音频(需用户手势)
  // ------------------------------------------------------------------
  async function startAudio() {
    await ENGINE.ensureStarted();
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

  // ------------------------------------------------------------------
  // 绑定事件
  // ------------------------------------------------------------------
  function bindEvents() {
    startBtn.addEventListener('click', startAudio);

    petBtn.addEventListener('click', async () => {
      if (window.kbi) await window.kbi.togglePetMode(true);
    });

    clearScoreBtn.addEventListener('click', () => SCORE.clear());

    volumeSlider.addEventListener('input', (e) => {
      ENGINE.setVolume(parseFloat(e.target.value));
    });

    // 全局键盘(Electron)
    if (window.kbi) {
      window.kbi.onGlobalKeydown(onGlobalKey);
    }
    // 网页内键盘 fallback
    window.addEventListener('keydown', onLocalKey);
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
