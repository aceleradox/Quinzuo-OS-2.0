import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sanitizeHtml(raw) {
    const text = String(raw ?? '');
    if (!/<[a-z!/]/i.test(text)) return escapeHtml(text);
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        doc.querySelectorAll('script,iframe,object,embed,link,meta,style,form').forEach((node) => node.remove());
        doc.querySelectorAll('*').forEach((node) => {
            Array.from(node.attributes || []).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || '').trim().toLowerCase();
                if (name.startsWith('on') || name === 'srcdoc' || ((name === 'href' || name === 'src') && /^javascript:/i.test(value))) {
                    node.removeAttribute(attr.name);
                }
            });
        });
        return doc.body ? doc.body.innerHTML : escapeHtml(text);
    } catch (_) { return escapeHtml(text); }
}

defineApp('word', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const initialName = fileData && fileData.name ? String(fileData.name) : 'documento.html';
        let currentId = fileData && fileData.id ? fileData.id : null;

        el.innerHTML = `
            <style>
                #wd_editor { user-select: text; -webkit-user-select: text; min-height: 260px; outline: none; line-height: 1.6; }
                #wd_editor:empty::before { content: 'Comece a escrever...'; color: #64748b; }
                #wd_editor ul, #wd_editor ol { padding-left: 24px; }
            </style>
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">📄 QUINZUO WORD</span>
                    <input type="text" id="wd_name" class="qz-input" style="width:150px" value="${escapeHtml(initialName)}" spellcheck="false">
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" data-cmd="bold" title="Negrito"><b>B</b></button>
                    <button class="app-bar-btn" data-cmd="italic" title="Itálico"><i>I</i></button>
                    <button class="app-bar-btn" data-cmd="underline" title="Sublinhado"><u>U</u></button>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" data-cmd="insertUnorderedList">• Lista</button>
                    <button class="app-bar-btn" data-cmd="insertOrderedList">1. Lista</button>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" data-cmd="justifyLeft">⬅</button>
                    <button class="app-bar-btn" data-cmd="justifyCenter">↔</button>
                    <button class="app-bar-btn" data-cmd="justifyRight">➡</button>
                    <div class="tool-sep"></div>
                    <input type="color" id="wd_color" value="#e2e8f0" title="Cor do texto">
                    <select id="wd_size" title="Tamanho">
                        <option value="2">Pequeno</option>
                        <option value="3" selected>Normal</option>
                        <option value="4">Médio</option>
                        <option value="5">Grande</option>
                        <option value="6">Título</option>
                    </select>
                    <select id="wd_block" title="Estilo de parágrafo">
                        <option value="p">Parágrafo</option>
                        <option value="h1">Título 1</option>
                        <option value="h2">Título 2</option>
                        <option value="h3">Título 3</option>
                    </select>
                </div>
                <div class="app-toolbar" style="padding-top:4px;padding-bottom:4px">
                    <button class="app-bar-btn" id="wd_new">＋ Novo</button>
                    <button class="app-bar-btn" id="wd_save">💾 Salvar .html</button>
                    <button class="app-bar-btn" id="wd_download">↓ Baixar .html</button>
                    <span style="font-size:9px;color:#64748b;margin-left:auto">Formatação via document.execCommand</span>
                </div>
                <div class="app-content" style="background:#f8fafc;display:flex;justify-content:center">
                    <div id="wd_editor" contenteditable="true" spellcheck="true"
                        style="width:min(100%,720px);min-height:100%;background:#fff;color:#0f172a;padding:26px 32px">${fileData && fileData.content !== undefined ? sanitizeHtml(fileData.content) : ''}</div>
                </div>
                <div class="app-log" id="wd_status" style="max-height:52px">${currentId ? `Aberto: ${escapeHtml(initialName)}` : 'Novo documento.'}</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        const editor = $('wd_editor');

        function status(text) {
            $('wd_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function run(cmd, value) {
            editor.focus();
            try { document.execCommand('styleWithCSS', false, true); } catch (_) { /* opcional */ }
            document.execCommand(cmd, false, value);
            HQAudio.uiClick();
        }

        function fileName() {
            let name = $('wd_name').value.trim() || 'documento';
            if (!/\.html?$/i.test(name)) name += '.html';
            return name;
        }

        function buildDocument() {
            const title = fileName().replace(/\.html?$/i, '');
            return `<!DOCTYPE html>\n<html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head><body>\n${editor.innerHTML}\n</body></html>`;
        }

        async function save() {
            HQAudio.uiClick();
            const name = fileName();
            $('wd_name').value = name;
            const html = buildDocument();
            if (currentId) {
                const result = await BackendFS.updateFile(currentId, { name, content: html });
                status(result ? `"${name}" salvo no VHD.` : `Falha ao salvar "${name}".`);
            } else {
                const result = await BackendFS.saveFile(name, 'text/html', html, false);
                if (result && result.id) { currentId = result.id; status(`"${name}" criado no VHD.`); }
                else status(`Falha ao criar "${name}".`);
            }
        }

        function download() {
            HQAudio.uiClick();
            const blob = new Blob([buildDocument()], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName();
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status('Download .html iniciado.');
        }

        function newDocument() {
            HQAudio.uiClick();
            currentId = null;
            $('wd_name').value = 'documento.html';
            editor.innerHTML = '';
            editor.focus();
            status('Novo documento em branco.');
        }

        el.querySelectorAll('[data-cmd]').forEach((btn) => {
            btn.onclick = () => run(btn.dataset.cmd);
        });
        $('wd_color').oninput = (event) => run('foreColor', event.target.value);
        $('wd_size').onchange = (event) => run('fontSize', event.target.value);
        $('wd_block').onchange = (event) => run('formatBlock', event.target.value);
        $('wd_save').onclick = save;
        $('wd_download').onclick = download;
        $('wd_new').onclick = newDocument;
        setTimeout(() => editor.focus(), 60);
    }
});
