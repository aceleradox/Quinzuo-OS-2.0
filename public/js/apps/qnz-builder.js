import { defineApp } from '../core/app-registry.js';
import { state } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { serializeQnz, buildQnzHtml, escapeHtml } from '../core/qnz.js';

function slug(text) {
    return String(text || 'app')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
}

function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

defineApp('qnzbuilder', {
    render(containerId) {
        const el = document.getElementById(containerId);

        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🏗️ QUINZUO QNZ BUILDER</span>
                    <span class="qz-badge">criador de apps / extensões .QNZ</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="qb_preview">👁️ Pré-visualizar</button>
                    <button class="app-bar-btn" id="qb_save">💾 Salvar .QNZ</button>
                    <button class="app-bar-btn" id="qb_install">⚡ Instalar e abrir</button>
                    <button class="app-bar-btn" id="qb_native">🧩 Gerar app nativo .app.js</button>
                    <button class="app-bar-btn" id="qb_download">↓ Baixar</button>
                </div>
                <div class="qb-grid">
                    <div class="qb-meta">
                        <div class="qb-title">Manifesto da extensão</div>
                        <label>ID do app<input id="qb_id" class="qz-input" value="meu-app-quinzuo" spellcheck="false"></label>
                        <label>Título<input id="qb_title" class="qz-input" value="Meu App Quinzuo"></label>
                        <label>Nome do arquivo<input id="qb_name" class="qz-input" value="meu-app.qnz" spellcheck="false"></label>
                        <label>Ícone<input id="qb_icon" class="qz-input" value="⚡" maxlength="8"></label>
                        <label>Descrição<input id="qb_desc" class="qz-input" value="Aplicativo criado no Quinzuo QNZ Builder"></label>
                        <div class="qb-row">
                            <label>Largura<input id="qb_width" class="qz-input" type="number" value="760" min="320" max="1600"></label>
                            <label>Altura<input id="qb_height" class="qz-input" type="number" value="520" min="200" max="1200"></label>
                        </div>
                        <div class="qb-row">
                            <label>Cor primária<input id="qb_primary" type="color" value="#8b5cf6"></label>
                            <label>Cor ciano<input id="qb_cyan" type="color" value="#06b6d4"></label>
                            <label>Fundo<input id="qb_bg" type="color" value="#0f172a"></label>
                        </div>
                        <div class="qb-hint">Gera um pacote .QNZ (JSON v1) com <b>html</b>, <b>css</b>, <b>js</b> e metadados de janela — igual a uma extensão.</div>
                    </div>
                    <div class="qb-code">
                        <div class="app-tabs">
                            <button id="qb_tab_html" class="active">HTML</button>
                            <button id="qb_tab_css">CSS</button>
                            <button id="qb_tab_js">JS</button>
                            <button id="qb_tab_preview">Preview</button>
                        </div>
                        <div id="qb_pane_html" class="qb-pane"><textarea id="qb_html" class="code-editor" spellcheck="false">&lt;div class="card"&gt;&lt;h1&gt;Olá, Quinzuo!&lt;/h1&gt;&lt;p&gt;Meu primeiro app .QNZ.&lt;/p&gt;&lt;/div&gt;</textarea></div>
                        <div id="qb_pane_css" class="qb-pane hidden"><textarea id="qb_css" class="code-editor" spellcheck="false">.card { background:#111c33; border:1px solid #334155; border-radius:14px; padding:24px; text-align:center; }
h1 { color:#22d3ee; }</textarea></div>
                        <div id="qb_pane_js" class="qb-pane hidden"><textarea id="qb_js" class="code-editor" spellcheck="false">console.log('Quinzuo QNZ Builder: app iniciado');</textarea></div>
                        <div id="qb_pane_preview" class="qb-pane hidden"><iframe id="qb_frame" class="qnz-preview-frame" title="Prévia do app"></iframe></div>
                    </div>
                </div>
                <div class="app-log" id="qb_log" style="max-height:80px">Pronto. Crie sua extensão e salve no VHD.</div>
            </div>`;

        const $ = (id) => el.querySelector(String(id).startsWith('#') ? id : '#' + id);
        const status = (text) => {
            $('#qb_log').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
            console.info('[QNZ Builder]', text);
        };

        function buildPackage() {
            return {
                format: 'qnz',
                version: 1,
                title: $('#qb_title').value.trim() || 'App Quinzuo',
                name: $('#qb_name').value.trim() || 'app.qnz',
                icon: $('#qb_icon').value.trim() || '⚡',
                description: $('#qb_desc').value.trim(),
                theme: {
                    primary: $('#qb_primary').value,
                    cyan: $('#qb_cyan').value,
                    background: $('#qb_bg').value,
                    dockStyle: 'glass'
                },
                window: {
                    width: Number($('#qb_width').value) || 760,
                    height: Number($('#qb_height').value) || 520,
                    resizable: true
                },
                html: $('#qb_html').value,
                css: $('#qb_css').value,
                js: $('#qb_js').value
            };
        }

        function showTab(tab) {
            ['html', 'css', 'js', 'preview'].forEach((key) => {
                const pane = $(`#qb_pane_${key}`);
                const btn = $(`#qb_tab_${key}`);
                if (pane) pane.classList.toggle('hidden', key !== tab);
                if (btn) btn.classList.toggle('active', key === tab);
            });
        }
        ['html', 'css', 'js', 'preview'].forEach((key) => { $(`#qb_tab_${key}`).onclick = () => showTab(key); });

        function preview() {
            showTab('preview');
            $('#qb_frame').srcdoc = buildQnzHtml(buildPackage());
            status('Prévia gerada.');
        }

        async function saveQnz(openAfter = false) {
            HQAudio.uiClick();
            const pkg = buildPackage();
            const name = /\.qnz$/i.test(pkg.name) ? pkg.name : `${slug(pkg.title)}.qnz`;
            const content = serializeQnz({ ...pkg, name });
            const result = await BackendFS.saveFile(name, 'application/x-qnz', content, false);
            if (!result) { status(`Falha ao salvar ${name}.`); return null; }
            status(`${name} salvo no VHD (QNZ v1).`);
            const file = (state.files || []).find((f) => String(f.id) === String(result.id) || f.name === name);
            if (openAfter && file) {
                const { openApp } = await import('../core/window-manager.js');
                openApp('qnz-runner', file);
                status(`${pkg.title} instalado e aberto.`);
            }
            return file;
        }

        function nativeSource() {
            const pkg = buildPackage();
            const appId = slug($('#qb_id').value || pkg.title);
            return [
                `import { defineApp } from '../core/app-registry.js';`,
                ``,
                `defineApp(${JSON.stringify(appId)}, {`,
                `    name: ${JSON.stringify(pkg.title)},`,
                `    icon: ${JSON.stringify(pkg.icon)},`,
                `    category: 'Utilidades',`,
                `    desc: ${JSON.stringify(pkg.description || 'App nativo criado pelo Quinzuo QNZ Builder')},`,
                `    width: ${pkg.window.width}, height: ${pkg.window.height},`,
                `    render(containerId, fileData, winId, info) {`,
                `        const el = document.getElementById(containerId);`,
                `        el.innerHTML = ${JSON.stringify(pkg.html)};`,
                `        const style = document.createElement('style');`,
                `        style.textContent = ${JSON.stringify(pkg.css)};`,
                `        el.appendChild(style);`,
                `        const appId = ${JSON.stringify(appId)};`,
                `        try { new Function('el', 'appId', 'fileData', 'winId', 'info', ${JSON.stringify(pkg.js)})(el, appId, fileData, winId, info); }`,
                `        catch (err) { console.warn('[App] falha no script:', err); }`,
                `    }`,
                `});`
            ].join('\n');
        }

        async function saveNative() {
            HQAudio.uiClick();
            const appId = slug($('#qb_id').value || $('#qb_title').value);
            const name = `${appId}.app.js`;
            const source = nativeSource();
            const result = await BackendFS.saveFile(name, 'text/javascript', source, false);
            if (!result) { status(`Falha ao salvar ${name}.`); return; }
            status(`${name} salvo no VHD.`);
            try {
                const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
                await import(/* webpackIgnore: true */ url);
                URL.revokeObjectURL(url);
                const { listApps } = await import('../core/app-registry.js');
                window.APPS = listApps();
                const { renderStartMenu } = await import('../core/desktop.js');
                renderStartMenu();
                status(`App nativo ${appId} registrado ao vivo no menu iniciar.`);
            } catch (err) {
                status(`App salvo, mas falhou ao registrar: ${err.message}`);
            }
        }

        $('#qb_preview').onclick = preview;
        $('#qb_save').onclick = () => saveQnz(false);
        $('#qb_install').onclick = () => saveQnz(true);
        $('#qb_native').onclick = saveNative;
        $('#qb_download').onclick = () => {
            HQAudio.uiClick();
            const name = $('#qb_name').value.trim() || 'app.qnz';
            download(/\.app\.js$/i.test(name) ? name : name, serializeQnz(buildPackage()), 'application/x-qnz');
            status('Download do pacote .QNZ iniciado.');
        };

        preview();
    }
});
