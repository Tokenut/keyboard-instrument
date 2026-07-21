// ==========================================================================
// engine.js — 声音引擎 (封装 Tone.js)
// 挂到 window.KBI_ENGINE
// ==========================================================================
(function (global) {
  'use strict';

  const M = global.KBI_MUSIC;
  let synth = null;
  let currentInstrumentId = M.DEFAULT_INSTRUMENT;
  let started = false;
  let masterVolume = null;
  let reverb = null;
  const samplerCache = {}; // 缓存已加载的采样器, 避免重复下载
  let loadingCb = null;    // 采样加载状态回调

  function onLoadingChange(cb) { loadingCb = cb; }

  // Tone.js 需要用户手势后才能启动音频上下文
  async function ensureStarted() {
    if (started) return;
    if (global.Tone && global.Tone.start) {
      await global.Tone.start();
    }
    started = true;
  }

  function ensureMaster() {
    if (!masterVolume) {
      // 加一点混响, 让声音更自然、有空间感
      reverb = new global.Tone.Reverb({ decay: 1.6, wet: 0.18 }).toDestination();
      masterVolume = new global.Tone.Volume(-6).connect(reverb);
    }
  }

  function buildSynth(instrumentId) {
    const inst = M.INSTRUMENTS[instrumentId] || M.INSTRUMENTS[M.DEFAULT_INSTRUMENT];
    ensureMaster();
    if (synth) {
      try { synth.disconnect(); } catch (_) { /* noop */ }
    }
    currentInstrumentId = inst.id;

    // 采样乐器: 用 Tone.Sampler
    if (inst.sampler) {
      if (samplerCache[inst.id]) {
        synth = samplerCache[inst.id];
        synth.connect(masterVolume);
        if (loadingCb) loadingCb(false, inst.id);
        return;
      }
      if (loadingCb) loadingCb(true, inst.id); // 开始加载
      const sampler = new global.Tone.Sampler({
        urls: inst.sampler.urls,
        baseUrl: inst.sampler.baseUrl,
        release: inst.sampler.release || 1,
        onload: () => { if (loadingCb) loadingCb(false, inst.id); },
      }).connect(masterVolume);
      samplerCache[inst.id] = sampler;
      synth = sampler;
      return;
    }

    // 合成乐器: 按 synthType 选择合成器
    const SynthCtor = inst.synthType === 'FMSynth' ? global.Tone.FMSynth
      : inst.synthType === 'AMSynth' ? global.Tone.AMSynth
      : global.Tone.Synth;
    synth = new global.Tone.PolySynth(SynthCtor, inst.synth).connect(masterVolume);
    if (loadingCb) loadingCb(false, inst.id);
  }

  function setInstrument(instrumentId) {
    if (!global.Tone) return;
    buildSynth(instrumentId);
  }

  function playNote(note, duration = '8n') {
    if (!global.Tone || !synth) return;
    if (!note) return;
    // 采样器未加载完时 loaded=false, 静默跳过避免报错
    if (synth.loaded === false) return;
    try {
      synth.triggerAttackRelease(note, duration);
    } catch (err) {
      // 极少数情况下同一时刻重复触发会抛错, 忽略即可
    }
  }

  function setVolume(db) {
    if (masterVolume) masterVolume.volume.value = db;
  }

  // ------------------------------------------------------------------
  // 回放一首曲子 (composer.compose() 的输出)
  // 用 setTimeout 精确调度, 简单可靠; 返回一个 stop 函数
  // ------------------------------------------------------------------
  let playTimers = [];
  function stopSong() {
    playTimers.forEach((t) => clearTimeout(t));
    playTimers = [];
  }

  function playSong(song, opts = {}) {
    if (!global.Tone || !synth) return () => {};
    stopSong();
    const notes = song.notes || [];
    notes.forEach((n) => {
      const timer = setTimeout(() => {
        try {
          synth.triggerAttackRelease(n.note, Math.max(0.12, n.durSec), undefined, 0.9);
        } catch (_) { /* noop */ }
        if (opts.onNote) opts.onNote(n);
      }, n.startSec * 1000);
      playTimers.push(timer);
    });
    // 结束回调
    if (opts.onEnd) {
      const endT = setTimeout(opts.onEnd, (song.totalSec + 0.3) * 1000);
      playTimers.push(endT);
    }
    return stopSong;
  }

  global.KBI_ENGINE = {
    ensureStarted,
    setInstrument,
    playNote,
    playSong,
    stopSong,
    setVolume,
    onLoadingChange,
    get currentInstrumentId() { return currentInstrumentId; },
    get started() { return started; },
  };
})(window);
