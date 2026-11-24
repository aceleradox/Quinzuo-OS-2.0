import { defineApp } from '../core/app-registry.js';
import { buildQnzHtml } from '../core/qnz.js';
import { HQAudio } from '../core/audio.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('browser', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const bookmarks = [
            { label: 'Quinzuo', url: (location.origin || 'http://localhost') + '/' },
            { label: 'MDN', url: 'https://developer.mozilla.org/pt-BR/' },
            { label: 'Google', url: 'https://www.google.com/' }
        ];

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🌐 NAVEGADOR / VIEW</span>
                    <button class="app-bar-btn" id="br_back" title="Voltar">◀</button>
                    <button class="app-bar-btn" id="br_forward" title="Avançar">▶</button>
                    <button class="app-bar-btn" id="br_reload" title="Recarregar">↻</button>
                    <input type="text" id="br_url" class="qz-input" style="flex:1;min-width:120px" placeholder="https://... ou arquivo.html" spellcheck="false" value="">
                    <button class="app-bar-btn" id="br_go">Ir</button>
                </div>
                <div class="app-toolbar" style="padding-top:4px;padding-bottom:4px">
                    <span style="font-size:9px;color:#64748b">Favoritos:</span>
                    ${bookmarks.map((bm, i) => `<button class="app-bar-btn" data-bookmark="${i}">${escapeHtml(bm.label)}</button>`).join('')}
                    <span id="br_label" style="font-size:9px;color:#94a3b8;margin-left:auto">Página inicial</span>
                </div>
                <div style="flex:1;min-height:0;background:#fff">
                    <iframe id="br_frame" data-qnz="1" class="qnz-preview-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
                </div>
                <div class="app-log" id="br_status" style="max-height:56px">Pronto.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        const frame = $('br_frame');
        const input = $('br_url');
        const entries = [{ type: 'home', value: '', label: 'Página inicial' }];
        let index = 0;

        function status(text) {
            $('br_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function renderEntry(entry) {
            if (!entry) return;
            $('br_label').textContent = entry.label;
            input.value = entry.value;
            if (entry.type === 'html' || entry.type === 'blocked' || entry.type === 'home') {
                frame.removeAttribute('src');
                frame.srcdoc = entry.srcdoc;
            } else {
                frame.removeAttribute('srcdoc');
                frame.src = entry.value;
            }
        }

        function makeEntry(raw) {
            const value = String(raw || '').trim();
            if (!value) return { type: 'home', value: '', label: 'Página inicial', srcdoc: homePage() };
            let parsed;
            try { parsed = new URL(value, location.href); }
            catch (_) { parsed = null; }
            if (!parsed || !/^https?:$/i.test(parsed.protocol)) {
                return {
                    type: 'blocked', value, label: 'Bloqueado: ' + value,
                    srcdoc: blockedPage(value)
                };
            }
            return { type: 'url', value: parsed.href, label: parsed.hostname };
        }

        function homePage() {
            if (fileData && fileData.content !== undefined && fileData.content !== null) {
                return buildQnzHtml({ html: String(fileData.content), css: '', js: '' }, { bridge: false });
            }
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quinzuo Browser</title>
                <style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
                b{color:#22d3ee;font-size:22px}p{color:#94a3b8;font-size:13px}</style></head>
                <body><div><b>🌐 Quinzuo Browser</b><p>Digite uma URL http(s) ou abra um arquivo HTML do VHD.</p></div></body></html>`;
        }

        function blockedPage(value) {
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acesso bloqueado</title>
                <style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:32px}h1{color:#f87171;font-size:20px}code{color:#22d3ee}</style></head>
                <body><h1>Endereço não permitido</h1><p>Somente URLs <b>http://</b> e <b>https://</b> são aceitas.</p>
                <p>Entrada: <code>${escapeHtml(value)}</code></p></body></html>`;
        }

        function navigate(raw, push = true) {
            const entry = makeEntry(raw);
            if (entry.type === 'url' && entry.value === (entries[index] || {}).value) {
                renderEntry(entry);
                return;
            }
            if (push) {
                entries.splice(index + 1);
                entries.push(entry);
                index = entries.length - 1;
            }
            renderEntry(entry);
            status(`Carregando: ${entry.label}`);
        }

        function go(delta) {
            const next = index + delta;
            if (next < 0 || next >= entries.length) return;
            index = next;
            renderEntry(entries[index]);
            status(`Histórico: ${entries[index].label}`);
        }

        $('br_go').onclick = () => { HQAudio.uiClick(); navigate(input.value); };
        input.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); navigate(input.value); } };
        $('br_back').onclick = () => { HQAudio.uiClick(); go(-1); };
        $('br_forward').onclick = () => { HQAudio.uiClick(); go(1); };
        $('br_reload').onclick = () => { HQAudio.uiClick(); renderEntry(entries[index]); status('Página recarregada.'); };
        el.querySelectorAll('[data-bookmark]').forEach((btn) => {
            btn.onclick = () => { HQAudio.uiClick(); navigate(bookmarks[Number(btn.dataset.bookmark)].url); };
        });

        if (fileData && fileData.name) $('br_label').textContent = fileData.name;
        entries[0].srcdoc = homePage();
        if (fileData && fileData.content !== undefined) input.value = fileData.name || '';
        renderEntry(entries[0]);
    }
});
