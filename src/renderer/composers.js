// ==========================================================================
// composers.js — 作曲家/音乐大师 知识库(本地画像)
//   每位用 6 维特征向量(0~1)描述其典型曲风, 用于与用户曲子做距离匹配。
//   特征维度:
//     pitch      音区偏高?      (0 低沉 ~ 1 高亢)
//     tempo      速度偏快?      (0 慢板 ~ 1 急板)
//     valence    明亮/大调?     (0 忧郁小调 ~ 1 明亮大调)
//     complexity 复杂/半音多?   (0 简约 ~ 1 繁复)
//     density    音符密集?      (0 疏 ~ 1 密)
//     range      音域宽?        (0 窄 ~ 1 宽)
//   挂到 window.KBI_COMPOSERS
// ==========================================================================
(function (global) {
  'use strict';

  const COMPOSERS = [
    {
      id: 'bach', name: '巴赫', en: 'J.S. Bach', era: '巴洛克',
      emoji: '⛪',
      color: '#8d6e3a',
      vec: { pitch: 0.5, tempo: 0.55, valence: 0.55, complexity: 0.9, density: 0.85, range: 0.7 },
      tag: '复调织体 · 数学般的秩序',
      quote: '音乐是流动的建筑，秩序中藏着神性。',
    },
    {
      id: 'mozart', name: '莫扎特', en: 'W.A. Mozart', era: '古典',
      emoji: '🎭',
      color: '#e0a63b',
      vec: { pitch: 0.7, tempo: 0.7, valence: 0.85, complexity: 0.55, density: 0.6, range: 0.65 },
      tag: '明亮优雅 · 天真与灵巧',
      quote: '你的旋律轻盈得像羽毛，笑意藏在每个音符里。',
    },
    {
      id: 'beethoven', name: '贝多芬', en: 'L. van Beethoven', era: '古典/浪漫',
      emoji: '🌩️',
      color: '#6b5b95',
      vec: { pitch: 0.45, tempo: 0.6, valence: 0.3, complexity: 0.7, density: 0.7, range: 0.85 },
      tag: '戏剧张力 · 命运的叩击',
      quote: '你的敲击里有风暴，也有不肯低头的意志。',
    },
    {
      id: 'chopin', name: '肖邦', en: 'F. Chopin', era: '浪漫',
      emoji: '🌙',
      color: '#b06a8f',
      vec: { pitch: 0.75, tempo: 0.5, valence: 0.45, complexity: 0.65, density: 0.6, range: 0.75 },
      tag: '诗意夜曲 · 键盘上的呼吸',
      quote: '每个音都像月光下的低语，忧郁而温柔。',
    },
    {
      id: 'debussy', name: '德彪西', en: 'C. Debussy', era: '印象派',
      emoji: '🌊',
      color: '#4a90a4',
      vec: { pitch: 0.6, tempo: 0.35, valence: 0.6, complexity: 0.6, density: 0.45, range: 0.7 },
      tag: '朦胧色彩 · 光与水的印象',
      quote: '你的旋律像雾中的海，界限被温柔地模糊。',
    },
    {
      id: 'satie', name: '萨蒂', en: 'Erik Satie', era: '近代',
      emoji: '🍸',
      color: '#7a9e7e',
      vec: { pitch: 0.55, tempo: 0.25, valence: 0.5, complexity: 0.25, density: 0.3, range: 0.4 },
      tag: '极简留白 · 慵懒的沉思',
      quote: '你懂得留白，寂静也是旋律的一部分。',
    },
    {
      id: 'joe_hisaishi', name: '久石让', en: 'Joe Hisaishi', era: '当代',
      emoji: '🍃',
      color: '#6aa84f',
      vec: { pitch: 0.65, tempo: 0.45, valence: 0.75, complexity: 0.4, density: 0.5, range: 0.6 },
      tag: '治愈五声 · 电影般的温柔',
      quote: '你的音符像夏日微风，干净又充满想象。',
    },
    {
      id: 'liszt', name: '李斯特', en: 'Franz Liszt', era: '浪漫',
      emoji: '🔥',
      color: '#c0392b',
      vec: { pitch: 0.7, tempo: 0.9, valence: 0.55, complexity: 0.85, density: 0.9, range: 0.95 },
      tag: '炫技狂想 · 手指的火焰',
      quote: '你的双手在键盘上狂奔，华丽而不知疲倦。',
    },
    {
      id: 'philip_glass', name: '菲利普·格拉斯', en: 'Philip Glass', era: '极简主义',
      emoji: '🔁',
      color: '#546e7a',
      vec: { pitch: 0.55, tempo: 0.65, valence: 0.5, complexity: 0.35, density: 0.8, range: 0.5 },
      tag: '重复织体 · 催眠的循环',
      quote: '你在重复中制造魔力，简单的动机不断生长。',
    },
    {
      id: 'ryuichi', name: '坂本龙一', en: 'Ryuichi Sakamoto', era: '当代',
      emoji: '❄️',
      color: '#5c6bc0',
      vec: { pitch: 0.6, tempo: 0.3, valence: 0.4, complexity: 0.5, density: 0.35, range: 0.6 },
      tag: '冷冽诗意 · 电子与钢琴之间',
      quote: '你的旋律像初雪落地，克制而深情。',
    },
  ];

  global.KBI_COMPOSERS = { list: COMPOSERS };
})(window);
