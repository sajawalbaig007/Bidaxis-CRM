"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCache = getCache;
exports.setCache = setCache;
exports.invalidateCache = invalidateCache;
exports.invalidatePattern = invalidatePattern;
const store = new Map();
function getCache(key) {
    const entry = store.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(key, data, ttlMs) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function invalidateCache(...keys) {
    keys.forEach(k => store.delete(k));
}
function invalidatePattern(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix))
            store.delete(key);
    }
}
