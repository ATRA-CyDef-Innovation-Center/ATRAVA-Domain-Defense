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
exports.auditFunctions = exports.getAuditStatistics = exports.deleteOldAuditLogs = exports.getAuditLogsByDateRange = exports.getAuditLogs = exports.logAction = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Log an action
exports.logAction = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { userId, action, details, status } = req.body;
        if (!userId || !action) {
            res.status(400).json({ error: 'Missing required fields: userId, action' });
            return;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            userId,
            action,
            details: details || {},
            status: status || 'success',
        };
        const docRef = await db.collection('auditLogs').add(entry);
        res.json({ success: true, id: docRef.id, data: entry });
    }
    catch (error) {
        console.error('[v0] Error logging action:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get audit logs
exports.getAuditLogs = functions.https.onRequest(async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const action = req.query.action;
        const userId = req.query.userId;
        let query = db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit);
        // Apply filters
        if (action) {
            query = query.where('action', '==', action);
        }
        if (userId) {
            query = query.where('userId', '==', userId);
        }
        const snapshot = await query.get();
        const logs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({ success: true, count: logs.length, logs });
    }
    catch (error) {
        console.error('[v0] Error fetching audit logs:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get logs by date range
exports.getAuditLogsByDateRange = functions.https.onRequest(async (req, res) => {
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const limit = parseInt(req.query.limit) || 100;
        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Missing required parameters: startDate, endDate' });
            return;
        }
        const snapshot = await db
            .collection('auditLogs')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        const logs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({ success: true, count: logs.length, logs });
    }
    catch (error) {
        console.error('[v0] Error fetching logs by date range:', error);
        res.status(500).json({ error: String(error) });
    }
});
// Delete old audit logs (cleanup)
exports.deleteOldAuditLogs = functions.pubsub
    .schedule('every 7 days')
    .onRun(async () => {
    try {
        // Get logs older than 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const snapshot = await db
            .collection('auditLogs')
            .where('timestamp', '<', ninetyDaysAgo.toISOString())
            .limit(1000)
            .get();
        const batch = db.batch();
        let count = 0;
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
        });
        if (count > 0) {
            await batch.commit();
            console.log(`[v0] Deleted ${count} old audit logs`);
        }
        return null;
    }
    catch (error) {
        console.error('[v0] Error cleaning up old logs:', error);
        throw error;
    }
});
// Export statistics
exports.getAuditStatistics = functions.https.onRequest(async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get logs in range
        const snapshot = await db
            .collection('auditLogs')
            .where('timestamp', '>=', startDate.toISOString())
            .get();
        // Build statistics
        const stats = {};
        const userStats = {};
        let totalLogs = 0;
        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const action = data.action || 'unknown';
            const userId = data.userId || 'unknown';
            stats[action] = (stats[action] || 0) + 1;
            userStats[userId] = (userStats[userId] || 0) + 1;
            totalLogs++;
        });
        res.json({
            success: true,
            period: { days, startDate: startDate.toISOString() },
            totalLogs,
            actions: stats,
            users: userStats,
        });
    }
    catch (error) {
        console.error('[v0] Error getting audit statistics:', error);
        res.status(500).json({ error: String(error) });
    }
});
exports.auditFunctions = {
    logAction: exports.logAction,
    getAuditLogs: exports.getAuditLogs,
    getAuditLogsByDateRange: exports.getAuditLogsByDateRange,
    deleteOldAuditLogs: exports.deleteOldAuditLogs,
    getAuditStatistics: exports.getAuditStatistics,
};
