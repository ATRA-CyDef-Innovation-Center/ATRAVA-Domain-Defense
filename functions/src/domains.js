"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.domainFunctions = exports.bulkImportDomains = exports.getBlacklistDomains = exports.removeBlacklistDomain = exports.addBlacklistDomain = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Add a single domain to blacklist
exports.addBlacklistDomain = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { domain, threatLevel, sources, addedBy } = req.body;
        if (!domain || !addedBy) {
            res.status(400).json({ error: 'Missing required fields: domain, addedBy' });
            return;
        }
        const docId = domain.toLowerCase().replace(/[^a-z0-9-]/g, '_');
        const entry = {
            domain: domain.toLowerCase(),
            threatLevel: threatLevel || 'medium',
            sources: sources || [],
            addedAt: new Date().toISOString(),
            addedBy,
        };
        await db.collection('domains').doc('blacklist').collection('entries').doc(docId).set(entry);
        // Log the action
        await logAction(addedBy, 'domain_added', {
            domain,
            threatLevel,
            sources,
            type: 'blacklist',
        });
        // Trigger node sync
        await triggerNodeSync();
        res.json({ success: true, docId, data: entry });
    }
    catch (error) {
        console.error('[v0] Error adding domain:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Remove domain from blacklist
exports.removeBlacklistDomain = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { domain, removedBy } = req.body;
        if (!domain) {
            res.status(400).json({ error: 'Missing required field: domain' });
            return;
        }
        const docId = domain.toLowerCase().replace(/[^a-z0-9-]/g, '_');
        await db.collection('domains').doc('blacklist').collection('entries').doc(docId).delete();
        // Log the action
        await logAction(removedBy, 'domain_removed', {
            domain,
            type: 'blacklist',
        });
        // Trigger node sync
        await triggerNodeSync();
        res.json({ success: true });
    }
    catch (error) {
        console.error('[v0] Error removing domain:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get all blacklist domains
exports.getBlacklistDomains = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await db.collection('domains').doc('blacklist').collection('entries').get();
        const domains = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({ success: true, count: domains.length, domains });
    }
    catch (error) {
        console.error('[v0] Error fetching domains:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Bulk import domains
exports.bulkImportDomains = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { domains, type, importedBy } = req.body;
        if (!Array.isArray(domains) || domains.length === 0) {
            res.status(400).json({ error: 'Invalid domains array' });
            return;
        }
        const batch = db.batch();
        const collectionPath = type === 'blacklist' ? 'blacklist' : 'whitelist';
        const baseRef = db.collection('domains').doc(collectionPath).collection('entries');
        domains.forEach((domain) => {
            const docId = domain.domain.toLowerCase().replace(/[^a-z0-9-]/g, '_');
            const entry = {
                domain: domain.domain.toLowerCase(),
                ...(type === 'blacklist' && {
                    threatLevel: domain.threatLevel || 'medium',
                    sources: domain.sources || [],
                }),
                ...(type === 'whitelist' && { reason: domain.reason || '' }),
                addedAt: new Date().toISOString(),
                addedBy: importedBy || 'bulk-import',
            };
            batch.set(baseRef.doc(docId), entry);
        });
        await batch.commit();
        // Log the action
        await logAction(importedBy, 'bulk_import', {
            count: domains.length,
            type,
        });
        // Trigger node sync
        await triggerNodeSync();
        res.json({ success: true, imported: domains.length });
    }
    catch (error) {
        console.error('[v0] Error bulk importing domains:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Helper: Log action to audit log
async function logAction(userId, action, details) {
    try {
        await db.collection('auditLogs').add({
            timestamp: new Date().toISOString(),
            userId,
            action,
            details,
            status: 'success',
        });
    }
    catch (error) {
        console.error('[v0] Error logging action:', error);
    }
}
// Helper: Trigger node sync
async function triggerNodeSync() {
    try {
        // Update a sync trigger document
        await db.collection('_system').doc('syncTrigger').update({
            lastTriggered: new Date().toISOString(),
            requiresSync: true,
        });
    }
    catch (error) {
        console.error('[v0] Error triggering sync:', error);
    }
}
exports.domainFunctions = {
    addBlacklistDomain: exports.addBlacklistDomain,
    removeBlacklistDomain: exports.removeBlacklistDomain,
    getBlacklistDomains: exports.getBlacklistDomains,
    bulkImportDomains: exports.bulkImportDomains,
};
