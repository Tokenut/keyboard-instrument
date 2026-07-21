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

  // Tone.js 需要用户手势后才能启动音频上下文
  async function ensureStarted() {
    if (started) return;
    if (global.Tone && global.Tone.start) {
      await global.Tone.start();
    }
    started = true;
  }

  function buildSynth(instrumentId) {
    const inst = M.INSTRUMENTS[instrumentId] || M.INSTRUMENTS[M.DEFAULT_INSTRUMENT];
    if (synth) {
      try { synth.dispose(); } catch (_) { /* noop */ }
    }
    if (!masterVolume) {
      masterVolume = new global.Tone.Volume(-6).toDestination();
    }
    // PolySynth 支持同时按多个键
    synth = new global.Tone.PolySynth(global.Tone.Synth, inst.synth).connect(masterVolume);
    currentInstrumentId = inst.id;
  }

  function setInstrument(instrumentId) {
    if (!global.Tone) return;
    buildSynth(instrumentId);
  }

  function playNote(note, duration = '8n') {
    if (!global.Tone || !synth) return;
    if (!note) return;
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
    get currentInstrumentId() { return currentInstrumentId; },
    get started() { return started; },
  };
})(window);
