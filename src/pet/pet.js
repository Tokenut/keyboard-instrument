// ==========================================================================
// pet.js — 桌宠窗口逻辑
//   · 显示当前乐器
//   · 全局打字时: 冒出小音符动效 + 轻微跳动 + 发声
//   · 点击本体 -> 回到主窗口
// ==========================================================================
(function () {
  'use strict';

  const M = window.KBI_MUSIC;
  const ENGINE = window.KBI_ENGINE;

  const petArt = document.getElementById('petArt');
  const petBody = document.getElementById('petBody');
  const petNotes = document.getElementById('petNotes');
  const petZzz = document.getElementById('petZzz');
  const petTip = document.getElementById('petTip');

  let currentInstrument = M.DEFAULT_INSTRUMENT;
  let audioReady = false;
  let idleTimer = null;

  // 初始乐器外观
  function applyInstrument(id) {
    currentInstrument = id;
    const inst = M.INSTRUMENTS[id] || M.INSTRUMENTS[M.DEFAULT_INSTRUMENT];
    petArt.textContent = inst.emoji;
    if (audioReady) ENGINE.setInstrument(id);
  }

  // 桌宠也独立发声(主窗口隐藏时更稳)
  async function ensureAudio() {
    if (audioReady) return;
    try {
      await ENGINE.ensureStarted();
      ENGINE.setInstrument(currentInstrument);
      audioReady = true;
    } catch (_) { /* 需要手势, 首次打字可能静音, 点一下即可 */ }
  }

  // 打字反馈
  const GLYPHS = ['♪', '♫', '♩', '♬'];
  function reactToKey(note) {
    // 醒来
    petBody.classList.remove('sleeping');
    petZzz.classList.remove('show');
    // 跳一下
    petArt.classList.remove('hop');
    void petArt.offsetWidth;
    petArt.classList.add('hop');
    // 冒音符
    spawnNote();
    // 发声
    if (audioReady && note) ENGINE.playNote(note);

    // 一段时间没输入 -> 睡觉
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      petBody.classList.add('sleeping');
      petZzz.classList.add('show');
    }, 3500);
  }

  function spawnNote() {
    const el = document.createElement('span');
    el.className = 'pet-note';
    el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    el.style.left = (30 + Math.random() * 40) + '%';
    el.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
    el.style.setProperty('--hue', Math.floor(Math.random() * 360));
    petNotes.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // ------------------------------------------------------------------
  // 事件
  // ------------------------------------------------------------------
  if (window.kbi) {
    window.kbi.onGlobalKeydown((payload) => {
      ensureAudio();
      const note = M.noteFromUiohook(payload.keycode);
      reactToKey(note);
    });
    window.kbi.onInstrumentChanged((id) => applyInstrument(id));
  }

  // 点击桌宠 -> 回主窗口
  petBody.addEventListener('click', () => {
    if (window.kbi) window.kbi.petClicked();
  });

  // 悬停显示提示
  petBody.addEventListener('mouseenter', () => petTip.classList.add('show'));
  petBody.addEventListener('mouseleave', () => petTip.classList.remove('show'));

  // 初始睡眠态
  applyInstrument(currentInstrument);
  petBody.classList.add('sleeping');
  petZzz.classList.add('show');
})();
