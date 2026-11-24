import { defineApp } from '../core/app-registry.js';
import { state, events, writeLS } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';
import { getSettings } from '../core/settings.js';
import { parseQnz } from '../core/qnz.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('floppy', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">💾 PARTIÇÕES VHD</span>
                    <b id="flp_vhd" style="font-size:11px">VHD ${state.currentVHD}</b>
                    <button class="app-bar-btn" id="flp_prev" title="Partição anterior">◀</button>
                    <button class="app-bar-btn" id="flp_next" title="Próxima partição">▶</button>
                    <button class="app-bar-btn" id="flp_new">＋ Nova partição</button>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="flp_upload">⬆ Enviar arquivo</button>
                    <input type="file" id="flp_file" hidden>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="flp_refresh">↻ Atualizar</button>
                </div>
                <div class="app-tabs">
                    <button data-tab="files" class="active">📁 Arquivos</button>
                    <button data-tab="flops">📦 FLOPs</button>
                </div>
                <div class="app-content" id="flp_files_panel">
                    <div id="flp_rename_box" style="display:none;gap:6px;align-items:center;padding:10px 12px;border-bottom:1px solid #334155">
                        <span style="font-size:10px;color:#94a3b8">Renomear:</span>
                        <input class="qz-input" id="flp_rename_input" style="flex:1;min-width:100px" spellcheck="false">
                        <button class="qz-btn qz-btn-sm qz-btn-success" id="flp_rename_ok">OK</button>
                        <button class="qz-btn qz-btn-sm qz-btn-ghost" id="flp_rename_cancel">Cancelar</button>
                    </div>
                    <div class="icon-grid" id="flp_list"></div>
                </div>
                <div class="app-content" id="flp_flops_panel" hidden>
                    <div id="flp_flops_list" class="qz-store" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px;padding:10px"></div>
                </div>
                <div class="app-log" id="flp_status">Pronto. Partição montada: VHD ${state.currentVHD}.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        let currentTab = 'files';
        let renameId = null;

        function status(text) {
            const box = $('flp_status');
            box.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function fileInfo(file) {
            const name = String(file.name || 'sem_nome');
            let icon = '📄';
            let label = name;
            if (/\.qnz$/i.test(name)) {
                try {
                    const pkg = parseQnz(file.content);
                    icon = pkg.icon || '⚡';
                    label = pkg.title || name;
                } catch (_) { /* mantém valores padrão */ }
            } else if (/html?$/i.test(String(file.type)) || /\.html?$/i.test(name)) icon = '🌐';
            else if (/text\/|txt$/i.test(String(file.type)) || /\.txt$/i.test(name)) icon = '📝';
            else if (/json$/i.test(String(file.type)) || /\.json$/i.test(name)) icon = '🗄️';
            return { icon, label };
        }

        function paintFiles() {
            const files = Array.isArray(state.files) ? state.files.slice() : [];
            $('flp_vhd').textContent = `VHD ${state.currentVHD} / ${state.totalVHDs} · ${files.length} arquivo(s)`;
            const list = $('flp_list');
            if (!files.length) {
                list.innerHTML = '<div class="qz-card" style="margin:12px;font-size:11px;color:#94a3b8">Partição vazia. Use “Enviar arquivo” ou instale um FLOP.</div>';
                return;
            }
            list.innerHTML = files.map((file) => {
                const info = fileInfo(file);
                const id = escapeHtml(file.id);
                return `<div class="icon-card" data-file-id="${id}">
                    <span class="big">${escapeHtml(info.icon)}</span>
                    <span class="lbl">${escapeHtml(info.label)}</span>
                    <span style="display:block;font-size:9px;color:#64748b;margin-top:3px">${escapeHtml(file.name)} · ${escapeHtml(file.type || '—')}</span>
                    <div style="display:flex;gap:3px;justify-content:center;flex-wrap:wrap;margin-top:7px">
                        <button class="qz-btn qz-btn-sm qz-btn-primary" data-act="open">Abrir</button>
                        <button class="qz-btn qz-btn-sm qz-btn-ghost" data-act="rename">Renomear</button>
                        <button class="qz-btn qz-btn-sm qz-btn-ghost" data-act="download">↓</button>
                        <button class="qz-btn qz-btn-sm qz-btn-danger" data-act="trash">✖</button>
                    </div>
                </div>`;
            }).join('');
        }

        async function paintFlops() {
            const box = $('flp_flops_list');
            box.innerHTML = '<div style="font-size:10px;color:#94a3b8">Carregando catálogo FLOP...</div>';
            const flops = await BackendFS.listFlops();
            if (!Array.isArray(flops) || !flops.length) {
                box.innerHTML = '<div class="qz-card" style="font-size:11px;color:#94a3b8">Nenhum FLOP disponível no catálogo.</div>';
                return;
            }
            box.innerHTML = flops.map((flop) => `<div class="qz-card">
                <div class="qz-card-title">${escapeHtml(flop.icon || '💾')} ${escapeHtml(flop.name || flop.id)}</div>
                <div style="font-size:10px;color:#cbd5e1;min-height:32px">${escapeHtml(flop.description || 'Pacote removível')}</div>
                <div style="font-size:9px;color:#64748b;margin:5px 0">v${escapeHtml(flop.version || '1.0')} · ${escapeHtml(flop.author || 'Quinzuo Labs')}</div>
                <button class="qz-btn qz-btn-sm qz-btn-success" data-flop-id="${escapeHtml(flop.id)}">Instalar no VHD ${state.currentVHD}</button>
            </div>`).join('');
        }

        function setTab(tab) {
            currentTab = tab;
            el.querySelectorAll('.app-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
            $('flp_files_panel').hidden = tab !== 'files';
            $('flp_flops_panel').hidden = tab !== 'flops';
            if (tab === 'flops') paintFlops();
        }

        function findFile(id) {
            return (state.files || []).find((f) => String(f.id) === String(id));
        }

        function downloadFile(file) {
            const blob = new Blob([String(file.content ?? '')], { type: file.type || 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name || 'arquivo.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status(`Download iniciado: ${file.name}`);
        }

        async function onListClick(event) {
            const btn = event.target.closest('button[data-act]');
            if (!btn) return;
            const card = event.target.closest('[data-file-id]');
            const file = card && findFile(card.dataset.fileId);
            if (!file) return;
            HQAudio.uiClick();
            const act = btn.dataset.act;
            if (act === 'open') {
                openApp(/javascript/i.test(file.type) ? 'codenate' : (/qnz$/i.test(file.name) ? 'qnz-runner' : 'browser'), file);
                status(`Abrindo ${file.name}...`);
            } else if (act === 'download') {
                downloadFile(file);
            } else if (act === 'rename') {
                renameId = file.id;
                $('flp_rename_input').value = file.name;
                $('flp_rename_box').style.display = 'flex';
                $('flp_rename_input').focus();
                $('flp_rename_input').select();
            } else if (act === 'trash') {
                await BackendFS.trashFile(file.id);
                status(`"${file.name}" movido para a lixeira.`);
            }
        }

        async function onRenameConfirm() {
            const name = $('flp_rename_input').value.trim();
            if (!renameId || !name) { status('Nome inválido.'); return; }
            await BackendFS.renameFile(renameId, name);
            $('flp_rename_box').style.display = 'none';
            renameId = null;
            status(`Arquivo renomeado para "${name}".`);
        }

        function onRenameCancel() {
            $('flp_rename_box').style.display = 'none';
            renameId = null;
        }

        function setVHD(next) {
            state.currentVHD = Math.min(state.totalVHDs, Math.max(1, next));
            status(`Partição atual: VHD ${state.currentVHD}.`);
            BackendFS.fetchAll();
            paintFiles();
        }

        function createVHD() {
            if (getSettings().implanol) {
                status('Criação bloqueada: Modo Implanol Virtual ativo.');
                return;
            }
            if (state.totalVHDs >= 4) { status('Limite máximo de 4 partições atingido.'); return; }
            state.totalVHDs += 1;
            writeLS('qz_vhds', state.totalVHDs);
            state.currentVHD = state.totalVHDs;
            status(`VHD ${state.currentVHD} criado e montado.`);
            BackendFS.fetchAll();
            paintFiles();
        }

        function onUploadChange(event) {
            const input = event.target;
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const result = await BackendFS.saveFile(file.name, file.type || 'application/octet-stream', String(reader.result || ''), false);
                status(result ? `Arquivo "${file.name}" gravado no VHD ${state.currentVHD}.` : `Falha ao gravar "${file.name}".`);
                paintFiles();
            };
            reader.onerror = () => status(`Não foi possível ler "${file.name}".`);
            reader.readAsText(file);
            input.value = '';
        }

        async function onFlopsClick(event) {
            const btn = event.target.closest('button[data-flop-id]');
            if (!btn) return;
            HQAudio.uiClick();
            status(`Instalando FLOP ${btn.dataset.flopId}...`);
            const result = await BackendFS.installFlop(btn.dataset.flopId);
            status(result && result.error ? `Falha: ${result.error}` : `FLOP instalado no VHD ${state.currentVHD}.`);
            paintFiles();
        }

        function onFsChanged() {
            if (!document.body.contains(el)) {
                document.removeEventListener(events.FS_CHANGED, onFsChanged);
                return;
            }
            paintFiles();
        }

        el.querySelectorAll('.app-tabs button').forEach((b) => { b.onclick = () => { HQAudio.uiClick(); setTab(b.dataset.tab); }; });
        $('flp_list').addEventListener('click', onListClick);
        $('flp_flops_list').addEventListener('click', onFlopsClick);
        $('flp_rename_ok').onclick = onRenameConfirm;
        $('flp_rename_cancel').onclick = onRenameCancel;
        $('flp_rename_input').onkeydown = (e) => { if (e.key === 'Enter') onRenameConfirm(); if (e.key === 'Escape') onRenameCancel(); };
        $('flp_prev').onclick = () => setVHD(state.currentVHD - 1);
        $('flp_next').onclick = () => setVHD(state.currentVHD + 1);
        $('flp_new').onclick = createVHD;
        $('flp_upload').onclick = () => { HQAudio.uiClick(); $('flp_file').click(); };
        $('flp_file').addEventListener('change', onUploadChange);
        $('flp_refresh').onclick = () => { HQAudio.uiClick(); BackendFS.fetchAll(); paintFiles(); status('Lista atualizada.'); };
        document.addEventListener(events.FS_CHANGED, onFsChanged);

        BackendFS.fetchAll();
        paintFiles();
    }
});
