import { emit, events, readLS, writeLS } from './state.js';
import { getSettings } from './settings.js';

/**
 * Quinzeta DB — serviço de banco de dados compartilhado do Quinzuo OS.
 * Habilitado pela BelaNovaEFI (Habilitar serviços do Quinzeta DB).
 * Planilhas do Excel (CSV) e bancos do Access (JSON) usam o mesmo acervo.
 */
const STORE_KEY = 'qz_quinzeta_db';

function emptyStore() {
    return { version: 1, tables: {} };
}

function normalizeName(name) {
    return String(name || 'sem-nome').trim().toLowerCase();
}

let store = readLS(STORE_KEY, null) || emptyStore();
if (!store || typeof store !== 'object' || !store.tables) store = emptyStore();

function persist() {
    writeLS(STORE_KEY, store);
    emit(events.SETTINGS_CHANGED, { quinzetaDB: true, tables: QuinzetaDB.list() });
}

export const QuinzetaDB = {
    isEnabled() {
        return !!getSettings().quinzetaDB;
    },

    list() {
        return Object.values(store.tables)
            .sort((a, b) => (b.updated || 0) - (a.updated || 0))
            .map((t) => ({ name: t.name, type: t.type, updated: t.updated }));
    },

    saveTable(name, type, content) {
        if (!this.isEnabled()) return { error: 'Quinzeta DB desabilitado na BelaNovaEFI.' };
        const key = normalizeName(name);
        store.tables[key] = {
            name: String(name || key),
            type: type === 'csv' ? 'csv' : 'json',
            content: String(content ?? ''),
            updated: Date.now()
        };
        persist();
        return store.tables[key];
    },

    saveSheet(name, csv) { return this.saveTable(name, 'csv', csv); },
    saveDatabase(name, data) { return this.saveTable(name, 'json', typeof data === 'string' ? data : JSON.stringify(data, null, 2)); },

    getTable(name) {
        if (!this.isEnabled()) return null;
        return store.tables[normalizeName(name)] || null;
    },

    removeTable(name) {
        if (!this.isEnabled()) return false;
        const ok = delete store.tables[normalizeName(name)];
        if (ok) persist();
        return ok;
    },

    exportAll() { return JSON.stringify(store, null, 2); },

    status() {
        return {
            habilitado: this.isEnabled(),
            tabelas: this.list().length,
            nome: 'Quinzeta DB',
            destinos: ['Quinzuo Excel', 'Quinzuo Access']
        };
    }
};
