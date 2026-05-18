import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { domainFunctions } from './domains';
import { nodeFunctions } from './nodes';
import { auditFunctions } from './audit';

// Initialize Firebase
admin.initializeApp();

// Export all functions
export const domains = domainFunctions;
export const nodes = nodeFunctions;
export const audit = auditFunctions;

// Health check function
export const healthCheck = functions.https.onRequest(async (req, res) => {
  try {
    const firestore = admin.firestore();
    const testDoc = await firestore.collection('_health').doc('check').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[v0] Health check error:', error);
    res.status(500).json({ status: 'error', message: String(error) });
  }
});
