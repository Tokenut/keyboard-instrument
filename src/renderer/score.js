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
    positionQuillAtLast();
    autoScroll();
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

    let x = LEFT_PAD;
    for (let mi = 0; mi < measures; mi++) {
      const stave = new VF.Stave(x, 12, STAVE_W);
      if (mi === 0) {
        stave.addClef('treble').addTimeSignature('4/4');
      }
      stave.setContext(context).draw();

      // 该小节的音符
      const slice = noteQueue.slice(mi * NOTES_PER_MEASURE, mi * NOTES_PER_MEASURE + NOTES_PER_MEASURE);
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

      // 用休止符补齐本小节, 保证节拍完整
      while (vexNotes.length < NOTES_PER_MEASURE) {
        vexNotes.push(new VF.StaveNote({ keys: ['b/4'], duration: 'qr' }));
      }

      try {
        VF.Formatter.FormatAndDraw(context, stave, vexNotes, { auto_beam: false });
      } catch (err) {
        // 某些边界情况格式化失败, 跳过该小节
      }
      x += STAVE_W;
    }
  }

  // 把羽毛笔移到最后一个音符位置
  function positionQuillAtLast() {
    if (!quillEl || noteQueue.length === 0) return;
    const total = noteQueue.length;
    const mi = Math.floor((total - 1) / NOTES_PER_MEASURE);
    const idxInMeasure = (total - 1) % NOTES_PER_MEASURE;
    // 估算 x: 小节起点 + 谱号偏移 + 音符间距
    const clefOffset = mi === 0 ? 60 : 12;
    const noteSpacing = (STAVE_W - clefOffset - 20) / NOTES_PER_MEASURE;
    const x = LEFT_PAD + mi * STAVE_W + clefOffset + idxInMeasure * noteSpacing;
    const y = 34;
    quillEl.style.opacity = '1';
    quillEl.style.transform = `translate(${x}px, ${y}px)`;
    // 落笔小动画
    quillEl.classList.remove('quill-dip');
    void quillEl.offsetWidth; // 触发 reflow 重启动画
    quillEl.classList.add('quill-dip');
  }

  function autoScroll() {
    if (!scrollEl) return;
    scrollEl.scrollLeft = scrollEl.scrollWidth;
  }

  global.KBI_SCORE = { init, addNote, clear };
})(window);
