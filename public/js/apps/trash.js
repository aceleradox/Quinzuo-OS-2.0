import { defineApp } from '../core/app-registry.js';
import { state } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('trash', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🗑️ LIXEIRA NEURAL · VHD ${state.currentVHD}</span>
                    <span id="tr_count" style="font-size:10px;color:#94a3b8">0 item(ns)</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="tr_refresh">↻ Atualizar</button>
                    <button class="app-bar-btn" id="tr_empty">🧹 Esvaziar lixeira</button>
                </div>
                <div class="app-content" id="tr_list"></div>
                <div class="app-log" id="tr_status">Lixeira pronta.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        let items = [];

        function status(text) {
            $('tr_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function paint() {
            $('tr_count').textContent = `${items.length} item(ns)`;
            if (!items.length) {
                $('tr_list').innerHTML = '<div class="qz-card" style="margin:12px;font-size:11px;color:#94a3b8">Nada descartado nesta partição. A memória está limpa.</div>';
                return;
            }
            $('tr_list').innerHTML = items.map((file) => `<div class="qz-card" style="margin:10px 12px" data-trash-id="${escapeHtml(file.id)}">
                <div class="qz-card-title">📄 ${escapeHtml(file.name || 'sem_nome')}</div>
                <div style="font-size:10px;color:#94a3b8;word-break:break-all">${escapeHtml(String(file.content ?? '').slice(0, 140))}${String(file.content ?? '').length > 140 ? '…' : ''}</div>
                <div style="font-size:9px;color:#64748b;margin:6px 0">ID ${escapeHtml(file.id)} · ${escapeHtml(file.type || '—')} · VHD ${escapeHtml(file.partition_id ?? state.currentVHD)}</div>
                <div style="display:flex;gap:6px">
                    <button class="qz-btn qz-btn-sm qz-btn-success" data-act="restore">♻ Restaurar</button>
                    <button class="qz-btn qz-btn-sm qz-btn-danger" data-act="delete">🗑 Excluir definitivamente</button>
                </div>
            </div>`).join('');
        }

        async function refresh() {
            items = await BackendFS.getTrash();
            paint();
        }

        async function onClick(event) {
            const btn = event.target.closest('button[data-act]');
            if (!btn) return;
            const card = event.target.closest('[data-trash-id]');
            const item = card && items.find((f) => String(f.id) === card.dataset.trashId);
            if (!item) return;
            HQAudio.uiClick();
            if (btn.dataset.act === 'restore') {
                await BackendFS.restoreFile(item.id);
                status(`"${item.name}" restaurado para o VHD.`);
            } else {
                await BackendFS.hardDelete(item.id);
                status(`"${item.name}" excluído definitivamente.`);
            }
            await refresh();
        }

        async function emptyTrash() {
            HQAudio.uiClick();
            if (!items.length) { status('A lixeira já está vazia.'); return; }
            const total = items.length;
            for (const item of items.slice()) {
                await BackendFS.hardDelete(item.id);
            }
            status(`${total} item(ns) removidos permanentemente.`);
            await refresh();
        }

        $('tr_list').addEventListener('click', onClick);
        $('tr_refresh').onclick = () => { HQAudio.uiClick(); refresh(); status('Lixeira atualizada.'); };
        $('tr_empty').onclick = emptyTrash;

        refresh();
    }
});
