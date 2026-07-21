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
  （点窗口的**黄色最小化按钮**会自动进入桌宠模式，此时打字仍持续发声）
- **录制成曲**：点「录制」记录一段演奏，停止后自动把杂乱敲击整理成一首曲子
- **作曲家匹配**：分析你的曲风特征，匹配最接近的音乐大师（巴赫/莫扎特/肖邦/久石让…）
- **分享海报**：一键生成含作曲家、契合度、特征雷达图、迷你旋律的海报，可下载 PNG

## 🎼 打字如何变成"一首曲子"?

你敲键盘是无固定节奏的，停止录制后经过三步后处理变成能听的曲子：

1. **节奏量化** — 把杂乱的时间戳吸附到节拍网格（16 分音符），并估算 BPM
2. **音阶吸附** — 把每个音吸到选定调式（默认 C 大调五声音阶），消除不和谐音
3. **结构化** — 补齐时值，生成可回放的旋律

然后从曲子提取 6 维特征（音区 / 速度 / 明暗 / 繁复 / 密度 / 音域），
与本地作曲家画像库做加权距离匹配，得出最接近的大师 + 契合度 + 匹配理由。

> 作曲家匹配是**基于特征的启发式**，图个有趣，非学术级曲风识别。
> 画像库在 `src/renderer/composers.js`，可自由增删调整。

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
│   ├── renderer.js   # 串联键盘/声音/记谱/录制/匹配/海报
│   ├── music.js      # 键位→音符映射 + 乐器定义
│   ├── engine.js     # Tone.js 声音引擎 + 曲子回放
│   ├── score.js      # VexFlow 五线谱 + 羽毛笔
│   ├── recorder.js   # 演奏录制(带时间戳)
│   ├── composer.js   # 节奏量化 + 音阶吸附 → 生成曲子
│   ├── composers.js  # 作曲家画像知识库
│   ├── matcher.js    # 特征提取 + 作曲家匹配
│   ├── poster.js     # Canvas 海报生成
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
