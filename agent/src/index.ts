import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PolicySyncManager } from './sync-manager';
import { HealthMonitor } from './health-monitor';
import { PolicyCache } from './policy-cache';
import { UnboundManager } from './unbound-manager';

const dotenv = require('dotenv');

const agentRoot = path.resolve(__dirname, '..');
const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.join(agentRoot, '.env.local'),
  path.join(agentRoot, '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const NODE_ID = process.env.NODE_ID || 'unknown-node';
const NODE_NAME = process.env.NODE_NAME || 'Default Node';
const NODE_IP = process.env.NODE_IP || '0.0.0.0';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const COREDNS_CONF_PATH = process.env.COREDNS_CONF_PATH || '/etc/coredns/Corefile';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '60000'); // 1 minute
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '120000'); // 2 minutes

let db: FirebaseFirestore.Firestore;
let syncManager: PolicySyncManager;
let healthMonitor: HealthMonitor;
let unboundManager: UnboundManager;

async function initializeFirebase() {
  console.log('[v0] Initializing Firebase...');
  try {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error(
        'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in the environment.'
      );
    }

    const serviceAccount: admin.ServiceAccount = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    };

    console.log('[v0] Using Firebase Admin credentials from environment variables');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log('[v0] Firebase initialized successfully');
  } catch (error) {
    console.error('[v0] Failed to initialize Firebase:', error);
    process.exit(1);
  }
}

async function registerNode() {
  console.log('[v0] Registering DNS node...');
  try {
    const nodeData = {
      nodeId: NODE_ID,
      name: NODE_NAME,
      ip: NODE_IP,
      version: '1.4.2',
      status: 'online',
      lastSync: new Date().toISOString(),
      uptime: 100,
      queriesPerDay: 0,
      blockRate: 0,
    };

    await db.collection('nodes').doc(NODE_ID).set(nodeData, { merge: true });
    console.log('[v0] Node registered:', NODE_ID);
  } catch (error) {
    console.error('[v0] Failed to register node:', error);
  }
}

async function startAgent() {
  console.log('[v0] Starting GCOT DNS Policy Agent...');
  console.log(`[v0] Node ID: ${NODE_ID}`);
  console.log(`[v0] Node Name: ${NODE_NAME}`);
  console.log(`[v0] Node IP: ${NODE_IP}`);

  // Initialize Firebase
  await initializeFirebase();

  // Register node
  await registerNode();

  // Initialize managers
  const policyCache = new PolicyCache();
  syncManager = new PolicySyncManager(db, NODE_ID, COREDNS_CONF_PATH, policyCache);
  healthMonitor = new HealthMonitor(db, NODE_ID);
  unboundManager = new UnboundManager();

  // Start initial sync
  console.log('[v0] Starting initial policy sync...');
  await syncManager.syncPolicies();

  // Start periodic syncing
  setInterval(async () => {
    try {
      await syncManager.syncPolicies();
    } catch (error) {
      console.error('[v0] Error during periodic sync:', error);
    }
  }, SYNC_INTERVAL);

  // Start health monitoring
  setInterval(async () => {
    try {
      await healthMonitor.checkHealth();
      await healthMonitor.reportMetrics();
      
      // Include Unbound health in report
      const unboundHealth = await unboundManager.getHealthReport();
      if (unboundHealth.isRunning) {
        await db.collection('nodes').doc(NODE_ID).update({
          unboundStatus: 'online',
          unboundCacheHitRate: unboundHealth.cacheStats.hitRate,
          unboundQueries: unboundHealth.queryStats.totalQueries,
        });
      }
    } catch (error) {
      console.error('[v0] Error during health check:', error);
    }
  }, HEALTH_CHECK_INTERVAL);

  console.log('[v0] Agent started successfully');
  console.log(`[v0] Sync interval: ${SYNC_INTERVAL}ms`);
  console.log(`[v0] Health check interval: ${HEALTH_CHECK_INTERVAL}ms`);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[v0] Received SIGTERM, shutting down gracefully...');
    await db.collection('nodes').doc(NODE_ID).update({
      status: 'offline',
      lastSync: new Date().toISOString(),
    });
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[v0] Received SIGINT, shutting down gracefully...');
    await db.collection('nodes').doc(NODE_ID).update({
      status: 'offline',
      lastSync: new Date().toISOString(),
    });
    process.exit(0);
  });
}

// Start the agent
startAgent().catch((error) => {
  console.error('[v0] Fatal error:', error);
  process.exit(1);
});
