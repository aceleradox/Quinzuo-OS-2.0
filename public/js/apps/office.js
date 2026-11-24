import { defineApp } from '../core/app-registry.js';
import { state } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const TOOLS = [
    { id: 'word', icon: '📄', name: 'Quinzuo Word', desc: 'Documentos formatados (.html)' },
    { id: 'excel', icon: '📊', name: 'Quinzuo Excel', desc: 'Planilhas e fórmulas (.csv)' },
    { id: 'access', icon: '🗄️', name: 'Quinzuo Access', desc: 'Mini-banco de dados (.json)' },
    { id: 'notepad', icon: '📝', name: 'Bloco de Notas', desc: 'Texto simples (.txt)' },
    { id: 'browser', icon: '🌐', name: 'Navegador / View', desc: 'HTML e URLs http(s)' },
    { id: 'codehorn', icon: '📯', name: 'code horn', desc: 'Editor de código web' },
    { id: 'qnz-designer', icon: '🎛️', name: 'Designer .QNZ', desc: 'Crie apps QNZ' }
];

defineApp('office', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">💼 QUINZUO OFFICE</span>
                    <span style="font-size:10px;color:#94a3b8">Suíte de produtividade · VHD ${state.currentVHD}</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="of_new_txt">＋ Texto</button>
                    <button class="app-bar-btn" id="of_new_html">＋ Documento</button>
                    <button class="app-bar-btn" id="of_new_csv">＋ Planilha</button>
                </div>
                <div class="app-content">
                    <div class="icon-grid">
                        ${TOOLS.map((tool) => `<div class="icon-card" data-app="${tool.id}">
                            <span class="big">${tool.icon}</span>
                            <span class="lbl">${escapeHtml(tool.name)}</span>
                            <div style="font-size:9px;color:#64748b;margin-top:5px">${escapeHtml(tool.desc)}</div>
                        </div>`).join('')}
                    </div>
                    <div style="padding:0 12px 12px">
                        <div class="qz-card-title">Documentos recentes no VHD</div>
                        <div id="of_recent" style="display:flex;flex-wrap:wrap;gap:6px"></div>
                    </div>
                </div>
                <div class="app-log" id="of_status" style="max-height:52px">Selecione um aplicativo para começar.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);

        function status(text) {
            $('of_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function paintRecent() {
            const files = (state.files || []).filter((f) => /\.(txt|html?|csv|json)$/i.test(String(f.name || ''))).slice(0, 8);
            $('of_recent').innerHTML = files.length
                ? files.map((f) => `<button class="app-bar-btn" data-file-id="${escapeHtml(f.id)}">${escapeHtml(f.name)}</button>`).join('')
                : '<span style="font-size:10px;color:#64748b">Nenhum documento salvo nesta partição.</span>';
        }

        async function create(name, type, content, appId) {
            HQAudio.uiClick();
            const result = await BackendFS.saveFile(name, type, content, false);
            if (!result || !result.id) { status(`Falha ao criar "${name}".`); return; }
            const file = (state.files || []).find((f) => String(f.id) === String(result.id));
            status(`"${name}" criado no VHD.`);
            paintRecent();
            if (file) openApp(appId, file);
        }

        el.querySelector('.icon-grid').addEventListener('click', (event) => {
            const card = event.target.closest('[data-app]');
            if (!card) return;
            HQAudio.uiClick();
            openApp(card.dataset.app);
            status(`Abrindo ${card.dataset.app}...`);
        });
        $('of_recent').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-file-id]');
            if (!btn) return;
            const file = (state.files || []).find((f) => String(f.id) === btn.dataset.fileId);
            if (!file) return;
            HQAudio.uiClick();
            const appId = /\.csv$/i.test(file.name) ? 'excel' : /\.json$/i.test(file.name) ? 'access' : /\.html?$/i.test(file.name) ? 'word' : 'notepad';
            openApp(appId, file);
            status(`Abrindo "${file.name}" no ${appId}.`);
        });
        $('of_new_txt').onclick = () => create('sem_titulo.txt', 'text/plain', '', 'notepad');
        $('of_new_html').onclick = () => create('documento.html', 'text/html', '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>', 'word');
        $('of_new_csv').onclick = () => create('planilha.csv', 'text/csv', '', 'excel');

        BackendFS.fetchAll();
        paintRecent();
    }
});
