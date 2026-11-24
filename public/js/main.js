/**
 * Quinzuo OS Static 5.8 — ponto de entrada.
 * Todos os módulos são arquivos separados; aqui apenas ligamos as peças.
 */
import './apps/index.js';

import { state, cogStats, events } from './core/state.js';
import { HQAudio } from './core/audio.js';
import { BackendFS } from './core/fs.js';
import { Dock } from './core/dock.js';
import { initContextMenu } from './core/context-menu.js';
import { initSystem, applySetup, showSetup, startBootSequence } from './core/boot.js';
import { initDesktop, triggerBSOD, ativarEmancipacao, updateCognitiveOverlay } from './core/desktop.js';
import { openApp, closeWindow, minimizeWindow, toggleMaximize, restoreWindow, focusWindow, closeAllWindows } from './core/window-manager.js';
import { listApps } from './core/app-registry.js';
import { getSettings } from './core/settings.js';
import { PrefrontalFramework } from './core/prefrontal-framework.js';
import { QuinzetaDB } from './core/quinzeta-db.js';

// Compatibilidade com código inline e apps antigos
Object.assign(window, {
    Quinzuo: state,
    cogStats,
    APPS: listApps(),
    HQAudio,
    BackendFS,
    openApp,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    restoreWindow,
    focusWindow,
    closeAllWindows,
    triggerBSOD,
    ativarEmancipacao,
    applySetup,
    showSetup,
    startBootSequence,
    updateCognitiveOverlay,
    getSettings,
    PrefrontalFramework,
    QuinzetaDB
});

document.addEventListener('qz:open-app', (e) => openApp(e.detail.appId));

/**
 * Monitor de trauma cognitivo:
 * qualquer erro de JavaScript, promise rejeitada ou console.error exibido no
 * console dispara o BSOD "TRAUMA COGNITIVO SINALIZADO" com a mensagem do erro.
 * Assim, se o ✕ / − / □ ou outro clique falhar, o sistema mostra o erro na tela.
 */
const consoleErrorOriginal = console.error.bind(console);
let traumaReportInProgress = false;

function reportTrauma(source, detail) {
    if (traumaReportInProgress) return;
    traumaReportInProgress = true;
    const text = `${source}: ${String(detail || 'erro desconhecido')}`.slice(0, 1200);
    try { consoleErrorOriginal('[Quinzuo OS] TRAUMA COGNITIVO SINALIZADO:', text); } catch (_) {}
    try { triggerBSOD(text); } catch (err) {
        try { consoleErrorOriginal('[Quinzuo OS] falha ao abrir BSOD:', err); } catch (_) {}
    }
    setTimeout(() => { traumaReportInProgress = false; }, 40);
}

console.error = (...args) => {
    consoleErrorOriginal(...args);
    reportTrauma('console.error', args.map((a) => (a && a.stack) || a).join(' '));
};

window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) {
        const src = e.target.src || e.target.href || e.target.nodeName;
        reportTrauma('recurso', `falha ao carregar ${src}`);
        return;
    }
    const err = e.error || {};
    reportTrauma('javascript', `${e.message || 'erro'}${err.stack ? '\n' + err.stack : ''}`);
});

window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason && (e.reason.stack || e.reason.message) ? (e.reason.stack || e.reason.message) : e.reason;
    reportTrauma('promise', reason);
});

PrefrontalFramework.init();

Dock.init();
initContextMenu();
initSystem();

/** Carrega apps nativos .app.js criados pelo QNZ Builder e salvos no VHD. */
const nativeAppsLoaded = new Set();
async function loadNativeApps() {
    const files = (state.files || []).filter((f) => /\.app\.js$/i.test(String(f.name || '')));
    for (const file of files) {
        if (nativeAppsLoaded.has(file.id)) continue;
        nativeAppsLoaded.add(file.id);
        try {
            const blob = new Blob([String(file.content || '')], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            await import(/* webpackIgnore: true */ url);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.warn(`[App nativo] falha ao carregar ${file.name}:`, err.message);
        }
    }
    window.APPS = listApps();
    import('./core/desktop.js').then((m) => m.renderStartMenu()).catch(() => {});
}
window.addEventListener('qz:boot-complete', loadNativeApps);

window.dispatchEvent(new CustomEvent('qz:core-ready'));
