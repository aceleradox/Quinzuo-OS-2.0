const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const net = require('net');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
// Sandboxed iframes have a "null" origin: allow cross-origin calls to the API.
app.use(cors());

const PORT = process.env.PORT || 3000;
const dbFile = path.join(__dirname, 'vhd.sqlite');
const FLOPS_DIR = path.join(__dirname, 'flops');

const dbExists = fs.existsSync(dbFile);

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Erro ao conectar no VHD (SQLite):", err.message);
    } else {
        console.log(dbExists ? "VHD existente montado." : "Novo VHD criado.");

        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    is_url BOOLEAN NOT NULL DEFAULT 0,
                    trashed BOOLEAN NOT NULL DEFAULT 0,
                    partition_id INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Auto-correção para bases antigas (Lixeira, Partições e Conteúdo)
            db.run("ALTER TABLE files ADD COLUMN trashed BOOLEAN NOT NULL DEFAULT 0", () => {});
            db.run("ALTER TABLE files ADD COLUMN partition_id INTEGER NOT NULL DEFAULT 1", () => {});
        });
    }
});

app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/flops', express.static(FLOPS_DIR));

app.get('/api/ping', (req, res) => res.json({ status: 'alive', kernel: 'Cognitive-VM 5.8', build: '15y' }));

/* --------------------------------- REDE (curl/whois) --------------------------- */

const DOMAIN_RE = /^(?=.{2,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'connection']);
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

class NetRequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

// Expands an IPv6 host into 8 numeric groups (also handles embedded IPv4 addresses).
function ipv6Groups(raw) {
    let host = String(raw || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
    const embedded = host.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (embedded) {
        const p = embedded[2].split('.').map(Number);
        if (p.some((n) => n > 255)) return null;
        host = embedded[1] + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
    }
    const halves = host.split('::');
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const groups = halves.length > 1 ? [...left, ...Array(missing).fill('0'), ...right] : left;
    if (groups.length !== 8) return null;
    const parsed = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : null));
    return parsed.includes(null) ? null : parsed;
}

function isBlockedHost(rawHost) {
    const host = String(rawHost || '').trim().toLowerCase().replace(/\.+$/, '');
    if (!host) return true;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return isPrivateIPv4(host);
    if (host.includes(':')) {
        const groups = ipv6Groups(host);
        if (!groups) return true;
        if (groups.slice(0, 7).every((g) => g === 0) && (groups[7] === 0 || groups[7] === 1)) return true;
        if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
            return isPrivateIPv4(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`);
        }
        if (groups.slice(0, 6).every((g) => g === 0)) {
            return isPrivateIPv4(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`);
        }
        // Unique-local (fc00::/7) and link-local (fe80::/10) are private too.
        if ((groups[0] & 0xfe00) === 0xfc00 || (groups[0] & 0xffc0) === 0xfe80) return true;
    }
    return false;
}

function normalizeDomain(value) {
    let domain = String(value || '').trim().toLowerCase();
    domain = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    domain = domain.split(/[/?#]/)[0];
    if (domain.includes('@')) domain = domain.slice(domain.lastIndexOf('@') + 1);
    domain = domain.replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.+$/, '');
    return domain;
}

function whoisServerFor(domain) {
    if (domain.endsWith('.br')) return 'whois.registro.br';
    if (domain.endsWith('.com') || domain.endsWith('.net')) return 'whois.verisign-grs.com';
    return 'whois.iana.org';
}

function parseWhoisServer(value) {
    let server = String(value || '').trim().toLowerCase().replace(/^whois:\/\//, '');
    server = server.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    server = server.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.+$/, '');
    return DOMAIN_RE.test(server) ? server : null;
}

function findWhoisReferral(body) {
    for (const line of body.split(/\r?\n/)) {
        const match = line.match(/^\s*(?:registrar\s+whois\s+server|whois\s+server|referral\s*server)\s*:\s*(\S+)/i);
        if (!match) continue;
        const server = parseWhoisServer(match[1]);
        if (server) return server;
    }
    return null;
}

function queryWhois(server, domain) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let body = '';
        let done = false;
        const finish = (err, value) => {
            if (done) return;
            done = true;
            socket.removeAllListeners();
            socket.destroy();
            if (err) reject(err);
            else resolve(value);
        };
        socket.setEncoding('utf8');
        socket.setTimeout(12000, () => finish(new Error(`Timeout ao consultar WHOIS em ${server}.`)));
        socket.on('data', (chunk) => {
            const room = 200000 - body.length;
            if (room > 0) body += chunk.slice(0, room);
            if (body.length >= 200000) finish(null, body);
        });
        socket.on('error', (err) => finish(err));
        socket.on('close', () => finish(null, body));
        socket.on('end', () => finish(null, body));
        socket.connect(43, server, () => socket.write(`${domain}\r\n`));
    });
}

app.post('/api/net/curl', async (req, res) => {
    try {
        const data = req.body || {};
        if (typeof data.url !== 'string' || !data.url.trim()) {
            throw new NetRequestError(400, 'URL inválida.');
        }
        let url;
        try { url = new URL(data.url.trim()); }
        catch (_) { throw new NetRequestError(400, 'URL inválida.'); }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new NetRequestError(400, 'Somente http e https são permitidos.');
        }
        if (isBlockedHost(url.hostname)) {
            throw new NetRequestError(400, 'Host privado ou local não é permitido.');
        }

        const method = data.method ? String(data.method).toUpperCase() : 'GET';
        if (!ALLOWED_METHODS.has(method)) throw new NetRequestError(400, 'Método HTTP não permitido.');

        const headers = {};
        if (data.headers !== undefined) {
            if (!data.headers || typeof data.headers !== 'object' || Array.isArray(data.headers)) {
                throw new NetRequestError(400, 'Headers devem ser um objeto simples.');
            }
            const keys = Object.keys(data.headers);
            if (keys.length > 20) throw new NetRequestError(400, 'Máximo de 20 headers permitidos.');
            for (const key of keys) {
                const lower = key.toLowerCase();
                if (FORBIDDEN_HEADERS.has(lower) || typeof data.headers[key] !== 'string') {
                    throw new NetRequestError(400, `Header inválido: ${lower}.`);
                }
                headers[key] = data.headers[key];
            }
        }

        const maxBytes = data.maxBytes === undefined ? 200000 : Number(data.maxBytes);
        if (!Number.isInteger(maxBytes) || maxBytes < 1000 || maxBytes > 1000000) {
            throw new NetRequestError(400, 'maxBytes deve estar entre 1000 e 1000000.');
        }

        const response = await fetch(url.toString(), {
            method,
            headers,
            signal: AbortSignal.timeout(15000)
        });

        const hardCap = maxBytes * 4 + 16; // UTF-8 uses at most 4 bytes per code point
        const chunks = [];
        let total = 0;
        let truncated = false;
        const collect = (buf) => {
            const room = hardCap - total;
            if (buf.length > room) {
                if (room > 0) chunks.push(buf.subarray(0, room));
                total = hardCap;
                truncated = true;
            } else {
                chunks.push(buf);
                total += buf.length;
            }
        };
        if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
            for await (const chunk of response.body) {
                collect(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                if (truncated) break;
            }
        } else {
            collect(Buffer.from(await response.arrayBuffer()));
        }

        let body = Buffer.concat(chunks).toString('utf8'); // invalid UTF-8 becomes U+FFFD
        if (body.length > maxBytes) {
            body = body.slice(0, maxBytes);
            truncated = true;
        }

        res.json({
            ok: true,
            status: response.status,
            statusText: response.statusText,
            finalUrl: response.url,
            contentType: response.headers.get('content-type') || '',
            body,
            truncated
        });
    } catch (err) {
        const status = err instanceof NetRequestError ? err.status : 502;
        const message = String((err && err.message) || err || 'Falha na requisição.').slice(0, 300);
        res.status(status).json({ error: message });
    }
});

app.post('/api/net/whois', async (req, res) => {
    try {
        const data = req.body || {};
        const domain = normalizeDomain(data.domain);
        if (!DOMAIN_RE.test(domain)) throw new NetRequestError(400, 'Domínio inválido.');

        let server = whoisServerFor(domain);
        const visited = new Set();
        let body = '';
        for (let hop = 0; hop <= 2; hop++) {
            if (visited.has(server)) break;
            visited.add(server);
            body = await queryWhois(server, domain);
            if (hop === 2) break;
            const referral = findWhoisReferral(body);
            if (!referral || referral === server || visited.has(referral)) break;
            server = referral;
        }
        res.json({ ok: true, server, body });
    } catch (err) {
        const status = err instanceof NetRequestError ? err.status : 502;
        const message = String((err && err.message) || err || 'Falha ao consultar WHOIS.').slice(0, 300);
        res.status(status).json({ error: message });
    }
});

/* ---------------------------- SISTEMA DE FICHEIROS ---------------------------- */

app.get('/api/fs', (req, res) => {
    db.all("SELECT id, name, type, content, is_url, partition_id FROM files WHERE trashed = 0 ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/fs/trash', (req, res) => {
    db.all("SELECT id, name, type, content, is_url, partition_id FROM files WHERE trashed = 1 ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/fs', (req, res) => {
    const { name, type, content, isUrl, partitionId } = req.body;
    db.run(
        "INSERT INTO files (name, type, content, is_url, trashed, partition_id) VALUES (?, ?, ?, ?, 0, ?)",
        [name || 'sem_nome', type || 'text/plain', content || '', isUrl ? 1 : 0, partitionId || 1],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        }
    );
});

// Renomear e/ou atualizar conteúdo (usado por editores, .qnz e apps)
app.put('/api/fs/:id', (req, res) => {
    const { name, content, isUrl } = req.body;
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
    if (isUrl !== undefined) { sets.push('is_url = ?'); vals.push(isUrl ? 1 : 0); }
    if (!sets.length) return res.json({ updated: 0 });
    vals.push(req.params.id);
    db.run(`UPDATE files SET ${sets.join(', ')} WHERE id = ?`, vals, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.put('/api/fs/:id/trash', (req, res) => {
    db.run("UPDATE files SET trashed = 1 WHERE id = ?", req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ trashed: this.changes });
    });
});

app.put('/api/fs/:id/restore', (req, res) => {
    db.run("UPDATE files SET trashed = 0 WHERE id = ?", req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ restored: this.changes });
    });
});

app.delete('/api/fs/:id', (req, res) => {
    db.run("DELETE FROM files WHERE id = ?", req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

/* ------------------------------- CONFIGURAÇÕES ------------------------------- */

app.get('/api/settings', (req, res) => {
    db.all("SELECT key, value FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach((r) => {
            try { settings[r.key] = JSON.parse(r.value); }
            catch (_) { settings[r.key] = r.value; }
        });
        res.json(settings);
    });
});

app.post('/api/settings', (req, res) => {
    const entries = Object.entries(req.body || {});
    if (!entries.length) return res.json({ ok: true, saved: 0 });
    db.serialize(() => {
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        entries.forEach(([key, value]) => stmt.run(key, JSON.stringify(value)));
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, saved: entries.length });
        });
    });
});

app.delete('/api/settings', (req, res) => {
    db.run("DELETE FROM settings", function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ reset: this.changes });
    });
});

/* ----------------------------------- FLOPS ----------------------------------- */

function resolveFlopPath(relative) {
    const target = path.resolve(FLOPS_DIR, relative || '');
    if (target !== FLOPS_DIR && !target.startsWith(FLOPS_DIR + path.sep)) {
        throw new Error('Caminho de flop inválido.');
    }
    return target;
}

function readFlopManifest(dir) {
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

app.get('/api/flops', (req, res) => {
    try {
        const indexPath = path.join(FLOPS_DIR, 'index.json');
        if (!fs.existsSync(indexPath)) return res.json([]);
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const refs = Array.isArray(index) ? index : (index.packages || []);
        const packages = refs.map((ref) => {
            const dir = resolveFlopPath(ref.dir || ref.id);
            const manifest = readFlopManifest(dir) || {};
            return {
                id: ref.id || manifest.id,
                folder: path.basename(dir),
                name: manifest.name || ref.name || ref.id,
                description: manifest.description || '',
                icon: manifest.icon || '💾',
                version: manifest.version || '1.0',
                author: manifest.author || 'Quinzuo Labs',
                files: manifest.files || []
            };
        });
        res.json(packages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/flops/install', (req, res) => {
    try {
        const { id, partitionId } = req.body;
        const index = JSON.parse(fs.readFileSync(path.join(FLOPS_DIR, 'index.json'), 'utf8'));
        const refs = Array.isArray(index) ? index : (index.packages || []);
        const ref = refs.find((p) => p.id === id);
        if (!ref) return res.status(404).json({ error: 'Flop não encontrado.' });

        const dir = resolveFlopPath(ref.dir || ref.id);
        const manifest = readFlopManifest(dir);
        if (!manifest) return res.status(400).json({ error: 'Manifesto inválido.' });

        const installed = [];
        db.serialize(() => {
            const stmt = db.prepare(
                "INSERT INTO files (name, type, content, is_url, trashed, partition_id) VALUES (?, ?, ?, 0, 0, ?)"
            );
            (manifest.files || []).forEach((file) => {
                const filePath = resolveFlopPath(path.join(path.basename(dir), file.path));
                if (!fs.existsSync(filePath)) return;
                const content = fs.readFileSync(filePath, 'utf8');
                stmt.run(file.name || path.basename(file.path), file.type || 'application/x-qnz', content, partitionId || 1);
                installed.push({
                    name: file.name || path.basename(file.path),
                    type: file.type || 'application/x-qnz',
                    dock: !!file.dock,
                    icon: file.icon || manifest.icon,
                    label: file.label || manifest.name
                });
            });
            stmt.finalize((err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ installed, manifest: { id: manifest.id, name: manifest.name, icon: manifest.icon } });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ---------------------------------- TERMINAL --------------------------------- */

const BLOCKED = [/rm\s+-rf\s+(\/|c:)/i, /format\s+[a-z]:/i, /del\s+\/f\s+\/s\s+\/q\s+[a-z]:/i, /shutdown/i, /taskkill\s+\/f\s+\/im/i];

app.post('/api/terminal', (req, res) => {
    const { command } = req.body;
    if (!command) return res.json({ output: '' });
    const cmd = command.trim();

    if (BLOCKED.some((rx) => rx.test(cmd))) {
        return res.json({ output: 'Comando bloqueado pelo núcleo de segurança do córtex.' });
    }
    if (cmd === 'help') {
        return res.json({ output: [
            'Comandos Quinzuo OS 5.8:',
            '  help | clear | vhd | flops | settings | sysinfo',
            '  kernel | date | echo <texto> | qnz <id>',
            '  curl <url> | whois <dominio>',
            'Comandos do host também são permitidos (com proteção básica).'
        ].join('\n') });
    }
    if (cmd === 'vhd') {
        db.all("SELECT id, name, type, partition_id, trashed FROM files", [], (err, rows) => {
            if (err) return res.json({ output: `Erro DB: ${err.message}` });
            const list = rows.map((r) => `[ID: ${r.id}] ${r.name} | ${r.type} | VHD ${r.partition_id} | Lixo: ${r.trashed ? 'S' : 'N'}`).join('\n');
            res.json({ output: `Arquivos no VHD (${rows.length}):\n${list || 'vazio'}` });
        });
        return;
    }
    if (cmd === 'flops') {
        try {
            const index = JSON.parse(fs.readFileSync(path.join(FLOPS_DIR, 'index.json'), 'utf8'));
            const refs = Array.isArray(index) ? index : (index.packages || []);
            res.json({ output: `Pacotes FLOP disponíveis:\n${refs.map((p) => '  - ' + p.id).join('\n') || '  nenhum'}` });
        } catch (_) { res.json({ output: 'Nenhum pacote FLOP instalado.' }); }
        return;
    }
    if (cmd === 'settings') {
        db.all("SELECT key, value FROM settings ORDER BY key", [], (err, rows) => {
            if (err) return res.json({ output: err.message });
            res.json({ output: rows.map((r) => `${r.key} = ${r.value}`).join('\n') || 'Configurações padrão.' });
        });
        return;
    }
    if (cmd === 'sysinfo' || cmd === 'kernel') {
        res.json({ output: `Quinzuo OS Static 5.8\nKernel: Cognitive-VM (WebAssembly)\nCórtex: Pré-Frontal\nVHD: SQLite (${path.basename(dbFile)})\nNode: ${process.version}\nUptime host: ${Math.floor(process.uptime())}s` });
        return;
    }
    if (cmd === 'date') { res.json({ output: new Date().toString() }); return; }
    if (cmd.startsWith('echo ')) { res.json({ output: cmd.slice(5) }); return; }
    if (cmd.startsWith('qnz ')) {
        const id = cmd.slice(4).trim();
        db.get("SELECT id, name, content FROM files WHERE id = ? OR name LIKE ?", [id, `%${id}%`], (err, row) => {
            if (err || !row) return res.json({ output: `QNZ não encontrado: ${id}` });
            try {
                const pkg = JSON.parse(row.content);
                res.json({ output: `QNZ: ${row.name}\nTítulo: ${pkg.title || pkg.name || '-'}\nÍcone: ${pkg.icon || '⚡'}\nHTML: ${(pkg.html || '').length} chars | CSS: ${(pkg.css || '').length} chars | JS: ${(pkg.js || '').length} chars` });
            } catch (_) { res.json({ output: `QNZ: ${row.name}\n(conteúdo HTML bruto: ${row.content.length} chars)` }); }
        });
        return;
    }

    exec(cmd, (error, stdout, stderr) => {
        let output = '';
        if (error) output += `Erro: ${error.message}\n`;
        if (stderr) output += `${stderr}\n`;
        if (stdout) output += stdout;
        res.json({ output: output || 'Executado.' });
    });
});

app.listen(PORT, () => console.log(`Quinzuo OS Static 5.8 rodando em http://localhost:${PORT}`));
