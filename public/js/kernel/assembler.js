// FantASM — montador e VM didáticos (ISA de 8 bits)
const REGISTERS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'ACC'];
const OPS = {
    NOP: 0x00, MOV: 0x01, ADD: 0x02, SUB: 0x03, MUL: 0x04,
    CMP: 0x05, JMP: 0x06, JZ: 0x07, JNZ: 0x08, OUT: 0x09,
    PUSH: 0x0a, POP: 0x0b, HLT: 0xff
};
const OP_NAMES = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));

function regIndex(token) {
    const t = String(token || '').toUpperCase().replace(/,/, '');
    if (t === 'ACC') return 8;
    const m = /^R([0-7])$/.exec(t);
    return m ? Number(m[1]) : -1;
}

// Operando: 0..8 = registrador, 0x80|n = imediato (0..127)
function operandOf(token, labels) {
    const r = regIndex(token);
    if (r >= 0) return r;
    const v = valueOf(token, labels);
    return v === null ? null : 0x80 | (v & 0x7f);
}

function valueOf(token, labels) {
    const t = String(token || '').replace(/,/, '').trim();
    if (/^-?\d+$/.test(t)) return Number(t) & 0xff;
    if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16) & 0xff;
    if (t.toUpperCase() === 'ACC') return 8;
    const r = regIndex(t);
    if (r >= 0) return r;
    if (labels && Object.prototype.hasOwnProperty.call(labels, t)) return labels[t];
    return null;
}

export function assemble(source) {
    const lines = String(source || '').split(/\r?\n/);
    const labels = {};
    const errors = [];
    const firstPass = [];

    lines.forEach((raw, lineNo) => {
        let text = raw.split(';')[0].trim();
        if (!text) return;
        const labelMatch = /^([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(text);
        if (labelMatch) {
            labels[labelMatch[1]] = firstPass.length;
            text = labelMatch[2].trim();
            if (!text) return;
        }
        firstPass.push({ text, lineNo: lineNo + 1 });
    });

    const program = [];
    const listing = [];
    firstPass.forEach(({ text, lineNo }) => {
        const parts = text.split(/\s+/);
        const op = parts[0].toUpperCase();
        const args = parts.slice(1);
        if (!(op in OPS)) { errors.push(`linha ${lineNo}: instrução desconhecida "${op}"`); return; }
        const bytes = [OPS[op]];
        if (['MOV', 'ADD', 'SUB', 'MUL', 'CMP'].includes(op)) {
            if (args.length < 2) { errors.push(`linha ${lineNo}: ${op} precisa de 2 operandos`); return; }
            const dst = regIndex(args[0]);
            const src = operandOf(args[1], labels);
            if (dst < 0 || src === null) { errors.push(`linha ${lineNo}: operando inválido em ${op}`); return; }
            bytes.push(dst, src);
        } else if (['JMP', 'JZ', 'JNZ'].includes(op)) {
            const target = valueOf(args[0], labels);
            if (target === null) { errors.push(`linha ${lineNo}: rótulo desconhecido "${args[0] || ''}"`); return; }
            bytes.push(target);
        } else if (op === 'OUT' || op === 'PUSH' || op === 'POP') {
            const v = args.length ? valueOf(args[0], labels) : 0;
            if (v === null) { errors.push(`linha ${lineNo}: operando inválido em ${op}`); return; }
            bytes.push(v);
        }
        program.push(...bytes);
        listing.push({ address: program.length - bytes.length, bytes, line: text });
    });

    return { program: Uint8Array.from(program), labels, errors, listing };
}

export function disassemble(bytes) {
    const out = [];
    let i = 0;
    while (i < bytes.length) {
        const op = bytes[i++];
        const name = OP_NAMES[op] || `DB 0x${op.toString(16).padStart(2, '0')}`;
        const size = ['MOV', 'ADD', 'SUB', 'MUL', 'CMP'].includes(name) ? 2 :
            (['JMP', 'JZ', 'JNZ', 'OUT', 'PUSH', 'POP'].includes(name) ? 1 : 0);
        const args = Array.from(bytes.slice(i, i + size));
        i += size;
        out.push(`${(i - size - 1).toString(16).padStart(4, '0')}  ${name.padEnd(4)} ${args.map((a) => '0x' + a.toString(16).padStart(2, '0')).join(' ')}`);
    }
    return out.join('\n');
}

export function hexDump(bytes, width = 8) {
    const lines = [];
    for (let i = 0; i < bytes.length; i += width) {
        const chunk = Array.from(bytes.slice(i, i + width));
        lines.push(`${i.toString(16).padStart(4, '0')}  ${chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(width * 3)}  ${chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')}`);
    }
    return lines.join('\n') || '(vazio)';
}

export function createVM(program, onOutput = () => {}) {
    const regs = new Array(9).fill(0);
    const stack = [];
    let pc = 0;
    let flagZero = false;
    let halted = false;
    let steps = 0;

    function readOperand() {
        const raw = program[pc++];
        if (raw & 0x80) return raw & 0x7f;
        return regs[raw] ?? raw;
    }

    function step() {
        if (halted || pc >= program.length) { halted = true; return false; }
        const op = program[pc++];
        steps++;
        switch (op) {
            case OPS.NOP: break;
            case OPS.MOV: { const d = program[pc++]; regs[d] = readOperand(); break; }
            case OPS.ADD: { const d = program[pc++]; regs[d] = (regs[d] + readOperand()) & 0xff; flagZero = regs[d] === 0; break; }
            case OPS.SUB: { const d = program[pc++]; regs[d] = (regs[d] - readOperand()) & 0xff; flagZero = regs[d] === 0; break; }
            case OPS.MUL: { const d = program[pc++]; regs[d] = (regs[d] * readOperand()) & 0xff; flagZero = regs[d] === 0; break; }
            case OPS.CMP: { const d = program[pc++]; flagZero = regs[d] === readOperand(); break; }
            case OPS.JMP: pc = program[pc]; break;
            case OPS.JZ: { const t = program[pc++]; if (flagZero) pc = t; break; }
            case OPS.JNZ: { const t = program[pc++]; if (!flagZero) pc = t; break; }
            case OPS.OUT: onOutput(readOperand()); break;
            case OPS.PUSH: stack.push(readOperand()); break;
            case OPS.POP: { const d = program[pc++]; regs[d] = stack.pop() || 0; break; }
            case OPS.HLT: halted = true; break;
            default: halted = true; onOutput(`ERRO: opcode desconhecido 0x${op.toString(16)}`);
        }
        return !halted;
    }

    return {
        step, regs, stack,
        get pc() { return pc; },
        get steps() { return steps; },
        get halted() { return halted; },
        get flagZero() { return flagZero; },
        get registers() { return REGISTERS.map((name, i) => `${name}=${regs[i]}`); }
    };
}
