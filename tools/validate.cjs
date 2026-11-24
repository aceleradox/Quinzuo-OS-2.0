#!/usr/bin/env node
'use strict';

/**
 * Validação estática do backend/frontend do Quinzuo OS Static.
 * Chamada por: npm run check
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const JS_DIR = path.join(PUBLIC, 'js');
const FLOPS_DIR = path.join(ROOT, 'flops');

const errors = [];
let checks = 0;

function ok() { checks += 1; }
function fail(message) { errors.push(message); }
function check(condition, message) { if (condition) ok(); else fail(message); }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }

function walk(dir, filter) {
    const found = [];
    if (!fs.existsSync(dir)) return found;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...walk(full, filter));
        else if (!filter || filter(full)) found.push(full);
    }
    return found;
}

/* 1. Arquivos obrigatórios ---------------------------------------------------- */

const CORE_FILES = [
    'app-registry', 'boot', 'bios', 'dock', 'window-manager', 'fs',
    'settings', 'qnz', 'desktop', 'context-menu', 'audio', 'state'
];
const CSS_FILES = ['base', 'desktop', 'windows', 'dock', 'bios', 'apps'];

const required = [
    'public/index.html',
    'public/js/main.js',
    'public/js/apps/index.js',
    ...CORE_FILES.map((name) => `public/js/core/${name}.js`),
    ...CSS_FILES.map((name) => `public/css/${name}.css`),
    'public/js/kernel/cognitive-kernel.wasm',
    'flops/index.json'
];
for (const item of required) {
    check(fs.existsSync(path.join(ROOT, item)), `Arquivo obrigatório ausente: ${item}`);
}

/* 2. Referências locais em index.html ---------------------------------------- */

const htmlFile = path.join(PUBLIC, 'index.html');
if (fs.existsSync(htmlFile)) {
    const html = read(htmlFile);
    const refs = Array.from(html.matchAll(/(?:href|src)\s*=\s*["'](\/(?:css|js)\/[^"'?#]+)/gi), (m) => m[1]);
    check(refs.length > 0, 'index.html não referencia nenhum arquivo CSS/JS local.');
    for (const ref of refs) {
        const target = path.join(PUBLIC, ref.replace(/^\/+/, ''));
        check(fs.existsSync(target), `index.html: referência inexistente ${ref}`);
    }
}

/* 3. Especificadores relativos de import ------------------------------------- */

const jsFiles = walk(JS_DIR, (file) => file.endsWith('.js'));
const importPatterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
];

for (const file of jsFiles) {
    const code = read(file);
    const specifiers = new Set();
    for (const pattern of importPatterns) {
        for (const match of code.matchAll(pattern)) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        const resolved = fs.existsSync(target) ? target
            : (fs.existsSync(target + '.js') ? target + '.js'
                : (fs.existsSync(path.join(target, 'index.js')) ? path.join(target, 'index.js') : null));
        check(!!resolved, `Import relativo inexistente em ${rel(file)}: ${specifier}`);
    }
}

/* 4. Sintaxe JavaScript (cópia temporária .mjs + node --check) ---------------- */

const tempFiles = [];
try {
    for (const file of jsFiles) {
        const temp = path.join(os.tmpdir(), `qnz-validate-${process.pid}-${tempFiles.length}.mjs`);
        fs.copyFileSync(file, temp);
        tempFiles.push(temp);
        try {
            execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' });
            ok();
        } catch (err) {
            const detail = String(err.stderr || err.message || err).trim().split(/\r?\n/).slice(-3).join(' | ');
            fail(`Erro de sintaxe em ${rel(file)}: ${detail}`);
        }
    }
} finally {
    for (const temp of tempFiles) {
        try { fs.unlinkSync(temp); } catch (_) { /* já removido */ }
    }
}

/* 5. Chaves em CSS e JSON válidos -------------------------------------------- */

for (const css of walk(PUBLIC, (file) => file.endsWith('.css'))) {
    const code = read(css).replace(/\/\*[\s\S]*?\*\//g, '');
    const open = (code.match(/\{/g) || []).length;
    const close = (code.match(/\}/g) || []).length;
    check(open === close, `CSS desbalanceado em ${rel(css)}: ${open} '{' vs ${close} '}'`);
}

const jsonFiles = walk(ROOT, (file) => file.endsWith('.json') && path.basename(file) !== 'package-lock.json');
for (const jsonFile of jsonFiles) {
    try {
        JSON.parse(read(jsonFile));
        ok();
    } catch (err) {
        fail(`JSON inválido em ${rel(jsonFile)}: ${err.message}`);
    }
}

/* 6. Pacotes FLOP ------------------------------------------------------------- */

const flopIndexFile = path.join(FLOPS_DIR, 'index.json');
if (fs.existsSync(flopIndexFile)) {
    try {
        const index = JSON.parse(read(flopIndexFile));
        const refs = Array.isArray(index) ? index : (index && Array.isArray(index.packages) ? index.packages : null);
        if (!refs) {
            fail('flops/index.json deve ser um array ou um objeto { packages: [] }.');
        } else {
            ok();
            refs.forEach((ref, position) => {
                const entry = ref && (ref.dir || ref.id);
                if (!entry) {
                    fail(`flops/index.json[${position}]: falta "dir" ou "id".`);
                    return;
                }
                ok();
                const dir = path.resolve(FLOPS_DIR, String(entry));
                if (dir !== FLOPS_DIR && !dir.startsWith(FLOPS_DIR + path.sep)) {
                    fail(`Caminho de flop inválido: ${entry}`);
                    return;
                }
                check(fs.existsSync(dir) && fs.statSync(dir).isDirectory(), `Pasta do flop ausente: flops/${entry}`);
                const manifestFile = path.join(dir, 'manifest.json');
                if (!fs.existsSync(manifestFile)) {
                    fail(`Manifesto ausente: flops/${entry}/manifest.json`);
                    return;
                }
                ok();
                let manifest;
                try {
                    manifest = JSON.parse(read(manifestFile));
                    ok();
                } catch (err) {
                    fail(`Manifesto inválido em flops/${entry}/manifest.json: ${err.message}`);
                    return;
                }
                const files = manifest && Array.isArray(manifest.files) ? manifest.files : [];
                for (const file of files) {
                    if (!file || typeof file.path !== 'string') {
                        fail(`flops/${entry}/manifest.json: entrada de arquivo sem "path".`);
                        continue;
                    }
                    const target = path.resolve(dir, file.path);
                    const inside = target.startsWith(dir + path.sep);
                    check(inside && fs.existsSync(target), `Arquivo do flop ausente: flops/${entry}/${file.path}`);
                }
            });
        }
    } catch (err) {
        fail(`flops/index.json inválido: ${err.message}`);
    }
}

/* 7. Magic bytes do kernel WASM ----------------------------------------------- */

const wasmFile = path.join(JS_DIR, 'kernel/cognitive-kernel.wasm');
if (fs.existsSync(wasmFile)) {
    const magic = fs.readFileSync(wasmFile).subarray(0, 4);
    check(
        magic.length === 4 && magic[0] === 0x00 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d,
        `Kernel WASM sem o cabeçalho 00 61 73 6d: ${rel(wasmFile)}`
    );
}

/* 8. Frases de boot ----------------------------------------------------------- */

const BOOT_PHRASES = [
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

const bootFile = path.join(JS_DIR, 'core/boot.js');
if (fs.existsSync(bootFile)) {
    const code = read(bootFile);
    for (const phrase of BOOT_PHRASES) {
        const present = code.includes(`'${phrase}'`) || code.includes(`"${phrase}"`) || code.includes(`\`${phrase}\``);
        check(present, `Frase de boot ausente em boot.js: ${phrase}`);
    }
}

/* 9. Registro de apps, Dock e menu de contexto -------------------------------- */

const registeredApps = new Set();
const registryFile = path.join(JS_DIR, 'core/app-registry.js');
if (fs.existsSync(registryFile)) {
    const code = read(registryFile);
    const block = (code.match(/APP_META\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
    const ids = Array.from(block.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]);
    check(ids.length > 0, 'APP_META não contém ids registrados.');
    ids.forEach((id) => registeredApps.add(id));
}

const appsDir = path.join(JS_DIR, 'apps');
for (const file of walk(appsDir, (item) => item.endsWith('.js'))) {
    const code = read(file);
    for (const match of code.matchAll(/\bdefineApp\(\s*['"]([^'"]+)['"]/g)) registeredApps.add(match[1]);
}
check(registeredApps.size > 0, 'Nenhum aplicativo registrado (APP_META/defineApp).');

const dockFile = path.join(JS_DIR, 'core/dock.js');
if (fs.existsSync(dockFile)) {
    const code = read(dockFile);
    const block = (code.match(/\bFAVORITES\s*=\s*\[([\s\S]*?)\]/) || [])[1];
    if (block) {
        for (const match of block.matchAll(/['"]([^'"]+)['"]/g)) {
            const id = match[1];
            if (id.startsWith('qnz:')) continue;
            check(registeredApps.has(id), `Dock FAVORITES: app não registrado "${id}"`);
        }
    }
}

const contextMenuFile = path.join(JS_DIR, 'core/context-menu.js');
if (fs.existsSync(contextMenuFile)) {
    const code = read(contextMenuFile);
    const ids = Array.from(code.matchAll(/\bopenApp\(\s*['"]([^'"]+)['"]/g), (match) => match[1]);
    for (const id of ids) {
        if (id.startsWith('qnz:')) continue;
        check(registeredApps.has(id), `context-menu.js: app não registrado "${id}"`);
    }
}

/* 10. Rotas /api usadas no frontend ------------------------------------------- */

const serverFile = path.join(ROOT, 'server.js');
const routes = new Set();
if (fs.existsSync(serverFile)) {
    const code = read(serverFile);
    for (const match of code.matchAll(/\bapp\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
        routes.add(match[1]);
    }
}
check(routes.size > 0, 'Nenhuma rota encontrada em server.js.');

const usedApis = new Set();
for (const file of jsFiles) {
    const code = read(file);
    for (const match of code.matchAll(/\bfetch\s*\(\s*(?:`|'|")([^`'"]+)(?:`|'|")/g)) {
        const found = (match[1].match(/\/api\/[^\s`'"]*/) || [])[0];
        if (!found) continue;
        usedApis.add(found.includes('${') ? found.slice(0, found.indexOf('${')) : found);
    }
}

for (const api of usedApis) {
    const normalized = api.replace(/\/+$/, '');
    const exists = Array.from(routes).some((route) => {
        if (route === api || route === normalized) return true;
        const colon = route.indexOf(':');
        const prefix = (colon === -1 ? route : route.slice(0, colon)).replace(/\/+$/, '');
        return prefix === normalized || normalized.startsWith(prefix + '/') || prefix.startsWith(normalized + '/');
    });
    check(exists, `Rota usada no frontend mas ausente no server.js: ${api}`);
}

/* 11. Resultado --------------------------------------------------------------- */

if (errors.length === 0) {
    console.log(`OK: ${checks} verificações concluídas sem erros.`);
} else {
    console.error(`Falha: ${errors.length} erro(s) encontrado(s) em ${checks} verificações:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
}
