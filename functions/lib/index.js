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
exports.healthCheck = exports.audit = exports.nodes = exports.domains = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const domains_1 = require("./domains");
const nodes_1 = require("./nodes");
const audit_1 = require("./audit");
// Initialize Firebase
admin.initializeApp();
// Export all functions
exports.domains = domains_1.domainFunctions;
exports.nodes = nodes_1.nodeFunctions;
exports.audit = audit_1.auditFunctions;
// Health check function
exports.healthCheck = functions.https.onRequest(async (req, res) => {
    try {
        const firestore = admin.firestore();
        const testDoc = await firestore.collection('_health').doc('check').get();
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error('[v0] Health check error:', error);
        res.status(500).json({ status: 'error', message: String(error) });
    }
});
