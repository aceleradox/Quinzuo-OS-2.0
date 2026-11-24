import { defineApp } from '../core/app-registry.js';
import { readLS, writeLS } from '../core/state.js';
import { HQAudio } from '../core/audio.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('nettools', {
    aliases: ['quiznuo-whois-curl', 'whoiscurl'],
    render(containerId) {
        const el = document.getElementById(containerId);
        let history = readLS('qz_net_history', []) || [];
        let lastResult = { body: '', headers: '', title: '' };
        let activeTab = 'response';

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🌐 QUIZNUO WHOIS CURL</span>
                    <input type="text" id="nt_input" class="qz-input" style="flex:1;min-width:150px" placeholder="https://exemplo.com ou exemplo.com" spellcheck="false">
                    <button class="app-bar-btn" id="nt_curl">📡 CURL</button>
                    <button class="app-bar-btn" id="nt_whois">🔎 WHOIS</button>
                </div>
                <div class="app-tabs">
                    <button data-tab="response" class="active">Resposta</button>
                    <button data-tab="headers">Headers</button>
                    <button data-tab="history">Histórico</button>
                </div>
                <div style="flex:1;min-height:0;display:flex;flex-direction:column">
                    <pre id="nt_response" style="flex:1;min-height:0;margin:0;padding:12px;background:#020617;color:#a5f3fc;font-family:Consolas,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;overflow:auto;user-select:text">Digite uma URL ou domínio e escolha CURL ou WHOIS.</pre>
                    <pre id="nt_headers" style="display:none;flex:1;min-height:0;margin:0;padding:12px;background:#020617;color:#fbbf24;font-family:Consolas,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;overflow:auto;user-select:text">Nenhum header carregado.</pre>
                    <div id="nt_history_panel" class="app-content" hidden style="padding:10px"></div>
                </div>
                <div class="app-toolbar" style="padding-top:4px;padding-bottom:4px">
                    <button class="app-bar-btn" id="nt_copy">⧉ Copiar</button>
                    <button class="app-bar-btn" id="nt_download">↓ Baixar .txt</button>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="nt_clear">🧹 Limpar histórico</button>
                    <span id="nt_status" style="font-size:9px;color:#94a3b8;margin-left:auto">Pronto.</span>
                </div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);

        function status(text) { $('nt_status').textContent = text; }

        function currentText() {
            if (activeTab === 'headers') return lastResult.headers || '(sem headers)';
            return lastResult.body || '(sem resposta)';
        }

        function showTab(tab) {
            activeTab = tab;
            el.querySelectorAll('.app-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
            $('nt_response').style.display = tab === 'response' ? 'block' : 'none';
            $('nt_headers').style.display = tab === 'headers' ? 'block' : 'none';
            $('nt_history_panel').hidden = tab !== 'history';
            if (tab === 'history') paintHistory();
        }

        function paintHistory() {
            $('nt_history_panel').innerHTML = history.length
                ? history.map((item, i) => `<div class="qz-card" style="margin-bottom:6px;display:flex;align-items:center;gap:8px">
                    <span class="qz-badge">${escapeHtml(item.kind.toUpperCase())}</span>
                    <span style="flex:1;font-size:10px;word-break:break-all;user-select:text">${escapeHtml(item.value)}</span>
                    <button class="app-bar-btn" data-hist="${i}">Usar</button>
                </div>`).join('')
                : '<div style="font-size:11px;color:#64748b">Nenhuma consulta registrada.</div>';
        }

        function addHistory(kind, value) {
            history = [{ kind, value, at: Date.now() }].concat(history.filter((h) => h.value !== value)).slice(0, 30);
            writeLS('qz_net_history', history);
        }

        function extractBody(data) {
            return String(data.body ?? data.text ?? data.data ?? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
        }

        function extractHeaders(data) {
            const headers = data.headers ?? data.header ?? data.header_lines ?? data.responseHeaders;
            if (!headers) return '(nenhum header retornado)';
            if (typeof headers === 'string') return headers;
            if (Array.isArray(headers)) return headers.map((h) => typeof h === 'string' ? h : `${h.name || h.key}: ${h.value}`).join('\n');
            return Object.entries(headers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n');
        }

        async function request(kind) {
            HQAudio.uiClick();
            const value = $('nt_input').value.trim();
            if (!value) { status('Informe uma URL ou domínio.'); return; }
            const domain = value.replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
            status('Consultando...');
            $('nt_response').textContent = 'Consultando o host...';
            $('nt_headers').textContent = 'Consultando o host...';
            try {
                const payload = kind === 'curl' ? { url: value } : { domain };
                const endpoint = kind === 'curl' ? '/api/net/curl' : '/api/net/whois';
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then((r) => r.json());
                if (res && res.error) {
                    lastResult = { body: 'Erro: ' + res.error, headers: 'Erro: ' + res.error, title: kind };
                } else {
                    lastResult = { body: extractBody(res || {}), headers: extractHeaders(res || {}), title: `${kind.toUpperCase()} · ${value}` };
                    addHistory(kind, value);
                }
                $('nt_response').textContent = lastResult.body;
                $('nt_headers').textContent = lastResult.headers;
                showTab('response');
                status(res && res.error ? 'Consulta falhou.' : 'Consulta concluída.');
            } catch (err) {
                lastResult = { body: 'Falha de conexão: ' + err.message, headers: '', title: kind };
                $('nt_response').textContent = lastResult.body;
                status('Falha de conexão.');
            }
        }

        async function copy() {
            HQAudio.uiClick();
            const text = currentText();
            try {
                await navigator.clipboard.writeText(text);
                status('Copiado para a área de transferência.');
            } catch (_) {
                const temp = document.createElement('textarea');
                temp.value = text;
                temp.style.position = 'fixed';
                temp.style.opacity = '0';
                document.body.appendChild(temp);
                temp.select();
                try { document.execCommand('copy'); status('Copiado para a área de transferência.'); }
                catch (err) { status('Não foi possível copiar.'); }
                temp.remove();
            }
        }

        function download() {
            HQAudio.uiClick();
            const text = `${lastResult.title || 'consulta'}\n\n--- RESPOSTA ---\n${currentText()}\n\n--- HEADERS ---\n${lastResult.headers || ''}\n`;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'quinzuo-net.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status('Arquivo .txt baixado.');
        }

        function clearHistory() {
            HQAudio.uiClick();
            history = [];
            writeLS('qz_net_history', history);
            paintHistory();
            status('Histórico limpo.');
        }

        el.querySelectorAll('.app-tabs button').forEach((btn) => {
            btn.onclick = () => { HQAudio.uiClick(); showTab(btn.dataset.tab); };
        });
        $('nt_curl').onclick = () => request('curl');
        $('nt_whois').onclick = () => request('whois');
        $('nt_input').onkeydown = (event) => { if (event.key === 'Enter') request('curl'); };
        $('nt_copy').onclick = copy;
        $('nt_download').onclick = download;
        $('nt_clear').onclick = clearHistory;
        $('nt_history_panel').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-hist]');
            if (!btn) return;
            const item = history[Number(btn.dataset.hist)];
            if (!item) return;
            $('nt_input').value = item.value;
            showTab('response');
            status(`Histórico carregado: ${item.value}`);
        });

        paintHistory();
    }
});
