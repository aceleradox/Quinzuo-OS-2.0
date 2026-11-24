import { defineApp } from '../core/app-registry.js';
import { cogStats } from '../core/state.js';
import { HQAudio } from '../core/audio.js';
import { updateCognitiveOverlay } from '../core/desktop.js';
import { saveSettings, getSettings } from '../core/settings.js';
import { Kernel } from '../kernel/cognitive-kernel.js';

defineApp('cortex', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root" style="overflow:auto">
                <div style="padding:16px;display:flex;flex-direction:column;gap:14px">
                    <div class="text-center">
                        <h2 class="text-xl font-extrabold text-cyan-400">Painel do Córtex Pré-Frontal</h2>
                        <p class="text-[10px] text-slate-400">Desenvolvimento cognitivo dinâmico · base 15 anos</p>
                    </div>
                    <div class="qz-card" id="cx_stats"></div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button class="qz-btn qz-btn-primary" id="cx_boost">🔥 Excitação Cognitiva</button>
                        <button class="qz-btn qz-btn-ghost" id="cx_reg">🛡️ Regular Impulsos</button>
                        <button class="qz-btn qz-btn-success" id="cx_simp">✨ Elevar Densidade Simpática</button>
                        <button class="qz-btn qz-btn-ghost" id="cx_vm">🧬 Virtualizar Maturidade</button>
                        <button class="qz-btn qz-btn-ghost" id="cx_oc">⚡ Overclock na Maturidade</button>
                        <button class="qz-btn qz-btn-ghost" id="cx_reset">↺ Recalibrar Córtex</button>
                    </div>
                    <div class="qz-card">
                        <div class="qz-card-title">Leitura do kernel WebAssembly</div>
                        <div class="grid grid-cols-3 gap-2 text-center text-xs">
                            <div><div class="text-slate-500">Versão</div><b id="cx_kver" class="text-cyan-300">--</b></div>
                            <div><div class="text-slate-500">Impulso</div><b id="cx_kimp" class="text-cyan-300">--</b></div>
                            <div><div class="text-slate-500">Ciclos</div><b id="cx_kcyc" class="text-cyan-300">--</b></div>
                        </div>
                    </div>
                    <p class="text-[9px] text-slate-600 text-center">* Ajustes aplicados diretamente no núcleo do sistema.</p>
                </div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        function stats() {
            $('cx_stats').innerHTML = `
                <div class="qz-card-title">Estado Atual</div>
                <div class="grid grid-cols-2 gap-y-2 text-[11px]">
                    <div>Capacidade: <b class="text-cyan-300">${cogStats.baseCap.toFixed(2)}</b></div>
                    <div>Córtex: <b>${cogStats.cortex}</b></div>
                    <div>Emoção: <b>${cogStats.emo}</b></div>
                    <div>Processamento: <b>${cogStats.proc}</b></div>
                    <div>Densidade: <b>${cogStats.simp}</b></div>
                    <div>Freq.: <b>${cogStats.cortexFreq} MHz</b></div>
                </div>`;
            $('cx_kver').textContent = Kernel.versao();
            $('cx_kimp').textContent = Kernel.regularImpulso(cogStats.impulsosRegulados ? 0.2 : 0.75).toFixed(2);
            $('cx_kcyc').textContent = Kernel.ciclos();
        }

        $('cx_boost').onclick = () => {
            HQAudio.excitacao();
            cogStats.boost += 0.5;
            import('../core/settings.js').then((m) => m.applySettings());
            cogStats.emo = 'Alta Excitação';
            updateCognitiveOverlay(); stats();
        };
        $('cx_reg').onclick = () => {
            HQAudio.uiClick();
            cogStats.impulsosRegulados = true;
            cogStats.proc = 'Estabilizado';
            Kernel.regularImpulso(0.1);
            updateCognitiveOverlay(); stats();
        };
        $('cx_simp').onclick = () => {
            HQAudio.uiClick();
            cogStats.simp = 'Elevada';
            updateCognitiveOverlay(); stats();
        };
        $('cx_vm').onclick = async () => {
            HQAudio.uiClick();
            await saveSettings({ vmq: !getSettings().vmq });
            stats();
        };
        $('cx_oc').onclick = async () => {
            HQAudio.uiClick();
            const next = !getSettings().maturityOverclock;
            await saveSettings({ maturityOverclock: next, vmq: next ? true : getSettings().vmq });
            stats();
        };
        $('cx_reset').onclick = async () => {
            HQAudio.uiClick();
            cogStats.boost = 0;
            cogStats.impulsosRegulados = false;
            cogStats.simp = 'Normal';
            await saveSettings({ vmq: false, overclock: false, maturityOverclock: false, supremo: false });
            Kernel.reset(); stats();
        };

        Kernel.ready().then(stats);
        stats();
    }
});
