// Optional online integration check. Downloads and verifies; never starts an installer or Roblox.
const { app, net } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { fetchVersion, downloadInstaller, findClient, inspectClient, verifyPublisher } = require('../electron/roblox.cjs');
app.whenReady().then(async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-live-check-'));
  try {
    const fetcher = (...args) => net.fetch(...args);
    const latest = await fetchVersion(fetcher);
    console.log('Official version endpoint:', latest.version, latest.versionGuid);
    const client = await findClient();
    if (client) {
      const status = await inspectClient(client);
      await verifyPublisher(client.exe);
      console.log('Installed client detected and publisher verified:', status.version);
    }
    const installer = await downloadInstaller(fetcher, folder, p => {
      if (p.stage === 'verifying') console.log('Official installer downloaded; verifying publisher.');
    });
    console.log('Installer signature verified. Size:', (await fs.stat(installer)).size);
    console.log('No executable was launched.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('luma-live-check-')) await fs.rm(resolved, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  }
});
