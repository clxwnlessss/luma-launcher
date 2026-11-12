const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, value) => ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld('luma', {
  getLibrary: () => invoke('library:get'),
  addGame: input => invoke('library:add', input),
  removeGame: id => invoke('library:remove', id),
  favoriteGame: id => invoke('library:favorite', id),
  launchGame: id => invoke('game:launch', id),
  saveSettings: settings => invoke('settings:save', settings),
  clearHistory: () => invoke('history:clear'),
  downloadRoblox: () => invoke('system:download'),
  openDataFolder: () => invoke('system:data'),
  getClientStatus: () => invoke('client:status'),
  checkClientVersion: () => invoke('client:check'),
  launchClient: () => invoke('client:launch'),
  installClient: () => invoke('client:install'),
  openClientFolder: type => invoke('client:folder', type),
  exportDiagnostics: () => invoke('diagnostics:export'),
  onClientProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('client:progress', listener);
    return () => ipcRenderer.removeListener('client:progress', listener);
  },
  windowAction: action => invoke('window:action', action)
});
