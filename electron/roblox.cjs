const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
function powershellEnv(extra) {
  const env = { ...process.env, ...extra };
  // A launcher started from PowerShell 7 may inherit an incompatible module path.
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'psmodulepath') delete env[key];
  return env;
}

async function findClient(localAppData = process.env.LOCALAPPDATA || '', programFiles = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles || '') {
  const candidates = [];
  const roots = [path.join(localAppData, 'Roblox', 'Versions'), ...(programFiles ? [path.join(programFiles, 'Roblox', 'Versions')] : [])];
  for (const root of roots) {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink() && /^version-[a-f0-9]+$/i.test(entry.name)) candidates.push({ exe: path.join(root, entry.name, 'RobloxPlayerBeta.exe'), versionGuid: entry.name, source: 'Roblox' });
    }
  }
  for (const launcher of ['Bloxstrap', 'Fishstrap']) {
    candidates.push({ exe: path.join(localAppData, launcher, 'Roblox', 'Player', 'RobloxPlayerBeta.exe'), versionGuid: null, source: launcher });
  }
  const found = [];
  for (const candidate of candidates) {
    const info = await fs.stat(candidate.exe).catch(() => null);
    if (info?.isFile()) found.push({ ...candidate, modified: info.mtimeMs });
  }
  return found.sort((a, b) => b.modified - a.modified)[0] || null;
}

async function inspectClient(client) {
  if (!client) return { installed: false, version: null, versionGuid: null, source: null, folder: null };
  let version = null;
  if (process.platform === 'win32') {
    try {
      const result = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '(Get-Item -LiteralPath $env:LUMA_INSPECT_EXE).VersionInfo.FileVersion'], { windowsHide: true, timeout: 10000, env: powershellEnv({ LUMA_INSPECT_EXE: client.exe }) });
      version = result.stdout.trim().replace(/,\s*/g, '.').slice(0, 80) || null;
    } catch {}
  }
  return { installed: true, version, versionGuid: client.versionGuid, source: client.source, folder: path.dirname(client.exe) };
}

async function verifyPublisher(file) {
  if (process.platform !== 'win32') throw new Error('windowsOnly');
  const result = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath $env:LUMA_SIGNED_EXE; if ($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match '(^|,\\s*)CN=Roblox Corporation(,|$)') { 'VALID' } else { 'INVALID' }"], { windowsHide: true, timeout: 30000, env: powershellEnv({ LUMA_SIGNED_EXE: file }) });
  if (result.stdout.trim() !== 'VALID') throw new Error('signatureFailed');
}

function startExecutable(executable, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, { cwd: path.dirname(executable), detached: true, stdio: 'ignore', windowsHide: false });
    process.once('error', () => reject(new Error('launchFailed')));
    process.once('spawn', () => { process.unref(); resolve(); });
  });
}

async function fetchVersion(fetcher) {
  try {
    const response = await fetcher('https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!/^version-[a-f0-9]+$/i.test(data.clientVersionUpload) || typeof data.version !== 'string' || data.version.length > 80) throw new Error();
    return { version: data.version, versionGuid: data.clientVersionUpload, checkedAt: new Date().toISOString() };
  } catch { throw new Error('networkFailed'); }
}

async function downloadInstaller(fetcher, folder, progress) {
  await fs.mkdir(folder, { recursive: true });
  const temporary = path.join(folder, 'RobloxPlayerInstaller.download.exe');
  const destination = path.join(folder, 'RobloxPlayerInstaller.exe');
  const maxBytes = 100 * 1024 * 1024;
  let file;
  try {
    const installerURL = 'https://setup.rbxcdn.com/RobloxPlayerInstaller.exe';
    // Electron's net.fetch may leave Response.url empty. Refuse redirects at the
    // request layer so that the fixed source remains authoritative in that case.
    const response = await fetcher(installerURL, { signal: AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error('networkFailed');
    const finalURL = new URL(response.url || installerURL);
    if (finalURL.protocol !== 'https:' || !(finalURL.hostname === 'rbxcdn.com' || finalURL.hostname.endsWith('.rbxcdn.com'))) throw new Error('networkFailed');
    // net.fetch transparently decompresses gzip; Content-Length then describes
    // compressed transport bytes, not the executable bytes we receive.
    const encoding = response.headers.get('content-encoding');
    const total = encoding && encoding !== 'identity' ? 0 : Number(response.headers.get('content-length')) || 0;
    if (total > maxBytes) throw new Error('downloadFailed');
    file = await fs.open(temporary, 'w');
    let received = 0;
    let last = 0;
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > maxBytes) throw new Error('downloadFailed');
      await file.writeFile(chunk);
      if (Date.now() - last > 150) { progress({ stage: 'downloading', received, total }); last = Date.now(); }
    }
    if (received < 1024 || (total && received !== total)) throw new Error('downloadFailed', { cause: { received, expected: total, encoding: response.headers.get('content-encoding') } });
    await file.close(); file = null;
    progress({ stage: 'verifying', received, total });
    await verifyPublisher(temporary);
    await fs.rename(temporary, destination);
    return destination;
  } catch (error) {
    if (['signatureFailed', 'downloadFailed', 'networkFailed'].includes(error.message)) throw error;
    throw new Error('downloadFailed', { cause: error });
  } finally {
    if (file) await file.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
module.exports = { findClient, inspectClient, verifyPublisher, startExecutable, fetchVersion, downloadInstaller };
