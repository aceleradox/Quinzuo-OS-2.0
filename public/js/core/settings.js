import { cogStats, emit, events, readLS, writeLS, applyTheme } from './state.js';

export const DEFAULT_SETTINGS = Object.freeze({
    theme: 'valsa',
    bootDevice: 'vhd1',
    cortexFreq: 2900,
    memory: 8192,
    vmq: false,
    decisao: false,
    overclock: false,
    maturityOverclock: false,
    supremo: false,
    implanol: false,
    audio: true,
    secureBoot: true,
    language: 'pt-BR',
    autoBoot: false,
    wallpaper: 'nebula',
    quinzetaDB: false
});

let current = { ...DEFAULT_SETTINGS, ...(readLS('qz_settings', {}) || {}) };

export function getSettings() {
    return { ...current };
}

export function applySettings(patch = {}) {
    current = { ...current, ...patch };
    writeLS('qz_settings', current);

    // Recalcula o córtex a partir da base (evita acúmulo entre aplicações)
    let cap = 5.8;
    if (current.vmq) cap += 2.5;
    if (current.decisao) cap += 1.2;
    if (current.overclock) cap += 1.5;
    if (current.maturityOverclock) cap += 1.8;
    if (current.supremo) cap = 10.0;
    cap = Math.min(10, cap + (cogStats.boost || 0));

    cogStats.baseCap = Number(cap.toFixed(2));
    cogStats.isSupremo = !!current.supremo;
    cogStats.isFunk = current.theme === 'funk';
    cogStats.implanol = !!current.implanol;
    cogStats.overclock = !!current.overclock;
    cogStats.maturityOverclock = !!current.maturityOverclock;
    cogStats.vmq = !!current.vmq;
    cogStats.decisao = !!current.decisao;
    cogStats.cortexFreq = Number(current.cortexFreq);
    cogStats.memory = Number(current.memory);

    if (current.supremo) {
        cogStats.cortex = '100% (Extrema Maturidade)';
        cogStats.emo = 'Frieza Absoluta / Foco Total';
        cogStats.proc = 'Lógica Quântica Ativada';
    } else if (current.vmq) {
        cogStats.cortex = '85% (Maturidade Virtualizada)';
        cogStats.emo = 'Estabilidade Emulada via VM-Q';
        cogStats.proc = current.decisao ? 'Otimizado (Cálculo Racional)' : 'Baseado em Impulsos';
    } else {
        cogStats.cortex = '58% (Em Desenvolvimento)';
        cogStats.emo = current.decisao ? 'Controlado Analiticamente' : 'Instável / Alta Intensidade';
        cogStats.proc = current.decisao ? 'Otimizado (Cálculo Racional)' : 'Baseado em Impulsos';
    }
    if (current.overclock) cogStats.proc += ' [OVERCLOCK]';
    if (current.maturityOverclock) {
        cogStats.cortex = '92% (Maturidade em Overclock)';
        cogStats.emo = 'Foco Acelerado / Maturidade Forçada';
        cogStats.proc += ' [MATURIDADE OC]';
    }

    applyTheme();
    emit(events.SETTINGS_CHANGED, getSettings());
    return getSettings();
}

export async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const remote = await res.json();
            current = { ...current, ...remote };
        }
    } catch (_) { /* modo offline usa localStorage */ }
    return applySettings();
}

export async function saveSettings(patch = {}) {
    applySettings(patch);
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(current)
        });
    } catch (_) {}
    return getSettings();
}

export async function resetSettings() {
    current = { ...DEFAULT_SETTINGS };
    applySettings();
    try { await fetch('/api/settings', { method: 'DELETE' }); } catch (_) {}
    return getSettings();
}
