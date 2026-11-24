import { defineApp } from '../core/app-registry.js';
import { readLS, writeLS } from '../core/state.js';
import { HQAudio } from '../core/audio.js';

const ACCENTS = {
    roxo: { primary: '#8b5cf6', cyan: '#06b6d4', label: 'Roxo / Valsa' },
    ciano: { primary: '#06b6d4', cyan: '#22d3ee', label: 'Ciano' },
    funk: { primary: '#ff007f', cyan: '#00ff00', label: 'Rosa / Funk' },
    verde: { primary: '#22c55e', cyan: '#a3e635', label: 'Verde' }
};

function readCss() {
    try { return localStorage.getItem('qz_custom_css') || ''; }
    catch (_) { return ''; }
}

defineApp('personalizar', {
    render(containerId) {
        const el = document.getElementById(containerId);
        const widgets = readLS('qz_widgets', { neoFetch: true }) || {};
        const accentName = readLS('qz_accent', 'roxo');

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🖌️ PERSONALIZAR OS</span>
                    <span style="font-size:10px;color:#94a3b8">CSS do usuário · widgets do desktop</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="pz_apply">✔ Aplicar</button>
                    <button class="app-bar-btn" id="pz_reset">↺ Resetar</button>
                </div>
                <div class="app-content" style="padding:12px;display:flex;flex-direction:column;gap:14px">
                    <div class="qz-card">
                        <div class="qz-card-title">Acento da interface</div>
                        <div style="display:flex;gap:7px;flex-wrap:wrap">
                            ${Object.keys(ACCENTS).map((key) => `<button class="qz-btn qz-btn-sm ${key === accentName ? 'qz-btn-primary' : 'qz-btn-ghost'}" data-accent="${key}">${ACCENTS[key].label}</button>`).join('')}
                        </div>
                        <div id="pz_accent_label" style="font-size:10px;color:#94a3b8;margin-top:7px">Atual: ${ACCENTS[accentName] ? ACCENTS[accentName].label : 'Roxo / Valsa'}</div>
                    </div>
                    <div class="qz-card">
                        <div class="qz-card-title">Widgets</div>
                        <label class="qz-check"><input type="checkbox" id="pz_neo" ${widgets.neoFetch !== false ? 'checked' : ''}> Mostrar neofetch widget (#neoFetchWidget)</label>
                    </div>
                    <div class="qz-card" style="flex:1;min-height:180px;display:flex;flex-direction:column">
                        <div class="qz-card-title">CSS personalizado (#user_custom_css)</div>
                        <textarea id="pz_css" class="code-editor" spellcheck="false" style="flex:1;min-height:140px;user-select:text;border:1px solid #334155;border-radius:6px" placeholder="/* Seu CSS aparece aqui */">${escapeHtml(readCss())}</textarea>
                        <div style="font-size:9px;color:#64748b;margin-top:5px">Exemplo: .window { border-radius: 14px; } — aplicado globalmente após clicar em Aplicar.</div>
                    </div>
                </div>
                <div class="app-log" id="pz_status" style="max-height:56px">Personalização pronta.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        let currentAccent = ACCENTS[accentName] ? accentName : 'roxo';

        function escapeHtml(text) {
            return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function status(text) {
            $('pz_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function applyAccent(name) {
            currentAccent = ACCENTS[name] ? name : 'roxo';
            const accent = ACCENTS[currentAccent];
            document.documentElement.style.setProperty('--quinzuo-primary', accent.primary);
            document.documentElement.style.setProperty('--quinzuo-cyan', accent.cyan);
            el.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('qz-btn-primary', b.dataset.accent === currentAccent));
            el.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('qz-btn-ghost', b.dataset.accent !== currentAccent));
            $('pz_accent_label').textContent = 'Atual: ' + accent.label;
            writeLS('qz_accent', currentAccent);
        }

        function applyWidgets() {
            const stateWidgets = { neoFetch: $('pz_neo').checked };
            writeLS('qz_widgets', stateWidgets);
            const widget = document.getElementById('neoFetchWidget');
            if (widget) widget.classList.toggle('hidden', !stateWidgets.neoFetch);
        }

        function applyCss() {
            const css = $('pz_css').value;
            try { localStorage.setItem('qz_custom_css', css); } catch (_) { /* storage indisponível */ }
            const style = document.getElementById('user_custom_css');
            if (style) style.textContent = css;
        }

        function applyAll() {
            HQAudio.uiClick();
            applyCss();
            applyWidgets();
            applyAccent(currentAccent);
            status('Aplicado: CSS, acento e widgets salvos localmente.');
        }

        function reset() {
            HQAudio.uiClick();
            $('pz_css').value = '';
            $('pz_neo').checked = true;
            applyCss();
            applyWidgets();
            applyAccent('roxo');
            status('Resetado ao visual padrão do Quinzuo OS.');
        }

        el.querySelectorAll('[data-accent]').forEach((btn) => {
            btn.onclick = () => {
                HQAudio.uiClick();
                applyAccent(btn.dataset.accent);
                status(`Acento "${ACCENTS[btn.dataset.accent].label}" selecionado (clique em Aplicar para confirmar).`);
            };
        });
        $('pz_apply').onclick = applyAll;
        $('pz_reset').onclick = reset;
        $('pz_neo').onchange = () => { HQAudio.uiClick(); applyWidgets(); };

        applyAccent(currentAccent);
        applyWidgets();
    }
});
