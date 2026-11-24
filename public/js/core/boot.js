import { state, cogStats } from './state.js';
import { getSettings, loadSettings, saveSettings } from './settings.js';
import { HQAudio } from './audio.js';
import { showBIOS, hideBIOS } from './bios.js';
import { initDesktop, updateCognitiveOverlay } from './desktop.js';
import { BackendFS } from './fs.js';
import { initKernel, Kernel } from '../kernel/cognitive-kernel.js';
import { openApp } from './window-manager.js';

// Frases que aparecem enquanto o sistema carrega
export const BOOT_FRASES = [
    'juro amiga  isso foi demais,',
    'gastei horrores nessa roupa',
    'santo duro amiga isso foi muito bom',
    'vamos curtir horrores nesse baile funk',
    'ai vei jurooo',
    'santu deus amiga ele ta quebrado vamos pra outro canto',
    'santo duroo',
    'amiga ta bem bubu em',
    'nossa vei juroo',
    'juroo',
    'coi coi',
    'amiga... a-mo'
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function initSystem() {
    const setupApply = document.getElementById('btnSetupApply');
    const setupBack = document.getElementById('btnSetupBack');
    if (setupApply) setupApply.onclick = () => applySetup();
    if (setupBack) setupBack.onclick = () => {
        hideSetup();
        showBIOS({ onBoot: () => startBootSequence(), onSetup: showSetup });
    };
    document.getElementById('btnEmancipar').onclick = () => import('./desktop.js').then((m) => m.ativarEmancipacao());

    loadSettings().then(() => {
        showBIOS({ onBoot: () => startBootSequence(), onSetup: showSetup });
    });
}

export function showSetup() {
    hideBIOS();
    const s = getSettings();
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    const check = (id, value) => { const el = document.getElementById(id); if (el) el.checked = !!value; };
    set('optDesktopMode', s.theme);
    set('optCortexFreq', s.cortexFreq);
    set('optMemory', s.memory);
    check('optVMQ', s.vmq);
    check('optDecision', s.decisao);
    check('optOverclock', s.overclock);
    check('optMaturityOC', s.maturityOverclock);
    check('optAudio', s.audio);
    check('optSecureBoot', s.secureBoot);
    check('optImplanol', s.implanol);
    check('optQuinzetaDB', s.quinzetaDB);
    check('optSupremo', s.supremo);
    document.getElementById('setupScreen').classList.remove('hidden');
}

export function hideSetup() {
    document.getElementById('setupScreen').classList.add('hidden');
}

export async function applySetup() {
    const value = (id) => document.getElementById(id).value;
    const checked = (id) => document.getElementById(id).checked;
    await saveSettings({
        theme: value('optDesktopMode'),
        cortexFreq: Number(value('optCortexFreq')),
        memory: Number(value('optMemory')),
        vmq: checked('optVMQ'),
        decisao: checked('optDecision'),
        overclock: checked('optOverclock'),
        maturityOverclock: checked('optMaturityOC'),
        audio: checked('optAudio'),
        secureBoot: checked('optSecureBoot'),
        implanol: checked('optImplanol'),
        quinzetaDB: checked('optQuinzetaDB'),
        supremo: checked('optSupremo')
    });
    startBootSequence();
}

export async function startBootSequence() {
    if (state.booting || state.booted) return;
    state.booting = true;

    hideBIOS();
    hideSetup();
    const boot = document.getElementById('bootScreen');
    boot.classList.remove('hidden');
    boot.classList.add('flex');

    const bar = document.getElementById('bootBar');
    const log = document.getElementById('bootLog');
    const counter = document.getElementById('bootPhraseCount');
    const subLog = document.getElementById('bootSubLog');
    bar.style.width = '0%';
    log.textContent = BOOT_FRASES[0];
    if (counter) counter.textContent = 'frase 01 / 12 · carregando córtex';
    const subLines = ['[BELANOVAEFI >> QUINZUO OS] aguardando sincronização neural...'];
    if (subLog) subLog.textContent = subLines.join('\n');
    HQAudio.boot();

    const s = getSettings();
    const isFunk = s.theme === 'funk';
    document.getElementById('bootTitle').textContent = isFunk ? 'QUINZUO OS — BAILE FUNK' : 'QUINZUO OS';
    document.getElementById('bootSubtitle').textContent = isFunk
        ? 'AUTONOMIA PROGRESSIVA TOTAL · CÓRTEX EM OVERCLOCK'
        : 'CAPACIDADE COGNITIVA 5.8 · NÚCLEO CÓRTEX PRÉ-FRONTAL';
    document.getElementById('bootIcon').textContent = isFunk ? '🕶️' : '🧠';

    // Cada frase fica visível por 2 passos. Overclock reduz o tempo, mas mantém a leitura confortável.
    const delay = s.overclock ? 430 : 920;
    const steps = 24;
    const progressCurve = [0, 2, 4, 7, 9, 12, 16, 18, 22, 26, 31, 35, 41, 46, 52, 57, 63, 68, 74, 79, 84, 88, 92, 96, 100];
    const phases = {
        0: '[BELANOVAEFI] sincronizando córtex pré-frontal · 15 anos de desenvolvimento',
        2: '[BELANOVAEFI] detectando núcleo feminino · capacidade base 5.8',
        4: '[KERNEL] instanciando Cognitive-VM 5.8 via WebAssembly',
        6: '[KERNEL] registrando opcode de maturidade e overclock',
        8: '[VHD] montando partição SQLite e índice de arquivos',
        10: '[VHD] lendo configurações persistidas',
        12: '[AMÍGDALA] monitorando densidade simpática',
        14: '[CÓRTEX] calibrando impulsos e tomada de decisão',
        16: '[FLOP] enumerando pacotes removíveis',
        18: '[DOCK] registrando aplicativos e ícones próprios',
        20: '[UI] compondo desktop, janelas e menu inicial',
        22: '[AUDIO] aquecendo HQAudio e animações de transição'
    };

    let kernelReady = false;
    let fsReady = false;
    let flopsReady = false;
    let phaseLabel = 'carregando córtex';

    function updateSub(text) {
        subLines.push(text);
        if (subLog) subLog.textContent = subLines.slice(-5).join('\n');
    }

    for (let i = 0; i <= steps; i++) {
        const progress = progressCurve[i] ?? Math.round((i / steps) * 100);
        bar.style.width = `${progress}%`;

        const phraseIndex = Math.min(BOOT_FRASES.length - 1, Math.floor(i / 2));
        log.textContent = BOOT_FRASES[phraseIndex];

        if (phases[i]) {
            phaseLabel = phases[i].split(']')[0].replace('[', '').toLowerCase();
            updateSub(phases[i]);
        }
        if (counter) counter.textContent = `frase ${String(phraseIndex + 1).padStart(2, '0')} / ${BOOT_FRASES.length} · ${phaseLabel}`;

        if (i === 4 && !kernelReady) {
            kernelReady = true;
            await initKernel();
            updateSub('[OK] Cognitive-VM pronta · ' + (Kernel.isFallback() ? 'fallback JS ativo' : 'WASM nativo'));
        }
        if (i === 9 && !fsReady) {
            fsReady = true;
            await BackendFS.fetchAll();
            updateSub(`[OK] VHD montado · ${state.files.length} arquivo(s) indexado(s)`);
        }
        if (i === 16 && !flopsReady) {
            flopsReady = true;
            const flops = await BackendFS.listFlops();
            updateSub(`[OK] ${flops.length} pacote(s) FLOP disponível(is)`);
        }

        await sleep(delay + (i % 4 === 0 ? 160 : 0));
    }

    log.textContent = 'amiga... a-mo';
    if (counter) counter.textContent = 'frase 12 / 12 · sistema pronto';
    bar.style.width = '100%';
    updateSub('[OK] sinapses estáveis · iniciando área de trabalho');
    await sleep(delay * 2);

    boot.classList.add('hidden');
    initDesktop();
    state.booted = true;
    state.booting = false;
    updateCognitiveOverlay();

    if (s.bootDevice.startsWith('vhd')) state.currentVHD = Number(s.bootDevice.slice(-1)) || 1;
    await BackendFS.fetchAll();
    if (s.bootDevice === 'flop') openApp('floppy');
    if (s.bootDevice === 'recovery') openApp('config');

    window.dispatchEvent(new CustomEvent('qz:boot-complete'));
}
