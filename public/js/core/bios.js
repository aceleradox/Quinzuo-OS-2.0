import { getSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from './settings.js';
import { HQAudio } from './audio.js';
import { state } from './state.js';

let uid = 0;

/** Renderiza a BIOS em tela cheia ou dentro de uma janela. */
export function showBIOS({ onBoot, onSetup } = {}) {
    const screen = document.getElementById('biosScreen');
    screen.classList.remove('hidden');
    screen.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'bios-shell';
    screen.appendChild(shell);
    renderBiosForm(shell, { embedded: false, onBoot, onSetup });
    return shell;
}

export function hideBIOS() {
    document.getElementById('biosScreen').classList.add('hidden');
}

export function renderBiosForm(container, { embedded = true, onBoot, onSetup } = {}) {
    const s = getSettings();
    const p = `bios_${++uid}_`;
    container.innerHTML = `
        <div class="bios-header">
            <div>
                <div class="bios-logo">BELANOVAEFI <span style="color:#22d3ee">&gt;&gt;</span> QUINZUO OS<span style="color:#22d3ee">°</span></div>
                <div class="bios-sub">Firmware BelaNovaEFI · 15 anos de desenvolvimento · núcleo feminino</div>
            </div>
            <div class="bios-version">
                BelaNovaEFI v5.8.0 · Cognitive-VM<br>
                BUILD ${new Date().getFullYear()}.QZ · VHD ${state.currentVHD}<br>
                <span style="color:#4ade80">CORTEX PRÉ-FRONTAL: ONLINE</span>
            </div>
        </div>

        <div class="bios-grid">
            <div class="bios-nav">
                <button data-goto="boot" class="active">🔌 Boot</button>
                <button data-goto="cortex">🧠 Córtex</button>
                <button data-goto="seguranca">🛡️ Segurança</button>
                <button data-goto="memoria">💾 Memória / VHD</button>
                <button data-goto="diag">🔬 Diagnóstico</button>
            </div>
            <div class="bios-body" style="overflow:auto;max-height:52vh">

                <section id="${p}boot" data-section="boot">
                    <div class="bios-section-title">Configuração de Inicialização</div>
                    <div class="bios-form">
                        ${select(p, 'bootDevice', 'Dispositivo de boot', [
                            ['vhd1', 'VHD 1 — Partição principal'], ['vhd2', 'VHD 2'], ['vhd3', 'VHD 3'], ['vhd4', 'VHD 4'],
                            ['flop', 'FLOP — Pacote removível'], ['recovery', 'Modo Recuperação']
                        ], s.bootDevice)}
                        ${select(p, 'language', 'Idioma', [['pt-BR', 'Português (BR)'], ['en-US', 'English (US)']], s.language)}
                        ${checkbox(p, 'audio', 'Áudio de interface (HQAudio)', s.audio)}
                        ${checkbox(p, 'autoBoot', 'Boot automático sem DEL', s.autoBoot)}
                    </div>
                </section>

                <section id="${p}cortex" data-section="cortex" style="margin-top:18px">
                    <div class="bios-section-title">Configuração do Córtex Pré-Frontal</div>
                    <div class="bios-form">
                        ${range(p, 'cortexFreq', 'Frequência do córtex (MHz)', s.cortexFreq, 800, 5800, 100)}
                        ${range(p, 'memory', 'Memória neural (MB)', s.memory, 512, 16384, 512)}
                        ${checkbox(p, 'vmq', 'Virtualização de maturidade precoce (VM-Q)', s.vmq)}
                        ${checkbox(p, 'decisao', 'Otimização de tomada de decisão', s.decisao)}
                        ${checkbox(p, 'overclock', 'Overclock cognitivo', s.overclock)}
                        ${checkbox(p, 'maturityOverclock', 'Overclock na Maturidade (92% / +1.8 cap)', s.maturityOverclock)}
                        ${checkbox(p, 'supremo', 'Modo cognitivo supremo (10.0)', s.supremo)}
                    </div>
                </section>

                <section id="${p}seguranca" data-section="seguranca" style="margin-top:18px">
                    <div class="bios-section-title">Segurança e Identidade</div>
                    <div class="bios-form">
                        ${checkbox(p, 'secureBoot', 'Boot seguro do córtex', s.secureBoot)}
                        ${select(p, 'theme', 'Perfil de desktop', [['valsa', 'Modo Valsa (USER)'], ['funk', 'Baile Funk (Autonomia Total)']], s.theme)}
                        ${select(p, 'wallpaper', 'Papel de parede', [['nebula', 'Nebulosa'], ['grid', 'Grade neural'], ['plain', 'Sólido']], s.wallpaper)}
                    </div>
                </section>

                <section id="${p}memoria" data-section="memoria" style="margin-top:18px">
                    <div class="bios-section-title">Armazenamento</div>
                    <div class="bios-form">
                        ${checkbox(p, 'implanol', 'Implanol Virtual (bloqueia novas partições)', s.implanol)}
                        ${checkbox(p, 'quinzetaDB', 'Habilitar serviços do Quinzeta DB (Excel / Access)', s.quinzetaDB)}
                        <div class="full">
                            <div style="font-size:10px;color:#94a3b8">Memória neural detectada: <b id="${p}memLabel">${s.memory} MB</b></div>
                            <div class="bios-memory-bar"><div id="${p}memBar" style="width:${Math.min(100, s.memory / 16384 * 100)}%"></div></div>
                        </div>
                        <div class="full" style="font-size:9px;color:#475569">
                            VHD montado: ${state.totalVHDs} partição(ões) · Arquivos em memória: ${state.files.length}
                        </div>
                    </div>
                </section>

                <section id="${p}diag" data-section="diag" style="margin-top:18px">
                    <div class="bios-section-title">Diagnóstico do Sistema</div>
                    <div class="bios-form">
                        <div class="full">
                            <button type="button" class="qz-btn qz-btn-ghost" id="${p}runDiag">Executar teste de integridade</button>
                            <div class="bios-log" id="${p}diagLog" style="margin-top:8px">Aguardando teste...</div>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <div class="bios-foot">
            <button type="button" class="qz-btn qz-btn-primary" id="${p}bootBtn">▶ Salvar e Iniciar (ENTER)</button>
            ${onSetup ? `<button type="button" class="qz-btn qz-btn-ghost" id="${p}setupBtn">Assistente de instalação</button>` : ''}
            <button type="button" class="qz-btn qz-btn-ghost" id="${p}resetBtn">Restaurar padrões</button>
            <span class="bios-hint">DEL/F1 · BelaNovaEFI &gt;&gt; Quinzuo OS &nbsp;|&nbsp; ENTER · Boot &nbsp;|&nbsp; ESC · Fechar</span>
        </div>`;

    const collect = () => {
        const patch = {};
        container.querySelectorAll('[data-bios-key]').forEach((input) => {
            const key = input.dataset.biosKey;
            if (input.type === 'checkbox') patch[key] = input.checked;
            else if (input.type === 'range' || input.type === 'number') patch[key] = Number(input.value);
            else patch[key] = input.value;
        });
        return patch;
    };

    container.querySelectorAll('.bios-nav button').forEach((btn) => {
        btn.onclick = () => {
            container.querySelectorAll('.bios-nav button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const target = container.querySelector(`[data-section="${btn.dataset.goto}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            HQAudio.uiClick();
        };
    });

    const memRange = container.querySelector('[data-bios-key="memory"]');
    if (memRange) memRange.oninput = () => {
        container.querySelector(`#${p}memLabel`).textContent = `${memRange.value} MB`;
        container.querySelector(`#${p}memBar`).style.width = `${Math.min(100, Number(memRange.value) / 16384 * 100)}%`;
    };

    container.querySelector(`#${p}runDiag`).onclick = () => {
        HQAudio.uiClick();
        const log = container.querySelector(`#${p}diagLog`);
        const lines = [
            '[OK] Barramento neural ............ 5.8 GHz',
            '[OK] Córtex pré-frontal ........... sincronizado',
            '[OK] Amígdala ..................... monitorando',
            `[OK] Memória ....................... ${collect().memory} MB`,
            `[OK] VHD SQLite .................... ${state.files.length} entradas`,
            '[OK] WebAssembly .................. Cognitive-VM pronta'
        ];
        let i = 0;
        log.textContent = '';
        const timer = setInterval(() => {
            log.textContent += lines[i++] + '\n';
            if (i >= lines.length) clearInterval(timer);
        }, 110);
    };

    container.querySelector(`#${p}bootBtn`).onclick = async () => {
        HQAudio.uiClick();
        await saveSettings(collect());
        if (onBoot) onBoot();
    };
    if (onSetup) container.querySelector(`#${p}setupBtn`).onclick = () => { HQAudio.uiClick(); onSetup(); };
    container.querySelector(`#${p}resetBtn`).onclick = async () => {
        if (!confirm('Restaurar todas as configurações da BIOS?')) return;
        await resetSettings();
        renderBiosForm(container, { embedded, onBoot, onSetup });
    };

    const onKey = (e) => {
        if (e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            document.removeEventListener('keydown', onKey);
            container.querySelector(`#${p}bootBtn`).click();
        }
        if (e.key === 'Escape' && embedded) {
            document.removeEventListener('keydown', onKey);
            const win = container.closest('.window');
            if (win && win.querySelector('.win-close')) win.querySelector('.win-close').click();
        }
    };
    document.addEventListener('keydown', onKey);

    return { collect };
}

function fieldLabel(label) {
    return `<span>${label}</span>`;
}
function checkbox(prefix, key, label, value) {
    return `<label class="qz-check" style="grid-column:1/-1"><input type="checkbox" data-bios-key="${key}" ${value ? 'checked' : ''}>${label}</label>`;
}
function select(prefix, key, label, options, value) {
    return `<label>${fieldLabel(label)}<select data-bios-key="${key}">${options.map(([v, t]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
}
function range(prefix, key, label, value, min, max, step) {
    return `<label>${fieldLabel(label)}<input type="range" data-bios-key="${key}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
}

export function openBiosApp(containerId) {
    renderBiosForm(document.getElementById(containerId), {
        embedded: true,
        onBoot: () => import('./boot.js').then((m) => m.startBootSequence()),
        onSetup: () => import('./boot.js').then((m) => m.showSetup())
    });
}

export { DEFAULT_SETTINGS };
