# 🎹 Keyboard Instrument · 键盘乐器

打字即演奏。你敲下的每一个字母都会变成音符实时发声，并被记录成**五线谱**，
光标是一支**羽毛笔**。当你不看窗口时，乐器会缩到屏幕角落变成一只**桌宠**，
随着你打字蹦出小音符动效。

> Type on your keyboard → hear a digital instrument → watch it written as sheet
> music with a quill-pen cursor → minimize into a desktop pet that reacts as you type.

## ✨ 功能

- **打字发声**：字母/数字键映射到音符，实时用 [Tone.js](https://tonejs.github.io/) 合成发声
- **全局监听**：基于 `uiohook-napi`，在**任何应用**里打字都能触发（需系统授权）
- **五线谱记谱**：用 [VexFlow](https://www.vexflow.com/) 实时绘制标准五线谱
- **羽毛笔光标**：落笔动画跟随最新记下的音符
- **多乐器**：钢琴 / 吉他 / 八音盒 / 长笛 / 合成器，可随时切换
- **桌宠模式**：缩到屏幕右下角悬浮，打字时跳动 + 冒音符，久不打字会「睡着」💤

## 🚀 运行

```bash
npm install
npm start        # 或 npm run dev 打开开发者工具
```

### macOS 全局键盘权限

首次运行会看到 `Accessibility API is disabled!` —— 这是正常的。
要开启「全局」打字发声，请到：

**系统设置 → 隐私与安全性 → 辅助功能** → 允许 `Electron`（或打包后的应用）。

> 未授权时会**自动降级**为「网页内键盘」：只要主窗口是焦点窗口，打字一样能演奏。

## 🎛️ 键位映射

| 区域 | 键 | 音区 |
|------|-----|------|
| 主行 | A S D F G H J K L | 中央 C 大调音阶 (C4–D5) |
| 上排 | Q W E R T Y U I O P | 高音区 (E5–G6) |
| 下排 | Z X C V B N M | 低音区 (C3–B3) |
| 数字 | 1–0 | 半音黑键点缀 |

映射可在 `src/renderer/music.js` 的 `KEY_TO_NOTE` 中自定义。

## 📁 结构

```
src/
├── main/
│   ├── main.js       # 主进程: 窗口管理 + 全局键盘 hook + IPC
│   └── preload.js    # 安全桥接
├── renderer/         # 主窗口
│   ├── index.html
│   ├── renderer.js   # 串联键盘/声音/记谱/UI
│   ├── music.js      # 键位→音符映射 + 乐器定义
│   ├── engine.js     # Tone.js 声音引擎
│   ├── score.js      # VexFlow 五线谱 + 羽毛笔
│   └── style.css
├── pet/              # 桌宠悬浮窗
│   ├── pet.html / pet.js / pet.css
└── vendor/           # Tone.js / vexflow.js (本地打包)
assets/
├── cursor/quill.svg  # 羽毛笔光标 (占位, 可替换)
├── instruments/      # 乐器立绘 (待填充)
└── pet/              # 桌宠形象 (待填充)
```

## 🎨 视觉素材

目前乐器和桌宠用 emoji 占位。要替换成自定义美术素材，见下方「素材清单」，
把文件放进 `assets/` 对应目录并在 `music.js` / `renderer.js` / `pet.js` 中引用即可。

## License

MIT
