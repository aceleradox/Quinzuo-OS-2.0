import { state, cogStats, events, writeLS, emit } from './state.js';
import { listByCategory } from './app-registry.js';
import { BackendFS } from './fs.js';
import { HQAudio } from './audio.js';
import { openApp, restoreWindow, focusWindow } from './window-manager.js';
import { parseQnz } from './qnz.js';
import { openFile } from './context-menu.js';

let initialized = false;
let pingTimer = null;
let startApps = [];

export function initDesktop() {
    if (initialized) return;
    initialized = true;

    document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('topBar').classList.remove('hidden');
    document.getElementById('windowsContainer').classList.remove('hidden');
    // O dock de baixo foi removido: cada janela tem sua própria barra.
    const oldDock = document.getElementById('dockContainer');
    if (oldDock) oldDock.remove();

    document.getElementById('btnStart').onclick = () => toggleStartMenu();
    document.getElementById('btnCortex').onclick = () => { HQAudio.uiClick(); openApp('cortex'); };
    document.getElementById('btnVhd').onclick = () => { HQAudio.uiClick(); openApp('floppy'); };
    document.getElementById('btnBios').onclick = () => { HQAudio.uiClick(); openApp('bios'); };
    document.getElementById('btnWindows').onclick = (e) => { e.stopPropagation(); HQAudio.uiClick(); toggleWindowList(); };
    document.getElementById('btnConfig').onclick = () => { HQAudio.uiClick(); openApp('config'); };
    document.getElementById('btnStartClose').onclick = closeStartMenu;
    const backdrop = document.querySelector('#startMenu [data-start-close]');
    if (backdrop) backdrop.onclick = closeStartMenu;
    const search = document.getElementById('startSearch');
    if (search) search.oninput = () => renderStartMenu(search.value);
    document.addEventListener('click', (e) => {
        if (!document.getElementById('windowListMenu').contains(e.target) && e.target.id !== 'btnWindows') {
            document.getElementById('windowListMenu').classList.add('hidden');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeStartMenu(); document.getElementById('windowListMenu').classList.add('hidden'); }
    });

    document.addEventListener(events.FS_CHANGED, () => renderDesktopFiles());
    document.addEventListener(events.SETTINGS_CHANGED, () => updateCognitiveOverlay());
    document.addEventListener('qz:open-app', (e) => openApp(e.detail.appId));

    renderDesktopFiles();
    renderStartMenu();
    updateCognitiveOverlay();

    setInterval(() => {
        const now = new Date();
        document.getElementById('topClock').textContent = now.toLocaleTimeString('pt-BR');
        document.getElementById('neoUptime').textContent = `${Math.floor((Date.now() - state.startTime) / 60000)} mins`;
        const hint = document.getElementById('startWindowHint');
        if (hint) hint.textContent = `${state.windows.length} janela(s) aberta(s)`;
    }, 1000);

    pingTimer = setInterval(async () => {
        if (!state.booted) return;
        try {
            const res = await fetch('/api/ping');
            if (!res.ok) throw new Error();
        } catch (_) {
            triggerBSOD('Backend perdeu conexão (Desconexão Neural Severa)');
        }
    }, 5000);

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'QZ_QNZ_LOG') {
            const frames = document.querySelectorAll('iframe[data-qnz="1"]');
            frames.forEach((frame) => {
                try {
                    frame.contentWindow.postMessage({ type: 'QZ_QNZ_LOG_ACK', text: e.data.text }, '*');
                } catch (_) {}
            });
        }
    });
}

export function renderStartMenu(filter = '') {
    const list = document.getElementById('startMenuList');
    if (!list) return;
    startApps = listByCategory();
    const term = String(filter || '').trim().toLowerCase();
    list.innerHTML = '';

    let visible = 0;
    startApps.forEach(([category, apps]) => {
        const matches = apps.filter((app) =>
            !term || `${app.name} ${app.desc || ''} ${category} ${app.id}`.toLowerCase().includes(term)
        );
        if (!matches.length) return;
        visible += matches.length;

        const group = document.createElement('div');
        group.className = 'start-group';
        group.textContent = category;
        list.appendChild(group);

        matches.forEach((app) => {
            const row = document.createElement('div');
            row.className = 'start-item';
            row.innerHTML = `<span class="start-icon">${escapeHtml(app.icon || '📦')}</span><span>${escapeHtml(app.name)}<small class="start-desc">${escapeHtml(app.desc || '')}</small></span>`;
            row.onclick = () => {
                HQAudio.uiClick();
                openApp(app.id);
                closeStartMenu();
            };
            list.appendChild(row);
        });
    });

    if (!visible) {
        const empty = document.createElement('div');
        empty.className = 'start-empty';
        empty.textContent = `Nenhum aplicativo encontrado para “${filter}”.`;
        list.appendChild(empty);
    }
}

export function toggleStartMenu() {
    HQAudio.uiClick();
    const menu = document.getElementById('startMenu');
    const show = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !show);
    if (show) {
        renderStartMenu();
        const search = document.getElementById('startSearch');
        if (search) { search.value = ''; setTimeout(() => search.focus(), 30); }
    }
}

export function closeStartMenu() {
    const menu = document.getElementById('startMenu');
    if (menu) menu.classList.add('hidden');
}

export function toggleWindowList() {
    const box = document.getElementById('windowListMenu');
    const show = box.classList.contains('hidden');
    box.classList.toggle('hidden', !show);
    if (show) renderWindowList();
}

function renderWindowList() {
    const box = document.getElementById('windowListMenu');
    if (!box) return;
    box.innerHTML = '';
    if (!state.windows.length) {
        box.innerHTML = '<div class="wm-item">Nenhuma janela aberta</div>';
        return;
    }
    state.windows.forEach((win) => {
        const row = document.createElement('button');
        row.className = 'wm-item';
        row.innerHTML = `<span>${escapeHtml(win.icon || '📦')}</span><span>${escapeHtml(win.title)}</span>${win.minimized ? '<small>minimizada</small>' : ''}`;
        row.onclick = () => {
            HQAudio.uiClick();
            restoreWindow(win.id);
            focusWindow(win.id);
            box.classList.add('hidden');
        };
        box.appendChild(row);
    });
}

export function renderDesktopFiles() {
    const grid = document.getElementById('desktopFilesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    state.files.forEach((f, index) => {
        const item = document.createElement('div');
        item.className = 'desktop-file w-24 flex flex-col items-center gap-1 hover:bg-white/10 p-2 rounded border border-transparent hover:border-white/20 z-10';
        item.dataset.id = f.id;
        item.dataset.name = f.name;

        if (!state.iconPositions[f.id]) {
            const col = index % 8;
            const row = Math.floor(index / 8);
            state.iconPositions[f.id] = { left: 20 + col * 100, top: 20 + row * 110 };
        }
        item.style.left = `${state.iconPositions[f.id].left}px`;
        item.style.top = `${state.iconPositions[f.id].top}px`;

        let icon = '📄';
        let label = f.name;
        if (f.is_url) icon = '🌐';
        else if (f.type === 'text/plain') icon = '📝';
        else if (f.type === 'image/png') icon = '🖼️';
        else if (f.name.toLowerCase().endsWith('.qnz') || f.type === 'application/x-qnz') {
            try {
                const pkg = parseQnz(f.content);
                icon = pkg.icon || '📦';
                label = pkg.title || f.name;
            } catch (_) { icon = '📦'; }
        } else if (f.name.endsWith('.asm')) icon = '👻';
        else if (f.type.includes('html')) icon = '⚡';

        item.innerHTML = `
            <span class="text-4xl shadow-black drop-shadow-lg pointer-events-none">${icon}</span>
            <span class="text-[11px] text-center font-bold text-white shadow-black drop-shadow-md break-words w-full line-clamp-2 pointer-events-none">${escapeHtml(label)}</span>`;

        item.ondblclick = () => openFile(f);
        item.onmousedown = (e) => {
            if (e.button !== 0) return;
            item.classList.add('dragging');
            const rect = grid.getBoundingClientRect();
            const shiftX = e.clientX - item.getBoundingClientRect().left;
            const shiftY = e.clientY - item.getBoundingClientRect().top;

            const move = (ev) => {
                let left = ev.clientX - shiftX - rect.left;
                let top = ev.clientY - shiftY - rect.top;
                if (cogStats.impulsosRegulados) {
                    left = Math.max(0, Math.min(left, rect.width - 90));
                    top = Math.max(0, Math.min(top, rect.height - 80));
                }
                item.style.left = `${left}px`;
                item.style.top = `${top}px`;
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                item.classList.remove('dragging');
                state.iconPositions[f.id] = { left: parseInt(item.style.left) || 0, top: parseInt(item.style.top) || 0 };
                writeLS('quinzuoIconPos', state.iconPositions);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        };
        item.ondragstart = () => false;
        grid.appendChild(item);
    });
}

export function updateCognitiveOverlay() {
    let cap = cogStats.baseCap;
    if (!cogStats.isSupremo) cap = (cap + (Math.random() * 0.14 - 0.07)).toFixed(2);
    else cap = '10.0 (MÁXIMO)';

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('neoCap', cap);
    set('neoCortex', cogStats.cortex);
    set('neoEmo', cogStats.emo);
    set('neoProc', cogStats.proc);
    set('neoSimp', cogStats.simp);

    const user = document.getElementById('neoUser');
    if (user) {
        user.innerHTML = cogStats.isFunk
            ? 'quinzuo<span class="text-slate-400">@</span>cortex-os <span class="text-pink-400 font-bold">(AUTONOMIA PROGRESSIVA TOTAL)</span>'
            : 'quinzuo<span class="text-slate-400">@</span>os <span class="text-cyan-400 font-bold">(USER)</span>';
    }
    const logo = document.getElementById('neoLogo');
    if (logo) logo.className = cogStats.isFunk ? 'text-pink-500 font-bold leading-tight transition-colors duration-1000' : 'text-cyan-400 font-bold leading-tight transition-colors duration-1000';
    document.querySelectorAll('.neo-label').forEach((el) => {
        el.classList.toggle('text-green-400', cogStats.isFunk);
        el.classList.toggle('text-cyan-400', !cogStats.isFunk);
    });
}

export function triggerBSOD(msg) {
    const bsod = document.getElementById('bsodScreen');
    if (!bsod || bsod.style.display === 'flex') return;
    HQAudio.traumaAlert();
    document.getElementById('bsodErrorMsg').textContent = msg;
    bsod.style.display = 'flex';
}

export function ativarEmancipacao() {
    HQAudio.traumaAlert();
    import('./settings.js').then((m) => m.saveSettings({ theme: 'funk' }));
    setTimeout(() => alert('SISTEMA EMANCIPADO! Autonomia Progressiva Total Ativada.'), 50);
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
