// ==========================================================================
// matcher.js — 从曲子提取特征 + 匹配最接近的作曲家
//   挂到 window.KBI_MATCHER
// ==========================================================================
(function (global) {
  'use strict';

  const CMP = global.KBI_COMPOSERS;
  const CO = global.KBI_COMPOSER;

  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  // ------------------------------------------------------------------
  // 从 composer.compose() 的结果提取 6 维特征(0~1)
  // ------------------------------------------------------------------
  function extractFeatures(song) {
    const notes = song.notes || [];
    if (notes.length === 0) {
      return { pitch: 0.5, tempo: 0.5, valence: 0.5, complexity: 0.5, density: 0.5, range: 0.5 };
    }
    const midis = notes.map((n) => n.midi);

    // pitch: 平均音高映射到 0~1 (MIDI 48=C3 低 ~ 84=C6 高)
    const avgMidi = midis.reduce((a, b) => a + b, 0) / midis.length;
    const pitch = clamp01((avgMidi - 48) / (84 - 48));

    // tempo: BPM 60~180 -> 0~1
    const tempo = clamp01((song.bpm - 60) / (180 - 60));

    // range: 音域跨度(半音), 0~36 -> 0~1
    const span = Math.max(...midis) - Math.min(...midis);
    const range = clamp01(span / 36);

    // complexity: 相邻音程平均跳动(半音) 0~12 -> 0~1
    let leapSum = 0;
    for (let i = 1; i < midis.length; i++) leapSum += Math.abs(midis[i] - midis[i - 1]);
    const avgLeap = midis.length > 1 ? leapSum / (midis.length - 1) : 0;
    const complexity = clamp01(avgLeap / 12);

    // density: 每秒音符数 0~8 -> 0~1
    const notesPerSec = song.totalSec > 0 ? notes.length / song.totalSec : 2;
    const density = clamp01(notesPerSec / 8);

    // valence: 大调/小调倾向。统计音级里"大三度(4)"vs"小三度(3)"色彩音的比例
    // 简化: 看音级集合里 E(大三度色彩) 和 Eb/A(小调色彩) 出现比
    const pcs = midis.map((m) => ((m % 12) + 12) % 12);
    const majorish = pcs.filter((p) => [4, 11, 7].includes(p)).length; // E B G -> 明亮
    const minorish = pcs.filter((p) => [3, 8, 10].includes(p)).length;  // Eb Ab Bb -> 忧郁
    let valence = 0.5;
    if (majorish + minorish > 0) valence = clamp01(majorish / (majorish + minorish));
    // 音区高也略微加分明亮感
    valence = clamp01(valence * 0.8 + pitch * 0.2);

    return { pitch, tempo, valence, complexity, density, range };
  }

  // ------------------------------------------------------------------
  // 加权距离匹配
  // ------------------------------------------------------------------
  const WEIGHTS = { pitch: 1, tempo: 1.1, valence: 1.2, complexity: 1.2, density: 1, range: 0.8 };

  function distance(a, b) {
    let sum = 0, wsum = 0;
    for (const k in WEIGHTS) {
      const w = WEIGHTS[k];
      const d = (a[k] - b[k]);
      sum += w * d * d;
      wsum += w;
    }
    return Math.sqrt(sum / wsum); // 归一化到 0~1 附近
  }

  // 返回排序后的匹配列表 + 最佳
  function match(song) {
    const feat = extractFeatures(song);
    const scored = CMP.list.map((c) => {
      const dist = distance(feat, c.vec);
      const similarity = Math.round(clamp01(1 - dist) * 100);
      return { composer: c, dist, similarity };
    });
    scored.sort((a, b) => a.dist - b.dist);
    return {
      features: feat,
      best: scored[0],
      ranking: scored,
    };
  }

  // 生成一句"为什么匹配"的解释
  function explain(feat, composer) {
    const reasons = [];
    const cv = composer.vec;
    const near = (k, label) => Math.abs(feat[k] - cv[k]) < 0.18;
    if (near('tempo')) reasons.push(feat.tempo > 0.6 ? '速度明快' : (feat.tempo < 0.4 ? '从容舒缓' : '节奏适中'));
    if (near('valence')) reasons.push(feat.valence > 0.6 ? '色彩明亮' : (feat.valence < 0.4 ? '忧郁内省' : '明暗交织'));
    if (near('complexity')) reasons.push(feat.complexity > 0.6 ? '旋律跳跃丰富' : '线条简洁');
    if (near('density')) reasons.push(feat.density > 0.6 ? '音符密集' : '留白从容');
    if (near('range')) reasons.push(feat.range > 0.6 ? '音域开阔' : '音域集中');
    if (reasons.length === 0) reasons.push('整体气质相近');
    return reasons.slice(0, 3).join(' · ');
  }

  global.KBI_MATCHER = { extractFeatures, match, explain };
})(window);
