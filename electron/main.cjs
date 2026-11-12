const { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu, Tray, net, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { Library, placeId } = require('./library.cjs');
const { findClient, inspectClient, verifyPublisher, startExecutable, fetchVersion, downloadInstaller } = require('./roblox.cjs');

const testMode = !app.isPackaged && process.env.LUMA_TEST_MODE === '1';
if (testMode && process.env.LUMA_TEST_DATA) app.setPath('userData', process.env.LUMA_TEST_DATA);
let window;
let library;
let tray;
let quitting = false;
let installing = false;
let latest = null;
let client = null;
let progressState = { stage: 'idle' };
const testClient = { installed: true, version: '0.747.0.7471481', versionGuid: 'version-aabbccdd', source: 'Roblox', folder: 'C:\\Roblox\\Player' };
const page = path.join(__dirname, '../src/index.html');
const pageURL = pathToFileURL(page).href;
let queue = Promise.resolve();

function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== pageURL) return { ok: false, error: 'forbidden' };
    const result = queue.then(async () => {
      try { return { ok: true, data: await callback(...args) }; }
      catch (error) { return { ok: false, error: error.message || 'operationFailed' }; }
    });
    queue = result.catch(() => {});
    return result;
  });
}

async function clientStatus() {
  client = testMode ? null : await findClient();
  return { ...(testMode ? testClient : await inspectClient(client)), latest, progress: progressState };
}
function progress(value) {
  progressState = value;
  if (window && !window.isDestroyed()) window.webContents.send('client:progress', value);
}
function configureTray() {
  if (!library.data.settings.closeToTray) { tray?.destroy(); tray = null; return; }
  if (!tray) {
    tray = new Tray(path.join(__dirname, '../assets/icon.png'));
    tray.on('double-click', () => { window.show(); window.focus(); });
  }
  const ru = library.data.settings.language === 'ru';
  tray.setToolTip('Luma Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: ru ? 'Открыть Luma' : 'Open Luma', click: () => { window.show(); window.focus(); } },
    { type: 'separator' },
    { label: ru ? 'Выйти' : 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
}
function afterLaunch() {
  if (library.data.settings.minimizeAfterLaunch && !testMode) window.minimize();
}

async function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 840, minWidth: 940, minHeight: 680,
    title: 'Luma Launcher', backgroundColor: '#0d1015', frame: false, show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once('ready-to-show', () => window.show());
  window.on('close', event => {
    if (!quitting && library.data.settings.closeToTray) { event.preventDefault(); window.hide(); }
  });
  await window.loadFile(page);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on('second-instance', () => {
  if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
});
if (hasLock) app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);
  library = new Library(path.join(app.getPath('userData'), 'library.json'));
  await library.load(testMode ? null : path.join(process.env.LOCALAPPDATA || app.getPath('home'), 'LumaLauncher', 'library.json'));
  handle('library:get', () => library.snapshot());
  handle('library:add', input => library.add(input));
  handle('library:remove', id => library.remove(id));
  handle('library:favorite', id => library.favorite(id));
  handle('settings:save', async value => { const result = await library.settings(value); configureTray(); return result; });
  handle('history:clear', () => library.save({ ...library.data, history: [] }));
  handle('game:launch', async input => {
    const id = placeId(input);
    if (!library.data.games.some(g => g.id === id)) throw new Error('gameMissing');
    if (!testMode) {
      if (process.platform === 'win32') {
        const registered = await app.getApplicationNameForProtocol(`roblox://placeId=${id}`);
        if (!registered) throw new Error('clientMissing');
      }
      await shell.openExternal(`roblox://placeId=${id}`);
    }
    afterLaunch();
    try { return { library: await library.record(id), recorded: true }; }
    catch { return { library: library.snapshot(), recorded: false }; }
  });
  handle('client:status', clientStatus);
  handle('client:check', async () => {
    latest = testMode ? { version: '0.747.0.7471481', versionGuid: 'version-aabbccdd', checkedAt: new Date().toISOString() } : await fetchVersion((...args) => net.fetch(...args));
    return clientStatus();
  });
  handle('client:launch', async () => {
    if (installing) throw new Error('installerBusy');
    if (!testMode) {
      client = await findClient();
      if (!client) throw new Error('clientMissing');
      await verifyPublisher(client.exe);
      await startExecutable(client.exe);
    }
    afterLaunch();
    return clientStatus();
  });
  handle('client:install', async () => {
    if (installing) throw new Error('installerBusy');
    if (process.platform !== 'win32') throw new Error('windowsOnly');
    installing = true;
    progress({ stage: 'downloading', received: 0, total: 0 });
    // Download happens outside the serialized IPC queue, allowing progress and window controls.
    (async () => {
      try {
        if (!testMode) {
          const file = await downloadInstaller((...args) => net.fetch(...args), path.join(app.getPath('userData'), 'downloads'), progress);
          await startExecutable(file);
        }
        progress({ stage: 'installerStarted' });
      } catch (error) { progress({ stage: 'failed', error: error.message }); }
      finally { installing = false; }
    })();
    return { started: true };
  });
  handle('client:folder', async type => {
    const root = path.join(process.env.LOCALAPPDATA || app.getPath('home'), 'Roblox');
    let folder;
    if (type === 'logs') folder = path.join(root, 'logs');
    else if (type === 'client') { client = testMode ? null : await findClient(); folder = client && path.dirname(client.exe); }
    else throw new Error('invalidAction');
    if (!folder && !testMode) throw new Error('clientMissing');
    if (!testMode) {
      const error = await shell.openPath(folder);
      if (error) throw new Error('folderMissing');
    }
  });
  handle('diagnostics:export', async () => {
    const status = await clientStatus();
    const report = { application: 'Luma Launcher', version: app.getVersion(), platform: process.platform, arch: process.arch, electron: process.versions.electron, client: status, generatedAt: new Date().toISOString() };
    if (testMode) return { saved: true };
    const ru = library.data.settings.language === 'ru';
    const result = await dialog.showSaveDialog(window, { title: ru ? 'Сохранить диагностику' : 'Save diagnostics', defaultPath: 'Luma-diagnostics.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), 'utf8');
    return { saved: true };
  });
  handle('system:download', async () => { if (!testMode) await shell.openExternal('https://www.roblox.com/download'); });
  handle('system:data', async () => {
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    if (!testMode) {
      const error = await shell.openPath(app.getPath('userData'));
      if (error) throw new Error(error);
    }
  });
  handle('window:action', action => {
    if (action === 'minimize') window.minimize();
    else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === 'close') window.close();
    else throw new Error('invalidAction');
  });
  await createWindow();
  configureTray();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
app.on('web-contents-created', (_event, contents) => contents.on('will-attach-webview', event => event.preventDefault()));
