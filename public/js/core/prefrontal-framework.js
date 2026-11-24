import { cogStats, events, emit, readLS, writeLS } from './state.js';

/**
 * Framework do Córtex Pré-Frontal — Quinzuo OS Static 5.8
 * -------------------------------------------------------
 * Camada cognitiva reutilizável: avaliação de decisão, inibição de impulso,
 * regulação emocional, planejamento, priorização e overclock controlado.
 *
 * Uso:
 *   import { PrefrontalFramework as PFC } from './prefrontal-framework.js';
 *   PFC.init();
 *   const decisao = PFC.avaliar({ recompensa: 0.8, risco: 0.2 });
 */
const HISTORY_KEY = 'qz_prefrontal_history';
const listeners = new Set();

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

function stamp() {
    return new Date().toLocaleTimeString('pt-BR');
}

function notify(entry) {
    listeners.forEach((fn) => {
        try { fn(entry); } catch (_) { /* listener com falha não derruba o córtex */ }
    });
    emit(events.SETTINGS_CHANGED, entry);
}

export const PrefrontalFramework = {
    version: '1.0.0',
    history: [],

    init() {
        this.history = Array.isArray(readLS(HISTORY_KEY, [])) ? readLS(HISTORY_KEY, []) : [];
        return this;
    },

    subscribe(fn) {
        if (typeof fn === 'function') listeners.add(fn);
        return () => listeners.delete(fn);
    },

    record(kind, data) {
        const entry = { kind, at: stamp, data, timestamp: Date.now() };
        entry.at = stamp();
        this.history.push(entry);
        if (this.history.length > 80) this.history = this.history.slice(-80);
        writeLS(HISTORY_KEY, this.history);
        notify(entry);
        return entry;
    },

    capacidadeAtual() {
        if (cogStats.isSupremo) return 10;
        let cap = cogStats.baseCap + (cogStats.boost || 0);
        if (cogStats.overclock) cap *= 1.12;
        return Number(Math.min(10, cap).toFixed(2));
    },

    controleInibitorio() {
        let controle = 0.32;
        if (cogStats.impulsosRegulados) controle += 0.28;
        if (cogStats.decisao) controle += 0.18;
        if (cogStats.vmq) controle += 0.10;
        if (cogStats.maturityOverclock) controle += 0.07;
        if (cogStats.isSupremo) controle += 0.05;
        return Number(clamp(controle, 0, 1).toFixed(2));
    },

    /** Avalia uma decisão usando recompensa, risco, urgência e carga emocional. */
    avaliar({ recompensa = 0.5, risco = 0.5, urgencia = 0.5, cargaEmocional = 0.5, contexto = '' } = {}) {
        const cap = this.capacidadeAtual();
        const controle = this.controleInibitorio();
        const ganho = clamp(recompensa, 0, 1);
        const perigo = clamp(risco, 0, 1);
        const urgente = clamp(urgencia, 0, 1);
        const emocao = clamp(cargaEmocional, 0, 1);

        let score = ganho * 0.34 + controle * 0.28 + (1 - perigo) * 0.20 + (1 - emocao) * 0.12;
        score += urgente * 0.06;
        score *= clamp(cap / 5.8, 0.6, 1.72);

        const acao = score >= 0.66 ? 'AGIR'
            : score >= 0.48 ? 'PAUSAR E AVALIAR'
            : 'INIBIR IMPULSO';

        const resultado = {
            acao,
            score: Number(Math.min(1, score).toFixed(3)),
            capacidade: cap,
            controle,
            contexto,
            justificativa: acao === 'AGIR'
                ? 'Córtex estável: recompensa supera risco e impulsos estão regulados.'
                : acao === 'PAUSAR E AVALIAR'
                    ? 'Carga emocional ou risco moderado: aguardar novo ciclo de avaliação.'
                    : 'Risco alto ou impulsos desregulados: inibir e redirecionar.'
        };
        this.record('avaliar', resultado);
        return resultado;
    },

    /** Regula o estado emocional e atualiza o overlay do sistema. */
    regularEmocao(nivel = 0.5) {
        const alvo = clamp(nivel, 0, 1);
        const controle = this.controleInibitorio();
        const final = Number(clamp(alvo * (1 - controle * 0.55), 0, 1).toFixed(2));
        cogStats.emo = final < 0.3 ? 'Estável' : final < 0.65 ? 'Moderado' : 'Intenso / regulado';
        cogStats.simp = final < 0.45 ? 'Calma' : 'Atenção elevada';
        const resultado = { entrada: alvo, regulado: final, controle };
        this.record('emocao', resultado);
        return resultado;
    },

    /** Monta um plano a partir de um objetivo e uma lista de passos. */
    planejar(objetivo = 'objetivo não informado', passos = []) {
        const lista = Array.isArray(passos) ? passos.filter(Boolean).map(String) : [];
        const capacidade = this.capacidadeAtual();
        const plano = {
            objetivo: String(objetivo),
            passos: lista,
            viabilidade: Number(clamp((capacidade / 10) + (lista.length <= 6 ? 0.25 : 0.05), 0, 1).toFixed(2)),
            prazoEstimadoMin: Math.max(1, Math.round(lista.length * (12 / capacidade)))
        };
        this.record('planejar', plano);
        return plano;
    },

    /** Ordena tarefas por impacto, urgência e custo cognitivo. */
    priorizar(tarefas = []) {
        const lista = Array.isArray(tarefas) ? tarefas : [];
        const ordenadas = lista.map((t, i) => {
            const item = typeof t === 'string' ? { nome: t } : (t || {});
            const impacto = clamp(item.impacto ?? 0.5, 0, 1);
            const urgencia = clamp(item.urgencia ?? 0.5, 0, 1);
            const custo = clamp(item.custo ?? 0.5, 0.1, 1);
            return { ...item, nome: item.nome || `Tarefa ${i + 1}`, prioridade: Number(((impacto * 0.6 + urgencia * 0.4) / custo).toFixed(3)) };
        }).sort((a, b) => b.prioridade - a.prioridade);
        this.record('priorizar', { total: ordenadas.length, ordem: ordenadas.map((t) => t.nome) });
        return ordenadas;
    },

    /** Overclock cognitivo temporário; identidade fictional do sistema. */
    overclock(duracaoMs = 30000) {
        const anterior = cogStats.overclock;
        cogStats.overclock = true;
        cogStats.boost = cogStats.isSupremo ? 4.2 : 0.8;
        const resultado = { ativo: true, duracaoMs, capacidade: this.capacidadeAtual(), anterior };
        this.record('overclock', resultado);
        setTimeout(() => {
            cogStats.overclock = anterior;
            cogStats.boost = anterior ? cogStats.boost : 0;
            this.record('overclock-fim', { ativo: false, capacidade: this.capacidadeAtual() });
        }, clamp(duracaoMs, 1000, 300000));
        return resultado;
    },

    reflexao(evento, aprendizado) {
        const entrada = { evento: String(evento || ''), aprendizado: String(aprendizado || '') };
        this.record('reflexao', entrada);
        return entrada;
    },

    snapshot() {
        return {
            versao: this.version,
            capacidade: this.capacidadeAtual(),
            controleInibitorio: this.controleInibitorio(),
            modo: cogStats.isFunk ? 'autonomia progressiva total' : 'valsa',
            overclock: !!cogStats.overclock,
            regulado: !!cogStats.impulsosRegulados,
            historico: this.history.slice(-12)
        };
    },

    limparHistorico() {
        this.history = [];
        writeLS(HISTORY_KEY, []);
        return true;
    }
};
