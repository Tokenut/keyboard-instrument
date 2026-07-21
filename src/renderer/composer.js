// ==========================================================================
// composer.js — 后处理: 把随机敲击整理成一首"曲子"
//   1. 节奏量化: 把杂乱时间戳吸附到节拍网格
//   2. 音阶吸附: 把每个音吸到选定调式(默认 C 大调五声), 消除不和谐
//   3. 输出结构化曲子(带时值), 供播放/记谱/特征提取/海报
//   挂到 window.KBI_COMPOSER
// ==========================================================================
(function (global) {
  'use strict';

  // 半音序号 <-> 音名
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // 常用调式(相对主音的半音集合)
  const SCALES = {
    'C_major':      { root: 0, name: 'C 大调',   set: [0, 2, 4, 5, 7, 9, 11] },
    'C_pentatonic': { root: 0, name: 'C 大调五声', set: [0, 2, 4, 7, 9] },
    'A_minor':      { root: 9, name: 'A 小调',   set: [0, 2, 3, 5, 7, 8, 10] },
    'A_minor_pent': { root: 9, name: 'A 小调五声', set: [0, 3, 5, 7, 10] },
    'chromatic':    { root: 0, name: '半音(不吸附)', set: [0,1,2,3,4,5,6,7,8,9,10,11] },
  };

  const DEFAULT_SCALE = 'C_pentatonic';

  // ---- 音名 <-> MIDI 编号 ----
  function noteToMidi(note) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
    if (!m) return 60;
    let idx = NOTE_NAMES.indexOf(m[1] + (m[2] === '#' ? '#' : ''));
    if (m[2] === 'b') idx = (NOTE_NAMES.indexOf(m[1]) + 11) % 12;
    const oct = parseInt(m[3], 10);
    return idx + (oct + 1) * 12;
  }

  function midiToNote(midi) {
    const idx = ((midi % 12) + 12) % 12;
    const oct = Math.floor(midi / 12) - 1;
    return NOTE_NAMES[idx] + oct;
  }

  // 把一个 midi 吸附到调式内最近的音
  function snapToScale(midi, scaleKey) {
    const scale = SCALES[scaleKey] || SCALES[DEFAULT_SCALE];
    if (scaleKey === 'chromatic') return midi;
    const pcTargets = scale.set.map((s) => (s + scale.root) % 12);
    let best = midi;
    let bestDist = 99;
    // 在 ±6 半音内找调式内最近音
    for (let d = 0; d <= 6; d++) {
      for (const dir of [d, -d]) {
        const cand = midi + dir;
        if (pcTargets.includes(((cand % 12) + 12) % 12)) {
          if (Math.abs(dir) < bestDist) { bestDist = Math.abs(dir); best = cand; }
        }
      }
      if (bestDist < 99) break;
    }
    return best;
  }

  // ---- 节奏量化 ----
  // 把事件时间戳吸附到 16 分音符网格; 根据平均间隔估算 BPM
  // events: [{ note, t, dur }]  dur=真实按键时长(ms)
  function quantize(events) {
    if (events.length < 2) {
      return { bpm: 90, beatMs: 666, stepMs: 166,
        notes: events.map((e) => ({ note: e.note, step: 0, durSteps: 2 })) };
    }
    // 估算 BPM: 用相邻音起始间隔中位数当作一个"步进"
    const gaps = [];
    for (let i = 1; i < events.length; i++) gaps.push(events[i].t - events[i - 1].t);
    gaps.sort((a, b) => a - b);
    const medGap = gaps[Math.floor(gaps.length / 2)] || 300;
    // 把中位间隔当作八分音符, 反推 BPM (八分 = 半拍)
    let bpm = Math.round(60000 / (medGap * 2));
    bpm = Math.min(180, Math.max(60, bpm)); // 限制在合理范围
    const beatMs = 60000 / bpm;
    const stepMs = beatMs / 4; // 16 分音符网格

    // 把每个事件量化到网格步
    const notes = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const step = Math.round(e.t / stepMs);
      // 时值优先用真实按键时长; 没有则用到下一个音的间隔
      let durMs = e.dur;
      if (!durMs || durMs < 40) {
        const next = events[i + 1];
        durMs = next ? (next.t - e.t) : stepMs * 2;
      }
      let durSteps = Math.round(durMs / stepMs);
      durSteps = Math.min(16, Math.max(1, durSteps)); // 1个16分 ~ 1个全音符
      notes.push({ note: e.note, step, durSteps });
    }
    return { bpm, beatMs, stepMs, notes };
  }

  // ---- 主流程: 生成曲子 ----
  function compose(rawEvents, opts = {}) {
    const scaleKey = opts.scale || DEFAULT_SCALE;
    const q = quantize(rawEvents);

    // 音阶吸附 + 转 Tone.js 需要的结构(带 duration 秒数)
    const beatMs = q.beatMs || (60000 / q.bpm);
    const stepMs = q.stepMs || beatMs / 4;

    const notes = q.notes.map((n) => {
      const snappedMidi = snapToScale(noteToMidi(n.note), scaleKey);
      const snapped = midiToNote(snappedMidi);
      return {
        note: snapped,
        midi: snappedMidi,
        startSec: (n.step * stepMs) / 1000,
        durSec: Math.max(0.12, (n.durSteps * stepMs) / 1000),
        durSteps: n.durSteps,
        step: n.step,
      };
    });

    return {
      bpm: q.bpm,
      scale: scaleKey,
      scaleName: (SCALES[scaleKey] || {}).name || scaleKey,
      notes,
      totalSec: notes.length ? notes[notes.length - 1].startSec + notes[notes.length - 1].durSec : 0,
    };
  }

  global.KBI_COMPOSER = {
    compose,
    noteToMidi,
    midiToNote,
    SCALES,
    DEFAULT_SCALE,
    NOTE_NAMES,
  };
})(window);
