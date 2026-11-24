import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';

const PALETTE = ['#ffffff', '#000000', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#a3e635', '#fbbf24', '#64748b'];

defineApp('pintaclima', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🎨 Pinta Clima</span>
                    <select id="pc_tool">
                        <option value="brush">🖌️ Pincel</option>
                        <option value="eraser">🧽 Borracha</option>
                        <option value="line">📏 Linha</option>
                        <option value="rect">▭ Retângulo</option>
                        <option value="ellipse">◯ Elipse</option>
                        <option value="fill">🪣 Preencher</option>
                        <option value="picker">🎯 Conta-gotas</option>
                        <option value="spray">💨 Spray</option>
                    </select>
                    <input type="color" id="pc_color" value="#f97316" title="Cor principal">
                    <input type="color" id="pc_color2" value="#8b5cf6" title="Cor secundária">
                    <label class="text-[9px] text-slate-400">Tamanho <input type="range" id="pc_size" min="1" max="60" value="6"></label>
                    <label class="text-[9px] text-slate-400">Opacidade <input type="range" id="pc_alpha" min="5" max="100" value="100"></label>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="pc_undo">↶</button>
                    <button class="app-bar-btn" id="pc_redo">↷</button>
                    <button class="app-bar-btn" id="pc_grid">▦ Grade</button>
                    <button class="app-bar-btn" id="pc_clear">Limpar</button>
                    <div class="tool-sep"></div>
                    <label class="text-[9px] text-slate-400">Zoom <input type="range" id="pc_zoom" min="40" max="200" value="100"></label>
                    <div class="tool-sep"></div>
                    <input type="text" id="pc_name" class="qz-input" style="width:130px" value="${escapeAttr(fileData ? fileData.name : 'arte_clima.png')}">
                    <button class="app-bar-btn" id="pc_save">🖼️ Salvar PNG</button>
                    <button class="app-bar-btn" id="pc_export">⬇ Exportar</button>
                </div>
                <div style="display:flex;align-items:center;gap:4px;padding:5px 8px;background:#0f172a;border-bottom:1px solid #1e293b">
                    <span class="text-[9px] text-slate-500 mr-1">Paleta:</span>
                    <div class="pc-palette">${PALETTE.map((c) => `<div class="pc-swatch" data-color="${c}" style="background:${c}" title="${c}"></div>`).join('')}</div>
                    <span class="ml-auto text-[9px] text-slate-500" id="pc_pos">0, 0</span>
                </div>
                <div class="pc-stage" id="pc_stage">
                    <div class="pc-canvas-wrap" id="pc_wrap">
                        <canvas id="pc_canvas" class="pc-canvas" width="900" height="560"></canvas>
                    </div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const canvas = $('pc_canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let drawing = false;
        let startX = 0, startY = 0;
        let undoStack = [], redoStack = [];
        let grid = false;
        let currentTool = 'brush';

        function snapshot() {
            undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            if (undoStack.length > 25) undoStack.shift();
            redoStack = [];
        }
        function restore(data) { ctx.putImageData(data, 0, 0); }
        function color() { return $('pc_color').value; }
        function size() { return Number($('pc_size').value); }
        function alpha() { return Number($('pc_alpha').value) / 100; }
        function point(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        }
        function setup() {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        setTimeout(() => {
            if (fileData && fileData.type === 'image/png') {
                const img = new Image();
                img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
                img.src = fileData.content;
            } else setup();
        }, 50);

        function applyTool(e, finishing = false) {
            const p = point(e);
            $('pc_pos').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
            ctx.globalAlpha = alpha();
            ctx.lineWidth = size();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : color();
            ctx.fillStyle = ctx.strokeStyle;

            if (currentTool === 'picker') {
                const data = ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
                $('pc_color').value = '#' + [data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
                return;
            }
            if (currentTool === 'spray') {
                for (let i = 0; i < size() * 3; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = Math.random() * size() * 2;
                    ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1.5, 1.5);
                }
                return;
            }
            if (currentTool === 'fill') {
                if (!finishing) return;
                floodFill(Math.round(p.x), Math.round(p.y), hexToRgb(color()));
                return;
            }
            if (finishing) {
                if (currentTool === 'rect') ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
                if (currentTool === 'ellipse') {
                    ctx.beginPath();
                    ctx.ellipse((startX + p.x) / 2, (startY + p.y) / 2, Math.abs(p.x - startX) / 2, Math.abs(p.y - startY) / 2, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (currentTool === 'line') {
                    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(p.x, p.y); ctx.stroke();
                }
                ctx.globalAlpha = 1;
                return;
            }
            if (currentTool === 'brush' || currentTool === 'eraser') {
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                ctx.beginPath(); ctx.moveTo(p.x, p.y);
            }
        }

        canvas.onmousedown = (e) => {
            HQAudio.uiClick();
            snapshot();
            currentTool = $('pc_tool').value;
            drawing = true;
            const p = point(e);
            startX = p.x; startY = p.y;
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            applyTool(e);
        };
        canvas.onmousemove = (e) => { if (drawing) applyTool(e); else { const p = point(e); $('pc_pos').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`; } };
        canvas.onmouseup = (e) => { if (!drawing) return; drawing = false; applyTool(e, true); ctx.beginPath(); ctx.globalAlpha = 1; };
        canvas.onmouseleave = () => { if (drawing) { drawing = false; applyTool({ clientX: startX, clientY: startY }, true); } ctx.beginPath(); };

        function hexToRgb(hex) {
            const v = hex.replace('#', '');
            return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), 255];
        }
        function floodFill(x, y, rgb) {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = img.data;
            const w = canvas.width, h = canvas.height;
            if (x < 0 || y < 0 || x >= w || y >= h) return;
            const start = (y * w + x) * 4;
            const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
            if (target.every((v, i) => v === rgb[i])) return;
            const match = (i) => Math.abs(data[i] - target[0]) < 8 && Math.abs(data[i + 1] - target[1]) < 8 && Math.abs(data[i + 2] - target[2]) < 8 && Math.abs(data[i + 3] - target[3]) < 8;
            const stack = [[x, y]];
            const seen = new Uint8Array(w * h);
            while (stack.length) {
                const [cx, cy] = stack.pop();
                if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
                const idx = cy * w + cx;
                if (seen[idx]) continue;
                seen[idx] = 1;
                const p = idx * 4;
                if (!match(p)) continue;
                data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; data[p + 3] = 255;
                stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
            }
            ctx.putImageData(img, 0, 0);
        }

        el.querySelectorAll('.pc-swatch').forEach((sw) => { sw.onclick = () => { $('pc_color').value = sw.dataset.color; HQAudio.uiClick(); }; });
        $('pc_undo').onclick = () => { if (undoStack.length) { redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); restore(undoStack.pop()); } };
        $('pc_redo').onclick = () => { if (redoStack.length) { undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); restore(redoStack.pop()); } };
        $('pc_grid').onclick = () => { grid = !grid; $('pc_wrap').classList.toggle('grid', grid); $('pc_grid').classList.toggle('active', grid); };
        $('pc_clear').onclick = () => { snapshot(); setup(); };
        $('pc_zoom').oninput = () => {
            const z = Number($('pc_zoom').value) / 100;
            canvas.style.width = `${900 * z}px`;
            canvas.style.height = `${560 * z}px`;
        };
        $('pc_color2').onclick = () => {
            const a = $('pc_color').value; $('pc_color').value = $('pc_color2').value; $('pc_color2').value = a;
        };
        $('pc_save').onclick = async () => {
            HQAudio.uiClick();
            let name = $('pc_name').value || 'desenho.png';
            if (!name.endsWith('.png')) name += '.png';
            const dataUrl = canvas.toDataURL('image/png');
            if (fileData) await BackendFS.updateFile(fileData.id, { name, content: dataUrl, isUrl: false });
            else await BackendFS.saveFile(name, 'image/png', dataUrl, false);
            alert('Desenho salvo no VHD!');
        };
        $('pc_export').onclick = () => {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = $('pc_name').value || 'desenho.png';
            a.click();
        };
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
