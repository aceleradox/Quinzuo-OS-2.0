import { defineApp } from '../core/app-registry.js';
import { cogStats, events } from '../core/state.js';
import { getSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from '../core/settings.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';

const WALLPAPERS = {
    nebula: 'radial-gradient(circle at 20% 20%, #1e1b4b 0%, #0f172a 45%, #020617 90%)',
    grid: 'linear-gradient(rgba(6,182,212,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.12) 1px, transparent 1px), radial-gradient(circle at 50% 40%, #0f172a, #020617)',
    plain: '#0b1120'
};

defineApp('config', {
    render(containerId) {
        const el = document.getElementById(containerId);
        const s = getSettings();

        function check(key, label, desc, value) {
            return `<label class="config-row"><div>${label}<small>${desc}</small></div>
                <input type="checkbox" data-cfg-key="${key}" ${value ? 'checked' : ''}></label>`;
        }
        function select(key, label, desc, options, value) {
            return `<label class="config-row"><div>${label}<small>${desc}</small></div>
                <select data-cfg-key="${key}">${options.map(([v, t]) => `<option value="${v}" ${String(value) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
        }
        function range(key, label, desc, value, min, max, step) {
            return `<label class="config-row"><div>${label}<small>${desc}</small></div>
                <div style="display:flex;align-items:center;gap:8px">
                    <input type="range" data-cfg-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
                    <b id="cfg_val_${key}" style="font-size:10px;color:#22d3ee;min-width:48px;text-align:right">${value}</b>
                </div></label>`;
        }

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">⚙️ CONFIGURAÇÃO DO SISTEMA</span>
                    <span style="font-size:10px;color:#94a3b8">Capacidade atual: <b id="cfg_cap" style="color:#22d3ee">${Number(cogStats.baseCap).toFixed(2)}</b> / 10</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="cfg_save">💾 Salvar alterações</button>
                    <button class="app-bar-btn" id="cfg_reset">↺ Restaurar padrões</button>
                </div>
                <div class="config-tabs">
                    <button data-tab="geral" class="active">Geral</button>
                    <button data-tab="cortex">Córtex</button>
                    <button data-tab="seguranca">Segurança</button>
                    <button data-tab="armazenamento">Armazenamento</button>
                    <button data-tab="rede">Rede</button>
                </div>
                <div class="app-content config-body">
                    <section data-section="geral">
                        <div class="qz-card-title">Interface e inicialização</div>
                        ${select('theme', 'Perfil de desktop', 'Valsa (padrão) ou Baile Funk (autonomia total).', [['valsa', 'Modo Valsa (USER)'], ['funk', 'Baile Funk']], s.theme)}
                        ${select('wallpaper', 'Papel de parede', 'Aplicado ao #desktop imediatamente após salvar.', [['nebula', 'Nebulosa'], ['grid', 'Grade neural'], ['plain', 'Sólido']], s.wallpaper)}
                        ${select('language', 'Idioma do sistema', 'Idioma da interface e das mensagens.', [['pt-BR', 'Português (BR)'], ['en-US', 'English (US)']], s.language)}
                        ${check('audio', 'Áudio de interface (HQAudio)', 'Cliques, abertura e fechamento de janelas.', s.audio)}
                        ${check('autoBoot', 'Boot automático sem DEL', 'Entra no sistema sem exigir a tecla de setup.', s.autoBoot)}
                        ${select('bootDevice', 'Dispositivo de boot', 'Partição montada na inicialização.', [['vhd1', 'VHD 1'], ['vhd2', 'VHD 2'], ['vhd3', 'VHD 3'], ['vhd4', 'VHD 4'], ['flop', 'FLOP removível'], ['recovery', 'Recuperação']], s.bootDevice)}
                    </section>
                    <section data-section="cortex" hidden>
                        <div class="qz-card-title">Núcleo cognitivo pré-frontal</div>
                        ${range('cortexFreq', 'Frequência do córtex (MHz)', 'Relógio lógico do núcleo cognitivo.', s.cortexFreq, 800, 5800, 100)}
                        ${range('memory', 'Memória neural (MB)', 'Memória disponível para processos e arquivos.', s.memory, 512, 16384, 512)}
                        ${check('vmq', 'Virtualização de maturidade (VM-Q)', 'Estabilidade emulada +2.5 de capacidade.', s.vmq)}
                        ${check('decisao', 'Otimização de decisão', 'Cálculo racional em vez de impulsos. +1.2 cap.', s.decisao)}
                        ${check('overclock', 'Overclock cognitivo', 'Força extra de processamento. +1.5 cap.', s.overclock)}
                        ${check('maturityOverclock', 'Overclock na Maturidade', 'Foco acelerado / 92% de córtex. +1.8 cap.', s.maturityOverclock)}
                        ${check('supremo', 'Modo cognitivo supremo', 'Capacidade fixada em 10.0 e frieza absoluta.', s.supremo)}
                        <div style="font-size:10px;color:#64748b;margin-top:10px">Capacidade é recalculada a partir da base 5.8 na aplicação das configurações.</div>
                    </section>
                    <section data-section="seguranca" hidden>
                        <div class="qz-card-title">Segurança e identidade</div>
                        ${check('secureBoot', 'Boot seguro do córtex', 'Valida a integridade do núcleo antes de iniciar.', s.secureBoot)}
                        ${select('theme', 'Perfil visual de segurança', 'O tema funk altera paleta e karakter do sistema.', [['valsa', 'Valsa — controlado'], ['funk', 'Funk — autonomia progressiva']], s.theme)}
                        <div class="qz-card" style="margin-top:10px;font-size:10px;color:#cbd5e1">
                            As preferências são gravadas no SQLite do host e espelhadas em localStorage (<span class="qz-mono">qz_settings</span>).
                        </div>
                    </section>
                    <section data-section="armazenamento" hidden>
                        <div class="qz-card-title">Partições VHD</div>
                        ${check('implanol', 'Modo Implanol Virtual', 'Bloqueia a criação de novas partições VHD.', s.implanol)}
                        ${select('bootDevice', 'VHD de montagem automática', 'Define a partição padrão para novos arquivos.', [['vhd1', 'VHD 1'], ['vhd2', 'VHD 2'], ['vhd3', 'VHD 3'], ['vhd4', 'VHD 4']], s.bootDevice)}
                        <div class="qz-card" style="margin-top:10px;font-size:10px;color:#cbd5e1">
                            Partições detectadas: <b id="cfg_vhds">${getSettings().bootDevice || 'vhd1'}</b> ·Gerencie arquivos FLOPs no app Partições (VHD).
                        </div>
                    </section>
                    <section data-section="rede" hidden>
                        <div class="qz-card-title">Conectividade</div>
                        <div class="config-row"><div>Host Quinzuo<small>Serviço local responsável por SQLite, FLOPs e redirecionamentos.</small></div>
                            <button class="qz-btn qz-btn-sm qz-btn-ghost" id="cfg_ping">Testar /api/ping</button></div>
                        <div class="config-row"><div>Ferramentas de rede<small>WHOIS e CURL via API local do sistema.</small></div>
                            <button class="qz-btn qz-btn-sm qz-btn-primary" id="cfg_nettools">Abrir WhoIs Curl</button></div>
                        <div class="qz-card" style="margin-top:10px;font-size:10px;color:#94a3b8" id="cfg_net_status">Nenhum teste executado nesta sessão.</div>
                    </section>
                    <div style="font-size:9px;color:#64748b;margin-top:16px;border-top:1px solid #1e293b;padding-top:8px">
                        Mudanças são salvas no SQLite + localStorage. Padrões: ${Object.keys(DEFAULT_SETTINGS).length} chaves do sistema.
                    </div>
                </div>
                <div class="app-log" id="cfg_status">Configurações carregadas. Salve para aplicar ao sistema.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);

        function status(text) {
            $('cfg_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function applyWallpaper(wallpaper) {
            const name = WALLPAPERS[wallpaper] ? wallpaper : 'nebula';
            const bg = WALLPAPERS[name];
            document.documentElement.style.setProperty('--desktop-bg', bg);
            const desktop = document.getElementById('desktop');
            if (desktop) {
                desktop.classList.remove('qz-wall-nebula', 'qz-wall-grid', 'qz-wall-plain');
                desktop.classList.add('qz-wall-' + name);
                desktop.style.background = bg;
                desktop.style.backgroundSize = name === 'grid' ? '28px 28px, 28px 28px, cover' : 'cover';
                desktop.style.backgroundPosition = 'center';
            }
        }

        function syncForm(settings) {
            el.querySelectorAll('[data-cfg-key]').forEach((input) => {
                const key = input.dataset.cfgKey;
                const value = settings[key];
                if (input.type === 'checkbox') input.checked = !!value;
                else input.value = value ?? '';
                const label = el.querySelector('#cfg_val_' + key);
                if (label) label.textContent = String(value ?? '');
            });
        }

        function collect() {
            const patch = {};
            el.querySelectorAll('[data-cfg-key]').forEach((input) => {
                const key = input.dataset.cfgKey;
                if (input.type === 'checkbox') patch[key] = input.checked;
                else if (input.type === 'range' || input.type === 'number') patch[key] = Number(input.value);
                else patch[key] = input.value;
            });
            return patch;
        }

        async function save() {
            HQAudio.uiClick();
            const patch = collect();
            await saveSettings(patch);
            applyWallpaper(patch.wallpaper);
            $('cfg_cap').textContent = Number(cogStats.baseCap).toFixed(2);
            status('Configurações salvas no SQLite + localStorage e aplicadas ao sistema.');
        }

        async function reset() {
            HQAudio.uiClick();
            await resetSettings();
            syncForm(DEFAULT_SETTINGS);
            applyWallpaper(DEFAULT_SETTINGS.wallpaper);
            $('cfg_cap').textContent = Number(cogStats.baseCap).toFixed(2);
            status('Valores padrão restaurados e persistidos.');
        }

        async function ping() {
            HQAudio.uiClick();
            $('cfg_net_status').textContent = 'Consultando host...';
            try {
                const res = await fetch('/api/ping');
                const data = await res.json();
                $('cfg_net_status').textContent = `Host online: ${data.status || 'alive'} · kernel ${data.kernel || '—'}`;
            } catch (err) {
                $('cfg_net_status').textContent = `Host offline: ${err.message}`;
            }
        }

        el.querySelectorAll('.config-tabs button').forEach((btn) => {
            btn.onclick = () => {
                HQAudio.uiClick();
                el.querySelectorAll('.config-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                el.querySelectorAll('[data-section]').forEach((section) => {
                    section.hidden = section.dataset.section !== btn.dataset.tab;
                });
            };
        });
        el.querySelectorAll('input[type="range"][data-cfg-key]').forEach((input) => {
            input.addEventListener('input', () => {
                const label = el.querySelector('#cfg_val_' + input.dataset.cfgKey);
                if (label) label.textContent = input.value;
            });
        });
        $('cfg_save').onclick = save;
        $('cfg_reset').onclick = reset;
        $('cfg_ping').onclick = ping;
        $('cfg_nettools').onclick = () => { HQAudio.uiClick(); openApp('nettools'); };

        function onSettingsChanged() {
            if (!document.body.contains(el)) {
                document.removeEventListener(events.SETTINGS_CHANGED, onSettingsChanged);
                return;
            }
            syncForm(getSettings());
            $('cfg_cap').textContent = Number(cogStats.baseCap).toFixed(2);
        }
        document.addEventListener(events.SETTINGS_CHANGED, onSettingsChanged);

        applyWallpaper(s.wallpaper);
    }
});
