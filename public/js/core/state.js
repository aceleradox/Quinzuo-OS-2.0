// Estado global do Quinzuo OS Static 5.8
export const readLS = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
};

export const writeLS = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
};

export const events = {
    FS_CHANGED: 'qz:fs-changed',
    SETTINGS_CHANGED: 'qz:settings-changed',
    DOCK_CHANGED: 'qz:dock-changed',
    WINDOW_FOCUS: 'qz:window-focus',
    TOAST: 'qz:toast'
};

export function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
}

export const state = {
    windows: [],
    activeWindowId: null,
    zCounter: 100,
    files: [],
    booted: false,
    currentVHD: 1,
    totalVHDs: readLS('qz_vhds', 1),
    iconPositions: readLS('quinzuoIconPos', {}),
    installedQnz: readLS('qz_installed_qnz', []),
    startTime: Date.now(),
    booting: false
};

export const cogStats = {
    baseCap: 5.8,
    boost: 0,
    cortex: '58% (Em Desenvolvimento)',
    emo: 'Instável / Alta Intensidade',
    proc: 'Baseado em Impulsos',
    simp: 'Normal',
    isSupremo: false,
    isFunk: false,
    implanol: false,
    overclock: false,
    maturityOverclock: false,
    impulsosRegulados: false,
    vmq: false,
    decisao: false,
    cortexFreq: 2900,
    memory: 8192
};

export function applyTheme() {
    document.body.classList.toggle('theme-funk', cogStats.isFunk);
}
