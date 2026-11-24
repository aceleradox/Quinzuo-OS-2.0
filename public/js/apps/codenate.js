import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';
import { parseQnz, serializeQnz, buildQnzHtml } from '../core/qnz.js';

const DEFAULT_HTML = `<!DOCTYPE html>
<html><body>
  <h1>Olá, Quinzuo!</h1>
  <p>Edite e clique em Testar.</p>
</body></html>`;
const DEFAULT_CSS = `body { background:#111827; color:#22d3ee; font-family:system-ui; padding:20px; }`;
const DEFAULT_JS = `console.log('codenate pronto');`;

defineApp('codenate', {
    aliases: ['jseditor'],
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const isQnz = fileData && (fileData.name.toLowerCase().endsWith('.qnz') || fileData.type === 'application/x-qnz');
        const pkg = isQnz ? parseQnz(fileData.content) : null;
        let html = pkg ? pkg.html : (fileData ? fileData.content : DEFAULT_HTML);
        let css = pkg ? pkg.css : DEFAULT_CSS;
        let js = pkg ? pkg.js : DEFAULT_JS;
        let current = 'html';
        if (fileData && !isQnz && fileData.name.endsWith('.css')) { css = fileData.content; current = 'css'; }
        if (fileData && !isQnz && fileData.name.endsWith('.js')) { js = fileData.content; current = 'js'; }

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">⚡ codenate</span>
                    <input type="text" id="cn_name" class="qz-input" style="width:150px" value="${escapeAttr(fileData ? fileData.name : 'app.html')}">
                    <button class="app-bar-btn" id="cn_run">▶ Testar</button>
                    <button class="app-bar-btn" id="cn_save_html">💾 Salvar HTML</button>
                    <button class="app-bar-btn" id="cn_save_qnz">📦 Salvar .QNZ</button>
                    <button class="app-bar-btn" id="cn_design">🎛️ Designer</button>
                    <div class="tool-sep"></div>
                    <span class="text-[9px] text-slate-500" id="cn_status">Pronto</span>
                </div>
                <div style="display:flex;flex-direction:column;min-height:0;flex:1">
                    <div class="app-tabs">
                        <button data-tab="html" class="active">HTML</button>
                        <button data-tab="css">CSS</button>
                        <button data-tab="js">JavaScript</button>
                    </div>
                    <div class="app-split">
                        <div style="width:50%;border-right:1px solid #334155;display:flex;flex-direction:column">
                            <textarea id="cn_code" class="code-editor" spellcheck="false">${escapeHtml(html)}</textarea>
                        </div>
                        <div style="width:50%;position:relative;background:white">
                            <iframe id="cn_preview" class="qnz-preview-frame" sandbox="allow-scripts allow-modals allow-popups" title="preview"></iframe>
                        </div>
                    </div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const code = $('cn_code');
        const sources = { html, css, js };
        code.value = sources[current];
        el.querySelectorAll('.app-tabs button').forEach((btn) => {
            btn.onclick = () => {
                sources[current] = code.value;
                current = btn.dataset.tab;
                code.value = sources[current];
                el.querySelectorAll('.app-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
            };
        });

        function collect() {
            sources[current] = code.value;
            return { ...sources };
        }
        function preview() {
            const src = collect();
            const full = src.html.toLowerCase().includes('<html')
                ? src.html.replace(/<\/head>/i, `<style>${src.css.replace(/<\/style/gi, '<\\/style')}</style></head>`)
                      .replace(/<\/body>/i, `<script>${src.js.replace(/<\/script/gi, '<\\/script')}<\/script></body>`)
                : buildQnzHtml({ html: src.html, css: src.css, js: src.js }, { bridge: false });
            $('cn_preview').srcdoc = full;
            $('cn_status').textContent = 'Pré-visualização atualizada';
        }
        function pkgFromEditor() {
            const src = collect();
            return serializeQnz({
                format: 'qnz', version: 1,
                title: $('cn_name').value.replace(/\.(html|qnz)$/i, ''),
                name: $('cn_name').value,
                icon: '⚡',
                html: src.html, css: src.css, js: src.js
            });
        }

        $('cn_run').onclick = () => { HQAudio.uiClick(); preview(); };
        $('cn_save_html').onclick = async () => {
            HQAudio.uiClick();
            const src = collect();
            const full = src.html.toLowerCase().includes('<html') ? src.html : buildQnzHtml({ ...src }, { bridge: false });
            let name = $('cn_name').value || 'app.html';
            if (!name.endsWith('.html')) name += '.html';
            if (fileData) await BackendFS.updateFile(fileData.id, { name, content: full, isUrl: false });
            else await BackendFS.saveFile(name, 'text/html', full, false);
            $('cn_status').textContent = `Salvo: ${name}`;
        };
        $('cn_save_qnz').onclick = async () => {
            HQAudio.uiClick();
            let name = $('cn_name').value || 'app.qnz';
            if (!name.endsWith('.qnz')) name = name.replace(/\.[^.]+$/, '') + '.qnz';
            const content = pkgFromEditor();
            if (fileData) await BackendFS.updateFile(fileData.id, { name, content, isUrl: false });
            else await BackendFS.saveFile(name, 'application/x-qnz', content, false);
            $('cn_status').textContent = `Salvo: ${name}`;
        };
        $('cn_design').onclick = () => {
            HQAudio.uiClick();
            openApp('qnz-designer', { name: $('cn_name').value, content: pkgFromEditor() });
        };

        preview();
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
