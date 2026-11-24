import { state, events, emit, readLS, writeLS } from './state.js';

/**
 * Formato .QNZ (v1): JSON com html, css e js + metadados de janela/designer.
 * Também aceita HTML puro (compatibilidade com arquivos antigos).
 */
export function parseQnz(content = '') {
    if (content && typeof content === 'object') return normalize(content);
    const text = String(content || '').trim();
    if (text.startsWith('{')) {
        try { return normalize(JSON.parse(text)); }
        catch (_) { /* cai para HTML */ }
    }
    return normalize({ format: 'html', html: text });
}

function normalize(pkg) {
    const theme = pkg.theme || {};
    const win = pkg.window || {};
    return {
        format: pkg.format || 'qnz',
        version: pkg.version || 1,
        title: pkg.title || pkg.name || 'Aplicativo QNZ',
        name: pkg.name || pkg.title || 'app.qnz',
        icon: pkg.icon || '⚡',
        description: pkg.description || '',
        theme: {
            primary: theme.primary || '#8b5cf6',
            cyan: theme.cyan || '#06b6d4',
            background: theme.background || '#0f172a',
            dockStyle: theme.dockStyle || 'glass'
        },
        window: {
            width: Number(win.width) || 720,
            height: Number(win.height) || 500,
            resizable: win.resizable !== false
        },
        html: pkg.html ?? pkg.content ?? '',
        css: pkg.css || '',
        js: pkg.js || ''
    };
}

export function serializeQnz(pkg) {
    const p = normalize(pkg);
    return JSON.stringify({
        format: 'qnz',
        version: 1,
        title: p.title,
        name: p.name,
        icon: p.icon,
        description: p.description,
        theme: p.theme,
        window: p.window,
        html: p.html,
        css: p.css,
        js: p.js
    }, null, 2);
}

const safeScript = (code) => String(code || '').replace(/<\/script/gi, '<\\/script');
const safeStyle = (code) => String(code || '').replace(/<\/style/gi, '<\\/style');

export function buildQnzHtml(pkg, options = {}) {
    const p = normalize(pkg);
    const bridge = options.bridge === false ? '' : `
<script>
(function () {
  var send = function (level, args) {
    try { parent.postMessage({ type: 'QZ_QNZ_LOG', level: level, text: Array.prototype.map.call(args, String).join(' ') }, '*'); } catch (e) {}
  };
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () { send(level, arguments); if (original) original.apply(console, arguments); };
  });
  window.addEventListener('error', function (e) { send('error', [e.message]); });
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'QZ_INJECT') return;
    try { (0, eval)(e.data.code); send('log', ['[codeneta] código injetado']); }
    catch (err) { send('error', ['[codeneta] ' + err.message]); }
  });
  window.__QZ_QNZ__ = { title: ${JSON.stringify(p.title)}, icon: ${JSON.stringify(p.icon)} };
})();
<\/script>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(p.title)}</title>
<style>
  :root { --qz-primary: ${p.theme.primary}; --qz-cyan: ${p.theme.cyan}; }
  html, body { margin: 0; min-height: 100%; }
  body { background: ${p.theme.background}; color: #f8fafc; font-family: system-ui, sans-serif; padding: 12px; }
  body.qnz-light { background: #fff; color: #0f172a; }
${safeStyle(p.css)}
</style>
${bridge}
</head>
<body class="${p.theme.background === '#ffffff' ? 'qnz-light' : ''}">
${p.html}
<script>
${safeScript(p.js)}
<\/script>
</body>
</html>`;
}

export function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------- Instalação no Dock ------------------------- */

export function getInstalledQnz() {
    return Array.isArray(state.installedQnz) ? state.installedQnz : [];
}

export function saveInstalledQnz(list) {
    state.installedQnz = list;
    writeLS('qz_installed_qnz', list);
    emit(events.DOCK_CHANGED, list);
}

export function installQnzToDock({ fileId, name, icon, label }) {
    const list = getInstalledQnz().filter((item) => String(item.fileId) !== String(fileId));
    list.push({ fileId, name: name || 'app.qnz', icon: icon || '⚡', label: label || name || 'QNZ' });
    saveInstalledQnz(list);
    return list;
}

export function uninstallQnzFromDock(fileId) {
    saveInstalledQnz(getInstalledQnz().filter((item) => String(item.fileId) !== String(fileId)));
}
