const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Library, placeId } = require('../electron/library.cjs');

test('Only Roblox place IDs and exact official game URLs are accepted', () => {
  assert.equal(placeId(' 123 '), '123');
  assert.equal(placeId('https://www.roblox.com/games/123/Hello?x=1'), '123');
  for (const input of ['0', '-1', '12&launch=x', 'https://roblox.com.evil.test/games/123', 'https://evil.test/games/123', 'javascript:alert(1)', 'https://user@roblox.com/games/123', 'https://roblox.com:8443/games/123', null]) assert.throws(() => placeId(input));
});

test('Library persists games, favorites, settings and history; rejects duplicates', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-test-'));
  try {
    const file = path.join(directory, 'library.json');
    const library = new Library(file);
    await library.load();
    await library.add({ link: '123', name: 'Мій світ', art: 2 });
    await assert.rejects(() => library.add({ link: '123', name: 'Дублікат' }));
    await library.favorite('123');
    await library.settings({ motion: false, accent: 'violet' });
    await library.settings({ motion: false, accent: 'blue', language: 'en', minimizeAfterLaunch: true, closeToTray: false });
    await library.record('123');
    const reloaded = new Library(file);
    await reloaded.load();
    assert.equal(reloaded.data.games[0].favorite, true);
    assert.equal(reloaded.data.games[0].art, 2);
    assert.equal(reloaded.data.settings.motion, false);
    assert.equal(reloaded.data.settings.language, 'en');
    assert.equal(reloaded.data.settings.minimizeAfterLaunch, true);
    assert.equal(reloaded.data.history.length, 1);
    await reloaded.remove('123');
    assert.equal(reloaded.data.games.length, 0);
    assert.equal(reloaded.data.history.length, 1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('Migrates Python library without changing the original; corrupt files are protected', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-test-'));
  try {
    const legacy = path.join(directory, 'old.json');
    const file = path.join(directory, 'new.json');
    const original = JSON.stringify({ games: [{ id: '123', name: 'Старий світ' }], history: [{ id: '123', name: 'Старий світ', time: '12.11.2026 · 12:00' }] });
    await fs.writeFile(legacy, original);
    const library = new Library(file);
    await library.load(legacy);
    assert.equal(library.data.games[0].name, 'Старий світ');
    assert.equal(library.data.history[0].legacyTime, '12.11.2026 · 12:00');
    assert.equal(await fs.readFile(legacy, 'utf8'), original);
    await fs.writeFile(file, 'broken');
    const corrupted = new Library(file);
    const snapshot = await corrupted.load();
    assert.equal(snapshot.readOnly, true);
    await assert.rejects(() => corrupted.add({ name: 'New', link: '456' }));
    assert.equal(await fs.readFile(file, 'utf8'), 'broken');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
