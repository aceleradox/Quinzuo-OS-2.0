import { state } from './state.js';
import { BackendFS } from './fs.js';
import { HQAudio } from './audio.js';
import { openApp } from './window-manager.js';
import { installQnzToDock, parseQnz } from './qnz.js';

const ACTIONS = {};

export function initContextMenu() {
    const menu = document.getElementById('contextMenu');

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        menu.classList.add('hidden');
        menu.classList.remove('flex');

        const fileItem = e.target.closest('.desktop-file');
        let html = '';

        if (fileItem) {
            const id = Number(fileItem.dataset.id);
            const f = state.files.find((file) => file.id === id);
            const isQnz = f && (f.name.toLowerCase().endsWith('.qnz') || f.type === 'application/x-qnz');

            html += item('Abrir', 'open', id, '👁️');
            if (f && (f.type.includes('html') || f.name.endsWith('.html') || f.type.includes('javascript') || isQnz)) {
                html += item(isQnz ? 'Designer .QNZ' : 'Editar código', 'edit', id, '⚡');
            }
            if (isQnz) {
                html += item('Instalar no Dock', 'dock', id, '⚓');
            }
            html += separator();
            html += item('Renomear', 'rename', id, '✏️');
            html += `<div class="ctx-item text-red-400 hover:!bg-red-500 hover:!text-white" data-action="trash" data-id="${id}"><span>🗑️</span> Enviar para Lixeira</div>`;
        } else {
            html += item('Atualizar arquivos', 'refresh', 0, '🔄');
            html += separator();
            html += item('Novo bloco de notas', 'newnote', 0, '📝');
            html += item('Novo app .QNZ', 'designer', 0, '🎛️');
            html += separator();
            html += item('Personalizar OS', 'personalizar', 0, '🖌️');
            html += item('BIOS / Configuração', 'bios', 0, '🔧');
        }

        menu.innerHTML = html;
        menu.querySelectorAll('[data-action]').forEach((node) => {
            node.onclick = (ev) => {
                ev.stopPropagation();
                runAction(node.dataset.action, Number(node.dataset.id));
                menu.classList.add('hidden');
                menu.classList.remove('flex');
            };
        });

        let x = e.pageX, y = e.pageY;
        if (x + 230 > window.innerWidth) x = window.innerWidth - 230;
        if (y + menu.offsetHeight + 10 > window.innerHeight) y = Math.max(34, window.innerHeight - menu.offsetHeight - 10);
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    });

    document.addEventListener('click', () => {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    });
}

function item(label, action, id, icon) {
    return `<div class="ctx-item" data-action="${action}" data-id="${id}"><span>${icon}</span> ${label}</div>`;
}
function separator() {
    return '<div class="ctx-sep"></div>';
}

function runAction(action, id) {
    const f = state.files.find((file) => file.id === id);
    HQAudio.uiClick();

    switch (action) {
        case 'open': if (f) openFile(f); break;
        case 'edit': if (f) openApp(f.name.endsWith('.qnz') ? 'qnz-designer' : 'codenate', f); break;
        case 'dock':
            if (f) {
                const pkg = parseQnz(f.content);
                installQnzToDock({ fileId: f.id, name: f.name, icon: pkg.icon, label: pkg.title });
            }
            break;
        case 'rename': {
            const name = prompt('Renomear arquivo:', f ? f.name : '');
            if (name && name.trim()) BackendFS.renameFile(id, name.trim());
            break;
        }
        case 'trash': BackendFS.trashFile(id); break;
        case 'refresh': BackendFS.fetchAll(); break;
        case 'newnote': openApp('notepad'); break;
        case 'designer': openApp('qnz-designer'); break;
        case 'personalizar': openApp('personalizar'); break;
        case 'bios': openApp('bios'); break;
    }
}

export function openFile(f) {
    if (!f) return;
    const isQnz = f.name.toLowerCase().endsWith('.qnz') || f.type === 'application/x-qnz';
    if (isQnz) return openApp('qnz-runner', f);
    if (f.is_url) return openApp('browser', f);
    if (f.type.includes('html') || f.name.endsWith('.html')) return openApp('browser', f);
    if (f.name.endsWith('.asm') || f.type === 'text/x-asm') return openApp('fantasm', f);
    if (f.type === 'image/png') return openApp('pintaclima', f);
    if (f.type.includes('javascript') || f.name.endsWith('.js')) return openApp('codeneta', f);
    return openApp('notepad', f);
}
