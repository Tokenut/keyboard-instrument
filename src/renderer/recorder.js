// ==========================================================================
// recorder.js — 演奏录制器
//   记录每个音的: 音高 / 起始时间 / 持续时长(keydown→keyup)
//   -> 供后处理成有真实节奏的曲子。
//   挂到 window.KBI_RECORDER
// ==========================================================================
(function (global) {
  'use strict';

  let recording = false;
  let startTime = 0;
  let events = [];        // 已完成(含时长)的音: { note, t, dur }
  const pending = {};     // 按下未松开的键: keycode -> { note, t, idx }

  function now() { return performance.now(); }

  function start() {
    recording = true;
    startTime = now();
    events = [];
    for (const k in pending) delete pending[k];
  }

  // 按下: 记录起始时间, 先放一个占位(dur 待定)
  function noteOn(note, keycode) {
    if (!recording || !note) return;
    const t = now() - startTime;
    const idx = events.length;
    events.push({ note, t, dur: null });
    // 用 keycode 关联 keyup; 若同键重复按下, 覆盖为最新
    if (keycode != null) pending[keycode] = { idx, t };
  }

  // 松开: 补上时长
  function noteOff(keycode) {
    if (!recording || keycode == null) return;
    const p = pending[keycode];
    if (!p) return;
    const t = now() - startTime;
    if (events[p.idx]) events[p.idx].dur = Math.max(40, t - p.t);
    delete pending[keycode];
  }

  // 无 keycode 场景(网页 fallback 只有音符)的兼容: 直接记一个默认短音
  function capture(note) {
    if (!recording || !note) return;
    const t = now() - startTime;
    events.push({ note, t, dur: 160 });
  }

  function stop() {
    recording = false;
    // 给还没松开的音补一个默认时长
    events.forEach((e) => { if (e.dur == null) e.dur = 200; });
    const duration = events.length ? events[events.length - 1].t : 0;
    for (const k in pending) delete pending[k];
    return { events: events.slice(), duration, count: events.length };
  }

  function isRecording() { return recording; }
  function currentCount() { return events.length; }

  global.KBI_RECORDER = { start, noteOn, noteOff, capture, stop, isRecording, currentCount };
})(window);
