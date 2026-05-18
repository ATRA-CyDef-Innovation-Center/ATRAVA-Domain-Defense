import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface DNSNodeStatus {
  nodeId: string;
  name: string;
  ip: string;
  status: 'online' | 'warning' | 'offline';
  version: string;
  lastSync: string;
  uptime: number;
  queriesPerDay: number;
  blockRate: number;
  metadata?: Record<string, any>;
}

// Register or update DNS node
export const registerNode = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { nodeId, name, ip, version, apiKey } = req.body;

    if (!nodeId || !name || !ip) {
      res.status(400).json({ error: 'Missing required fields: nodeId, name, ip' });
      return;
    }

    const nodeData: DNSNodeStatus = {
      nodeId,
      name,
      ip,
      version: version || 'unknown',
      status: 'online',
      lastSync: new Date().toISOString(),
      uptime: 100,
      queriesPerDay: 0,
      blockRate: 0,
    };

    await db.collection('nodes').doc(nodeId).set(nodeData, { merge: true });

    // Log registration
    await logAction(nodeId, 'node_registered', { name, ip, version });

    res.json({ success: true, nodeId, data: nodeData });
  } catch (error) {
    console.error('[v0] Error registering node:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get node status
export const getNodeStatus = functions.https.onRequest(async (req, res) => {
  try {
    const nodeId = req.query.nodeId as string;

    if (!nodeId) {
      res.status(400).json({ error: 'Missing nodeId parameter' });
      return;
    }

    const doc = await db.collection('nodes').doc(nodeId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    res.json({ success: true, data: doc.data() });
  } catch (error) {
    console.error('[v0] Error fetching node status:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Update node health/status
export const updateNodeStatus = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { nodeId, status, uptime, queriesPerDay, blockRate, metrics } = req.body;

    if (!nodeId) {
      res.status(400).json({ error: 'Missing nodeId' });
      return;
    }

    const updateData: any = {
      status: status || 'online',
      lastSync: new Date().toISOString(),
      ...(uptime !== undefined && { uptime }),
      ...(queriesPerDay !== undefined && { queriesPerDay }),
      ...(blockRate !== undefined && { blockRate }),
    };

    await db.collection('nodes').doc(nodeId).update(updateData);

    // Log health check
    if (metrics) {
      await logAction(nodeId, 'node_health_check', metrics);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[v0] Error updating node status:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get all nodes
export const getAllNodes = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await db.collection('nodes').get();

    const nodes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, count: nodes.length, nodes });
  } catch (error) {
    console.error('[v0] Error fetching nodes:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Sync policies to all nodes
export const syncPoliciesToNodes = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get all blacklist domains
    const blacklistSnapshot = await db
      .collection('domains')
      .doc('blacklist')
      .collection('entries')
      .get();

    // Get all whitelis domains
    const whitelistSnapshot = await db
      .collection('domains')
      .doc('whitelist')
      .collection('entries')
      .get();

    const blacklistedDomains = blacklistSnapshot.docs.map((doc) => doc.data().domain);
    const whitelistedDomains = whitelistSnapshot.docs.map((doc) => doc.data().domain);

    // Create sync manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      blacklist: blacklistedDomains,
      whitelist: whitelistedDomains,
      totalDomains: blacklistedDomains.length + whitelistedDomains.length,
    };

    // Store manifest for nodes to pull
    await db.collection('_system').doc('policyManifest').set(manifest);

    // Get all nodes and update their sync status
    const nodesSnapshot = await db.collection('nodes').get();
    const batch = db.batch();

    nodesSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        syncStatus: 'pending',
        syncVersion: manifest.timestamp,
      });
    });

    await batch.commit();

    // Log the sync
    await logAction('system', 'policies_synced', {
      totalDomains: manifest.totalDomains,
      blacklisted: blacklistedDomains.length,
      whitelisted: whitelistedDomains.length,
    });

    res.json({ success: true, manifest });
  } catch (error) {
    console.error('[v0] Error syncing policies:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Helper: Log action
async function logAction(userId: string, action: string, details: any) {
  try {
    await db.collection('auditLogs').add({
      timestamp: new Date().toISOString(),
      userId,
      action,
      details,
      status: 'success',
    });
  } catch (error) {
    console.error('[v0] Error logging action:', error);
  }
}

export const nodeFunctions = {
  registerNode,
  getNodeStatus,
  updateNodeStatus,
  getAllNodes,
  syncPoliciesToNodes,
};
