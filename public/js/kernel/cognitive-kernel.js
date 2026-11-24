/**
 * Loader do kernel WebAssembly "Capacidade Cognitiva 5.8".
 * Tenta instanciar o .wasm; se falhar, usa um fallback JS com a mesma semântica.
 */
let instance = null;
let usingFallback = false;
let initPromise = null;

const fallback = {
    versao: () => 58,
    capacidade_base: () => 5.8,
    calcular_capacidade: (mat, oc, dec, sup) => Math.min(10, sup ? 10 : 5.8 + mat * 2.5 + oc * 1.5 + dec * 1.2),
    regular_impulso: (v) => {
        const x = Math.min(1, Math.max(0, v));
        return (5.8 + 0.58 * 2) * (1 - x * 0.15);
    },
    simular_ciclo: (ticks, carga) => (ticks <= 0 ? 0 : ((5.8 + 0.58) * (carga / 100) * ticks) / ticks),
    ciclos: () => 0,
    definir_cortex: () => {},
    ler_cortex: () => 0.58,
    reset: () => {},
    gravar_memoria: () => {},
    ler_memoria: () => 0
};

export async function initKernel() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            const response = await fetch('/js/kernel/cognitive-kernel.wasm');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = await response.arrayBuffer();
            const module = await WebAssembly.compile(bytes);
            instance = await WebAssembly.instantiate(module, {});
            usingFallback = false;
        } catch (err) {
            console.warn('[Kernel] WASM indisponível, usando fallback JS:', err.message);
            instance = fallback;
            usingFallback = true;
        }
        return Kernel;
    })();
    return initPromise;
}

function call(name, ...args) {
    const target = instance || fallback;
    const fn = target && target[name];
    if (typeof fn !== 'function') return fallback[name](...args);
    return fn(...args);
}

export const Kernel = {
    async ready() { if (!instance) await initKernel(); return this; },
    isFallback() { return usingFallback; },
    versao: () => call('versao'),
    capacidadeBase: () => call('capacidade_base'),
    definirCortex: (v) => call('definir_cortex', v),
    lerCortex: () => call('ler_cortex'),
    regularImpulso: (v) => call('regular_impulso', v),
    calcularCapacidade: (maturidade, overclock, decisao, supremo) =>
        call('calcular_capacidade', maturidade, overclock, decisao ? 1 : 0, supremo ? 1 : 0),
    simularCiclo: (ticks, carga) => call('simular_ciclo', Math.max(1, ticks | 0), carga),
    ciclos: () => call('ciclos'),
    reset: () => call('reset'),
    gravarMemoria: (pos, valor) => call('gravar_memoria', pos, valor),
    lerMemoria: (pos) => call('ler_memoria', pos)
};
