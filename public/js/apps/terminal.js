import { defineApp } from '../core/app-registry.js';
import { state, cogStats } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';
import { getSettings } from '../core/settings.js';
import { Kernel } from '../kernel/cognitive-kernel.js';

defineApp('terminal', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="term-screen" id="term_screen">
                <div style="border-bottom:1px solid #14532d;padding-bottom:8px;margin-bottom:8px">
                    <b>Quinzuo OS Terminal 5.8</b> · shell híbrido (Linux-like + JS)<br>
                    <span style="color:#22c55e">Digite <b>help</b> para ver os comandos. Use <b>js &lt;código&gt;</b> para executar JavaScript.</span>
                </div>
                <div class="term-output" id="term_out"></div>
                <div class="term-prompt">
                    <span>quinzuo@os:~$</span>
                    <input type="text" id="term_in" autocomplete="off" spellcheck="false" placeholder="help, ls, js 1+1, inject alert(1), curl https://...">
                </div>
            </div>`;

        const input = el.querySelector('#term_in');
        const out = el.querySelector('#term_out');
        const history = [];
        let histIndex = 0;

        function print(text, cls = '') {
            const div = document.createElement('div');
            if (cls) div.className = cls;
            div.textContent = text;
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;
        }

        async function run(raw) {
            const cmd = raw.trim();
            if (!cmd) return;
            history.push(cmd);
            histIndex = history.length;
            print(`quinzuo@os:~$ ${cmd}`, 'text-emerald-300');

            const [name, ...args] = cmd.split(/\s+/);
            const rest = cmd.slice(name.length).trim();
            const lower = name.toLowerCase();

            switch (lower) {
                case 'clear': out.innerHTML = ''; return;
                case 'help':
                    print([
                        'SISTEMA: help | clear | history | date | whoami | uname | neofetch | uptime',
                        'ARQUIVOS: ls [vhd] | cat <id> | touch <nome> | write <id> <texto> | rm <id> | rename <id> <nome>',
                        'APPS: open <app> | qnz <id> | cortex | kernel | bios | config | flops',
                        'REDE: curl <url> | whois <dominio>',
                        'JAVASCRIPT: js <código> | inject <código> | eval <código>',
                        'SHELL: qualquer outro comando é enviado ao host Node.js (com proteção básica).'
                    ].join('\n'));
                    return;
                case 'history': print(history.map((h, i) => `${i + 1}  ${h}`).join('\n')); return;
                case 'date': print(new Date().toString()); return;
                case 'whoami': print('quinzuo (córtex pré-frontal · desenvolvimento feminino · 15 anos)'); return;
                case 'uname': print('QuinzuoOS 5.8 Cognitive-VM x86_wasm GNU/Feminino'); return;
                case 'uptime': print(`Uptime: ${Math.floor((Date.now() - state.startTime) / 1000)}s · Capacidade ${cogStats.baseCap}`); return;
                case 'neofetch':
                    print(`       /\\\n      /  \\\n     /\\   \\\n    /      \\\n   /   ,,   \\\n  /   |  |   \\\n /_-''    ''-_\\\nquinzuo@quinzuo-os\n---------------\nOS: Quinzuo OS Static 5.8\nKernel: Cognitive-VM (WebAssembly)\nCórtex: ${cogStats.cortex}\nCapacidade: ${cogStats.baseCap}\nShell: qsh 5.8`, 'text-cyan-200');
                    return;
                case 'ls': {
                    const files = args[0] === 'vhd' || !args.length
                        ? state.files
                        : state.files.filter((f) => f.name.includes(args[0]));
                    print(files.map((f) => `${String(f.id).padStart(4)}  ${f.is_url ? '🌐' : '📄'}  ${f.name}`).join('\n') || '(vazio)');
                    return;
                }
                case 'cat': {
                    const f = state.files.find((x) => String(x.id) === args[0] || x.name === args[0]);
                    print(f ? String(f.content).slice(0, 20000) : `cat: ${args[0]}: arquivo não encontrado`);
                    return;
                }
                case 'touch': {
                    if (!args[0]) { print('uso: touch <nome>'); return; }
                    const r = await BackendFS.saveFile(args[0], 'text/plain', '', false);
                    print(r ? `criado: ${args[0]}` : 'falha ao criar');
                    return;
                }
                case 'write': {
                    const f = state.files.find((x) => String(x.id) === args[0]);
                    if (!f) { print('uso: write <id> <texto>'); return; }
                    const text = cmd.slice(cmd.indexOf(args[0]) + args[0].length).trim();
                    await BackendFS.updateFile(f.id, { content: text });
                    print(`gravado em ${f.name}`);
                    return;
                }
                case 'rm': {
                    const f = state.files.find((x) => String(x.id) === args[0] || x.name === args[0]);
                    if (!f) { print(`rm: ${args[0]}: inexistente`); return; }
                    await BackendFS.trashFile(f.id);
                    print(`removido (lixeira): ${f.name}`);
                    return;
                }
                case 'rename': {
                    const f = state.files.find((x) => String(x.id) === args[0]);
                    if (!f || !args[1]) { print('uso: rename <id> <novo nome>'); return; }
                    await BackendFS.renameFile(f.id, args[1]);
                    print(`${f.name} → ${args[1]}`);
                    return;
                }
                case 'open': {
                    openApp(args.join('-') || 'cortex');
                    print(`abrindo ${args.join('-') || 'cortex'}`);
                    return;
                }
                case 'cortex': openApp('cortex'); return;
                case 'kernel': print(`Kernel v${Kernel.versao()} · base ${Kernel.capacidadeBase()} · ciclos ${Kernel.ciclos()}`); return;
                case 'bios': openApp('bios'); return;
                case 'config': openApp('config'); return;
                case 'flops': openApp('floppy'); return;
                case 'qnz': {
                    const f = state.files.find((x) => String(x.id) === args[0] || x.name.includes(args[0] || ''));
                    if (!f) { print('qnz: arquivo não encontrado'); return; }
                    openApp('qnz-runner', f);
                    return;
                }
                case 'js':
                case 'eval': {
                    try {
                        const logs = [];
                        const fakeConsole = {
                            log: (...a) => logs.push(a.map(String).join(' ')),
                            warn: (...a) => logs.push('⚠ ' + a.map(String).join(' ')),
                            error: (...a) => logs.push('✖ ' + a.map(String).join(' '))
                        };
                        const fn = new Function('console', 'Quinzuo', 'cogStats', `"use strict";\n${rest}`);
                        const result = fn(fakeConsole, state, cogStats);
                        print(logs.join('\n') + (result !== undefined ? `\n→ ${String(result)}` : ''), 'text-fuchsia-300');
                    } catch (err) { print(`JS Error: ${err.message}`, 'text-red-400'); }
                    return;
                }
                case 'inject': {
                    const frames = [...document.querySelectorAll('iframe[data-qnz="1"]')];
                    frames.forEach((frame) => frame.contentWindow.postMessage({ type: 'QZ_INJECT', code: rest }, '*'));
                    print(`código injetado em ${frames.length} janela(s) .QNZ.`, 'text-fuchsia-300');
                    return;
                }
                case 'curl': {
                    if (!args[0]) { print('uso: curl <url>'); return; }
                    print('consultando...');
                    const res = await fetch('/api/net/curl', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: args[0] })
                    }).then((r) => r.json());
                    print(res.error ? `curl: ${res.error}` : (res.body || '').slice(0, 20000));
                    return;
                }
                case 'whois': {
                    if (!args[0]) { print('uso: whois <dominio>'); return; }
                    print('consultando WHOIS...');
                    const res = await fetch('/api/net/whois', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain: args[0] })
                    }).then((r) => r.json());
                    print(res.error ? `whois: ${res.error}` : (res.body || '').slice(0, 20000));
                    return;
                }
                case 'sudo': print('quinzuo não precisa de sudo. O córtex já confia em você. 😌'); return;
            }

            try {
                const res = await fetch('/api/terminal', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: cmd })
                }).then((r) => r.json());
                print(res.output || '');
            } catch (_) { print('Erro de conexão com o host.', 'text-red-400'); }
        }

        input.onkeydown = async (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value;
                input.value = '';
                await run(cmd);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                histIndex = Math.max(0, histIndex - 1);
                input.value = history[histIndex] || '';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                histIndex = Math.min(history.length, histIndex + 1);
                input.value = history[histIndex] || '';
            }
        };
        el.querySelector('#term_screen').onclick = () => input.focus();
        setTimeout(() => input.focus(), 150);
    }
});
