import { defineApp } from '../core/app-registry.js';
import { state, events } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { buildQnzHtml } from '../core/qnz.js';

defineApp('codehorn', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge" style="border-color:#f59e0b;color:#fde68a">📯 code horn</span>
                    <span class="text-[9px] text-slate-400">Editor de códigos-fonte web</span>
                    <div class="tool-sep"></div>
                    <input type="text" id="ch_find" class="qz-input" style="width:110px" placeholder="buscar...">
                    <button class="app-bar-btn" id="ch_search">🔎 Localizar</button>
                    <button class="app-bar-btn" id="ch_replace">🔁 Substituir</button>
                    <button class="app-bar-btn" id="ch_format">✨ Format</button>
                    <button class="app-bar-btn" id="ch_minify">📦 Minify</button>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="ch_preview">👁️ Preview</button>
                    <button class="app-bar-btn" id="ch_save">💾 Salvar</button>
                </div>
                <div style="display:flex;min-height:0;flex:1">
                    <div style="width:180px;border-right:1px solid #334155;background:#0b1220;display:flex;flex-direction:column">
                        <div class="qz-card-title" style="padding:8px">Arquivos do VHD</div>
                        <div id="ch_files" style="flex:1;overflow:auto;font-size:10px"></div>
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#111c33;border-bottom:1px solid #334155">
                            <input type="text" id="ch_name" class="qz-input" style="width:170px" value="novo.js">
                            <span class="text-[9px] text-slate-500" id="ch_info">—</span>
                        </div>
                        <div style="display:flex;flex:1;min-height:0">
                            <div id="ch_lines" class="qz-mono" style="width:42px;background:#020617;color:#475569;font-size:11px;text-align:right;padding:10px 6px;overflow:hidden;line-height:1.5"></div>
                            <textarea id="ch_code" class="code-editor" spellcheck="false" placeholder="// escreva aqui..."></textarea>
                        </div>
                        <iframe id="ch_frame" sandbox="allow-scripts allow-modals" style="display:none;width:100%;height:45%;border:0;background:white"></iframe>
                    </div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        let activeId = null;

        function renderFiles() {
            const list = state.files.filter((f) => !f.is_url);
            $('ch_files').innerHTML = list.map((f) => {
                const icon = f.name.endsWith('.html') ? '📄' : f.name.endsWith('.css') ? '🎨' : f.name.endsWith('.js') ? '⚡' : f.name.endsWith('.qnz') ? '📦' : '📝';
                return `<div class="ch-file px-2 py-1 cursor-pointer hover:bg-violet-900/30 ${activeId === f.id ? 'bg-violet-900/40' : ''}" data-id="${f.id}" title="${escapeAttr(f.name)}">${icon} ${escapeHtml(f.name)}</div>`;
            }).join('') || '<div class="p-2 text-slate-600">VHD vazio</div>';
            el.querySelectorAll('.ch-file').forEach((node) => {
                node.onclick = () => {
                    const f = state.files.find((x) => x.id === Number(node.dataset.id));
                    if (!f) return;
                    activeId = f.id;
                    $('ch_name').value = f.name;
                    $('ch_code').value = f.content;
                    updateLines();
                    $('ch_info').textContent = `${f.content.length} chars`;
                    HQAudio.uiClick();
                    renderFiles();
                };
            });
        }

        function updateLines() {
            const count = $('ch_code').value.split('\n').length;
            $('ch_lines').textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
            $('ch_lines').scrollTop = $('ch_code').scrollTop;
        }
        $('ch_code').onscroll = () => { $('ch_lines').scrollTop = $('ch_code').scrollTop; };
        $('ch_code').oninput = () => { updateLines(); $('ch_info').textContent = `${$('ch_code').value.length} chars`; };
        $('ch_code').onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const t = $('ch_code');
                const start = t.selectionStart;
                t.value = t.value.slice(0, start) + '  ' + t.value.slice(t.selectionEnd);
                t.selectionStart = t.selectionEnd = start + 2;
                updateLines();
            }
        };

        $('ch_search').onclick = () => {
            const term = $('ch_find').value;
            if (!term) return;
            const t = $('ch_code');
            const idx = t.value.toLowerCase().indexOf(term.toLowerCase(), t.selectionEnd);
            if (idx >= 0) { t.focus(); t.setSelectionRange(idx, idx + term.length); $('ch_info').textContent = `encontrado em ${idx}`; }
            else $('ch_info').textContent = 'não encontrado';
        };
        $('ch_replace').onclick = () => {
            const term = $('ch_find').value;
            if (!term) return;
            const replacement = prompt(`Substituir "${term}" por:`, '');
            if (replacement === null) return;
            $('ch_code').value = $('ch_code').value.split(term).join(replacement);
            updateLines();
        };
        $('ch_format').onclick = () => {
            const t = $('ch_code');
            t.value = t.value.split('\n').map((l) => l.trimEnd()).join('\n').replace(/}\s*else/g, '} else');
            updateLines();
            HQAudio.uiClick();
        };
        $('ch_minify').onclick = () => {
            $('ch_code').value = $('ch_code').value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
            updateLines();
        };
        $('ch_preview').onclick = () => {
            HQAudio.uiClick();
            const frame = $('ch_frame');
            frame.style.display = 'block';
            frame.srcdoc = buildQnzHtml({ html: $('ch_code').value, css: '', js: '' }, { bridge: false });
        };
        $('ch_save').onclick = async () => {
            HQAudio.uiClick();
            let name = $('ch_name').value || 'arquivo.txt';
            const content = $('ch_code').value;
            if (activeId) await BackendFS.updateFile(activeId, { name, content });
            else {
                const r = await BackendFS.saveFile(name, name.endsWith('.html') ? 'text/html' : 'text/plain', content, false);
                activeId = r && r.id;
            }
            renderFiles();
            $('ch_info').textContent = 'salvo no VHD';
        };

        document.addEventListener(events.FS_CHANGED, renderFiles);
        renderFiles();
        updateLines();
    }
});

function escapeHtml(text) { return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(text) { return escapeHtml(text); }
