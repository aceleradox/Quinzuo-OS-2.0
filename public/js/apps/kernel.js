import { defineApp } from '../core/app-registry.js';
import { Kernel } from '../kernel/cognitive-kernel.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { HQAudio } from '../core/audio.js';

defineApp('kernel', {
    render(containerId) {
        const el = document.getElementById(containerId);
        const s = getSettings();
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🧬 WebAssembly · Capacidade Cognitiva 5.8</span>
                    <span id="k_backend" class="text-[10px] text-slate-400">carregando kernel...</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="k_run">▶ Simular 100 ciclos</button>
                    <button class="app-bar-btn" id="k_step">⏭ Passo</button>
                    <button class="app-bar-btn" id="k_reset">↺ Reset</button>
                    <button class="app-bar-btn" id="k_apply">💾 Aplicar ao sistema</button>
                </div>
                <div class="kernel-grid">
                    <div style="display:flex;flex-direction:column;gap:12px;min-height:0">
                        <div class="kernel-gauge">
                            <div class="qz-card-title">Capacidade Cognitiva Calculada</div>
                            <b id="k_cap">--</b><span class="text-xs text-slate-400"> / 10.0</span>
                            <div class="kernel-meter"><div id="k_capbar" style="width:0%"></div></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                            <div class="kernel-gauge"><div class="qz-card-title">Córtex</div><b id="k_cortex" style="font-size:17px">--</b></div>
                            <div class="kernel-gauge"><div class="qz-card-title">Ciclos WASM</div><b id="k_cycles" style="font-size:17px">0</b></div>
                            <div class="kernel-gauge"><div class="qz-card-title">Impulso</div><b id="k_imp" style="font-size:17px">--</b></div>
                        </div>
                        <div class="kernel-gauge" style="flex:1;min-height:150px">
                            <div class="qz-card-title">Traço de atividade neural</div>
                            <canvas id="k_chart" style="width:100%;height:120px;background:#020617;border-radius:6px"></canvas>
                        </div>
                    </div>
                    <div class="kernel-controls">
                        <div class="qz-card-title">Registradores de entrada</div>
                        <label class="qz-field"><span>Maturidade (0 — 1)</span><input type="range" id="k_mat" min="0" max="1" step="0.01" value="${s.vmq ? 0.85 : 0.58}"></label>
                        <label class="qz-field"><span>Overclock (0 — 1)</span><input type="range" id="k_oc" min="0" max="1" step="0.01" value="${s.overclock ? 1 : 0}"></label>
                        <label class="qz-field"><span>Decisão (0 — 1)</span><input type="range" id="k_dec" min="0" max="1" step="0.01" value="${s.decisao ? 1 : 0}"></label>
                        <label class="qz-check"><input type="checkbox" id="k_sup" ${s.supremo ? 'checked' : ''}> Modo supremo</label>
                        <label class="qz-field"><span>Carga do ciclo (%)</span><input type="range" id="k_load" min="1" max="100" step="1" value="50"></label>
                        <div class="qz-card-title" style="margin-top:6px">Memória do kernel</div>
                        <div class="hexdump" id="k_mem" style="border:1px solid #1e293b;border-radius:6px"></div>
                    </div>
                </div>
                <div class="app-log" id="k_log">Inicializando simulação...</div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        const history = [];
        let ready = false;

        function log(text) {
            const out = $('k_log');
            out.textContent += `\n[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
            out.scrollTop = out.scrollHeight;
        }

        function readParams() {
            return {
                mat: Number($('k_mat').value),
                oc: Number($('k_oc').value),
                dec: Number($('k_dec').value),
                sup: $('k_sup').checked
            };
        }

        function refresh() {
            if (!ready) return;
            const p = readParams();
            const cap = Kernel.calcularCapacidade(p.mat, p.oc, p.dec, p.sup);
            $('k_cap').textContent = cap.toFixed(2);
            $('k_capbar').style.width = `${cap * 10}%`;
            $('k_cortex').textContent = `${Math.round(Kernel.lerCortex() * 100)}%`;
            $('k_cycles').textContent = Kernel.ciclos();
            $('k_imp').textContent = Kernel.regularImpulso(1 - p.dec * 0.6).toFixed(2);
            drawChart();
        }

        function drawChart() {
            const canvas = $('k_chart');
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.clientWidth || 300;
            canvas.height = 120;
            ctx.fillStyle = '#020617';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (!history.length) return;
            const max = Math.max(...history, 1) * 1.15;
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            history.forEach((v, i) => {
                const x = (i / Math.max(1, history.length - 1)) * canvas.width;
                const y = canvas.height - (v / max) * (canvas.height - 12) - 6;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        function memoryDump() {
            if (Kernel.isFallback()) { $('k_mem').textContent = 'modo fallback JS'; return; }
            for (let i = 0; i < 8; i++) Kernel.gravarMemoria(i, 65 + i);
            const values = [];
            for (let i = 0; i < 8; i++) values.push(Kernel.lerMemoria(i).toString(16).padStart(2, '0'));
            $('k_mem').textContent = `0x00: ${values.join(' ')}  (${values.map((h) => String.fromCharCode(parseInt(h, 16))).join('')})`;
        }

        $('k_run').onclick = () => {
            HQAudio.uiClick();
            const load = Number($('k_load').value);
            const result = Kernel.simularCiclo(100, load);
            history.push(result);
            if (history.length > 60) history.shift();
            log(`100 ciclos @ ${load}% → média ${result.toFixed(3)} · total ${Kernel.ciclos()} ciclos`);
            refresh();
        };
        $('k_step').onclick = () => {
            HQAudio.uiClick();
            const result = Kernel.simularCiclo(1, Number($('k_load').value));
            history.push(result);
            if (history.length > 60) history.shift();
            log(`passo único → ${result.toFixed(3)}`);
            refresh();
        };
        $('k_reset').onclick = () => { Kernel.reset(); history.length = 0; log('Registradores do kernel reiniciados.'); refresh(); };
        $('k_apply').onclick = async () => {
            const p = readParams();
            await saveSettings({ vmq: p.mat > 0.7, overclock: p.oc > 0.5, decisao: p.dec > 0.5, supremo: p.sup });
            log('Parâmetros aplicados ao córtex do sistema.');
        };
        ['k_mat', 'k_oc', 'k_dec', 'k_sup'].forEach((id) => $(id).addEventListener('input', refresh));

        Kernel.ready().then(() => {
            ready = true;
            $('k_backend').textContent = Kernel.isFallback() ? 'fallback JavaScript ativo' : '.wasm carregado e validado';
            log(`Kernel versão ${Kernel.versao()} · base ${Kernel.capacidadeBase().toFixed(2)}`);
            memoryDump();
            refresh();
        });
    }
});
