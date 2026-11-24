import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { state } from '../core/state.js';

defineApp('codeneta', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge" style="background:rgba(236,72,153,.2);border-color:#ec4899;color:#fbcfe8">💉 codeneta</span>
                    <select id="cnet_target">
                        <option value="active">Janela .QNZ ativa</option>
                        <option value="all">Todas as janelas .QNZ</option>
                        <option value="desktop">Área de trabalho (local)</option>
                    </select>
                    <input type="text" id="cnet_name" class="qz-input" style="width:140px" value="${escapeAttr(fileData ? fileData.name : 'inject.js')}">
                    <button class="app-bar-btn" id="cnet_inject">💉 Injetar</button>
                    <button class="app-bar-btn" id="cnet_save">💾 Salvar snippet</button>
                    <button class="app-bar-btn" id="cnet_clear">Limpar log</button>
                </div>
                <div class="app-split">
                    <div style="width:55%;border-right:1px solid #334155;display:flex;flex-direction:column">
                        <div class="app-tabs"><button class="active">JavaScript</button></div>
                        <textarea id="cnet_code" class="code-editor dark" spellcheck="false" placeholder="// Código injetado...">${escapeHtml(fileData ? fileData.content : "console.log('codeneta conectado');")}</textarea>
                    </div>
                    <div style="width:45%;display:flex;flex-direction:column;background:#020617">
                        <div class="qz-card-title" style="padding:8px">Alvos disponíveis</div>
                        <div id="cnet_targets" class="text-[10px] text-slate-400" style="padding:0 8px 8px"></div>
                        <div class="app-log" id="cnet_log" style="flex:1;max-height:none;border-top:1px solid #334155">// aguardando injeção...</div>
                    </div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const log = (text) => { $('cnet_log').textContent += `\n${text}`; $('cnet_log').scrollTop = 1e9; };

        function frames() {
            return [...document.querySelectorAll('iframe[data-qnz="1"]')];
        }
        function refreshTargets() {
            const list = frames();
            $('cnet_targets').innerHTML = list.length
                ? list.map((f, i) => `• iframe[${i}] — ${f.dataset.qnzTitle || 'app.qnz'}`).join('<br>')
                : 'Nenhuma janela .QNZ aberta. Abra uma pelo Designer .QNZ.';
        }
        const timer = setInterval(refreshTargets, 1000);
        refreshTargets();

        $('cnet_inject').onclick = () => {
            HQAudio.uiClick();
            const code = $('cnet_code').value;
            const target = $('cnet_target').value;
            if (target === 'desktop') {
                try {
                    const result = new Function('Quinzuo', 'cogStats', 'codeneta', code)(state, state, { log });
                    log(`[desktop] executado. retorno: ${String(result ?? '')}`);
                } catch (err) { log(`[desktop] ERRO: ${err.message}`); }
                return;
            }
            const list = target === 'all' ? frames() : frames().slice(-1);
            list.forEach((frame, i) => {
                frame.contentWindow.postMessage({ type: 'QZ_INJECT', code }, '*');
                log(`[iframe ${i}] código enviado (${code.length} chars)`);
            });
            if (!list.length) log('[!] Nenhum iframe .QNZ disponível.');
        };

        $('cnet_save').onclick = async () => {
            HQAudio.uiClick();
            let name = $('cnet_name').value || 'inject.js';
            if (!name.endsWith('.js')) name += '.js';
            const f = state.files.find((x) => x.name === name);
            if (f) await BackendFS.updateFile(f.id, { content: $('cnet_code').value });
            else await BackendFS.saveFile(name, 'text/javascript', $('cnet_code').value, false);
            log(`[VHD] snippet salvo: ${name}`);
        };
        $('cnet_clear').onclick = () => { $('cnet_log').textContent = '// log limpo'; };

        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'QZ_QNZ_LOG') log(`[qnz] ${e.data.level}: ${e.data.text}`);
        });

        // Limpa o intervalo quando a janela é fechada
        const win = el.closest('.window');
        if (win) {
            const observer = new MutationObserver(() => {
                if (!document.body.contains(win)) { clearInterval(timer); observer.disconnect(); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
