// ==========================================================================
// recorder.js — 演奏录制器
//   记录一段时间内敲下的音符及其时间戳(ms), 供后处理成曲子。
//   挂到 window.KBI_RECORDER
// ==========================================================================
(function (global) {
  'use strict';

  let recording = false;
  let startTime = 0;
  let events = []; // [{ note:'C4', t: ms相对开始 }]

  function start() {
    recording = true;
    startTime = performance.now();
    events = [];
  }

  // 每次发声时调用
  function capture(note) {
    if (!recording || !note) return;
    events.push({ note, t: performance.now() - startTime });
  }

  // 停止并返回原始录制数据
  function stop() {
    recording = false;
    const duration = events.length ? events[events.length - 1].t : 0;
    return {
      events: events.slice(),
      duration,
      count: events.length,
    };
  }

  function isRecording() {
    return recording;
  }

  function currentCount() {
    return events.length;
  }

  global.KBI_RECORDER = { start, capture, stop, isRecording, currentCount };
})(window);
