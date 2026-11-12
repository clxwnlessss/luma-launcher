const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { findClient, fetchVersion, downloadInstaller } = require('../electron/roblox.cjs');
const { validate } = require('../electron/library.cjs');

test('Detects only an actual Player executable in recognized installation directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-detect-'));
  try {
    const versions = path.join(root, 'Roblox', 'Versions');
    await fs.mkdir(path.join(versions, 'version-aabbcc'), { recursive:true });
    await fs.mkdir(path.join(versions, 'version-ddeeff'), { recursive:true });
    await fs.writeFile(path.join(versions, 'version-ddeeff', 'RobloxStudioBeta.exe'), 'studio');
    assert.equal(await findClient(root, ''), null);
    await fs.writeFile(path.join(versions, 'version-aabbcc', 'RobloxPlayerBeta.exe'), 'player');
    const client = await findClient(root, '');
    assert.equal(client.versionGuid, 'version-aabbcc');
    assert.equal(client.source, 'Roblox');
    assert.equal(path.basename(client.exe), 'RobloxPlayerBeta.exe');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('Version check validates the official response and handles network failures', async () => {
  const version = await fetchVersion(async url => {
    assert.equal(url,'https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer');
    return {ok:true,json:async()=>({version:'0.747.0.1',clientVersionUpload:'version-aabbcc'})};
  });
  assert.equal(version.versionGuid,'version-aabbcc');
  await assert.rejects(()=>fetchVersion(async()=>({ok:true,json:async()=>({version:'1',clientVersionUpload:'../../bad'})})), /networkFailed/);
  await assert.rejects(()=>fetchVersion(async()=>{throw Error('offline');}), /networkFailed/);
});

test('Installer rejects cross-domain redirects and leaves no partial executable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'luma-download-'));
  try {
    await assert.rejects(()=>downloadInstaller(async()=>({ok:true,body:{},url:'https://evil.test/installer.exe'}),root,()=>{}),/networkFailed/);
    assert.deepEqual(await fs.readdir(root),[]);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('Legacy settings migrate with RU default; new language and behavior options persist', () => {
  const old=validate({games:[],history:[],settings:{motion:false,accent:'violet'}});
  assert.equal(old.settings.language,'ru');
  assert.equal(old.settings.motion,false);
  assert.equal(old.settings.closeToTray,false);
  const next=validate({...old,settings:{...old.settings,language:'en',closeToTray:true,minimizeAfterLaunch:true,accent:'blue'}});
  assert.equal(next.settings.language,'en');
  assert.equal(next.settings.closeToTray,true);
  assert.equal(next.settings.minimizeAfterLaunch,true);
  assert.equal(next.settings.accent,'blue');
});

test('Every localization key has both Russian and English strings', async () => {
  const context={window:{}};
  vm.runInNewContext(await fs.readFile(path.join(__dirname,'../src/i18n.js'),'utf8'),context);
  const strings=context.window.LumaStrings;
  for(const [key,values] of Object.entries(strings)){
    assert.equal(values.length,2,key);
    assert.ok(values.every(value=>typeof value==='string'&&value.length),key);
    assert.equal(/[іїєґ]/iu.test(values.join('')),false,key);
  }
});
