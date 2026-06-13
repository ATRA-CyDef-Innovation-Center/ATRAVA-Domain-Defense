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
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_manager_1 = require("./sync-manager");
const health_monitor_1 = require("./health-monitor");
const policy_cache_1 = require("./policy-cache");
const unbound_manager_1 = require("./unbound-manager");
const proxy_server_1 = require("./proxy-server");
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
let db;
let syncManager;
let healthMonitor;
let unboundManager;
let proxyServer;
let policySyncTimer = null;
let policySyncInFlight = false;
let policySyncPending = null;
const unsubscribePolicyListeners = [];
async function reportRuntimeMetrics(policyCache) {
    await healthMonitor.checkHealth();
    await healthMonitor.reportMetrics();
    const unboundHealth = await unboundManager.getHealthReport();
    if (unboundHealth.isRunning) {
        const policyQueryStats = await unboundManager.getPolicyQueryStats(policyCache);
        await db.collection('nodes').doc(NODE_ID).update({
            unboundStatus: 'online',
            unboundCacheHitRate: unboundHealth.cacheStats.hitRate,
            unboundQueries: unboundHealth.queryStats.totalQueries,
            queriesPerDay: unboundHealth.queryStats.totalQueries,
            blockedQueries: policyQueryStats.blockedQueries,
            sampledQueries: policyQueryStats.sampledQueries,
            blockRate: policyQueryStats.blockRate,
        });
    }
}
function mergeSyncOptions(current, next) {
    if (!current)
        return next;
    return {
        force: Boolean(current.force || next.force),
        domain: next.domain || current.domain,
        reason: next.reason || current.reason,
        triggerRef: next.triggerRef || current.triggerRef,
    };
}
function schedulePolicySync(options = {}) {
    policySyncPending = mergeSyncOptions(policySyncPending, options);
    if (policySyncTimer)
        clearTimeout(policySyncTimer);
    policySyncTimer = setTimeout(() => {
        policySyncTimer = null;
        runScheduledPolicySync().catch((error) => {
            console.error('[v0] Scheduled policy sync failed:', error);
        });
    }, Number(process.env.SYNC_DEBOUNCE_MS || 500));
}
async function runScheduledPolicySync() {
    if (policySyncInFlight)
        return;
    const options = policySyncPending;
    policySyncPending = null;
    if (!options)
        return;
    policySyncInFlight = true;
    try {
        console.log(`[v0] Running scheduled policy sync: ${options.reason || 'policy change'}`);
        const success = await syncManager.syncPolicies(options);
        if (success && options.triggerRef) {
            await options.triggerRef.set({
                requiresSync: false,
                lastCompleted: new Date().toISOString(),
                completedBy: NODE_ID,
            }, { merge: true });
        }
    }
    finally {
        policySyncInFlight = false;
        if (policySyncPending) {
            await runScheduledPolicySync();
        }
    }
}
function startPolicyChangeListeners() {
    const manifestRef = db.collection('_system').doc('policyManifest');
    const triggerRef = db.collection('_system').doc('syncTrigger');
    unsubscribePolicyListeners.push(manifestRef.onSnapshot((snapshot) => {
        if (!snapshot.exists)
            return;
        const data = snapshot.data() || {};
        schedulePolicySync({
            force: false,
            domain: data.domain,
            reason: data.lastChange || 'policyManifest update',
        });
    }, (error) => {
        console.error('[v0] Policy manifest listener error:', error);
    }));
    unsubscribePolicyListeners.push(triggerRef.onSnapshot((snapshot) => {
        if (!snapshot.exists)
            return;
        const data = snapshot.data() || {};
        if (!data.requiresSync)
            return;
        schedulePolicySync({
            force: true,
            domain: data.domain,
            reason: data.reason || 'syncTrigger update',
            triggerRef,
        });
    }, (error) => {
        console.error('[v0] Sync trigger listener error:', error);
    }));
    console.log('[v0] Firestore policy change listeners started');
}
async function initializeFirebase() {
    console.log('[v0] Initializing Firebase...');
    try {
        if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
            throw new Error('Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in the environment.');
        }
        const serviceAccount = {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    const policyCache = new policy_cache_1.PolicyCache();
    syncManager = new sync_manager_1.PolicySyncManager(db, NODE_ID, COREDNS_CONF_PATH, policyCache);
    healthMonitor = new health_monitor_1.HealthMonitor(db, NODE_ID);
    unboundManager = new unbound_manager_1.UnboundManager();
    // Start initial sync
    console.log('[v0] Starting initial policy sync...');
    await syncManager.syncPolicies();
    startPolicyChangeListeners();
    proxyServer = (0, proxy_server_1.startProxyServer)({ policyCache });
    await reportRuntimeMetrics(policyCache);
    // Start periodic syncing
    setInterval(async () => {
        try {
            await syncManager.syncPolicies();
        }
        catch (error) {
            console.error('[v0] Error during periodic sync:', error);
        }
    }, SYNC_INTERVAL);
    // Start health monitoring
    setInterval(async () => {
        try {
            await reportRuntimeMetrics(policyCache);
        }
        catch (error) {
            console.error('[v0] Error during health check:', error);
        }
    }, HEALTH_CHECK_INTERVAL);
    console.log('[v0] Agent started successfully');
    console.log(`[v0] Sync interval: ${SYNC_INTERVAL}ms`);
    console.log(`[v0] Health check interval: ${HEALTH_CHECK_INTERVAL}ms`);
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('[v0] Received SIGTERM, shutting down gracefully...');
        unsubscribePolicyListeners.forEach((unsubscribe) => unsubscribe());
        if (proxyServer)
            proxyServer.close();
        await db.collection('nodes').doc(NODE_ID).update({
            status: 'offline',
            lastSync: new Date().toISOString(),
        });
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        console.log('[v0] Received SIGINT, shutting down gracefully...');
        unsubscribePolicyListeners.forEach((unsubscribe) => unsubscribe());
        if (proxyServer)
            proxyServer.close();
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
