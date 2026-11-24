import { events } from './state.js';

/**
 * Dock da Quinzuo OS — modo "somente janelas abertas".
 * Os aplicativos não ficam fixados: cada janela aberta ganha um tile com
 * minimizar / maximizar / fechar. O ícone do app aparece no tile da janela.
 */
export const Dock = {
    favEl: null,
    runEl: null,
    tiles: new Map(),

    init() {
        this.favEl = document.getElementById('dockFavorites');
        this.runEl = document.getElementById('dockRunning');
        this.renderFavorites();
        document.addEventListener(events.DOCK_CHANGED, () => this.renderFavorites());
        return this;
    },

    // Reservado para compatibilidade: o dock não mostra favoritos fixos.
    renderFavorites() {
        if (this.favEl) this.favEl.innerHTML = '';
    },

    add(info, handlers) {
        if (!this.runEl) return;

        const tile = document.createElement('div');
        tile.className = 'dock-item running';
        tile.dataset.win = info.id;
        tile.innerHTML = `
            <span class="dock-icon">${info.icon || '📦'}</span>
            <span class="dock-label">${escapeText(info.title || info.appId)}</span>
            <div class="dock-tile-controls">
                <button class="dctl-min" title="Minimizar">−</button>
                <button class="dctl-max" title="Maximizar / Restaurar">□</button>
                <button class="dctl-close" title="Fechar">×</button>
            </div>`;

        tile.onclick = () => handlers.onActivate();
        tile.querySelector('.dctl-min').onclick = (e) => { e.stopPropagation(); handlers.onMinimize(); };
        tile.querySelector('.dctl-max').onclick = (e) => { e.stopPropagation(); handlers.onMaximize(); };
        tile.querySelector('.dctl-close').onclick = (e) => { e.stopPropagation(); handlers.onClose(); };

        this.runEl.appendChild(tile);
        this.tiles.set(info.id, tile);
        this.update(info);
        return tile;
    },

    update(info) {
        const tile = this.tiles.get(info.id);
        if (!tile) return;
        tile.classList.toggle('minimized', !!info.minimized);
        tile.classList.toggle('active', !!info.active && !info.minimized);
        tile.classList.toggle('maximized', !!info.maximized);
        tile.querySelector('.dock-label').textContent = info.title || info.appId;
    },

    setActive(winId) {
        this.tiles.forEach((tile, id) => tile.classList.toggle('active', id === winId));
    },

    remove(winId) {
        const tile = this.tiles.get(winId);
        if (tile) tile.remove();
        this.tiles.delete(winId);
    }
};

function escapeText(text) {
    return String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
