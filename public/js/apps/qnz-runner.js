import { defineApp } from '../core/app-registry.js';
import { parseQnz, buildQnzHtml, installQnzToDock, getInstalledQnz, uninstallQnzFromDock } from '../core/qnz.js';
import { HQAudio } from '../core/audio.js';
import { BackendFS } from '../core/fs.js';
import { openApp } from '../core/window-manager.js';

defineApp('qnz-runner', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        if (!fileData) {
            el.innerHTML = `<div class="p-6 text-xs text-slate-400">Abra um arquivo <b>.qnz</b> pela área de trabalho ou pelo Partições (VHD).</div>`;
            return;
        }
        const pkg = parseQnz(fileData.content);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge" style="border-color:var(--quinzuo-cyan)">📦 .QNZ</span>
                    <b class="text-[11px]">${escapeHtml(pkg.icon)} ${escapeHtml(pkg.title)}</b>
                    <span class="text-[9px] text-slate-500">${escapeHtml(fileData.name)} · ${pkg.window.width}×${pkg.window.height}</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="qzr_reload">↻ Recarregar</button>
                    <button class="app-bar-btn" id="qzr_design">🎛️ Designer</button>
                    <button class="app-bar-btn" id="qzr_dock">⚓ Instalar no Dock</button>
                    ${getInstalledQnz().some((i) => String(i.fileId) === String(fileData.id)) ? '<button class="app-bar-btn" id="qzr_undock">⚓ Remover do Dock</button>' : ''}
                </div>
                <div style="flex:1;min-height:0;background:white">
                    <iframe id="qzr_frame" data-qnz="1" data-qnz-title="${escapeAttr(pkg.title)}"
                        class="qnz-preview-frame" sandbox="allow-scripts allow-modals allow-popups allow-forms"></iframe>
                </div>
                <div class="app-log" id="qzr_log" style="max-height:80px">// console do aplicativo .QNZ</div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const frame = $('qzr_frame');
        frame.srcdoc = buildQnzHtml(pkg);

        function logLine(text) {
            const log = $('qzr_log');
            if (!log || !document.body.contains(log)) return;
            log.textContent += `\n${text}`;
            log.scrollTop = log.scrollHeight;
        }

        const onMessage = async (e) => {
            if (!e.data || typeof e.data !== 'object') return;
            if (e.source && frame.contentWindow && e.source !== frame.contentWindow) return;
            if (!document.body.contains(el)) return;

            if (e.data.type === 'QZ_QNZ_LOG') {
                logLine(`[${e.data.level || 'log'}] ${e.data.text ?? ''}`);
                return;
            }

            if (e.data.type === 'QZ_SAVE_FILE') {
                const name = String(e.data.name || 'arquivo.qnz').slice(0, 120);
                const type = String(e.data.type || 'text/plain').slice(0, 80);
                const content = typeof e.data.content === 'string' ? e.data.content.slice(0, 20000000) : '';
                const result = await BackendFS.saveFile(name, type, content, false);
                logLine(`[VHD] ${result ? 'salvo' : 'falha ao salvar'}: ${name}`);
                if (e.source) e.source.postMessage({ type: 'QZ_SAVE_FILE_RESULT', id: e.data.id, ok: !!result, result }, '*');
                return;
            }

            if (e.data.type === 'QZ_NET_REQUEST') {
                const id = e.data.id;
                const kind = e.data.kind === 'whois' ? 'whois' : 'curl';
                const value = String(e.data.value || '').slice(0, 2000);
                try {
                    const res = await fetch(`/api/net/${kind}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(kind === 'whois' ? { domain: value } : { url: value })
                    });
                    const data = await res.json();
                    logLine(`[net] ${kind} ${value} → ${data.error ? 'erro' : 'ok'}`);
                    if (e.source) e.source.postMessage({ type: 'QZ_NET_RESPONSE', id, ok: !data.error, data }, '*');
                } catch (err) {
                    if (e.source) e.source.postMessage({ type: 'QZ_NET_RESPONSE', id, ok: false, data: { error: err.message } }, '*');
                }
                return;
            }

            if (e.data.type === 'QZ_OPEN_APP' && typeof e.data.appId === 'string') {
                HQAudio.uiClick();
                openApp(e.data.appId);
                logLine(`[OS] abrindo ${e.data.appId}`);
            }
        };
        window.addEventListener('message', onMessage);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(el)) {
                window.removeEventListener('message', onMessage);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        $('qzr_reload').onclick = () => { HQAudio.uiClick(); frame.srcdoc = buildQnzHtml(pkg); };
        $('qzr_design').onclick = () => { HQAudio.uiClick(); openApp('qnz-designer', fileData); };
        $('qzr_dock').onclick = () => {
            HQAudio.uiClick();
            installQnzToDock({ fileId: fileData.id, name: fileData.name, icon: pkg.icon, label: pkg.title });
            alert(`"${pkg.title}" instalado no Dock!`);
        };
        const undock = $('qzr_undock');
        if (undock) undock.onclick = () => { HQAudio.uiClick(); uninstallQnzFromDock(fileData.id); alert('Removido do Dock.'); };
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
