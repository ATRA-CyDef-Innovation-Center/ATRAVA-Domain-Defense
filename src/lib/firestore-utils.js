var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, getDocs, } from 'firebase/firestore';
import { db } from './firebase';
// Generic Firestore operations
export function getDocument(collectionName, docId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const docRef = doc(db, collectionName, docId);
            const docSnap = yield getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        }
        catch (error) {
            console.error(`Error getting document from ${collectionName}:`, error);
            throw error;
        }
    });
}
export function setDocument(collectionName, docId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const docRef = doc(db, collectionName, docId);
            yield setDoc(docRef, data);
        }
        catch (error) {
            console.error(`Error setting document in ${collectionName}:`, error);
            throw error;
        }
    });
}
export function updateDocument(collectionName, docId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const docRef = doc(db, collectionName, docId);
            yield updateDoc(docRef, data);
        }
        catch (error) {
            console.error(`Error updating document in ${collectionName}:`, error);
            throw error;
        }
    });
}
export function deleteDocument(collectionName, docId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const docRef = doc(db, collectionName, docId);
            yield deleteDoc(docRef);
        }
        catch (error) {
            console.error(`Error deleting document from ${collectionName}:`, error);
            throw error;
        }
    });
}
export function queryCollection(collectionName, constraints) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const q = query(collection(db, collectionName), ...constraints);
            const querySnapshot = yield getDocs(q);
            return querySnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        }
        catch (error) {
            console.error(`Error querying ${collectionName}:`, error);
            throw error;
        }
    });
}
// Firestore collection paths
export const COLLECTIONS = {
    USERS: 'users',
    NODES: 'dns_nodes',
    POLICIES: 'policies',
    WHITELISTED_DOMAINS: 'whitelisted_domains',
    BLACKLISTED_DOMAINS: 'blacklisted_domains',
    DNS_LOGS: 'dns_query_logs',
    AUDIT_LOGS: 'audit_logs',
    SETTINGS: 'settings',
};
