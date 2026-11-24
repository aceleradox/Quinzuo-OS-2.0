import { state, emit, events } from './state.js';

async function jsonRequest(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const BackendFS = {
    async fetchAll() {
        try {
            const all = await jsonRequest('/api/fs');
            state.files = all.filter((f) => f.partition_id == state.currentVHD);
            emit(events.FS_CHANGED, state.files);
            return state.files;
        } catch (e) {
            console.warn('[FS] falha ao listar:', e.message);
            return state.files;
        }
    },

    async saveFile(name, type, content, isUrl = false) {
        try {
            const result = await jsonRequest('/api/fs', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({ name, type, content, isUrl, partitionId: state.currentVHD })
            });
            await this.fetchAll();
            return result;
        } catch (e) { console.warn('[FS] falha ao salvar:', e.message); return null; }
    },

    async updateFile(id, patch) {
        try {
            const result = await jsonRequest(`/api/fs/${id}`, {
                method: 'PUT',
                headers: JSON_HEADERS,
                body: JSON.stringify(patch)
            });
            await this.fetchAll();
            return result;
        } catch (e) { console.warn('[FS] falha ao atualizar:', e.message); return null; }
    },

    async renameFile(id, newName) { return this.updateFile(id, { name: newName }); },

    async trashFile(id) {
        try {
            await fetch(`/api/fs/${id}/trash`, { method: 'PUT' });
            await this.fetchAll();
        } catch (e) { console.warn('[FS] falha na lixeira:', e.message); }
    },

    async restoreFile(id) {
        try {
            await fetch(`/api/fs/${id}/restore`, { method: 'PUT' });
            await this.fetchAll();
        } catch (e) { console.warn('[FS] falha ao restaurar:', e.message); }
    },

    async hardDelete(id) {
        try {
            await fetch(`/api/fs/${id}`, { method: 'DELETE' });
            await this.fetchAll();
        } catch (e) { console.warn('[FS] falha ao excluir:', e.message); }
    },

    async getTrash() {
        try {
            const all = await jsonRequest('/api/fs/trash');
            return all.filter((f) => f.partition_id == state.currentVHD);
        } catch (e) { return []; }
    },

    async listFlops() {
        try { return await jsonRequest('/api/flops'); }
        catch (e) { return []; }
    },

    async installFlop(id) {
        try {
            const result = await jsonRequest('/api/flops/install', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({ id, partitionId: state.currentVHD })
            });
            await this.fetchAll();
            return result;
        } catch (e) { return { error: e.message }; }
    }
};
