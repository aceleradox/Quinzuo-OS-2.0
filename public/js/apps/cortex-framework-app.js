import { defineApp } from '../core/app-registry.js';
import { PrefrontalFramework as PFC } from '../core/prefrontal-framework.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

defineApp('cortex-framework', {
    render(containerId) {
        const el = document.getElementById(containerId);
        PFC.init();

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🧠 FRAMEWORK CÓRTEX PRÉ-FRONTAL</span>
                    <span class="qz-badge">v${escapeHtml(PFC.version)}</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="pfc_snapshot">📊 Snapshot</button>
                    <button class="app-bar-btn" id="pfc_overclock">🚀 Overclock 30s</button>
                    <button class="app-bar-btn" id="pfc_clear">🧹 Limpar histórico</button>
                </div>
                <div class="app-toolbar" style="flex-wrap:wrap">
                    <label style="font-size:9px;color:#94a3b8">Recompensa <input type="range" id="pfc_recompensa" min="0" max="1" step="0.05" value="0.8"></label>
                    <label style="font-size:9px;color:#94a3b8">Risco <input type="range" id="pfc_risco" min="0" max="1" step="0.05" value="0.2"></label>
                    <label style="font-size:9px;color:#94a3b8">Urgência <input type="range" id="pfc_urgencia" min="0" max="1" step="0.05" value="0.5"></label>
                    <label style="font-size:9px;color:#94a3b8">Carga emocional <input type="range" id="pfc_emocao" min="0" max="1" step="0.05" value="0.4"></label>
                    <button class="app-bar-btn" id="pfc_avaliar">⚖️ Avaliar decisão</button>
                    <button class="app-bar-btn" id="pfc_regular">💗 Regular emoção</button>
                </div>
                <div class="app-content" style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div style="background:#111c33;border:1px solid #334155;border-radius:10px;padding:12px">
                        <div style="font-size:11px;font-weight:800;color:#22d3ee;margin-bottom:8px">Plano de ação</div>
                        <input id="pfc_objetivo" class="qz-input" style="width:100%;margin-bottom:7px" value="Estabilizar o córtex">
                        <textarea id="pfc_passos" class="code-editor" style="height:105px;border:1px solid #334155;border-radius:7px">Respirar\nPriorizar tarefas\nRegistrar decisão</textarea>
                        <button class="app-bar-btn" id="pfc_planejar" style="margin-top:7px">📝 Gerar plano</button>
                        <button class="app-bar-btn" id="pfc_priorizar" style="margin-top:7px">🥇 Priorizar</button>
                        <div id="pfc_plano" style="font-size:10px;color:#cbd5e1;white-space:pre-wrap;margin-top:9px"></div>
                    </div>
                    <div style="background:#111c33;border:1px solid #334155;border-radius:10px;padding:12px">
                        <div style="font-size:11px;font-weight:800;color:#f472b6;margin-bottom:8px">Estado cognitivo</div>
                        <div id="pfc_estado" style="font-size:10px;color:#cbd5e1;white-space:pre-wrap"></div>
                    </div>
                </div>
                <div class="app-log" id="pfc_log" style="max-height:150px"></div>
            </div>`;

        const $ = (id) => el.querySelector(String(id).startsWith('#') ? id : '#' + id);
        const log = (obj) => {
            $('#pfc_log').textContent += `\n[${new Date().toLocaleTimeString('pt-BR')}] ${JSON.stringify(obj, null, 2)}`;
            $('#pfc_log').scrollTop = $('#pfc_log').scrollHeight;
        };

        const showState = () => { $('#pfc_estado').textContent = JSON.stringify(PFC.snapshot(), null, 2); };
        const val = (id) => Number($(id).value);

        $('#pfc_avaliar').onclick = () => log(PFC.avaliar({
            recompensa: val('pfc_recompensa'),
            risco: val('pfc_risco'),
            urgencia: val('pfc_urgencia'),
            cargaEmocional: val('pfc_emocao')
        }));
        $('#pfc_regular').onclick = () => { log(PFC.regularEmocao(val('pfc_emocao'))); showState(); };
        $('#pfc_planejar').onclick = () => log(PFC.planejar($('#pfc_objetivo').value, $('#pfc_passos').value.split('\n')));
        $('#pfc_priorizar').onclick = () => {
            const tarefas = $('#pfc_passos').value.split('\n').filter(Boolean).map((nome, i) => ({ nome, impacto: 1 - i * 0.1, urgencia: 0.7, custo: 0.5 }));
            const ordem = PFC.priorizar(tarefas);
            $('#pfc_plano').textContent = ordem.map((t, i) => `${i + 1}. ${t.nome} (${t.prioridade})`).join('\n');
            log({ priorização: ordem.map((t) => t.nome) });
        };
        $('#pfc_snapshot').onclick = () => { log(PFC.snapshot()); showState(); };
        $('#pfc_overclock').onclick = () => { log(PFC.overclock(30000)); showState(); };
        $('#pfc_clear').onclick = () => { PFC.limparHistorico(); log({ historico: 'limpo' }); showState(); };

        PFC.subscribe((entry) => { if ($('#pfc_log')) log(entry); });
        showState();
    }
});
