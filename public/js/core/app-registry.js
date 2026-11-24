// Registro central de aplicativos: metadados + renderizadores
const registry = new Map();

export const APP_META = [
    { id: 'cortex', name: 'Painel Córtex', icon: '🧠', category: 'Sistema', desc: 'Controle emocional e cognitivo', width: 700, height: 520 },
    { id: 'kernel', name: 'Capacidade Cognitiva 5.8', icon: '🧬', category: 'Sistema', desc: 'Simulador do kernel em WebAssembly', width: 860, height: 580 },
    { id: 'bios', name: 'BelaNovaEFI >> Quinzuo OS', icon: '🔧', category: 'Sistema', desc: 'Firmware e configuração de baixo nível', width: 940, height: 640 },
    { id: 'cortex-framework', name: 'Framework Córtex Pré-Frontal', icon: '🧠', category: 'Sistema', desc: 'Decisão, inibição e overclock cognitivo', width: 860, height: 590 },
    { id: 'config', name: 'Configuração', icon: '⚙️', category: 'Sistema', desc: 'Preferências completas do sistema', width: 840, height: 620 },
    { id: 'terminal', name: 'Terminal / CMD', icon: '💻', category: 'Sistema', desc: 'Shell local, VHD e host', width: 760, height: 480 },
    { id: 'floppy', name: 'Partições (VHD)', icon: '💾', category: 'Sistema', desc: 'Discos, arquivos e pacotes FLOP', width: 820, height: 560 },
    { id: 'trash', name: 'Lixeira Neural', icon: '🗑️', category: 'Sistema', desc: 'Memória temporária', width: 700, height: 460 },

    { id: 'codeneta', name: 'codeneta', icon: '💉', category: 'Desenvolvimento', desc: 'Injetor de JavaScript', width: 800, height: 560 },
    { id: 'codenate', name: 'codenate', icon: '⚡', category: 'Desenvolvimento', desc: 'Editor de código web', width: 900, height: 600 },
    { id: 'codehorn', name: 'Quinzuo Code Horn', icon: '📯', category: 'Desenvolvimento', desc: 'Editor de código com chifre Quinzuo', width: 880, height: 580 },
    { id: 'qnzbuilder', name: 'Quinzuo QNZ Builder', icon: '🏗️', category: 'Desenvolvimento', desc: 'Crie apps .QNZ e nativos .app.js', width: 980, height: 680 },
    { id: 'fantasm', name: 'FantASM', icon: '👻', category: 'Desenvolvimento', desc: 'Editor e simulador de Assembly', width: 900, height: 620 },
    { id: 'qnz-designer', name: 'Designer .QNZ', icon: '🎛️', category: 'Desenvolvimento', desc: 'Crie apps com design próprio', width: 960, height: 640 },
    { id: 'qnz-runner', name: 'Executor .QNZ', icon: '📦', category: 'Desenvolvimento', desc: 'Executa arquivos .qnz em janela', width: 760, height: 560 },

    { id: 'pintaclima', name: 'Pinta Clima', icon: '🎨', category: 'Criatividade', desc: 'Editor de desenho avançado', width: 940, height: 640 },
    { id: 'office', name: 'Quinzuo Office', icon: '💼', category: 'Criatividade', desc: 'Suite de produtividade', width: 720, height: 480 },
    { id: 'word', name: 'Quinzuo Word', icon: '📄', category: 'Criatividade', desc: 'Editor de texto', width: 780, height: 560 },
    { id: 'excel', name: 'Quinzuo Excel', icon: '📊', category: 'Criatividade', desc: 'Planilhas', width: 800, height: 560 },
    { id: 'access', name: 'Quinzuo Access', icon: '🗄️', category: 'Criatividade', desc: 'Banco de dados', width: 780, height: 520 },
    { id: 'notepad', name: 'Bloco de Notas', icon: '📝', category: 'Criatividade', desc: 'Texto simples', width: 680, height: 480 },
    { id: 'makeup', name: 'Make Up Editor', icon: '💄', category: 'Criatividade', desc: 'Editor de maquiagem virtual', width: 820, height: 560 },

    { id: 'browser', name: 'Navegador / View', icon: '🌐', category: 'Utilidades', desc: 'Visualizador HTML e URLs', width: 800, height: 600 },
    { id: 'arcade', name: 'Quinzuo Arcade', icon: '🕹️', category: 'Utilidades', desc: 'Hub de jogos web', width: 900, height: 620 },
    { id: 'personalizar', name: 'Personalizar OS', icon: '🖌️', category: 'Utilidades', desc: 'CSS e widgets do desktop', width: 820, height: 540 },
    { id: 'nettools', name: 'Quiznuo WHOIS / CURL', icon: '🌐', category: 'Utilidades', desc: 'Rede, DNS e requisições HTTP', width: 860, height: 600 }
];

APP_META.forEach((meta) => registry.set(meta.id, { ...meta, render: null }));

export function defineApp(id, definition = {}) {
    const base = registry.get(id) || { id, name: id, icon: '📦', category: 'Outros', width: 720, height: 520 };
    const previous = registry.get(id) || {};
    const merged = { ...base, ...previous, ...definition, id };
    registry.set(id, merged);
    if (definition.aliases) {
        definition.aliases.forEach((alias) => registry.set(alias, { ...merged, id: alias, aliasOf: id }));
    }
    return merged;
}

export function getApp(id) {
    return registry.get(id) || null;
}

export function listApps() {
    return Array.from(registry.values()).filter((app) => !app.aliasOf);
}

export function listByCategory() {
    const groups = new Map();
    listApps().forEach((app) => {
        if (!groups.has(app.category)) groups.set(app.category, []);
        groups.get(app.category).push(app);
    });
    return Array.from(groups.entries());
}
