// ==========================================================================
// score.js — VexFlow 五线谱实时记谱 + 羽毛笔光标定位
// 挂到 window.KBI_SCORE
// ==========================================================================
(function (global) {
  'use strict';

  // VexFlow UMD 在浏览器挂到 window.Vex
  const VF = global.Vex && global.Vex.Flow ? global.Vex.Flow : (global.Vex || {});

  const STAVE_W = 200;      // 每个小节的目标最小宽度(实际会自适应铺满)
  const NOTES_PER_MEASURE = 4; // 每小节音符数(4/4 拍, 四分音符)
  const STAVE_H = 150;
  const LEFT_PAD = 8;
  const MAX_NOTES = 48;     // 谱面最多保留的音符数(超过则滚动跟随)

  let container = null;   // #score
  let scrollEl = null;    // #scoreScroll
  let quillEl = null;     // 羽毛笔 img
  let renderer = null;
  let context = null;

  // 已记录的音符队列, 每项 { note: 'C4', key: 'c/4' }
  let noteQueue = [];
  // 最后一个音符的真实绘制坐标(来自 VexFlow), 用于精确定位羽毛笔
  let lastNotePos = null;

  // 把科学音高 'C#4' 转成 VexFlow 的 'c#/4'
  function toVexKey(sci) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(sci);
    if (!m) return 'c/4';
    const letter = m[1].toLowerCase();
    const acc = m[2] || '';
    const oct = m[3];
    return `${letter}${acc}/${oct}`;
  }

  function init(scoreEl, scrollContainer, quill) {
    container = scoreEl;
    scrollEl = scrollContainer;
    quillEl = quill;
    renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    redraw();
  }

  // 添加一个音符并重绘
  function addNote(sciNote) {
    noteQueue.push({ note: sciNote, key: toVexKey(sciNote) });
    // 最多保留一定数量, 防止无限增长
    if (noteQueue.length > MAX_NOTES) {
      noteQueue = noteQueue.slice(noteQueue.length - MAX_NOTES);
    }
    redraw();
    autoScroll();          // 先滚到末尾
    positionQuillAtLast(); // 再按最终 scrollLeft 定位羽毛笔
  }

  function clear() {
    noteQueue = [];
    redraw();
    if (quillEl) quillEl.style.opacity = '0';
  }

  // 计算需要多少小节
  function measureCount() {
    return Math.max(1, Math.ceil(noteQueue.length / NOTES_PER_MEASURE));
  }

  // 每行可容纳的小节数(根据 viewport 可用宽度)
  function measuresPerLine() {
    const avail = (scrollEl ? scrollEl.clientWidth : 440) - LEFT_PAD * 2;
    return Math.max(1, Math.floor(avail / STAVE_W));
  }

  const LINE_H = 116;       // 每行五线谱垂直间距
  const TOP_PAD = 10;

  function redraw() {
    if (!renderer) return;
    const measures = measureCount();
    const perLine = measuresPerLine();
    const lines = Math.ceil(measures / perLine);

    // 可用宽度: viewport 客户区减去左右留白
    const avail = (scrollEl ? scrollEl.clientWidth : 440) - LEFT_PAD * 2;
    // 小节宽度自适应, 铺满每行
    const staveW = Math.floor(avail / perLine);
    const lineW = LEFT_PAD * 2 + perLine * staveW;
    const totalH = TOP_PAD + lines * LINE_H + 20;
    renderer.resize(lineW, totalH);
    context = renderer.getContext();
    context.clear();
    context.setFont('Arial', 10);

    lastNotePos = null;
    const lastRealIdx = noteQueue.length - 1;

    for (let mi = 0; mi < measures; mi++) {
      const lineIdx = Math.floor(mi / perLine);
      const colIdx = mi % perLine;
      const x = LEFT_PAD + colIdx * staveW;
      const y = TOP_PAD + lineIdx * LINE_H;
      const isLineStart = colIdx === 0;

      const stave = new VF.Stave(x, y, staveW);
      // 每行开头都画谱号(像真乐谱), 第一行还画拍号
      if (isLineStart) {
        stave.addClef('treble');
        if (lineIdx === 0) stave.addTimeSignature('4/4');
      }
      stave.setContext(context).draw();

      const sliceStart = mi * NOTES_PER_MEASURE;
      const slice = noteQueue.slice(sliceStart, sliceStart + NOTES_PER_MEASURE);
      const vexNotes = slice.map((n) => {
        const keyLetter = n.key.split('/')[0];
        const staveNote = new VF.StaveNote({ keys: [n.key], duration: 'q' });
        if (keyLetter.includes('#')) {
          staveNote.addModifier(new VF.Accidental('#'), 0);
        } else if (keyLetter.includes('b')) {
          staveNote.addModifier(new VF.Accidental('b'), 0);
        }
        return staveNote;
      });

      const realCount = vexNotes.length;
      while (vexNotes.length < NOTES_PER_MEASURE) {
        vexNotes.push(new VF.StaveNote({ keys: ['b/4'], duration: 'qr' }));
      }

      try {
        VF.Formatter.FormatAndDraw(context, stave, vexNotes, { auto_beam: false });
        if (lastRealIdx >= sliceStart && lastRealIdx < sliceStart + realCount) {
          const idxInMeasure = lastRealIdx - sliceStart;
          const noteObj = vexNotes[idxInMeasure];
          try {
            const nx = noteObj.getAbsoluteX();
            const ys = noteObj.getYs ? noteObj.getYs() : null;
            const ny = (ys && ys.length) ? ys[0] : (y + 40);
            lastNotePos = { x: nx, y: ny };
          } catch (_) { /* noop */ }
        }
      } catch (err) {
        // 某些边界情况格式化失败, 跳过该小节
      }
    }
  }

  // 把羽毛笔笔尖移到最后一个音符的真实绘制位置
  //   quill 相对 .score-paper 定位; scrollEl = .score-viewport
  function positionQuillAtLast() {
    if (!quillEl || !lastNotePos || !container || !scrollEl) return;

    // viewport 相对其定位父级(.score-paper)的偏移
    const vpLeft = scrollEl.offsetLeft;
    const vpTop = scrollEl.offsetTop;
    // score(SVG容器)相对 viewport 的偏移(viewport 的 padding)
    const scoreLeft = container.offsetLeft;
    const scoreTop = container.offsetTop;
    // 笔尖锚点(SVG 内笔尖位置)
    const TIP_X = 8, TIP_Y = 52;

    // 多行纵向滚动: x 固定, y 减去已滚动距离
    const x = vpLeft + scoreLeft + lastNotePos.x - TIP_X;
    const y = vpTop + scoreTop + lastNotePos.y - scrollEl.scrollTop - TIP_Y;

    quillEl.style.opacity = '1';
    quillEl.style.transform = `translate(${x}px, ${y}px)`;
    quillEl.classList.remove('quill-dip');
    void quillEl.offsetWidth;
    quillEl.classList.add('quill-dip');
  }

  function autoScroll() {
    if (!scrollEl) return;
    // 多行布局: 纵向滚到最新一行
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  global.KBI_SCORE = { init, addNote, clear };
})(window);
