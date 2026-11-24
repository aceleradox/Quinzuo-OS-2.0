import { defineApp } from '../core/app-registry.js';
import { state } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { QuinzetaDB } from '../core/quinzeta-db.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ROWS = 12;
const COLS = 8;

function colName(index) {
    return String.fromCharCode(65 + index);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const source = String(text ?? '');
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"') {
                if (source[i + 1] === '"') { field += '"'; i += 1; }
                else quoted = false;
            } else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch !== '\r') field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
}

function csvField(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

defineApp('excel', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const cells = Object.create(null);
        const evaluating = new Set();
        let currentId = fileData && fileData.id ? fileData.id : null;
        let selected = 'A1';

        function ref(row, col) { return colName(col) + (row + 1); }

        function numeric(value) {
            const n = Number(String(value).replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
        }

        function evaluateFormula(source) {
            let expr = String(source);
            expr = expr.replace(/SUM\(\s*([A-H])(10|11|12|[1-9])\s*:\s*([A-H])(10|11|12|[1-9])\s*\)/gi, (all, c1, r1, c2, r2) => {
                const a = c1.toUpperCase().charCodeAt(0) - 65;
                const b = c2.toUpperCase().charCodeAt(0) - 65;
                const lo = Math.min(Number(r1), Number(r2));
                const hi = Math.max(Number(r1), Number(r2));
                let sum = 0;
                for (let col = Math.min(a, b); col <= Math.max(a, b); col += 1) {
                    for (let row = lo; row <= hi; row += 1) sum += numeric(evaluateCell(colName(col) + row));
                }
                return String(sum);
            });
            expr = expr.replace(/(^|[^A-Za-z0-9_])\$?([A-H])\$?(10|11|12|[1-9])\b/gi, (all, prefix, col, row) => prefix + String(numeric(evaluateCell(col.toUpperCase() + row))));
            if (!/^[0-9+\-*/(). %eE]+$/.test(expr)) return '#ERRO';
            try {
                const result = Function('"use strict"; return (' + expr + ')')();
                if (!Number.isFinite(result)) return '#ERRO';
                return String(Math.round(result * 10000) / 10000);
            } catch (_) { return '#ERRO'; }
        }

        function evaluateCell(key) {
            const raw = String(cells[key] ?? '');
            if (!/^=/.test(raw)) return raw;
            if (evaluating.has(key)) return '#CICLO';
            evaluating.add(key);
            try { return evaluateFormula(raw.slice(1)); }
            finally { evaluating.delete(key); }
        }

        function display(key) { return evaluateCell(key); }

        function cellElement(key) { return el.querySelector(`[data-cell="${key}"]`); }

        function recalcAll() {
            for (let row = 0; row < ROWS; row += 1) {
                for (let col = 0; col < COLS; col += 1) {
                    const key = ref(row, col);
                    const cell = cellElement(key);
                    if (cell && document.activeElement !== cell) cell.textContent = display(key);
                }
            }
        }

        function selectCell(key) {
            if (!cellElement(key)) return;
            selected = key;
            el.querySelectorAll('[data-cell]').forEach((c) => c.classList.toggle('active', c.dataset.cell === key));
            el.querySelector('#xl_cell').textContent = key;
            const cell = cellElement(key);
            cell.textContent = String(cells[key] ?? '');
            el.querySelector('#xl_formula').value = String(cells[key] ?? '');
            cell.focus();
        }

        function buildGrid() {
            const header = `<tr><th style="width:44px;background:#1e293b;border:1px solid #334155"></th>${Array.from({ length: COLS }, (_, c) => `<th style="background:#1e293b;border:1px solid #334155;color:#22d3ee;font-size:10px">${colName(c)}</th>`).join('')}</tr>`;
            const body = Array.from({ length: ROWS }, (_, r) => `<tr>
                <td style="background:#1e293b;border:1px solid #334155;color:#94a3b8;font-size:10px;text-align:center">${r + 1}</td>
                ${Array.from({ length: COLS }, (_, c) => `<td data-cell="${ref(r, c)}" contenteditable="true" spellcheck="false"
                    style="border:1px solid #334155;min-width:82px;height:24px;padding:3px 5px;font-size:11px;user-select:text;outline:none;white-space:nowrap"></td>`).join('')}
            </tr>`).join('');
            el.querySelector('#xl_grid').innerHTML = `<table style="border-collapse:collapse;width:100%;background:#0f172a">${header}${body}</table>`;
        }

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">📊 QUINZUO EXCEL</span>
                    <input type="text" id="xl_name" class="qz-input" style="width:150px" value="${fileData && fileData.name ? escapeHtml(fileData.name) : 'planilha.csv'}" spellcheck="false">
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="xl_save">💾 Salvar CSV</button>
                    <button class="app-bar-btn" id="xl_download">↓ Baixar CSV</button>
                    <button class="app-bar-btn" id="xl_recalc">↻ Recalcular</button>
                    <select id="xl_files" style="background:#020617;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:4px;font-size:10px">
                        <option value="">Abrir CSV do VHD...</option>
                    </select>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="xl_db_save" title="Salvar no Quinzeta DB">🗄️ DB</button>
                    <select id="xl_db_tables" style="background:#020617;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:4px;font-size:10px">
                        <option value="">Abrir do Quinzeta DB...</option>
                    </select>
                </div>
                <div class="app-toolbar" style="padding-top:4px;padding-bottom:4px">
                    <span id="xl_cell" style="font-size:10px;color:#22d3ee;min-width:38px">A1</span>
                    <span style="font-size:9px;color:#64748b">fx</span>
                    <input type="text" id="xl_formula" class="qz-input" style="flex:1" placeholder="=SUM(A1:A3) ou =A1+B1" spellcheck="false">
                    <span style="font-size:9px;color:#64748b">12×8 · setas navegam</span>
                </div>
                <div class="app-content" id="xl_grid"></div>
                <div class="app-log" id="xl_status" style="max-height:52px">Pronto. Use =SUM(A1:A3) ou =A1+B1.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);

        function status(text) { $('xl_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`; }

        function loadRows(rows) {
            Object.keys(cells).forEach((key) => delete cells[key]);
            rows.slice(0, ROWS).forEach((row, r) => {
                row.slice(0, COLS).forEach((value, c) => { cells[ref(r, c)] = String(value ?? ''); });
            });
            buildGrid();
            for (let row = 0; row < ROWS; row += 1) {
                for (let col = 0; col < COLS; col += 1) {
                    const key = ref(row, col);
                    const cell = cellElement(key);
                    if (cell) cell.textContent = display(key);
                }
            }
            selectCell('A1');
        }

        function toCsv() {
            const rows = [];
            for (let r = 0; r < ROWS; r += 1) {
                const line = [];
                for (let c = 0; c < COLS; c += 1) line.push(csvField(cells[ref(r, c)] ?? ''));
                rows.push(line.join(','));
            }
            return rows.join('\n');
        }

        function fileName() {
            const name = $('xl_name').value.trim() || 'planilha';
            const finalName = /\.csv$/i.test(name) ? name : name + '.csv';
            $('xl_name').value = finalName;
            return finalName;
        }

        async function save() {
            HQAudio.uiClick();
            const name = fileName();
            if (currentId) {
                const result = await BackendFS.updateFile(currentId, { name, content: toCsv() });
                status(result ? `"${name}" salvo no VHD.` : `Falha ao salvar "${name}".`);
            } else {
                const result = await BackendFS.saveFile(name, 'text/csv', toCsv(), false);
                if (result && result.id) { currentId = result.id; status(`"${name}" criado no VHD.`); }
                else status(`Falha ao criar "${name}".`);
            }
            paintFiles();
            if (QuinzetaDB.isEnabled()) {
                const db = QuinzetaDB.saveSheet(name, toCsv());
                status(db && db.error ? db.error : `"${name}" também salvo no Quinzeta DB.`);
                paintDbTables();
            }
        }

        function download() {
            HQAudio.uiClick();
            const blob = new Blob([toCsv()], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName();
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            status('Download .csv iniciado.');
        }

        function paintFiles() {
            const files = (state.files || []).filter((f) => /\.csv$/i.test(String(f.name || '')) || /csv/i.test(String(f.type || '')));
            $('xl_files').innerHTML = '<option value="">Abrir CSV do VHD...</option>' + files.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('');
        }

        function paintDbTables() {
            const enabled = QuinzetaDB.isEnabled();
            $('xl_db_save').style.display = enabled ? '' : 'none';
            $('xl_db_tables').style.display = enabled ? '' : 'none';
            const tables = enabled ? QuinzetaDB.list() : [];
            $('xl_db_tables').innerHTML = '<option value="">Abrir do Quinzeta DB...</option>' +
                tables.map((t) => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} · ${escapeHtml(t.type)}</option>`).join('');
        }

        function saveToQuinzeta() {
            HQAudio.uiClick();
            const result = QuinzetaDB.saveSheet(fileName(), toCsv());
            status(result && result.error ? result.error : `Planilha enviada ao Quinzeta DB: ${result.name}`);
            paintDbTables();
        }

        function openFromQuinzeta() {
            const name = $('xl_db_tables').value;
            if (!name) return;
            const table = QuinzetaDB.getTable(name);
            if (!table) { status('Tabela não encontrada no Quinzeta DB.'); return; }
            if (table.type !== 'csv') { status('Esta tabela é um banco JSON. Abra no Quinzuo Access.'); return; }
            loadRows(parseCsv(table.content));
            $('xl_name').value = table.name;
            currentId = null;
            status(`"${table.name}" carregado do Quinzeta DB.`);
        }

        $('xl_grid').addEventListener('focusin', (event) => {
            const cell = event.target.closest('[data-cell]');
            if (!cell) return;
            selected = cell.dataset.cell;
            $('xl_cell').textContent = selected;
            cell.textContent = String(cells[selected] ?? '');
            $('xl_formula').value = String(cells[selected] ?? '');
            el.querySelectorAll('[data-cell]').forEach((c) => c.classList.toggle('active', c === cell));
        });
        $('xl_grid').addEventListener('input', (event) => {
            const cell = event.target.closest('[data-cell]');
            if (!cell) return;
            cells[cell.dataset.cell] = cell.textContent;
        });
        $('xl_grid').addEventListener('keydown', (event) => {
            const cell = event.target.closest('[data-cell]');
            if (!cell) return;
            const key = cell.dataset.cell;
            const col = key.charCodeAt(0) - 65;
            const row = Number(key.slice(1)) - 1;
            let target = null;
            if (event.key === 'ArrowUp') target = [row - 1, col];
            else if (event.key === 'ArrowDown' || event.key === 'Enter') target = [row + 1, col];
            else if (event.key === 'ArrowLeft') target = [row, col - 1];
            else if (event.key === 'ArrowRight' || event.key === 'Tab') target = [row, col + 1];
            if (target) {
                event.preventDefault();
                if (target[0] >= 0 && target[0] < ROWS && target[1] >= 0 && target[1] < COLS) selectCell(ref(target[0], target[1]));
            }
        });
        $('xl_grid').addEventListener('focusout', (event) => {
            if (event.target.closest('[data-cell]')) recalcAll();
        });
        $('xl_formula').addEventListener('input', (event) => {
            cells[selected] = event.target.value;
        });
        $('xl_formula').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); recalcAll(); status(`Célula ${selected} atualizada.`); }
        });
        $('xl_formula').addEventListener('blur', recalcAll);
        $('xl_save').onclick = save;
        $('xl_download').onclick = download;
        $('xl_recalc').onclick = () => { HQAudio.uiClick(); recalcAll(); status('Fórmulas recalculadas.'); };
        $('xl_files').addEventListener('change', () => {
            const id = $('xl_files').value;
            if (!id) return;
            const file = (state.files || []).find((f) => String(f.id) === id);
            if (!file) return;
            currentId = file.id;
            $('xl_name').value = file.name;
            loadRows(parseCsv(file.content));
            status(`"${file.name}" carregado do VHD.`);
        });

        $('xl_db_save').onclick = saveToQuinzeta;
        $('xl_db_tables').addEventListener('change', openFromQuinzeta);

        loadRows(parseCsv(fileData && fileData.content !== undefined ? fileData.content : ''));
        paintFiles();
        paintDbTables();
    }
});
