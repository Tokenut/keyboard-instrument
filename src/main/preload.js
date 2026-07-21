// ==========================================================================
// preload.js — 安全桥接层 (contextIsolation 下暴露有限 API 给渲染进程)
// ==========================================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kbi', {
  // 监听全局按键(来自主进程的 uiohook)
  onGlobalKeydown: (cb) => {
    ipcRenderer.on('global-keydown', (_e, payload) => cb(payload));
  },
  onGlobalKeyup: (cb) => {
    ipcRenderer.on('global-keyup', (_e, payload) => cb(payload));
  },

  // 切换桌宠模式
  togglePetMode: (enable) => ipcRenderer.invoke('toggle-pet-mode', enable),

  // 广播乐器变更(主窗口 -> 桌宠)
  notifyInstrumentChanged: (id) => ipcRenderer.send('instrument-changed', id),
  onInstrumentChanged: (cb) => {
    ipcRenderer.on('instrument-changed', (_e, id) => cb(id));
  },

  // 桌宠被点击 -> 回主窗口
  petClicked: () => ipcRenderer.send('pet-clicked'),

  // 查询全局 hook 是否可用
  getHookStatus: () => ipcRenderer.invoke('hook-status'),
});
