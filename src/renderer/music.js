// ==========================================================================
// music.js — 键位 -> 音符 映射 + 乐器定义 (被主窗口和桌宠共享)
// 通过 <script> 标签加载, 挂到 window.KBI_MUSIC
// ==========================================================================
(function (global) {
  'use strict';

  // ------------------------------------------------------------------
  // uiohook keycode -> 逻辑键名 (来自 uiohook-napi 的 UiohookKey)
  // 只映射我们关心的字母/数字键
  // ------------------------------------------------------------------
  const UIOHOOK_KEYCODE_TO_KEY = {
    0x001E: 'A', 0x0030: 'B', 0x002E: 'C', 0x0020: 'D', 0x0012: 'E',
    0x0021: 'F', 0x0022: 'G', 0x0023: 'H', 0x0017: 'I', 0x0024: 'J',
    0x0025: 'K', 0x0026: 'L', 0x0032: 'M', 0x0031: 'N', 0x0018: 'O',
    0x0019: 'P', 0x0010: 'Q', 0x0013: 'R', 0x001F: 'S', 0x0014: 'T',
    0x0016: 'U', 0x002F: 'V', 0x0011: 'W', 0x002D: 'X', 0x0015: 'Y',
    0x002C: 'Z',
    0x000B: '0', 0x0002: '1', 0x0003: '2', 0x0004: '3', 0x0005: '4',
    0x0006: '5', 0x0007: '6', 0x0008: '7', 0x0009: '8', 0x000A: '9',
    0x0039: 'Space',
  };

  // ------------------------------------------------------------------
  // 逻辑键 -> 音符 (科学音高记号, 供 Tone.js & VexFlow 使用)
  // 设计: 按 QWERTY 常用打字键从低到高铺一段 C 大调音阶,
  //       让随手打字也能连成较悦耳的旋律。
  // ------------------------------------------------------------------
  const KEY_TO_NOTE = {
    // 主行(打字最频繁) -> 中央 C 附近一个八度
    A: 'C4', S: 'D4', D: 'E4', F: 'F4', G: 'G4', H: 'A4', J: 'B4',
    K: 'C5', L: 'D5',
    // 上排 -> 高八度延伸
    Q: 'E5', W: 'F5', E: 'G5', R: 'A5', T: 'B5', Y: 'C6', U: 'D6',
    I: 'E6', O: 'F6', P: 'G6',
    // 下排 -> 低音区
    Z: 'C3', X: 'D3', C: 'E3', V: 'F3', B: 'G3', N: 'A3', M: 'B3',
    // 数字排 -> 半音点缀(黑键), 让偶尔按到也不难听
    1: 'C#4', 2: 'D#4', 3: 'F#4', 4: 'G#4', 5: 'A#4',
    6: 'C#5', 7: 'D#5', 8: 'F#5', 9: 'G#5', 0: 'A#5',
  };

  // ------------------------------------------------------------------
  // 乐器定义: id / 中文名 / emoji占位(等你替换成真实素材) / Tone合成器配置
  // ------------------------------------------------------------------
  const INSTRUMENTS = {
    piano: {
      id: 'piano',
      name: '钢琴',
      emoji: '🎹',
      // 明亮、带衰减 —— 近似钢琴
      synth: {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.6, sustain: 0.05, release: 1.2 },
      },
    },
    guitar: {
      id: 'guitar',
      name: '吉他',
      emoji: '🎸',
      synth: {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.8 },
      },
    },
    music_box: {
      id: 'music_box',
      name: '八音盒',
      emoji: '🎶',
      synth: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.9, sustain: 0.0, release: 1.5 },
      },
    },
    flute: {
      id: 'flute',
      name: '长笛',
      emoji: '🪈',
      synth: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.7, release: 0.4 },
      },
    },
    synth_wave: {
      id: 'synth_wave',
      name: '合成器',
      emoji: '🎛️',
      synth: {
        oscillator: { type: 'square' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 },
      },
    },
  };

  const DEFAULT_INSTRUMENT = 'piano';

  // ------------------------------------------------------------------
  // 工具: 从事件解析音符
  // ------------------------------------------------------------------
  function noteFromUiohook(keycode) {
    const key = UIOHOOK_KEYCODE_TO_KEY[keycode];
    if (!key || key === 'Space') return null;
    return KEY_TO_NOTE[key] || null;
  }

  function noteFromBrowserKey(evtKey) {
    if (!evtKey) return null;
    const k = evtKey.length === 1 ? evtKey.toUpperCase() : evtKey;
    return KEY_TO_NOTE[k] || null;
  }

  global.KBI_MUSIC = {
    UIOHOOK_KEYCODE_TO_KEY,
    KEY_TO_NOTE,
    INSTRUMENTS,
    DEFAULT_INSTRUMENT,
    noteFromUiohook,
    noteFromBrowserKey,
  };
})(window);
