import { defineApp } from '../core/app-registry.js';
import { state } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { QuinzetaDB } from '../core/quinzeta-db.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('access', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        let sequence = 1;
        let currentId = fileData && fileData.id ? fileData.id : null;

        function newRow(values = []) {
            return { id: 'r' + (sequence++), values: values.slice() };
        }

        function normalize(data) {
            const columns = Array.isArray(data && data.columns) && data.columns.length
                ? data.columns.map((c) => String(c))
                : ['Nome', 'Email', 'Idade'];
            const source = Array.isArray(data && data.rows) ? data.rows : [];
            const rows = source.map((row) => {
                const values = Array.isArray(row && row.values) ? row.values : [];
                return newRow(columns.map((_, i) => String(values[i] ?? '')));
            });
            return { columns, rows };
        }

        let db = { columns: ['Nome', 'Email', 'Idade'], rows: [newRow(['', '', ''])] };
        if (fileData && fileData.content) {
            try { db = normalize(JSON.parse(String(fileData.content))); }
            catch (_) { /* mantém tabela padrão */ }
        }

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🗄️ QUINZUO ACCESS</span>
                    <input type="text" id="ac_name" class="qz-input" style="width:150px" value="${fileData && fileData.name ? escapeHtml(fileData.name) : 'banco.json'}" spellcheck="false">
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="ac_add_row">＋ Registro</button>
                    <button class="app-bar-btn" id="ac_add_col">＋ Coluna</button>
                    <button class="app-bar-btn" id="ac_save">💾 Salvar JSON</button>
                    <button class="app-bar-btn" id="ac_download">↓ Baixar</button>
                </div>
                <div class="app-toolbar" style="padding-top:4px;padding-bottom:4px">
                    <span style="font-size:9px;color:#64748b">Filtrar:</span>
                    <input type="text" id="ac_search" class="qz-input" style="width:180px" placeholder="buscar em todos os campos">
                    <select id="ac_files" style="background:#020617;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:4px;font-size:10px">
                        <option value="">Abrir JSON do VHD...</option>
                    </select>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="ac_db_save" title="Salvar no Quinzeta DB">🗄️ DB</button>
                    <select id="ac_db_tables" style="background:#020617;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:4px;font-size:10px">
                        <option value="">Abrir do Quinzeta DB...</option>
                    </select>
                    <span id="ac_count" style="font-size:9px;color:#94a3b8;margin-left:auto">0 registro(s)</span>
                </div>
                <div class="app-content" style="padding:10px">
                    <table style="width:100%;border-collapse:collapse;font-size:11px">
                        <thead id="ac_head"></thead>
                        <tbody id="ac_rows"></tbody>
                    </table>
                </div>
                <div class="app-log" id="ac_status" style="max-height:52px">Banco pronto. Colunas padrão: Nome, Email, Idade.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);

        function status(text) {
            $('ac_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function paintHead() {
            $('ac_head').innerHTML = `<tr>${db.columns.map((col, i) => `<th style="border:1px solid #334155;padding:5px;background:#1e293b;text-align:left">
                    <div style="display:flex;gap:3px;align-items:center">
                        <input class="qz-input" data-col="${i}" value="${escapeHtml(col)}" style="width:100%;min-width:80px;font-size:10px;padding:4px 6px">
                        <button class="app-bar-btn" data-del-col="${i}" title="Remover coluna">✖</button>
                    </div></th>`).join('')}<th style="border:1px solid #334155;padding:5px;background:#1e293b">Ações</th></tr>`;
        }

        function paintRows() {
            const query = $('ac_search').value.trim().toLowerCase();
            const rows = db.rows.filter((row) => !query || row.values.some((v) => String(v).toLowerCase().includes(query)));
            $('ac_count').textContent = `${rows.length} registro(s)`;
            $('ac_rows').innerHTML = rows.map((row) => `<tr data-row-id="${escapeHtml(row.id)}">
                ${db.columns.map((_, i) => `<td style="border:1px solid #334155;padding:3px">
                    <input class="qz-input" data-cell="${escapeHtml(row.id)}:${i}" value="${escapeHtml(row.values[i] ?? '')}" style="width:100%;min-width:80px;font-size:11px;padding:4px 6px;user-select:text">
                </td>`).join('')}
                <td style="border:1px solid #334155;padding:3px;text-align:center">
                    <button class="qz-btn qz-btn-sm qz-btn-danger" data-del-row="${escapeHtml(row.id)}">Excluir</button>
                </td></tr>`).join('') || `<tr><td colspan="${db.columns.length + 1}" style="padding:14px;text-align:center;color:#64748b">Nenhum registro encontrado.</td></tr>`;
        }

        function paintFiles() {
            const files = (state.files || []).filter((f) => /\.json$/i.test(String(f.name || '')) || /json/i.test(String(f.type || '')));
            $('ac_files').innerHTML = '<option value="">Abrir JSON do VHD...</option>' + files.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('');
        }

        function dbPayload() {
            return { columns: db.columns, rows: db.rows.map((r) => ({ id: r.id, values: r.values })) };
        }

        function paintDbTables() {
            const enabled = QuinzetaDB.isEnabled();
            $('ac_db_save').style.display = enabled ? '' : 'none';
            $('ac_db_tables').style.display = enabled ? '' : 'none';
            const tables = enabled ? QuinzetaDB.list() : [];
            $('ac_db_tables').innerHTML = '<option value="">Abrir do Quinzeta DB...</option>' +
                tables.map((t) => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} · ${escapeHtml(t.type)}</option>`).join('');
        }

        function saveToQuinzeta() {
            HQAudio.uiClick();
            const name = $('ac_name').value.trim() || 'banco';
            const result = QuinzetaDB.saveDatabase(name, dbPayload());
            status(result && result.error ? result.error : `Banco enviado ao Quinzeta DB: ${result.name}`);
            paintDbTables();
        }

        function openFromQuinzeta() {
            const name = $('ac_db_tables').value;
            if (!name) return;
            const table = QuinzetaDB.getTable(name);
            if (!table) { status('Tabela não encontrada no Quinzeta DB.'); return; }
            if (table.type !== 'json') { status('Esta tabela é uma planilha CSV. Abra no Quinzuo Excel.'); return; }
            try {
                db = normalize(JSON.parse(table.content));
                currentId = null;
                $('ac_name').value = table.name;
                paintHead();
                paintRows();
                status(`Banco "${table.name}" carregado do Quinzeta DB.`);
            } catch (_) { status('Banco inválido no Quinzeta DB.'); }
        }

        function addRow() {
            HQAudio.uiClick();
            db.rows.push(newRow(db.columns.map(() => '')));
            paintRows();
            status('Registro adicionado.');
        }

        function addColumn() {
            HQAudio.uiClick();
            db.columns.push('Nova coluna');
            db.rows.forEach((row) => row.values.push(''));
            paintHead();
            paintRows();
            status('Coluna adicionada. Renomeie o cabeçalho.');
        }

        async function save() {
            HQAudio.uiClick();
            const name = ($('ac_name').value.trim() || 'banco') + '';
            const fileName = /\.json$/i.test(name) ? name : name + '.json';
            $('ac_name').value = fileName;
            const json = JSON.stringify({ columns: db.columns, rows: db.rows.map((r) => ({ id: r.id, values: r.values })) }, null, 2);
            if (currentId) {
                const result = await BackendFS.updateFile(currentId, { name: fileName, content: json });
                status(result ? `"${fileName}" atualizado no VHD.` : `Falha ao salvar "${fileName}".`);
            } else {
                const result = await BackendFS.saveFile(fileName, 'application/json', json, false);
                if (result && result.id) { currentId = result.id; status(`"${fileName}" criado no VHD.`); }
                else status(`Falha ao criar "${fileName}".`);
            }
            paintFiles();
            if (QuinzetaDB.isEnabled()) {
                const dbResult = QuinzetaDB.saveDatabase(fileName, dbPayload());
                status(dbResult && dbResult.error ? dbResult.error : `"${fileName}" também salvo no Quinzeta DB.`);
                paintDbTables();
            }
        }

        function download() {
            HQAudio.uiClick();
            const json = JSON.stringify({ columns: db.columns, rows: db.rows }, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = ($('ac_name').value.trim() || 'banco.json');
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status('Download .json iniciado.');
        }

        $('ac_head').addEventListener('input', (event) => {
            const input = event.target.closest('[data-col]');
            if (!input) return;
            db.columns[Number(input.dataset.col)] = input.value;
        });
        $('ac_head').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-del-col]');
            if (!btn) return;
            if (db.columns.length <= 1) { status('É necessário manter ao menos uma coluna.'); return; }
            const idx = Number(btn.dataset.delCol);
            db.columns.splice(idx, 1);
            db.rows.forEach((row) => row.values.splice(idx, 1));
            paintHead();
            paintRows();
            status('Coluna removida.');
        });
        $('ac_rows').addEventListener('input', (event) => {
            const input = event.target.closest('[data-cell]');
            if (!input) return;
            const parts = input.dataset.cell.split(':');
            const row = db.rows.find((r) => r.id === parts[0]);
            if (row) row.values[Number(parts[1])] = input.value;
        });
        $('ac_rows').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-del-row]');
            if (!btn) return;
            HQAudio.uiClick();
            db.rows = db.rows.filter((r) => r.id !== btn.dataset.delRow);
            paintRows();
            status('Registro excluído.');
        });
        $('ac_search').addEventListener('input', paintRows);
        $('ac_files').addEventListener('change', () => {
            const id = $('ac_files').value;
            if (!id) return;
            const file = (state.files || []).find((f) => String(f.id) === id);
            if (!file) return;
            try {
                db = normalize(JSON.parse(String(file.content)));
                currentId = file.id;
                $('ac_name').value = file.name;
                paintHead();
                paintRows();
                status(`Banco "${file.name}" carregado do VHD.`);
            } catch (_) { status('Arquivo JSON inválido.'); }
        });
        $('ac_add_row').onclick = addRow;
        $('ac_add_col').onclick = addColumn;
        $('ac_save').onclick = save;
        $('ac_download').onclick = download;
        $('ac_db_save').onclick = saveToQuinzeta;
        $('ac_db_tables').addEventListener('change', openFromQuinzeta);

        paintHead();
        paintRows();
        paintFiles();
        paintDbTables();
    }
});
