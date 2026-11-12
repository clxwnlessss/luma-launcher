const icons = {
  roblox:'<path d="m6 1 13 5-5 13-13-5Z"/><path d="m8 7 5 2-2 5-5-2Z"/>',
  grid:'<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
  heart:'<path d="M17.3 4.8a4.3 4.3 0 0 0-6.1 0L10 6 8.8 4.8a4.3 4.3 0 0 0-6.1 6.1L10 18l7.3-7.1a4.3 4.3 0 0 0 0-6.1Z"/>',
  clock:'<circle cx="10" cy="10" r="7.5"/><path d="M10 5v5l3 2"/>',
  settings:'<path d="m8 2-1 3-3 1 .5 3-2 2 2 2 .5 3 3 1 2-2 3 .5 1-3 3-1-1-3 1-3-3-1-1-3-3 1Z"/><circle cx="10" cy="10" r="2.5"/>',
  palette:'<path d="M10 2a8 8 0 1 0 0 16h1a2 2 0 0 0 0-4c-2 0-1-2 1-2h2a4 4 0 0 0 4-4c0-3-4-6-8-6Z"/><path d="M6 6h.1M10 5h.1M14 7h.1M5 10h.1"/>',
  pulse:'<path d="M1 10h4l3-7 4 14 3-7h4"/>',
  search:'<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/>',
  plus:'<path d="M10 4v12M4 10h12"/>', arrow:'<path d="M3 10h13m-5-5 5 5-5 5"/>',
  play:'<path d="m7 4 9 6-9 6Z" fill="currentColor" stroke-width="1"/>',
  x:'<path d="m5 5 10 10M5 15 15 5"/>', minus:'<path d="M4 10h12"/>', maximize:'<rect x="4" y="4" width="12" height="12" rx="1"/>',
  trash:'<path d="M3 5h14M8 3h4M5 5l1 12h8l1-12M8 8v6m4-6v6"/>', check:'<path d="m4 10 4 4 8-9"/>',
  sparkle:'<path d="m10 1 2.5 6.5L19 10l-6.5 2.5L10 19l-2.5-6.5L1 10l6.5-2.5Z"/>',
  folder:'<path d="M2 5h6l2 2h8v10H2Z"/>', download:'<path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4"/>',
  info:'<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5m0-9v.1"/>',
  loader:'<path d="M17 10a7 7 0 1 1-7-7"/>', refresh:'<path d="M17 7a7 7 0 1 0 0 6M17 2v5h-5"/>'
};
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const icon = name => `<i><svg viewBox="0 0 20 20" aria-hidden="true">${icons[name] || icons.info}</svg></i>`;
const art = index => `../assets/world-${Number.isInteger(index) ? Math.abs(index) % 4 : 0}.svg`;
let data = { games:[], history:[], settings:{ language:'ru', motion:true, accent:'mint', minimizeAfterLaunch:false, closeToTray:false } };
let status = null;
let view = 'client';
let filter = 'all';
let sort = 'recent';
let selectedArt = 0;
let mutationBusy = false;
let actionBusy = false;
let launching = null;
let confirmAction = null;
let loading = true;
const lang = () => data.settings.language === 'en' ? 'en' : 'ru';
const t = key => window.LumaStrings[key]?.[lang() === 'ru' ? 0 : 1] || window.LumaStrings.operationFailed[lang() === 'ru' ? 0 : 1];
const errorText = code => Object.hasOwn(window.LumaStrings, code) ? t(code) : t('operationFailed');

function translate() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  $('#language').value = lang();
  document.body.dataset.motion = data.settings.motion ? 'on' : 'off';
  document.body.dataset.accent = data.settings.accent;
}
async function request(method, value) {
  if (!window.luma) throw new Error('standaloneOnly');
  const result = await window.luma[method](value);
  if (!result?.ok) throw new Error(result?.error || 'operationFailed');
  return result.data;
}
function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.innerHTML = icon(error ? 'info' : 'check');
  const text = document.createElement('span'); text.textContent = message; element.append(text);
  $('#toasts').append(element);
  while ($('#toasts').children.length > 3) $('#toasts').firstElementChild.remove();
  setTimeout(() => { element.classList.add('leaving'); setTimeout(() => element.remove(), 260); }, error ? 6500 : 4200);
}
function navigate(next) {
  if (!['client','appearance','behavior','diagnostics','library','history','about'].includes(next)) return;
  view = next; filter = 'all'; $('#search').value = ''; $('#main').scrollTop = 0;
  $('#content').style.animation = 'none'; void $('#content').offsetWidth; $('#content').style.animation = '';
  render();
}
function confirm(title, description, accept, callback, primary = false) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-accept').textContent = accept;
  $('#confirm-accept').className = `button ${primary ? 'primary' : 'danger'}`;
  confirmAction = callback;
  $('#confirm-dialog').showModal(); $('#confirm-cancel').focus();
}
function picker() {
  $('#art-picker').innerHTML = [0,1,2,3].map(index => `<button type="button" class="art-option" data-art="${index}" aria-label="${t(`art${index}`)}" aria-pressed="${selectedArt === index}"><img src="${art(index)}" alt=""></button>`).join('');
}
function openAdd() {
  if (loading) return;
  if (data.readOnly) return toast(t('readOnly'), true);
  $('#game-form').reset(); $('#form-error').textContent = ''; selectedArt = 0; picker();
  $('#game-dialog').showModal(); $('#game-name').focus();
}
const btn = (key, action, symbol, primary = false, disabled = false) => `<button class="button ${primary ? 'primary' : 'secondary'}" data-action="${action}" ${disabled ? 'disabled' : ''}>${icon(symbol)}${t(key)}</button>`;
const panelTitle = (key, symbol) => `<h2>${icon(symbol)}${t(key)}</h2>`;
const settingRow = (key, help, control) => `<div class="settings-row"><div><strong>${t(key)}</strong><p>${t(help)}</p></div>${control}</div>`;
const toggle = key => `<button class="toggle" data-setting="${key}" role="switch" aria-checked="${data.settings[key]}" aria-label="${t({motion:'animations', minimizeAfterLaunch:'minimizeOnLaunch', closeToTray:'closeToTray'}[key])}" ${data.readOnly ? 'disabled' : ''}></button>`;
const infoRow = (key, value) => `<div class="client-detail"><span>${t(key)}</span><strong>${esc(value || t('unknown'))}</strong></div>`;

function installProgress() {
  const progress = status?.progress;
  if (!progress || progress.stage === 'idle') return '';
  if (progress.stage === 'failed') return `<div class="install-progress failed" role="alert">${icon('info')}<span>${errorText(progress.error)}</span></div>`;
  const ongoing = ['downloading','verifying'].includes(progress.stage);
  const percent = progress.total ? Math.min(100, Math.round(progress.received / progress.total * 100)) : null;
  return `<div class="install-progress" role="status"><div>${icon(ongoing ? 'loader' : 'check')}<span>${t(progress.stage)}</span>${progress.stage === 'downloading' && percent !== null ? `<b>${percent}%</b>` : ''}</div>${ongoing ? `<progress max="100" ${percent !== null ? `value="${percent}"` : ''} aria-label="${t('downloading')}"></progress>` : ''}</div>`;
}
function clientPage() {
  const installed = status?.installed;
  const installing = ['downloading','verifying'].includes(status?.progress?.stage);
  let update = t('notChecked');
  if (status?.latest) update = status.latest.versionGuid === status.versionGuid ? t('currentVersion') : status.installed ? t('compareUnknown') : t('latestVersion');
  return `<p class="collection-intro">${t('clientIntro')}</p><section class="launcher-panel"><div class="launch-visual"><div class="launch-orbit"></div><div class="roblox-emblem">${icon('roblox')}</div><span class="visual-star s1">✦</span><span class="visual-star s2">✧</span></div><div class="launch-copy"><span class="hero-tag"><span class="status-dot"></span>${status ? t(installed ? 'readyLabel' : 'setupLabel') : t('checking')}</span><h2>${t('launchHeadline')}</h2><p>${t(installed ? 'clientText' : 'noClientText')}</p><div class="launch-actions">${btn(launching === 'client' ? 'launching' : installed ? 'playRoblox' : 'install', installed ? 'launch-client' : 'install-client', launching === 'client' ? 'loader' : installed ? 'play' : 'download', true, actionBusy || !status || installing)}${btn('refresh','refresh','refresh',false,actionBusy)}</div></div></section>
  <div class="client-grid"><section class="settings-panel">${panelTitle('client','roblox')}<div class="client-detected"><span class="status-dot ${!installed ? 'offline' : ''}"></span>${status ? t(installed ? 'installed' : 'notInstalled') : t('checking')}</div>${infoRow('installedVersion',status?.version)}${infoRow('versionId',status?.versionGuid)}${infoRow('source',status?.source)}<div class="panel-actions">${btn('openFolder','open-client','folder',false,!installed)}${btn('openLogs','open-logs','clock')}</div></section>
  <section class="settings-panel">${panelTitle('installSection','download')}<p class="panel-description">${t('installDescription')}</p><div class="client-detail"><span>${t('latestVersion')}</span><strong>${esc(status?.latest?.version || t('notChecked'))}</strong></div><div class="update-note">${update}</div><div class="panel-actions">${btn('checkUpdates','check-updates','refresh',false,actionBusy || installing)}${btn('installUpdate','install-client','download',false,installing)}</div>${installProgress()}<p class="panel-footnote">${t('installNote')}</p></section></div><div class="tip-banner">${icon('info')}<span>${t('versionNote')}</span></div>`;
}
function appearancePage() {
  return `<p class="collection-intro">${t('appearanceIntro')}</p><div class="settings-grid"><section class="settings-panel">${panelTitle('appearance','palette')}${settingRow('language','languageHelp',`<select id="settings-language" class="language-select" aria-label="${t('language')}"><option value="ru" ${lang()==='ru'?'selected':''}>Русский</option><option value="en" ${lang()==='en'?'selected':''}>English</option></select>`)}${settingRow('accent','accentHelp',`<div class="accent-swatches">${['mint','violet','blue'].map(value=>`<button class="accent-swatch${data.settings.accent===value?' active':''}" data-accent="${value}" aria-label="${t(value)}" aria-pressed="${data.settings.accent===value}"></button>`).join('')}</div>`)}${settingRow('animations','animationsHelp',toggle('motion'))}</section><section class="appearance-preview"><span class="eyebrow">${t('appearancePreview')}</span><span class="preview-spark">✦</span><h2>luma<span>.</span></h2><p>${t('previewText')}</p><span class="preview-button">${icon('play')}${t('playRoblox')}</span><div class="preview-orbit"></div></section></div>`;
}
function behaviorPage() {
  return `<p class="collection-intro">${t('behaviorIntro')}</p><section class="settings-panel wide">${panelTitle('behavior','settings')}${settingRow('minimizeOnLaunch','minimizeHelp',toggle('minimizeAfterLaunch'))}${settingRow('closeToTray','trayHelp',toggle('closeToTray'))}</section><div class="tip-banner">${icon('info')}<span>${t('behaviorNote')}</span></div>`;
}
function diagnosticsPage() {
  return `<p class="collection-intro">${t('diagnosticsIntro')}</p><section class="settings-panel">${panelTitle('client','pulse')}${infoRow('installedVersion',status?.version)}${infoRow('versionId',status?.versionGuid)}${infoRow('clientPath',status?.folder)}<div class="panel-actions">${btn('refresh','refresh','refresh',false,actionBusy)}${btn('exportReport','export-report','download')}</div></section><div class="diagnostic-tools">${[
    ['logs','logsHelp','openLogs','open-logs','clock'],['folder','launchHint','openFolder','open-client','folder'],['launcherData','dataHelp','openFolder','open-data','settings']
  ].map(([title,help,button,action,symbol])=>`<section class="tool-panel"><span class="stat-icon">${icon(symbol)}</span><h3>${t(title)}</h3><p>${t(help)}</p>${btn(button,action,'arrow',false,action==='open-client'&&!status?.installed)}</section>`).join('')}</div>`;
}
function gamesList() {
  const query = $('#search').value.trim().toLocaleLowerCase(lang());
  const games = data.games.filter(game => (filter !== 'favorites' || game.favorite) && (game.name.toLocaleLowerCase(lang()).includes(query) || game.id.includes(query)));
  if (sort === 'name') games.sort((a,b)=>a.name.localeCompare(b.name,lang())); else games.reverse();
  return games;
}
function gameCard(game,index) {
  return `<article class="game-card" style="--index:${Math.min(index,8)}" data-game="${game.id}"><div class="card-art"><img src="${art(game.art)}" alt="" loading="lazy"><button class="card-favorite${game.favorite?' selected':''}" data-favorite="${game.id}" aria-label="${t(game.favorite?'favoriteRemove':'favoriteAdd')}" aria-pressed="${game.favorite}">${icon('heart')}</button><span class="card-index">ROBLOX / ${String(index+1).padStart(2,'0')}</span></div><div class="card-body"><h3 class="card-title" title="${esc(game.name)}">${esc(game.name)}</h3><div class="card-meta">PLACE ID · ${game.id}</div><div class="card-actions"><button class="play-card${launching===game.id?' launching':''}" data-launch="${game.id}" ${launching?'disabled':''}>${icon(launching===game.id?'loader':'play')}${t(launching===game.id?'launching':'play')}</button><button class="remove-card" data-remove="${game.id}" aria-label="${t('remove')} ${esc(game.name)}">${icon('trash')}</button></div></div></article>`;
}
function empty(title,help,add=false,symbol='✧') {
  return `<div class="empty-state"><div class="empty-symbol">${symbol}</div><h2>${t(title)}</h2><p>${t(help)}</p>${add?btn('addGame','add','plus',true):''}</div>`;
}
function libraryPage() {
  const games = gamesList(); const query = $('#search').value.trim();
  return `<p class="collection-intro">${t('libraryIntro')}</p><div class="filters"><button class="filter${filter==='all'?' active':''}" data-filter="all">${t('allGames')} · ${data.games.length}</button><button class="filter${filter==='favorites'?' active':''}" data-filter="favorites">${t('favorites')}</button><select id="sort" class="sort-select" aria-label="${t('sort')}"><option value="recent" ${sort==='recent'?'selected':''}>${t('recentFirst')}</option><option value="name" ${sort==='name'?'selected':''}>${t('byName')}</option></select></div>${games.length?`<div class="card-grid">${games.map(gameCard).join('')}<button class="add-card" data-action="add"><span class="add-card-icon">${icon('plus')}</span><strong>${t('addGame')}</strong><p>${t('emptyLibraryHelp')}</p></button></div>`:query?empty('noResults','noResultsHelp'):filter==='favorites'?empty('emptyFavorites','emptyFavoritesHelp',false,'♡'):empty('emptyLibrary','emptyLibraryHelp',true)}`;
}
function historyPage() {
  const query = $('#search').value.trim().toLocaleLowerCase(lang());
  const history = [...data.history].reverse().filter(item => item.name.toLocaleLowerCase(lang()).includes(query)||item.id.includes(query));
  return `<p class="collection-intro">${t('historyIntro')}</p>${data.history.length?`<div class="section-heading"><span class="card-meta">${history.length} / 200</span><button class="button ghost" data-action="clear-history">${icon('trash')}${t('clear')}</button></div>`:''}${history.length?`<div class="history-list">${history.map(item=>{
    const game=data.games.find(g=>g.id===item.id);
    const date=item.at?new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.at)):item.legacyTime||t('previousVersion');
    return `<article class="history-row"><img class="history-thumb" src="${art(game?.art)}" alt=""><div class="history-info"><strong>${esc(item.name)}</strong><small>${t('launchRequest')} · ${item.id}</small></div><time class="history-time">${esc(date)}</time>${game?`<button class="button secondary" data-launch="${item.id}" ${launching?'disabled':''}>${icon('play')}${t('play')}</button>`:`<span class="card-meta">${t('removedGame')}</span>`}</article>`;
  }).join('')}</div>`:empty(query?'noResults':'historyEmpty',query?'noResultsHelp':'historyEmptyHelp',false,'◷')}<div class="tip-banner">${icon('info')}<span>${t('historyNote')}</span></div>`;
}
function aboutPage() {
  return `<p class="collection-intro">${t('aboutIntro')}</p><section class="about-card"><span class="about-version">LUMA LAUNCHER / 0.3.0 / WINDOWS</span><div class="about-logo"><span>✦</span> luma<span>.</span></div><h2>${t('tagline')}</h2><p>${t('aboutBody')}</p><p>${t('authNote')}</p><div class="about-limit">${icon('info')}<span>${t('aboutLimits')}</span></div><div class="about-license">${t('license')}<br>${t('affiliation')}</div></section>`;
}
function render() {
  translate();
  const pages={client:clientPage,appearance:appearancePage,behavior:behaviorPage,diagnostics:diagnosticsPage,library:libraryPage,history:historyPage,about:aboutPage};
  $('#page-title').textContent=t(`${view}Title`);
  $('#page-eyebrow').textContent=`LUMA / ${t(view).toLocaleUpperCase(lang())}`;
  const searchable=['library','history'].includes(view);
  $('.search-box').hidden=!searchable; $('#add-top').hidden=view!=='library';
  $('#sidebar-client-status').textContent=status?t(status.installed?'installed':'notInstalled'):t('checking');
  $('#nav-count').textContent=data.games.length;
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  $('#warning').hidden=!data.warning; $('#warning').textContent=data.warning?errorText(data.warning):'';
  $('#content').innerHTML=pages[view]();
  if ($('#game-dialog').open) picker();
}
async function mutate(method,value,message) {
  if(mutationBusy)return; mutationBusy=true;
  try { data=await request(method,value); render(); if(message)toast(t(message)); }
  catch(error){toast(errorText(error.message),true); render();}
  finally{mutationBusy=false;}
}
async function perform(method,value,message) {
  if(actionBusy)return; actionBusy=true; render();
  try {const result=await request(method,value); if(['getClientStatus','checkClientVersion','launchClient'].includes(method))status=result; if(method==='exportDiagnostics'){if(result.saved)toast(t('reportSaved'));}else if(message)toast(t(message));}
  catch(error){toast(errorText(error.message),true);}
  finally{actionBusy=false;launching=null;render();}
}
async function launchGame(id) {
  if(launching||actionBusy)return; launching=id; render();
  try {const result=await request('launchGame',id);data=result.library;toast(t(result.recorded?'launchSent':'launchNotRecorded'),!result.recorded);}
  catch(error){toast(errorText(error.message),true);}
  finally{launching=null;render();}
}
function askInstall() {
  confirm(t('installTitle'),t('installConfirm'),t('installAccept'),async()=>{
    try {await request('installClient');} catch(error){toast(errorText(error.message),true);}
  },true);
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button)return;
  if(button.dataset.view)return navigate(button.dataset.view);
  if(button.dataset.window){try{await request('windowAction',button.dataset.window);}catch{}return;}
  if(button.id==='add-top')return openAdd();
  if(button.classList.contains('modal-close'))return $('#game-dialog').close();
  if(button.dataset.art!==undefined){selectedArt=Number(button.dataset.art);picker();return;}
  if(button.dataset.filter){filter=button.dataset.filter;render();return;}
  if(button.dataset.favorite)return mutate('favoriteGame',button.dataset.favorite);
  if(button.dataset.launch)return launchGame(button.dataset.launch);
  if(button.dataset.remove){const game=data.games.find(g=>g.id===button.dataset.remove);if(game)confirm(t('removeTitle'),`${game.name}\n\n${t('removeDescription')}`,t('remove'),()=>mutate('removeGame',game.id,'gameRemoved'));return;}
  if(button.dataset.setting)return mutate('saveSettings',{...data.settings,[button.dataset.setting]:!data.settings[button.dataset.setting]});
  if(button.dataset.accent)return mutate('saveSettings',{...data.settings,accent:button.dataset.accent});
  if(button.id==='confirm-cancel')return $('#confirm-dialog').close();
  if(button.id==='confirm-accept'){const callback=confirmAction;confirmAction=null;$('#confirm-dialog').close();return callback?.();}
  const action=button.dataset.action;
  if(action==='add')return openAdd();
  if(action==='refresh')return perform('getClientStatus',undefined,'scanDone');
  if(action==='check-updates')return perform('checkClientVersion');
  if(action==='launch-client'){launching='client';return perform('launchClient',undefined,'launchSent');}
  if(action==='install-client')return askInstall();
  if(action==='open-client')return perform('openClientFolder','client');
  if(action==='open-logs')return perform('openClientFolder','logs');
  if(action==='open-data')return perform('openDataFolder');
  if(action==='export-report')return perform('exportDiagnostics');
  if(action==='clear-history')return confirm(t('clearHistory'),t('clearHistoryHelp'),t('clear'),()=>mutate('clearHistory',undefined,'historyCleared'));
});
document.addEventListener('change',event=>{
  if(['language','settings-language'].includes(event.target.id)){
    $('#toasts').replaceChildren();
    return mutate('saveSettings',{...data.settings,language:event.target.value});
  }
  if(event.target.id==='sort'){sort=event.target.value;render();}
});
$('.brand').addEventListener('click',event=>{event.preventDefault();navigate('client');});
$('#search').addEventListener('input',render);
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){event.preventDefault();if(!['library','history'].includes(view))navigate('library');$('#search').focus();}
});
$('#game-form').addEventListener('submit',async event=>{
  event.preventDefault();if(mutationBusy)return;mutationBusy=true;$('#save-game').disabled=true;$('#form-error').textContent='';
  try {data=await request('addGame',{name:$('#game-name').value,link:$('#game-link').value,art:selectedArt});$('#game-dialog').close();view='library';filter='all';$('#search').value='';render();toast(t('gameAdded'));}
  catch(error){$('#form-error').textContent=errorText(error.message);}
  finally{mutationBusy=false;$('#save-game').disabled=false;}
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();}));
document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=`<svg viewBox="0 0 20 20" aria-hidden="true">${icons[node.dataset.icon]||icons.info}</svg>`);
window.luma?.onClientProgress(progress=>{
  status={...(status||{}),progress};render();
  if(progress.stage==='failed')toast(errorText(progress.error),true);
  if(progress.stage==='installerStarted')toast(t('installerStarted'));
});
render();
(async()=>{
  try {data=await request('getLibrary');}
  catch(error){data.warning=error.message;data.readOnly=true;}
  loading=false;render();
  try {status=await request('getClientStatus');render();}
  catch(error){toast(errorText(error.message),true);}
})();
