const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function placeId(input) {
  if (typeof input !== 'string') throw new Error('invalidPlace');
  const value = input.trim();
  if (/^[1-9]\d{0,19}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/games\/([1-9]\d{0,19})(?:\/|$)/);
    if (url.protocol === 'https:' && ['roblox.com', 'www.roblox.com'].includes(url.hostname) && !url.username && !url.password && !url.port && match) return match[1];
  } catch {}
  throw new Error('invalidPlace');
}

function validate(data) {
  if (!data || !Array.isArray(data.games) || !Array.isArray(data.history)) throw new Error('libraryCorrupt');
  if (data.games.length > 5000 || data.history.length > 10000) throw new Error('libraryCorrupt');
  const ids = new Set();
  const games = data.games.map(game => {
    if (!game || typeof game.name !== 'string' || !game.name.trim() || game.name.length > 80) throw new Error('invalidName');
    const id = placeId(game.id);
    if (ids.has(id)) throw new Error('duplicateGame');
    ids.add(id);
    return { id, name: game.name.trim(), favorite: game.favorite === true, art: Number.isInteger(game.art) ? Math.abs(game.art) % 4 : Number(BigInt(id) % 4n), addedAt: typeof game.addedAt === 'string' ? game.addedAt : null };
  });
  const history = data.history.slice(-200).map(item => {
    if (!item || typeof item.name !== 'string' || item.name.length > 80) throw new Error('libraryCorrupt');
    const legacyTime = typeof item.legacyTime === 'string' ? item.legacyTime : item.time;
    return { id: placeId(item.id), name: item.name, at: typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) ? item.at : null, legacyTime: typeof legacyTime === 'string' ? legacyTime.slice(0, 80) : null };
  });
  return { games, history, settings: {
    motion: data.settings?.motion !== false,
    accent: ['violet', 'blue'].includes(data.settings?.accent) ? data.settings.accent : 'mint',
    language: data.settings?.language === 'en' ? 'en' : 'ru',
    minimizeAfterLaunch: data.settings?.minimizeAfterLaunch === true,
    closeToTray: data.settings?.closeToTray === true
  } };
}

const empty = () => validate({ games: [], history: [] });

class Library {
  constructor(file) { this.file = file; this.data = empty(); this.blocked = false; this.warning = null; }
  async load(legacyFile) {
    try {
      this.data = validate(JSON.parse(await fs.readFile(this.file, 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (legacyFile) {
          try {
            const old = validate(JSON.parse(await fs.readFile(legacyFile, 'utf8')));
            await this.save(old);
          } catch (legacyError) {
            if (legacyError.code !== 'ENOENT') this.warning = 'migrationFailed';
          }
        }
      } else {
        this.blocked = true;
        this.warning = 'libraryCorrupt';
      }
    }
    return this.snapshot();
  }
  snapshot() { return structuredClone({ ...this.data, warning: this.warning, readOnly: this.blocked }); }
  async save(next) {
    if (this.blocked) throw new Error('readOnly');
    const clean = validate(next);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(clean, null, 2), 'utf8');
      await fs.rename(temporary, this.file);
      this.data = clean;
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    return this.snapshot();
  }
  async add(input) {
    const id = placeId(input?.link);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 80) throw new Error('invalidName');
    if (this.data.games.some(g => g.id === id)) throw new Error('duplicateGame');
    return this.save({ ...this.data, games: [...this.data.games, { id, name, addedAt: new Date().toISOString(), favorite: false, art: Number.isInteger(input.art) ? Math.abs(input.art) % 4 : 0 }] });
  }
  async remove(id) {
    return this.save({ ...this.data, games: this.data.games.filter(g => g.id !== placeId(id)) });
  }
  async favorite(id) {
    return this.save({ ...this.data, games: this.data.games.map(g => g.id === placeId(id) ? { ...g, favorite: !g.favorite } : g) });
  }
  async settings(value) {
    if (!value || typeof value.motion !== 'boolean' || !['mint', 'violet', 'blue'].includes(value.accent) || (value.language !== undefined && !['ru', 'en'].includes(value.language)) || ['minimizeAfterLaunch', 'closeToTray'].some(key => value[key] !== undefined && typeof value[key] !== 'boolean')) throw new Error('invalidSettings');
    return this.save({ ...this.data, settings: { ...this.data.settings, ...value } });
  }
  async record(id) {
    const game = this.data.games.find(g => g.id === placeId(id));
    if (!game) throw new Error('gameMissing');
    return this.save({ ...this.data, history: [...this.data.history, { id: game.id, name: game.name, at: new Date().toISOString() }].slice(-200) });
  }
}
module.exports = { placeId, validate, Library, empty };
