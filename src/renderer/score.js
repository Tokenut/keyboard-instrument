// ==========================================================================
// score.js — VexFlow 五线谱实时记谱 + 羽毛笔光标定位
// 挂到 window.KBI_SCORE
// ==========================================================================
(function (global) {
  'use strict';

  // VexFlow UMD 在浏览器挂到 window.Vex
  const VF = global.Vex && global.Vex.Flow ? global.Vex.Flow : (global.Vex || {});

  const STAVE_W = 260;      // 每个小节宽度
  const NOTES_PER_MEASURE = 4; // 每小节音符数(4/4 拍, 四分音符)
  const STAVE_H = 130;
  const LEFT_PAD = 10;

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
    // 最多保留一定数量, 防止无限增长(保留最近 40 个音)
    if (noteQueue.length > 40) {
      noteQueue = noteQueue.slice(noteQueue.length - 40);
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

  function redraw() {
    if (!renderer) return;
    const measures = measureCount();
    const totalW = LEFT_PAD + measures * STAVE_W + 20;
    renderer.resize(totalW, STAVE_H);
    context = renderer.getContext();
    context.clear();
    context.setFont('Arial', 10);

    lastNotePos = null;
    const lastRealIdx = noteQueue.length - 1; // 最后一个真实音符的全局索引

    let x = LEFT_PAD;
    for (let mi = 0; mi < measures; mi++) {
      const stave = new VF.Stave(x, 12, STAVE_W);
      if (mi === 0) {
        stave.addClef('treble').addTimeSignature('4/4');
      }
      stave.setContext(context).draw();

      // 该小节的音符
      const sliceStart = mi * NOTES_PER_MEASURE;
      const slice = noteQueue.slice(sliceStart, sliceStart + NOTES_PER_MEASURE);
      const vexNotes = slice.map((n) => {
        const keyLetter = n.key.split('/')[0];
        const staveNote = new VF.StaveNote({
          keys: [n.key],
          duration: 'q',
        });
        // 处理升号
        if (keyLetter.includes('#')) {
          staveNote.addModifier(new VF.Accidental('#'), 0);
        } else if (keyLetter.includes('b')) {
          staveNote.addModifier(new VF.Accidental('b'), 0);
        }
        return staveNote;
      });

      const realCount = vexNotes.length; // 本小节真实音符数
      // 用休止符补齐本小节, 保证节拍完整
      while (vexNotes.length < NOTES_PER_MEASURE) {
        vexNotes.push(new VF.StaveNote({ keys: ['b/4'], duration: 'qr' }));
      }

      try {
        VF.Formatter.FormatAndDraw(context, stave, vexNotes, { auto_beam: false });
        // 若最后一个真实音符落在本小节, 读取它的真实绘制坐标
        if (lastRealIdx >= sliceStart && lastRealIdx < sliceStart + realCount) {
          const idxInMeasure = lastRealIdx - sliceStart;
          const noteObj = vexNotes[idxInMeasure];
          try {
            const nx = noteObj.getAbsoluteX();
            const ys = noteObj.getYs ? noteObj.getYs() : null;
            const ny = (ys && ys.length) ? ys[0] : 40;
            lastNotePos = { x: nx, y: ny };
          } catch (_) { /* noop */ }
        }
      } catch (err) {
        // 某些边界情况格式化失败, 跳过该小节
      }
      x += STAVE_W;
    }
  }

  // 把羽毛笔笔尖移到最后一个音符的真实绘制位置
  function positionQuillAtLast() {
    if (!quillEl || !lastNotePos || !container || !scrollEl) return;

    // lastNotePos 是相对 #score 内 SVG 的坐标。
    // quill 相对 .score-scroll 定位, 需换算:
    //   score 相对 scroll 的偏移(含 padding) - scroll 已滚动距离 + 音符坐标
    const scoreOffsetLeft = container.offsetLeft; // score 在 scroll 内的左偏移(含 padding)
    const scoreOffsetTop = container.offsetTop;
    // 笔尖在 SVG 左下角(约 x=8,y=58), 让笔尖对准音符
    const TIP_X = 8, TIP_Y = 56;

    const x = scoreOffsetLeft + lastNotePos.x - TIP_X - scrollEl.scrollLeft;
    const y = scoreOffsetTop + lastNotePos.y - TIP_Y;

    quillEl.style.opacity = '1';
    quillEl.style.transform = `translate(${x}px, ${y}px)`;
    // 落笔小动画
    quillEl.classList.remove('quill-dip');
    void quillEl.offsetWidth;
    quillEl.classList.add('quill-dip');
  }

  function autoScroll() {
    if (!scrollEl) return;
    scrollEl.scrollLeft = scrollEl.scrollWidth;
    // 滚动后重新定位羽毛笔(因为 scrollLeft 变了)
    positionQuillAtLast();
  }

  global.KBI_SCORE = { init, addNote, clear };
})(window);
