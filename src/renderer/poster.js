// ==========================================================================
// poster.js — 用 Canvas 生成可下载的分享海报
//   内容: 标题 · 作曲家 · 相似度 · 匹配理由 · 特征雷达图 · 迷你旋律 · 文案
//   挂到 window.KBI_POSTER
// ==========================================================================
(function (global) {
  'use strict';

  const W = 720;
  const H = 1080;

  const FEATURE_LABELS = {
    pitch: '音区', tempo: '速度', valence: '明亮',
    complexity: '繁复', density: '密度', range: '音域',
  };

  // 圆角矩形
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRadar(ctx, cx, cy, radius, features, color) {
    const keys = Object.keys(FEATURE_LABELS);
    const n = keys.length;
    const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring++) {
      const rr = (radius * ring) / 4;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = angle(i % n);
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 轴线 + 标签
    ctx.fillStyle = 'rgba(244,236,220,0.75)';
    ctx.font = '22px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    keys.forEach((k, i) => {
      const a = angle(i);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      const lx = cx + (radius + 30) * Math.cos(a);
      const ly = cy + (radius + 30) * Math.sin(a);
      ctx.fillText(FEATURE_LABELS[k], lx, ly);
    });
    // 数据多边形
    ctx.beginPath();
    keys.forEach((k, i) => {
      const v = Math.max(0.05, features[k]);
      const a = angle(i);
      const x = cx + radius * v * Math.cos(a);
      const y = cy + radius * v * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = color + '55';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();
    // 顶点
    keys.forEach((k, i) => {
      const v = Math.max(0.05, features[k]);
      const a = angle(i);
      const x = cx + radius * v * Math.cos(a);
      const y = cy + radius * v * Math.sin(a);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color; ctx.fill();
    });
  }

  // 迷你旋律可视化(音高柱)
  function drawMelody(ctx, x, y, w, h, notes, color) {
    if (!notes.length) return;
    const midis = notes.map((n) => n.midi);
    const lo = Math.min(...midis), hi = Math.max(...midis);
    const span = Math.max(1, hi - lo);
    const show = notes.slice(0, 48);
    const bw = w / show.length;
    show.forEach((n, i) => {
      const t = (n.midi - lo) / span;
      const bh = 6 + t * (h - 6);
      const bx = x + i * bw;
      const by = y + (h - bh);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5 + t * 0.5;
      roundRect(ctx, bx + 1, by, Math.max(2, bw - 2), bh, 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // 换行绘制
  function wrapText(ctx, text, x, y, maxW, lh) {
    const chars = text.split('');
    let line = '';
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = ch; yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
    return yy;
  }

  // ------------------------------------------------------------------
  // 主函数: 生成海报, 返回 canvas
  // ------------------------------------------------------------------
  function generate({ matchResult, song, instrumentName, reason }) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const best = matchResult.best;
    const c = best.composer;
    const accent = c.color || '#e8b84b';

    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1c1530');
    bg.addColorStop(0.5, '#241b35');
    bg.addColorStop(1, '#140f22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 顶部光晕
    const glow = ctx.createRadialGradient(W / 2, 180, 20, W / 2, 180, 360);
    glow.addColorStop(0, accent + '40');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 500);

    ctx.textAlign = 'center';

    // 小标题
    ctx.fillStyle = 'rgba(244,236,220,0.6)';
    ctx.font = '26px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('· 我的键盘作曲画像 ·', W / 2, 90);

    // 作曲家 emoji
    ctx.font = '130px serif';
    ctx.fillText(c.emoji || '🎼', W / 2, 250);

    // "你的曲风最接近"
    ctx.fillStyle = 'rgba(244,236,220,0.75)';
    ctx.font = '28px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('你的曲风最接近', W / 2, 320);

    // 作曲家名
    ctx.fillStyle = accent;
    ctx.font = 'bold 68px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(c.name, W / 2, 395);
    ctx.fillStyle = 'rgba(244,236,220,0.5)';
    ctx.font = '26px -apple-system, sans-serif';
    ctx.fillText(c.en + '  ·  ' + c.era, W / 2, 435);

    // 相似度徽章
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px -apple-system, sans-serif';
    ctx.fillText('契合度 ' + best.similarity + '%', W / 2, 490);

    // 标签
    ctx.fillStyle = 'rgba(244,236,220,0.85)';
    ctx.font = '25px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(c.tag, W / 2, 535);

    // 雷达图
    drawRadar(ctx, W / 2, 720, 150, matchResult.features, accent);

    // 匹配理由卡片
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, 80, 895, W - 160, 70, 16);
    ctx.fill();
    ctx.fillStyle = 'rgba(244,236,220,0.9)';
    ctx.font = '24px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('“ ' + (reason || c.tag) + ' ”', W / 2, 938);

    // 迷你旋律
    drawMelody(ctx, 80, 985, W - 160, 44, song.notes || [], accent);

    // 底部信息
    ctx.fillStyle = 'rgba(244,236,220,0.45)';
    ctx.font = '22px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`♪ ${instrumentName}`, 80, 1055);
    ctx.textAlign = 'right';
    ctx.fillText(`${song.bpm} BPM · ${song.scaleName} · ${(song.notes||[]).length}音`, W - 80, 1055);

    // 品牌
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,236,220,0.3)';
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillText('Keyboard Instrument · 打字即作曲', W / 2, 1085 - 5);

    return canvas;
  }

  function download(canvas, filename) {
    const a = document.createElement('a');
    a.download = filename || `keyboard-composer-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  global.KBI_POSTER = { generate, download };
})(window);
