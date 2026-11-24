import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';

const PRESETS = {
    natural: { shadow: '#d8a48f', lipstick: '#d96b6b', blush: '#e8a0a0', brow: '#6b4b36', opacity: 35 },
    glam: { shadow: '#7b3fa1', lipstick: '#c2185b', blush: '#e57399', brow: '#3e2723', opacity: 60 },
    night: { shadow: '#1e3a8a', lipstick: '#7f1d1d', blush: '#9d174d', brow: '#1c1917', opacity: 75 },
    funk: { shadow: '#ff007f', lipstick: '#00ff88', blush: '#facc15', brow: '#111827', opacity: 85 }
};

defineApp('makeup', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge" style="border-color:#ec4899;color:#fbcfe8">💄 Pinta Clima · Make Up</span>
                    <select id="mu_tool">
                        <option value="shadow">🌈 Sombra</option>
                        <option value="lipstick">💋 Batom</option>
                        <option value="blush">🌸 Blush</option>
                        <option value="lashes">👁️ Cílios</option>
                        <option value="eyeliner">🖊️ Delineado</option>
                        <option value="brow">🦶 Sobrancelha</option>
                        <option value="highlight">✨ Iluminador</option>
                        <option value="contour">🎭 Contorno</option>
                    </select>
                    <input type="color" id="mu_color" value="#c2185b">
                    <label class="text-[9px] text-slate-400">Pincel <input type="range" id="mu_size" min="4" max="80" value="24"></label>
                    <label class="text-[9px] text-slate-400">Opacidade <input type="range" id="mu_alpha" min="5" max="100" value="55"></label>
                    <select id="mu_filter">
                        <option value="none">Sem filtro</option>
                        <option value="blur">Blur suave</option>
                        <option value="blur-strong">Blur forte</option>
                        <option value="brightness">Brilho +</option>
                        <option value="contrast">Contraste +</option>
                        <option value="sepia">Retrô</option>
                        <option value="hue">Hue shift</option>
                    </select>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="mu_undo">↶</button>
                    <button class="app-bar-btn" id="mu_clear">Limpar maquiagem</button>
                    <div class="tool-sep"></div>
                    <label class="app-bar-btn" style="cursor:pointer">📷 Foto base<input type="file" id="mu_upload" accept="image/*" class="hidden"></label>
                    <label class="text-[9px] text-slate-400">Preset
                        <select id="mu_preset"><option value="">—</option><option value="natural">Natural</option><option value="glam">Glam</option><option value="night">Night</option><option value="funk">Funk</option></select>
                    </label>
                    <input type="text" id="mu_name" class="qz-input" style="width:120px" value="makeup.png">
                    <button class="app-bar-btn" id="mu_save">💾 Salvar PNG</button>
                </div>
                <div style="font-size:9px;color:#64748b;padding:5px 9px;background:#0b1220;border-bottom:1px solid #1e293b">
                    Clique ou arraste sobre os olhos, lábios e bochechas. Use os filtros para suavizar e dar acabamento.
                </div>
                <div class="pc-stage" id="mu_stage">
                    <div class="pc-canvas-wrap"><canvas id="mu_canvas" class="pc-canvas" width="700" height="700"></canvas></div>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const canvas = $('mu_canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let painting = false;
        let undo = [];
        let baseImage = null;

        function drawFace() {
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#f3e2d3';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // rosto
            ctx.fillStyle = '#f1c9a5';
            ctx.beginPath(); ctx.ellipse(350, 360, 190, 245, 0, 0, Math.PI * 2); ctx.fill();
            // orelhas
            ctx.beginPath(); ctx.ellipse(155, 370, 24, 45, 0, 0, Math.PI * 2); ctx.ellipse(545, 370, 24, 45, 0, 0, Math.PI * 2); ctx.fill();
            // cabelo
            ctx.fillStyle = '#3b2a24';
            ctx.beginPath(); ctx.ellipse(350, 165, 205, 130, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(145, 180); ctx.quadraticCurveTo(110, 430, 165, 560); ctx.lineTo(215, 250); ctx.fill();
            ctx.beginPath(); ctx.moveTo(555, 180); ctx.quadraticCurveTo(590, 430, 535, 560); ctx.lineTo(485, 250); ctx.fill();
            // olhos
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(280, 330, 42, 20, 0, 0, Math.PI * 2); ctx.ellipse(420, 330, 42, 20, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4b3621';
            ctx.beginPath(); ctx.arc(280, 330, 13, 0, Math.PI * 2); ctx.arc(420, 330, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(280, 330, 6, 0, Math.PI * 2); ctx.arc(420, 330, 6, 0, Math.PI * 2); ctx.fill();
            // nariz e boca
            ctx.strokeStyle = '#c9976f'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(350, 355); ctx.quadraticCurveTo(365, 405, 345, 415); ctx.stroke();
            ctx.fillStyle = '#b85c5c';
            ctx.beginPath(); ctx.moveTo(305, 480); ctx.quadraticCurveTo(350, 505, 395, 480); ctx.quadraticCurveTo(350, 462, 305, 480); ctx.fill();
            // sobrancelhas
            ctx.strokeStyle = '#5b3b2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(238, 288); ctx.quadraticCurveTo(280, 272, 322, 288); ctx.moveTo(378, 288); ctx.quadraticCurveTo(420, 272, 462, 288); ctx.stroke();
        }

        function snapshot() {
            undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            if (undo.length > 20) undo.shift();
        }

        function filterString() {
            const f = $('mu_filter').value;
            return ({
                none: 'none', blur: 'blur(2px)', 'blur-strong': 'blur(6px)',
                brightness: 'brightness(1.25)', contrast: 'contrast(1.35)',
                sepia: 'sepia(0.45)', hue: 'hue-rotate(35deg)'
            })[f] || 'none';
        }

        function point(e) {
            const r = canvas.getBoundingClientRect();
            return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
        }

        function stamp(p) {
            const tool = $('mu_tool').value;
            const size = Number($('mu_size').value);
            ctx.save();
            ctx.globalAlpha = Number($('mu_alpha').value) / 100;
            ctx.filter = filterString();
            ctx.fillStyle = $('mu_color').value;
            ctx.strokeStyle = $('mu_color').value;
            ctx.lineCap = 'round';

            if (tool === 'lashes') {
                ctx.lineWidth = 2.5;
                for (let i = -3; i <= 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(p.x + i * 5, p.y);
                    ctx.quadraticCurveTo(p.x + i * 7, p.y + size * 0.5, p.x + i * 10, p.y + size);
                    ctx.stroke();
                }
            } else if (tool === 'eyeliner' || tool === 'brow') {
                ctx.lineWidth = tool === 'brow' ? size / 5 : 3;
                ctx.beginPath(); ctx.moveTo(p.x - size / 2, p.y); ctx.quadraticCurveTo(p.x, p.y - size / 5, p.x + size / 2, p.y); ctx.stroke();
            } else if (tool === 'highlight') {
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
                g.addColorStop(0, 'rgba(255,255,255,0.9)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
            } else if (tool === 'contour') {
                const g = ctx.createRadialGradient(p.x, p.y, size / 3, p.x, p.y, size * 1.4);
                g.addColorStop(0, $('mu_color').value);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(p.x, p.y, size * 1.4, 0, Math.PI * 2); ctx.fill();
            } else {
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
                g.addColorStop(0, $('mu_color').value);
                g.addColorStop(0.65, $('mu_color').value + 'aa');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        canvas.onmousedown = (e) => { HQAudio.uiClick(); snapshot(); painting = true; stamp(point(e)); };
        canvas.onmousemove = (e) => { if (painting) stamp(point(e)); };
        canvas.onmouseup = () => { painting = false; };
        canvas.onmouseleave = () => { painting = false; };

        $('mu_undo').onclick = () => { if (undo.length) ctx.putImageData(undo.pop(), 0, 0); };
        $('mu_clear').onclick = () => {
            snapshot();
            if (baseImage) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height); }
            else drawFace();
        };
        $('mu_upload').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    baseImage = img;
                    snapshot();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };
        $('mu_preset').onchange = () => {
            const p = PRESETS[$('mu_preset').value];
            if (!p) return;
            $('mu_color').value = p.lipstick;
            $('mu_alpha').value = p.opacity;
            HQAudio.excitacao();
        };
        $('mu_save').onclick = async () => {
            let name = $('mu_name').value || 'makeup.png';
            if (!name.endsWith('.png')) name += '.png';
            const content = canvas.toDataURL('image/png');
            if (fileData) await BackendFS.updateFile(fileData.id, { name, content, isUrl: false });
            else await BackendFS.saveFile(name, 'image/png', content, false);
            alert('Maquiagem salva no VHD!');
        };

        drawFace();
    }
});
