# ✦ Luma Launcher 0.3

An independent **Windows desktop launcher for Roblox**, built with Electron + JavaScript.
Full **Russian / English** interface, animated styling, and a regular Windows installer.

## Download / Скачать

**[Download the Windows installer / Скачать установщик](https://github.com/clxwnlessss/luma-launcher/releases/download/v0.3.0/LumaLauncher-Setup-0.3.0.exe)**

[Portable application](https://github.com/clxwnlessss/luma-launcher/releases/download/v0.3.0/LumaLauncher-0.3.0-Portable.exe) · [Release notes and SHA-256 checksums](https://github.com/clxwnlessss/luma-launcher/releases/tag/v0.3.0)

- `LumaLauncher-Setup-0.3.0.exe` — normal installer with desktop and Start menu shortcuts, RU / EN installer languages.
- `LumaLauncher-0.3.0-Portable.exe` — portable application.

Node.js and Python are not required for built applications. Luma itself is not code-signed. The official Roblox installer is verified separately before launch.

## Features

- Detect the installed Roblox Player and read its version/build.
- Launch the client after verifying its Roblox Corporation digital signature.
- Check the public Roblox WindowsPlayer version.
- Download the official installer from setup.rbxcdn.com, verify its Authenticode signature, and open it when the user chooses Install / update.
- Open client and log folders; export a local diagnostics report.
- Game library, search, sorting, favorites, and the last 200 game launch requests.
- Persistent Russian / English language, three accent colors, optional animations, minimize after launch, and close to system tray.
- Import the original Python launcher library without changing its original file.

Luma is inspired by the convenience of launchers such as Bloxstrap. **It is not a full Bloxstrap clone.** It does not replace Roblox protocol handlers, inject into the client, modify FastFlags, or promise higher FPS. Roblox handles sign-in, game connections, and client-file updates through its official installer.

## Development

Windows 10/11 x64, Node.js **22.12+**, npm:

```powershell
npm ci
npm start
npm test
npm run test:ui
npm run build
```

Both builds are created in `release/`. `npm run pack` produces an unpacked application; copy the entire `release/win-unpacked` folder when using that form. C++ is not required for this version.

Optional online check:

```powershell
npm run test:live
```

This reads the real Roblox version endpoint, checks the installed client signature, and downloads/verifies the official installer in a temporary folder. **It never starts Roblox or the installer.**

## Verification

Unit tests cover exact URL validation, atomic persistence, migration, corrupted-file protection, client detection, version response validation, download-source restrictions, and both localization dictionaries.

The Electron UI check uses isolated data and mocked external actions. It exercises RU/EN pages and errors, language persistence, client actions, settings, tray configuration, library, favorites, history, input escaping, and narrow-window layout. The real version endpoint and actual client/installer signatures were verified separately on Windows. A launch-history entry records a request handed to Windows, not a confirmed connection to a game server.

## Data and security

Data stays in Electron's userData folder, normally `%APPDATA%/luma-launcher`. Open its actual location from **Diagnostics → Luma data**. On first use, Luma attempts to import `%LOCALAPPDATA%/LumaLauncher/library.json` from version 0.1. Corrupted files are kept unchanged and editing is disabled until the file is fixed or renamed.

The renderer is sandboxed with context isolation, Node integration disabled, local-only assets, and a narrow preload API. Main-process inputs are validated. Installer downloads use a fixed HTTPS address, refuse redirects, cap the file size, and require a valid Roblox Corporation signature before opening.

No passwords or authentication cookies are requested. Diagnostics contain versions and the client folder path, which can include the Windows username. Reports are saved only to a user-chosen destination and never uploaded automatically.

## Project structure

- `electron/` — main process, preload, storage, Windows client operations.
- `src/` — HTML, CSS, JavaScript, RU/EN dictionary.
- `assets/` — original SVG artwork and application icon.
- `scripts/` — UI checks, optional online check, artwork generator.
- `tests/` — unit tests.
- `launcher.py` — retained original version 0.1.

Artwork is committed. Regenerating it optionally requires Python and Pillow: `python scripts/generate-assets.py`. Normal development and packaging do not require Python.

GitHub Actions runs checks and builds Windows installers as workflow artifacts. It does not automatically publish a release.

## Русский

**Luma — отдельное приложение для Windows, не сайт.** Полный русский и английский интерфейс, выбор языка сохраняется после перезапуска.

Приложение находит и запускает Roblox, проверяет публичную версию, загружает и проверяет официальный установщик. Есть библиотека игр, избранное, история, открытие журналов, локальная диагностика, цвета, анимации и сворачивание в трей.

Для обычного использования скачай `LumaLauncher-Setup-0.3.0.exe` из Releases. Для запуска исходного кода нужны Node.js 22.12+, затем `npm ci` и `npm start`. Для сборки: `npm run build`.

Это самостоятельный проект, не полная копия Bloxstrap. Авторизацией, подключением к играм и обновлением файлов клиента занимается Roblox. Luma не запрашивает пароль или cookies и не изменяет FastFlags.

## References

- [Roblox deep links](https://create.roblox.com/docs/production/promotion/deeplinks)
- [Roblox installation support](https://en.help.roblox.com/hc/en-us/articles/204473560-How-to-Install-and-Play-Roblox)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)

MIT. Not affiliated with Roblox Corporation or Bloxstrap. Luma is a working project name; trademark availability has not been checked.
