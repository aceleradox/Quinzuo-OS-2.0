import { state, events, emit } from './state.js';
import { getApp } from './app-registry.js';
import { Dock } from './dock.js';
import { HQAudio } from './audio.js';
import { parseQnz } from './qnz.js';

let counter = 0;
let drag = null;

/* Controles de atalho por janela. Registro global para o Alt funcionar mesmo
   quando o foco está na barra de título ou no corpo da página (fora do app). */
const dockControllers = new Map();
let globalShortcutsReady = false;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function openApp(appId, fileData = null, options = {}) {
    if (!appId) return null;

    // Atalho de app instalado: qnz:<fileId>
    if (String(appId).startsWith('qnz:')) {
        const fileId = String(appId).slice(4);
        const file = state.files.find((f) => String(f.id) === fileId);
        if (!file) {
            alert('Este aplicativo .QNZ não está mais no VHD.');
            return null;
        }
        appId = 'qnz-runner';
        fileData = file;
    }

    const app = getApp(appId) || {
        id: appId, name: appId, icon: '📦', width: 720, height: 500, category: 'Outros'
    };

    // Apps .QNZ usam o ícone, título e tamanho definidos no próprio pacote.
    let appIcon = app.icon || '📦';
    let qnzTitle = null;
    if (appId === 'qnz-runner' && fileData) {
        const pkg = parseQnz(fileData.content);
        appIcon = pkg.icon || '⚡';
        qnzTitle = pkg.title || fileData.name;
        options = { ...options };
        options.width = options.width || pkg.window.width;
        options.height = options.height || pkg.window.height;
    }

    const id = `win_${appId.replace(/[^a-z0-9-]/gi, '')}_${++counter}`;
    const contentId = `content_${id}`;
    const win = document.createElement('div');
    win.className = 'window';
    win.id = id;
    win.dataset.app = appId;

    const width = options.width || app.width || 720;
    const height = options.height || app.height || 500;
    const maxLeft = Math.max(20, window.innerWidth - width - 20);
    const maxTop = Math.max(40, window.innerHeight - height - 110);
    const offset = (state.windows.length % 8) * 25;
    win.style.width = `${Math.min(width, window.innerWidth - 30)}px`;
    win.style.height = `${Math.min(height, window.innerHeight - 130)}px`;
    win.style.left = `${clamp(90 + offset, 10, maxLeft)}px`;
    win.style.top = `${clamp(50 + offset, 34, maxTop)}px`;

    let title = qnzTitle || app.name;
    if (!qnzTitle && fileData && fileData.name) title += ` — ${fileData.name}`;
    if (options.title) title = options.title;

    win.innerHTML = `
        <div class="window-header">
            <div class="window-title"><span>${escapeHtml(appIcon)}</span><div>${escapeHtml(title)} ${app.desc ? `<small>· ${escapeHtml(app.desc)}</small>` : ''}</div></div>
            <div class="win-controls">
                <button class="win-btn win-min" data-waction="min" title="Minimizar"></button>
                <button class="win-btn win-max" data-waction="max" title="Maximizar"></button>
                <button class="win-btn win-close" data-waction="close" title="Fechar"></button>
            </div>
        </div>
        <div class="window-content" id="${contentId}"></div>
        <div class="window-dock">
            <div class="wdock-actions" title="Mac-style: fechar / minimizar / maximizar">
                <button class="wdock-action close" data-waction="close" title="Fechar (Ctrl+W)">✕</button>
                <button class="wdock-action min" data-waction="min" title="Minimizar">−</button>
                <button class="wdock-action max" data-waction="max" title="Maximizar / Restaurar">□</button>
            </div>
            <div class="wdock-app" title="${escapeHtml(app.name)}">${escapeHtml(appIcon)}</div>
            <div class="wdock-menus">
                <button class="wdock-menu-btn" data-wmenu="file">🗂️ Arquivo</button>
                <button class="wdock-menu-btn" data-wmenu="edit">✏️ Editar</button>
                <button class="wdock-menu-btn" data-wmenu="view">👁️ Exibir</button>
                <button class="wdock-menu-btn" data-wmenu="tools">🧰 Ferramentas</button>
                <button class="wdock-menu-btn" data-wmenu="app">🧩 App</button>
                <button class="wdock-menu-btn" data-wmenu="help">❓ Ajuda</button>
                <button class="wdock-menu-btn" data-wmenu="advanced">🚀 Avançado</button>
            </div>
            <div class="wdock-alt-hint" title="Pressione ALT para opções avançadas">ALT</div>
        </div>
        <div class="window-menu-panel"></div>`;

    const info = {
        id, appId, icon: appIcon, title, fileData,
        minimized: false, maximized: false, active: true, restore: null
    };
    state.windows.push(info);
    state.zCounter += 1;
    win.style.zIndex = state.zCounter;

    const container = document.getElementById('windowsContainer');
    container.appendChild(win);

    win.addEventListener('mousedown', () => focusWindow(id));
    win.querySelector('.window-header').onmousedown = (e) => startDrag(e, id);
    win.querySelector('.window-header').ondblclick = () => toggleMaximize(id);
    win.querySelectorAll('.win-controls .win-btn').forEach((btn) => bindWindowAction(btn, id));

    Dock.add(info, {
        onActivate: () => {
            if (info.minimized) restoreWindow(id);
            else focusWindow(id);
        },
        onMinimize: () => minimizeWindow(id),
        onMaximize: () => toggleMaximize(id),
        onClose: () => closeWindow(id)
    });

    setupWindowDock(win, id, app, info);

    const content = document.getElementById(contentId);
    try {
        if (typeof app.render === 'function') app.render(contentId, fileData, id, info);
        else content.innerHTML = `<div class="window-error">Aplicativo "${appId}" ainda não possui interface registrada.</div>`;
    } catch (err) {
        console.error('[App]', appId, err);
        content.innerHTML = `<div class="window-error">Falha ao iniciar ${escapeHtml(appId)}:\n${escapeHtml(err.stack || err.message)}</div>`;
    }

    // Garante que o app recém-aberto seja o alvo do Alt e dos atalhos.
    state.windows.forEach((w) => { w.active = w.id === id; });
    state.activeWindowId = id;
    document.querySelectorAll('.window').forEach((w) => w.classList.toggle('inactive', w.id !== id));
    Dock.setActive(id);

    HQAudio.appOpen();
    emit(events.WINDOW_FOCUS, info);
    return id;
}

/** Barra "dock" dentro da janela: menus com emojis + controles da janela. */
function setupWindowDock(win, winId, app, info) {
    const panel = win.querySelector('.window-menu-panel');
    const buttons = [...win.querySelectorAll('.wdock-menu-btn')];
    const content = win.querySelector('.window-content');
    const sep = { sep: true };
    let openKey = null;

    function closePanel() {
        panel.classList.remove('open');
        buttons.forEach((b) => b.classList.remove('active'));
        openKey = null;
    }

    function dispatch(command) {
        if (!content) return;
        content.dispatchEvent(new CustomEvent('qz:app-command', {
            bubbles: true,
            detail: { command, winId, appId: info.appId, fileData: info.fileData }
        }));
    }

    function reloadApp() {
        if (!content) return;
        content.innerHTML = '';
        try {
            app.render(content.id, info.fileData, winId, info);
        } catch (err) {
            content.innerHTML = `<div class="window-error">Falha ao reiniciar ${escapeHtml(info.appId)}:\n${escapeHtml(err.stack || err.message)}</div>`;
        }
    }

    function exec(command) {
        dispatch(command);
        try { document.execCommand(command); } catch (_) {}
    }

    const helpText = [
        'QUINZUO OS STATIC 5.8 — AJUDA RÁPIDA',
        '',
        'Barra de cada janela:',
        '  🗂️ Arquivo  — novo texto, abrir arquivos, salvar/exportar, fechar',
        '  ✏️ Editar    — desfazer, recortar, copiar, colar, selecionar tudo, localizar',
        '  👁️ Exibir    — maximizar, barra de ferramentas, zoom',
        '  🧰 Ferramentas — terminal, codeneta, FantASM, QNZ Builder, configuração',
        '  🧩 App       — sobre, reiniciar app, criar app, córtex',
        '  ❓ Ajuda     — esta ajuda, atalhos, BIOS',
        '  ➖ / □ / ✕  — minimizar, maximizar/restaurar, fechar',
        '',
        'Atalhos: Ctrl+S salva · Ctrl+W fecha · Ctrl+A seleciona tudo.',
        'As frases de boot e o kernel em WASM fazem parte da identidade do sistema.'
    ].join('\n');

    const menus = {
        file: [
            { icon: '📝', label: 'Novo bloco de notas', run: () => openApp('notepad') },
            { icon: '💾', label: 'Partições / Abrir arquivo', run: () => openApp('floppy') },
            { icon: '📦', label: 'Instalar .QNZ', run: () => openApp('qnz-builder') },
            sep,
            { icon: '💽', label: 'Salvar no VHD', shortcut: 'Ctrl+S', run: () => dispatch('save') },
            { icon: '⬇️', label: 'Exportar arquivo', run: () => dispatch('export') },
            sep,
            { icon: '❌', label: 'Fechar janela', shortcut: 'Ctrl+W', run: () => closeWindow(winId) }
        ],
        edit: [
            { icon: '↶', label: 'Desfazer', shortcut: 'Ctrl+Z', run: () => exec('undo') },
            { icon: '↷', label: 'Refazer', shortcut: 'Ctrl+Y', run: () => exec('redo') },
            sep,
            { icon: '✂️', label: 'Recortar', shortcut: 'Ctrl+X', run: () => exec('cut') },
            { icon: '📋', label: 'Copiar', shortcut: 'Ctrl+C', run: () => exec('copy') },
            { icon: '📌', label: 'Colar', shortcut: 'Ctrl+V', run: () => exec('paste') },
            sep,
            { icon: '🔲', label: 'Selecionar tudo', shortcut: 'Ctrl+A', run: () => exec('selectAll') },
            { icon: '🔎', label: 'Localizar', shortcut: 'Ctrl+F', run: () => dispatch('find') }
        ],
        view: [
            { icon: '🟦', label: 'Maximizar / Restaurar', run: () => toggleMaximize(winId) },
            { icon: '🧰', label: 'Mostrar / ocultar toolbar', run: () => {
                const bar = content && content.querySelector('.app-toolbar');
                if (bar) bar.style.display = bar.style.display === 'none' ? '' : 'none';
                dispatch('toolbar');
            } },
            sep,
            { icon: '🔍', label: 'Zoom aumentar', run: () => dispatch('zoom-in') },
            { icon: '🔎', label: 'Zoom diminuir', run: () => dispatch('zoom-out') },
            { icon: '↔️', label: 'Ajustar à janela', run: () => dispatch('fit') },
            { icon: '🌈', label: 'Alternar tema funk', run: () => import('./settings.js').then((m) => m.saveSettings({ theme: m.getSettings().theme === 'funk' ? 'valsa' : 'funk' })) }
        ],
        tools: [
            { icon: '💻', label: 'Terminal / CMD', run: () => openApp('terminal') },
            { icon: '💉', label: 'codeneta · injetor JS', run: () => openApp('codeneta') },
            { icon: '⚡', label: 'codenate · editor', run: () => openApp('codenate') },
            { icon: '👻', label: 'FantASM', run: () => openApp('fantasm') },
            { icon: '🏗️', label: 'Quinzuo QNZ Builder', run: () => openApp('qnz-builder') },
            sep,
            { icon: '⚙️', label: 'Configuração', run: () => openApp('config') },
            { icon: '🔧', label: 'BIOS', run: () => openApp('bios') }
        ],
        app: [
            { icon: info.icon || app.icon || '📦', label: `Sobre ${app.name}`, run: () => alert(`${info.icon || app.icon || '📦'} ${app.name}\n${app.desc || 'Aplicativo Quinzuo OS'}\nCategoria: ${app.category || 'Outros'}`) },
            { icon: '🔄', label: 'Reiniciar aplicativo', run: reloadApp },
            { icon: '🆕', label: 'Criar app Quinzuo', run: () => openApp('qnz-builder') },
            sep,
            { icon: '🧬', label: 'Painel do córtex', run: () => openApp('cortex') },
            { icon: '🧠', label: 'Kernel 5.8 (WASM)', run: () => openApp('kernel') }
        ],
        help: [
            { icon: '❓', label: 'Ajuda do sistema', run: () => openApp('notepad', { name: 'AJUDA_QNZ.txt', content: helpText }) },
            { icon: '⌨️', label: 'Ver atalhos', run: () => alert(helpText) },
            sep,
            { icon: '🔧', label: 'Abrir BIOS', run: () => openApp('bios') },
            { icon: '🛠️', label: 'Diagnóstico do sistema', run: () => openApp('kernel') }
        ],
        advanced: [
            { icon: '🚀', label: 'Alternar modo avançado', shortcut: 'Alt', run: () => {
                win.classList.toggle('advanced');
                dispatch('advanced');
            } },
            { icon: '🧑‍💻', label: 'Inspecionar elementos', run: () => {
                if (content) content.classList.toggle('qz-dev-mode');
                dispatch('inspect');
            } },
            { icon: '📋', label: 'Copiar ID da janela', run: () => {
                try { navigator.clipboard.writeText(winId); } catch (_) {}
                dispatch('copy-id');
            } },
            { icon: '🔍', label: 'Informações da janela', run: () => alert(`App: ${app.name}\nID: ${winId}\nJanela: ${info.title}\nEstado: ${info.minimized ? 'minimizada' : (info.maximized ? 'maximizada' : 'normal')}`) },
            sep,
            { icon: '💉', label: 'Injetar JavaScript', run: () => openApp('codeneta') },
            { icon: '🏗️', label: 'Criar app Quinzuo', run: () => openApp('qnz-builder') },
            { icon: '🔄', label: 'Reiniciar aplicativo', run: reloadApp },
            sep,
            { icon: '➖', label: 'Minimizar', run: () => minimizeWindow(winId) },
            { icon: '□', label: 'Maximizar / Restaurar', run: () => toggleMaximize(winId) },
            { icon: '✕', label: 'Fechar janela', run: () => closeWindow(winId) }
        ]
    };

    function showMenu(key, btn) {
        closePanel();
        openKey = key;
        panel.innerHTML = '';

        (menus[key] || []).forEach((item) => {
            if (item.sep) {
                const line = document.createElement('div');
                line.className = 'wm-sep';
                panel.appendChild(line);
                return;
            }
            const row = document.createElement('button');
            row.className = 'wm-item';
            row.innerHTML = `<span>${item.icon}</span><span>${escapeHtml(item.label)}</span>${item.shortcut ? `<small>${escapeHtml(item.shortcut)}</small>` : ''}`;
            row.onclick = (ev) => {
                ev.stopPropagation();
                HQAudio.uiClick();
                closePanel();
                item.run();
            };
            panel.appendChild(row);
        });

        const left = btn ? clamp(btn.offsetLeft - 4, 4, Math.max(4, win.clientWidth - 220)) : 4;
        panel.style.left = `${left}px`;
        panel.classList.add('open');
        if (btn) btn.classList.add('active');
    }

    buttons.forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation();
            HQAudio.uiClick();
            const key = btn.dataset.wmenu;
            if (openKey === key) { closePanel(); return; }
            showMenu(key, btn);
        };
    });

    // Ligação direta (fase de captura): os botões ✕ / − / □ respondem mesmo
    // quando o app interno usa stopPropagation ou recria parte do DOM.
    win.querySelectorAll('.wdock-action').forEach((btn) => bindWindowAction(btn, winId));

    const onDocClick = (e) => { if (!win.contains(e.target)) closePanel(); };
    document.addEventListener('click', onDocClick);

    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            document.removeEventListener('click', onDocClick);
            dockControllers.delete(winId);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    dockControllers.set(winId, {
        openMenu: (key) => showMenu(key, win.querySelector(`[data-wmenu="${key}"]`)),
        closePanel,
        dispatch,
        toggleAdvanced: () => {
            if (openKey === 'advanced') { closePanel(); return; }
            win.classList.add('advanced');
            showMenu('advanced', win.querySelector('[data-wmenu="advanced"]'));
        }
    });
    installGlobalShortcuts();
}

function activeDockController() {
    if (state.activeWindowId && dockControllers.has(state.activeWindowId)) {
        return dockControllers.get(state.activeWindowId);
    }
    const ids = [...dockControllers.keys()].reverse();
    for (const id of ids) {
        if (document.getElementById(id)) return dockControllers.get(id);
    }
    return null;
}

function installGlobalShortcuts() {
    if (globalShortcutsReady) return;
    globalShortcutsReady = true;
    const altMap = { f: 'file', e: 'edit', v: 'view', t: 'tools', a: 'app', h: 'help', '0': 'advanced' };

    document.addEventListener('keydown', (e) => {
        const ctrl = activeDockController();
        if (!ctrl) return;
        const k = String(e.key || '').toLowerCase();

        if (e.altKey && !e.ctrlKey && !e.metaKey && altMap[k]) {
            e.preventDefault();
            HQAudio.uiClick();
            ctrl.openMenu(altMap[k]);
            return;
        }
        // Alt sozinho libera o menu avançado em qualquer janela.
        if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (!e.repeat) {
                HQAudio.uiClick();
                ctrl.toggleAdvanced();
            }
            return;
        }
        if (e.ctrlKey && !e.altKey && (k === 's' || k === 'w')) {
            e.preventDefault();
            if (k === 's') ctrl.dispatch('save');
            else {
                const id = state.activeWindowId;
                if (id) closeWindow(id);
            }
            return;
        }
        if (e.key === 'Escape') ctrl.closePanel();
    }, true);
}

function bindWindowAction(btn, winId) {
    if (!btn) return;
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        HQAudio.uiClick();
        const action = btn.dataset.waction;
        if (action === 'min') minimizeWindow(winId);
        if (action === 'max') toggleMaximize(winId);
        if (action === 'close') closeWindow(winId);
    }, true);
}

export function focusWindow(winId) {
    const info = state.windows.find((w) => w.id === winId);
    if (!info) return;
    state.windows.forEach((w) => { w.active = w.id === winId; });
    state.activeWindowId = winId;
    const win = document.getElementById(winId);
    if (win) {
        state.zCounter += 1;
        win.style.zIndex = state.zCounter;
    }
    document.querySelectorAll('.window').forEach((w) => w.classList.toggle('inactive', w.id !== winId));
    Dock.setActive(winId);
}

export function closeWindow(winId) {
    HQAudio.appClose();
    const win = document.getElementById(winId);
    if (win) {
        win.classList.add('closing');
        setTimeout(() => win.remove(), 180);
    }
    state.windows = state.windows.filter((w) => w.id !== winId);
    if (state.activeWindowId === winId) state.activeWindowId = null;
    Dock.remove(winId);
}

export function minimizeWindow(winId) {
    const info = state.windows.find((w) => w.id === winId);
    const win = document.getElementById(winId);
    if (!info || !win) return;
    info.minimized = true;
    win.classList.add('minimized');
    Dock.update(info);
}

export function restoreWindow(winId) {
    const info = state.windows.find((w) => w.id === winId);
    const win = document.getElementById(winId);
    if (!info || !win) return;
    info.minimized = false;
    win.classList.remove('minimized');
    focusWindow(winId);
    Dock.update(info);
}

export function toggleMaximize(winId) {
    const info = state.windows.find((w) => w.id === winId);
    const win = document.getElementById(winId);
    if (!info || !win) return;

    if (!info.maximized) {
        info.restore = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        win.classList.add('maximized');
        info.maximized = true;
    } else {
        win.classList.remove('maximized');
        if (info.restore) {
            win.style.left = info.restore.left;
            win.style.top = info.restore.top;
            win.style.width = info.restore.width;
            win.style.height = info.restore.height;
        }
        info.maximized = false;
    }
    if (info.minimized) restoreWindow(winId);
    focusWindow(winId);
    Dock.update(info);
}

export function startDrag(e, winId) {
    if (e.target.closest('button') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const win = document.getElementById(winId);
    const info = state.windows.find((w) => w.id === winId);
    if (!win || !info || info.maximized) return;
    focusWindow(winId);
    drag = { win, startX: e.clientX, startY: e.clientY, initX: win.offsetLeft, initY: win.offsetTop };

    const onMove = (ev) => {
        if (!drag) return;
        const nx = drag.initX + ev.clientX - drag.startX;
        const ny = drag.initY + ev.clientY - drag.startY;
        drag.win.style.left = `${clamp(nx, -drag.win.offsetWidth + 120, window.innerWidth - 100)}px`;
        drag.win.style.top = `${clamp(ny, 0, window.innerHeight - 90)}px`;
    };
    const onUp = () => {
        drag = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

export function closeAllWindows() {
    [...state.windows].forEach((w) => closeWindow(w.id));
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
