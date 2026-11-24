import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('notepad', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const initialName = fileData && fileData.name ? String(fileData.name) : 'sem_titulo.txt';
        const initialContent = fileData && fileData.content !== undefined ? String(fileData.content) : '';
        let currentId = fileData && fileData.id ? fileData.id : null;

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">📝 BLOCO DE NOTAS</span>
                    <input type="text" id="np_name" class="qz-input" style="width:180px" value="${escapeHtml(initialName)}" spellcheck="false">
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="np_new">＋ Novo</button>
                    <button class="app-bar-btn" id="np_save">💾 Salvar no VHD</button>
                    <button class="app-bar-btn" id="np_download">↓ Baixar .txt</button>
                    <span id="np_count" style="font-size:10px;color:#94a3b8;margin-left:auto">0 linhas · 0 caracteres</span>
                </div>
                <div class="app-content" style="display:flex;min-height:0">
                    <textarea id="np_editor" class="code-editor" spellcheck="false" style="user-select:text;resize:none" placeholder="Escreva aqui...">${escapeHtml(initialContent)}</textarea>
                </div>
                <div class="app-log" id="np_status">${currentId ? `Arquivo aberto: ${escapeHtml(initialName)}` : 'Novo documento — não salvo.'}</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        const editor = $('np_editor');

        function status(text) {
            $('np_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function updateCount() {
            const text = editor.value;
            const lines = text.length ? text.split(/\r?\n/).length : 1;
            $('np_count').textContent = `${lines} linha(s) · ${text.length} caractere(s)`;
        }

        function fileName() {
            let name = $('np_name').value.trim() || 'sem_titulo';
            if (!/\.txt$/i.test(name)) name += '.txt';
            return name;
        }

        async function save() {
            HQAudio.uiClick();
            const name = fileName();
            $('np_name').value = name;
            if (currentId) {
                const result = await BackendFS.updateFile(currentId, { name, content: editor.value });
                status(result ? `"${name}" atualizado no VHD.` : `Falha ao atualizar "${name}".`);
            } else {
                const result = await BackendFS.saveFile(name, 'text/plain', editor.value, false);
                if (result && result.id) {
                    currentId = result.id;
                    status(`"${name}" criado no VHD.`);
                } else {
                    status(`Falha ao criar "${name}".`);
                }
            }
        }

        function newFile() {
            HQAudio.uiClick();
            currentId = null;
            $('np_name').value = 'sem_titulo.txt';
            editor.value = '';
            updateCount();
            editor.focus();
            status('Novo documento criado (ainda não salvo).');
        }

        function download() {
            HQAudio.uiClick();
            const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName();
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status('Download .txt iniciado.');
        }

        editor.addEventListener('input', updateCount);
        $('np_new').onclick = newFile;
        $('np_save').onclick = save;
        $('np_download').onclick = download;
        updateCount();
        setTimeout(() => editor.focus(), 60);
    }
});
