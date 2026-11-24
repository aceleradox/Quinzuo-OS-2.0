import { defineApp } from '../core/app-registry.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { assemble, disassemble, hexDump, createVM } from '../kernel/assembler.js';

const DEFAULT_CODE = `; FantASM — ISA didática de 8 bits
; Registradores R0-R7 + ACC
    MOV R0, 5
    MOV R1, 3
loop:
    ADD ACC, R0
    SUB R1, 1
    CMP R1, 0
    JNZ loop
    OUT ACC
    HLT`;

defineApp('fantasm', {
    render(containerId, fileData) {
        const el = document.getElementById(containerId);
        const initial = fileData && fileData.type !== 'application/x-qnz' ? fileData.content : DEFAULT_CODE;
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge" style="border-color:#a78bfa">👻 FantASM</span>
                    <input type="text" id="fa_name" class="qz-input" style="width:130px" value="${escapeAttr(fileData ? fileData.name : 'programa.asm')}">
                    <button class="app-bar-btn" id="fa_asm">⚙️ Montar</button>
                    <button class="app-bar-btn" id="fa_run">▶ Executar</button>
                    <button class="app-bar-btn" id="fa_step">⏭ Passo</button>
                    <button class="app-bar-btn" id="fa_stop">⏹ Parar</button>
                    <button class="app-bar-btn" id="fa_save">💾 Salvar .asm</button>
                    <div class="tool-sep"></div>
                    <label class="text-[9px] text-slate-400">Velocidade <input type="range" id="fa_speed" min="20" max="800" value="150"></label>
                </div>
                <div class="fantasm-grid">
                    <div class="fantasm-code">
                        <div class="app-tabs"><button class="active">Código fonte</button></div>
                        <textarea id="fa_code" class="code-editor" spellcheck="false">${escapeHtml(initial)}</textarea>
                    </div>
                    <div class="fantasm-side">
                        <div class="qz-card-title" style="padding:8px 8px 0">Registradores</div>
                        <div class="fantasm-regs" id="fa_regs"></div>
                        <div class="qz-card-title" style="padding:0 8px 4px">Código de máquina</div>
                        <div class="hexdump" id="fa_hex" style="flex:1;min-height:90px"></div>
                        <div class="qz-card-title" style="padding:4px 8px">Desmontagem</div>
                        <div class="hexdump" id="fa_dis" style="max-height:110px;color:#67e8f9"></div>
                    </div>
                </div>
                <div class="app-log" id="fa_log" style="max-height:90px">// montador pronto · OPCODEs: MOV ADD SUB MUL CMP JMP JZ JNZ OUT PUSH POP HLT</div>
            </div>`;

        const $ = (id) => el.querySelector(`#${id}`);
        let vm = null;
        let timer = null;
        let program = new Uint8Array();

        function log(text) {
            const out = $('fa_log');
            out.textContent += `\n${text}`;
            out.scrollTop = out.scrollHeight;
        }
        function renderRegs() {
            const regs = vm ? vm.registers : assemble($('fa_code').value).program && new Array(9).fill(0);
            const names = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'ACC'];
            $('fa_regs').innerHTML = regs.map((r, i) => `<div class="fantasm-reg"><b>${names[i]}</b> <span>${String(r).padStart(3, '0')}</span></div>`).join('') +
                `<div class="fantasm-reg" style="grid-column:1/-1"><b>PC</b> <span>${vm ? vm.pc : 0}</span> · <b>Z</b> <span>${vm ? Number(vm.flagZero) : 0}</span> · <b>PASSOS</b> <span>${vm ? vm.steps : 0}</span></div>`;
        }
        function doAssemble() {
            const result = assemble($('fa_code').value);
            program = result.program;
            $('fa_hex').textContent = hexDump(program);
            $('fa_dis').textContent = disassemble(program);
            if (result.errors.length) result.errors.forEach((e) => log(`ERRO ${e}`));
            else log(`Montado: ${program.length} bytes · ${Object.keys(result.labels).length} rótulos`);
            vm = createVM(program, (v) => log(`OUT → ${v}`));
            renderRegs();
            return result;
        }

        $('fa_asm').onclick = () => { HQAudio.uiClick(); doAssemble(); };
        $('fa_run').onclick = () => {
            HQAudio.uiClick();
            if (!vm || vm.halted) doAssemble();
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
                if (!vm || !vm.step()) { clearInterval(timer); timer = null; log('Execução finalizada.'); }
                renderRegs();
            }, Number($('fa_speed').value));
        };
        $('fa_step').onclick = () => {
            HQAudio.uiClick();
            if (!vm || vm.halted) doAssemble();
            vm.step(); renderRegs();
        };
        $('fa_stop').onclick = () => { if (timer) clearInterval(timer); timer = null; log('Execução interrompida.'); };
        $('fa_save').onclick = async () => {
            HQAudio.uiClick();
            let name = $('fa_name').value || 'programa.asm';
            if (!name.endsWith('.asm')) name += '.asm';
            if (fileData) await BackendFS.updateFile(fileData.id, { name, content: $('fa_code').value });
            else await BackendFS.saveFile(name, 'text/x-asm', $('fa_code').value, false);
            log(`Salvo: ${name}`);
        };

        doAssemble();
    }
});

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }
