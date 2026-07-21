// ==========================================================================
// main.js — Electron 主进程
// 职责:
//   1. 创建主窗口(乐器展示 + 五线谱记谱页)
//   2. 创建桌宠悬浮窗(始终置顶、透明、无边框、可穿透)
//   3. 用 uiohook-napi 做「全局」键盘监听 —— 用户在任何 app 打字都能触发
//   4. 把按键事件通过 IPC 广播给两个渲染进程
// ==========================================================================

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// 彻底禁用后台节流(定时器/音频), 保证主窗口失焦时打字仍能发声
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let uIOhook = null;
let hookLoaded = false;
try {
  // uiohook-napi 是原生模块, 若加载失败(权限/平台)也不应让 app 崩溃
  ({ uIOhook } = require('uiohook-napi'));
  hookLoaded = true;
} catch (err) {
  console.error('[main] 无法加载 uiohook-napi, 全局键盘监听将不可用:', err.message);
}

let mainWindow = null;
let petWindow = null;

// 当前是否处于「桌宠模式」(主窗口隐藏, 只留桌宠)
let petMode = false;

// --------------------------------------------------------------------------
// 创建主窗口
// --------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'Keyboard Instrument',
    backgroundColor: '#1a1526',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 关键: 关闭后台节流, 否则主窗口失焦时音频会被 Chromium 挂起/限流
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --------------------------------------------------------------------------
// 创建桌宠悬浮窗(屏幕右下角)
// --------------------------------------------------------------------------
function createPetWindow() {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  const petW = 220;
  const petH = 260;

  petWindow = new BrowserWindow({
    width: petW,
    height: petH,
    x: sw - petW - 24,
    y: sh - petH - 24,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false, // 不抢焦点, 用户可继续在别处打字
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // 让桌宠窗口永远浮在最上层(包括全屏应用之上)
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  petWindow.loadFile(path.join(__dirname, '../pet/pet.html'));
  petWindow.hide(); // 默认隐藏, 进入桌宠模式才显示

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

// --------------------------------------------------------------------------
// 全局键盘监听 -> 广播给渲染进程
// --------------------------------------------------------------------------
function startGlobalKeyboardHook() {
  if (!hookLoaded) return;

  uIOhook.on('keydown', (e) => {
    // e.keycode 是 uiohook 的统一键码(跨平台)
    const payload = { keycode: e.keycode, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('global-keydown', payload);
    }
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('global-keydown', payload);
    }
  });

  // 转发 keyup, 用于计算每个音的按键时长(时值/节奏)
  uIOhook.on('keyup', (e) => {
    const payload = { keycode: e.keycode };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('global-keyup', payload);
    }
  });

  try {
    uIOhook.start();
    console.log('[main] 全局键盘监听已启动');
  } catch (err) {
    console.error('[main] 启动键盘监听失败:', err.message);
  }
}

// --------------------------------------------------------------------------
// IPC: 渲染进程 <-> 主进程
// --------------------------------------------------------------------------
function registerIpc() {
  // 切换桌宠模式(隐藏/显示主窗口)
  ipcMain.handle('toggle-pet-mode', (_evt, enable) => {
    petMode = enable;
    if (enable) {
      if (petWindow) petWindow.show();
      if (mainWindow) mainWindow.hide();
    } else {
      if (petWindow) petWindow.hide();
      if (mainWindow) mainWindow.show();
    }
    return petMode;
  });

  // 主窗口通知桌宠: 当前选中的乐器变了
  ipcMain.on('instrument-changed', (_evt, instrumentId) => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('instrument-changed', instrumentId);
    }
  });

  // 桌宠被点击 -> 请求返回主窗口
  ipcMain.on('pet-clicked', () => {
    petMode = false;
    if (petWindow) petWindow.hide();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 查询全局 hook 是否可用(用于前端提示用户授权)
  ipcMain.handle('hook-status', () => hookLoaded);
}

// --------------------------------------------------------------------------
// App 生命周期
// --------------------------------------------------------------------------
app.whenReady().then(() => {
  createMainWindow();
  createPetWindow();
  registerIpc();
  startGlobalKeyboardHook();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createPetWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (hookLoaded) {
    try { uIOhook.stop(); } catch (_) { /* noop */ }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (hookLoaded) {
    try { uIOhook.stop(); } catch (_) { /* noop */ }
  }
});
