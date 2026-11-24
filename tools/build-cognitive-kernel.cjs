/**
 * Gerador do kernel WebAssembly "Capacidade Cognitiva 5.8".
 * Monta o binário .wasm instruction a instruction (sem dependências externas).
 * Uso: npm run build:kernel
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'js', 'kernel');

const I32 = 0x7f;
const F32 = 0x7d;

function uleb(n) {
    const out = [];
    do {
        let byte = n & 0x7f;
        n >>>= 7;
        if (n) byte |= 0x80;
        out.push(byte);
    } while (n);
    return out;
}

function f32bytes(value) {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(value, 0);
    return Array.from(buf);
}

function vec(items) {
    return [...uleb(items.length), ...items.reduce((acc, item) => acc.concat(item), [])];
}

function section(id, payload) {
    return [id, ...uleb(payload.length), ...payload];
}

const OP = {
    block: [0x02, 0x40],
    loop: [0x03, 0x40],
    if: [0x04, 0x40],
    end: [0x0b],
    br: (d) => [0x0c, ...uleb(d)],
    brIf: (d) => [0x0d, ...uleb(d)],
    localGet: (i) => [0x20, ...uleb(i)],
    localSet: (i) => [0x21, ...uleb(i)],
    globalGet: (i) => [0x23, ...uleb(i)],
    globalSet: (i) => [0x24, ...uleb(i)],
    i32Const: (v) => [0x41, ...uleb(v)],
    f32Const: (v) => [0x43, ...f32bytes(v)],
    i32Load8u: [0x2d, 0x00, 0x00],
    i32Store8: [0x3a, 0x00, 0x00],
    i32GeS: [0x4e],
    f32Lt: [0x5d],
    f32Gt: [0x5e],
    i32Add: [0x6a],
    f32Add: [0x92],
    f32Sub: [0x93],
    f32Mul: [0x94],
    f32Div: [0x95],
    f32Min: [0x96],
    f32ConvertI32: [0xb2]
};

const TYPES = [
    { params: [], results: [I32] },                             // 0 () -> i32
    { params: [], results: [F32] },                             // 1 () -> f32
    { params: [F32], results: [] },                             // 2 (f32) -> ()
    { params: [F32], results: [F32] },                          // 3 (f32) -> f32
    { params: [F32, F32, F32, I32], results: [F32] },           // 4 capacidade
    { params: [I32, F32], results: [F32] },                     // 5 ciclo
    { params: [], results: [] },                                // 6 () -> ()
    { params: [I32, I32], results: [] },                        // 7 (i32,i32) -> ()
    { params: [I32], results: [I32] }                           // 8 (i32) -> i32
];
const typeIndex = (params, results) => TYPES.findIndex((t) =>
    t.params.join(',') === params.join(',') && t.results.join(',') === results.join(','));

const C = (...parts) => parts.reduce((acc, p) => acc.concat(p), []);

const bodies = [];

// 0: versao() -> 58
bodies.push({ type: 0, locals: [], code: C(OP.i32Const(58)) });

// 1: capacidade_base() -> global base
bodies.push({ type: 1, locals: [], code: C(OP.globalGet(0)) });

// 2: definir_cortex(f32)
bodies.push({ type: 2, locals: [], code: C(OP.localGet(0), OP.globalSet(1)) });

// 3: ler_cortex() -> f32
bodies.push({ type: 3, locals: [], code: C(OP.globalGet(1)) });

// 4: regular_impulso(f32) -> f32  (local 1 = valor clampado)
bodies.push({
    type: 3,
    locals: [[1, F32]],
    code: C(
        OP.localGet(0), OP.localSet(1),
        OP.localGet(1), OP.f32Const(0), OP.f32Lt, OP.if, OP.f32Const(0), OP.localSet(1), OP.end,
        OP.localGet(1), OP.f32Const(1), OP.f32Gt, OP.if, OP.f32Const(1), OP.localSet(1), OP.end,
        OP.localGet(1), OP.globalSet(2),
        OP.globalGet(0), OP.globalGet(1), OP.f32Const(2), OP.f32Mul, OP.f32Add,
        OP.f32Const(1), OP.localGet(1), OP.f32Const(0.15), OP.f32Mul, OP.f32Sub,
        OP.f32Mul
    )
});

// 5: calcular_capacidade(maturidade, overclock, decisao, supremo) -> f32
bodies.push({
    type: 4,
    locals: [[1, F32]], // local 4 = capacidade
    code: C(
        OP.globalGet(0), OP.localGet(0), OP.f32Const(2.5), OP.f32Mul, OP.f32Add, OP.localSet(4),
        OP.localGet(4), OP.localGet(1), OP.f32Const(1.5), OP.f32Mul, OP.f32Add, OP.localSet(4),
        OP.localGet(4), OP.localGet(2), OP.f32Const(1.2), OP.f32Mul, OP.f32Add, OP.localSet(4),
        OP.localGet(3), OP.if, OP.f32Const(10), OP.localSet(4), OP.end,
        OP.localGet(4), OP.f32Const(10), OP.f32Min
    )
});

// 6: simular_ciclo(ticks, carga) -> f32
bodies.push({
    type: 5,
    locals: [[1, I32], [1, F32]], // local 2 = i, local 3 = acumulador
    code: C(
        OP.i32Const(0), OP.localSet(2),
        OP.f32Const(0), OP.localSet(3),
        OP.block,
        OP.loop,
        OP.localGet(2), OP.localGet(0), OP.i32GeS, OP.brIf(1),
        OP.localGet(3),
        OP.globalGet(0), OP.globalGet(1), OP.f32Add,
        OP.localGet(1), OP.f32Const(100), OP.f32Div,
        OP.f32Mul, OP.f32Add, OP.localSet(3),
        OP.globalGet(3), OP.i32Const(1), OP.i32Add, OP.globalSet(3),
        OP.localGet(2), OP.i32Const(1), OP.i32Add, OP.localSet(2),
        OP.br(0),
        OP.end,
        OP.end,
        OP.localGet(3), OP.localGet(0), OP.f32ConvertI32, OP.f32Div
    )
});

// 7: ciclos() -> i32
bodies.push({ type: 0, locals: [], code: C(OP.globalGet(3)) });

// 8: reset()
bodies.push({
    type: 6,
    locals: [],
    code: C(OP.f32Const(0.58), OP.globalSet(1), OP.f32Const(0.5), OP.globalSet(2), OP.i32Const(0), OP.globalSet(3))
});

// 9: gravar_memoria(pos, valor)
bodies.push({ type: 7, locals: [], code: C(OP.localGet(0), OP.localGet(1), OP.i32Store8) });

// 10: ler_memoria(pos) -> i32
bodies.push({ type: 8, locals: [], code: C(OP.localGet(0), OP.i32Load8u) });

const functionTypes = bodies.map((b) => b.type);

const typeSection = section(1, vec(TYPES.map((t) => C(
    [0x60],
    [...uleb(t.params.length), ...t.params],
    [...uleb(t.results.length), ...t.results]
))));

const funcSection = section(3, vec(functionTypes.map((t) => uleb(t))));
const memorySection = section(5, [1, 0x00, 0x01]); // 1 página de 64 KiB (flags=0, min=1)

const globals = [
    { type: F32, init: OP.f32Const(5.8) },   // 0 base
    { type: F32, init: OP.f32Const(0.58) },  // 1 córtex
    { type: F32, init: OP.f32Const(0.5) },   // 2 impulso
    { type: I32, init: OP.i32Const(0) }      // 3 ciclos
];
const globalSection = section(6, vec(globals.map((g) => C([g.type, 0x01], g.init, OP.end))));

const exportNames = [
    ['versao', 0, 0], ['capacidade_base', 0, 1], ['definir_cortex', 0, 2],
    ['ler_cortex', 0, 3], ['regular_impulso', 0, 4], ['calcular_capacidade', 0, 5],
    ['simular_ciclo', 0, 6], ['ciclos', 0, 7], ['reset', 0, 8],
    ['gravar_memoria', 0, 9], ['ler_memoria', 0, 10], ['memory', 2, 0]
];
const exportSection = section(7, vec(exportNames.map(([name, kind, index]) => C(
    [...uleb(name.length), ...Array.from(Buffer.from(name, 'utf8'))],
    [kind, ...uleb(index)]
))));

const codeSection = section(10, vec(bodies.map((b) => {
    const localsVec = vec(b.locals.map(([count, type]) => [...uleb(count), type]));
    const body = C(localsVec, b.code, OP.end);
    return C(uleb(body.length), body);
})));

const wasm = Buffer.from([
    0x00, 0x61, 0x73, 0x6d, // magic \0asm
    0x01, 0x00, 0x00, 0x00, // version 1
    ...typeSection,
    ...funcSection,
    ...memorySection,
    ...globalSection,
    ...exportSection,
    ...codeSection
]);

// Validação imediata pelo próprio Node
const wasmModule = new WebAssembly.Module(wasm);
const exportsList = WebAssembly.Module.exports(wasmModule).map((e) => e.name).join(', ');

fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, 'cognitive-kernel.wasm');
fs.writeFileSync(outFile, wasm);
console.log(`Kernel WebAssembly gerado: ${outFile} (${wasm.length} bytes)`);
console.log(`Exports: ${exportsList}`);

// Smoke test
const instance = new WebAssembly.Instance(wasmModule, {});
const e = instance.exports;
console.log(`versao=${e.versao()} base=${e.capacidade_base().toFixed(2)} ` +
    `cap=${e.calcular_capacidade(1, 1, 1, 0).toFixed(2)} ` +
    `supremo=${e.calcular_capacidade(0, 0, 0, 1).toFixed(2)} ` +
    `ciclo=${e.simular_ciclo(10, 50).toFixed(3)} ciclos=${e.ciclos()}`);
