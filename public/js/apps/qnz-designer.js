import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';
import { parseQnz, serializeQnz, buildQnzHtml, installQnzToDock } from '../core/qnz.js';

defineApp('qnz-designer', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const pkg = parseQnz(fileData ? fileData.content : '');
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🎛️ Designer .QNZ</span>
                    <input type="text" id="qzd_file" class="qz-input" style="width:140px" value="${escapeAttr(fileData ? fileData.name : 'novo_app.qnz')}" placeholder="app.qnz">
                    <button class="app-bar-btn" id="qzd_preview">👁️ Pré-visualizar</button>
                    <button class="app-bar-btn" id="qzd_save">💾 Salvar no VHD</button>
                    <button class="app-bar-btn" id="qzd_install">⚓ Salvar + Instalar no Dock</button>
                    <button class="app-bar-btn" id="qzd_run">▶ Executar</button>
                </div>
                <div class="qnz-designer-grid">
                    <div class="qnz-designer-meta">
                        <div class="qz-card-title">Design do aplicativo</div>
                        <label class="qz-field"><span>Título</span><input id="qzd_title" value="${escapeAttr(pkg.title)}"></label>
                        <div style="display:flex;gap:8px">
                            <label class="qz-field" style="flex:1"><span>Ícone (emoji)</span><input id="qzd_icon" value="${escapeAttr(pkg.icon)}" maxlength="4"></label>
                            <label class="qz-field" style="flex:1"><span>Estilo do Dock</span><select id="qzd_dockstyle">
                                <option value="glass" ${pkg.theme.dockStyle === 'glass' ? 'selected' : ''}>Vidro</option>
                                <option value="neon" ${pkg.theme.dockStyle === 'neon' ? 'selected' : ''}>Neon</option>
                                <option value="solid" ${pkg.theme.dockStyle === 'solid' ? 'selected' : ''}>Sólido</option>
                            </select></label>
                        </div>
                        <div style="display:flex;gap:8px">
                            <label class="qz-field" style="flex:1"><span>Primária</span><input type="color" id="qzd_primary" value="${pkg.theme.primary}"></label>
                            <label class="qz-field" style="flex:1"><span>Secundária</span><input type="color" id="qzd_cyan" value="${pkg.theme.cyan}"></label>
                            <label class="qz-field" style="flex:1"><span>Fundo</span><input type="color" id="qzd_bg" value="${pkg.theme.background}"></label>
                        </div>
                        <div style="display:flex;gap:8px">
                            <label class="qz-field" style="flex:1"><span>Largura</span><input type="number" id="qzd_w" value="${pkg.window.width}"></label>
                            <label class="qz-field" style="flex:1"><span>Altura</span><input type="number" id="qzd_h" value="${pkg.window.height}"></label>
                        </div>
                        <label class="qz-field"><span>Descrição</span><input id="qzd_desc" value="${escapeAttr(pkg.description)}"></label>
                        <div class="qz-card" style="margin-top:auto">
                            <div class="qz-card-title">Dica</div>
                            <p class="text-[10px] text-slate-400">O .QNZ é um pacote JSON com HTML, CSS e JS. Ele roda em janela com seu próprio ícone e estilo no Dock. Use o <b>codeneta</b> para injetar código nele em tempo real.</p>
                        </div>
                    </div>
                    <div class="qnz-designer-code">
                        <div class="app-tabs">
                            <button data-tab="html" class="active">HTML</button>
                            <button data-tab="css">CSS</button>
                            <button data-tab="js">JavaScript</button>
                            <button data-tab="preview">Preview</button>
                        </div>
                        <div class="app-content" style="position:relative">
                            <div id="qzd_pane_code" style="height:100%"><textarea id="qzd_code" class="code-editor" spellcheck="false"></textarea></div>
                            <div id="qzd_pane_preview" style="height:100%;display:none;background:white"><iframe id="qzd_frame" data-qnz="1" class="qnz-preview-frame" sandbox="allow-scripts allow-modals allow-popups"></iframe></div>
                        </div>
                    </div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const sources = { html: pkg.html, css: pkg.css, js: pkg.js };
        let current = 'html';
        $('qzd_code').value = sources.html;

        el.querySelectorAll('.app-tabs button').forEach((btn) => {
            btn.onclick = () => {
                sources[current] = $('qzd_code').value;
                current = btn.dataset.tab;
                el.querySelectorAll('.app-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                const preview = current === 'preview';
                $('qzd_pane_code').style.display = preview ? 'none' : 'block';
                $('qzd_pane_preview').style.display = preview ? 'block' : 'none';
                if (preview) updatePreview(); else $('qzd_code').value = sources[current];
            };
        });

        function collect() {
            sources[current] = $('qzd_code').value;
            return serializeQnz({
                format: 'qnz', version: 1,
                title: $('qzd_title').value || 'App QNZ',
                name: $('qzd_file').value || 'app.qnz',
                icon: $('qzd_icon').value || '⚡',
                description: $('qzd_desc').value,
                theme: { primary: $('qzd_primary').value, cyan: $('qzd_cyan').value, background: $('qzd_bg').value, dockStyle: $('qzd_dockstyle').value },
                window: { width: Number($('qzd_w').value) || 720, height: Number($('qzd_h').value) || 500 },
                ...sources
            });
        }

        function updatePreview() {
            $('qzd_frame').srcdoc = buildQnzHtml(JSON.parse(collect()));
        }

        async function save() {
            let name = $('qzd_file').value || 'app.qnz';
            if (!name.endsWith('.qnz')) name += '.qnz';
            const content = collect();
            let id = fileData && fileData.id;
            if (id) await BackendFS.updateFile(id, { name, content, isUrl: false });
            else {
                const result = await BackendFS.saveFile(name, 'application/x-qnz', content, false);
                id = result && result.id;
            }
            return { id, name };
        }

        $('qzd_preview').onclick = () => { HQAudio.uiClick(); updatePreview(); };
        $('qzd_save').onclick = async () => {
            HQAudio.uiClick();
            await save();
            alert('Aplicativo .QNZ salvo no VHD!');
        };
        $('qzd_install').onclick = async () => {
            HQAudio.uiClick();
            const { id, name } = await save();
            if (!id) { alert('Falha ao salvar no VHD.'); return; }
            const p = JSON.parse($('qzd_code').value ? collect() : collect());
            installQnzToDock({ fileId: id, name, icon: p.icon, label: p.title });
            alert(`"${p.title}" instalado no Dock!`);
        };
        $('qzd_run').onclick = () => {
            HQAudio.uiClick();
            openApp('qnz-runner', { name: $('qzd_file').value, content: collect() });
        };
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
