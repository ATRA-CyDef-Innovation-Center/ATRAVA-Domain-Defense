import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface AuditLogEntry {
  timestamp: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  status: 'success' | 'warning' | 'error';
}

// Log an action
export const logAction = functions.https.onRequest(async (req, res) => {
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

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      details: details || {},
      status: status || 'success',
    };

    const docRef = await db.collection('auditLogs').add(entry);

    res.json({ success: true, id: docRef.id, data: entry });
  } catch (error) {
    console.error('[v0] Error logging action:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get audit logs
export const getAuditLogs = functions.https.onRequest(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const action = req.query.action as string;
    const userId = req.query.userId as string;

    let query: any = db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit);

    // Apply filters
    if (action) {
      query = query.where('action', '==', action);
    }
    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();

    const logs = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('[v0] Error fetching audit logs:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get logs by date range
export const getAuditLogsByDateRange = functions.https.onRequest(async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const limit = parseInt(req.query.limit as string) || 100;

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

    const logs = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('[v0] Error fetching logs by date range:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Delete old audit logs (cleanup)
export const deleteOldAuditLogs = functions.pubsub
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

      snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        batch.delete(doc.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        console.log(`[v0] Deleted ${count} old audit logs`);
      }

      return null;
    } catch (error) {
      console.error('[v0] Error cleaning up old logs:', error);
      throw error;
    }
  });

// Export statistics
export const getAuditStatistics = functions.https.onRequest(async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get logs in range
    const snapshot = await db
      .collection('auditLogs')
      .where('timestamp', '>=', startDate.toISOString())
      .get();

    // Build statistics
    const stats: Record<string, number> = {};
    const userStats: Record<string, number> = {};
    let totalLogs = 0;

    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
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
  } catch (error) {
    console.error('[v0] Error getting audit statistics:', error);
    res.status(500).json({ error: String(error) });
  }
});

export const auditFunctions = {
  logAction,
  getAuditLogs,
  getAuditLogsByDateRange,
  deleteOldAuditLogs,
  getAuditStatistics,
};
