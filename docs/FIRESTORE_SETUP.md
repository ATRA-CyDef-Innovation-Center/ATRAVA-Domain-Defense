# ATRAVA Domain Defense Firebase/Firestore Setup Guide

## Firebase Project Configuration

### Environment Variables

Add the following to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-side Firebase Admin SDK credentials
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PROJECT_ID=your_project_id
```

## Firestore Collections & Schema

### 1. **users** - User accounts and roles
```
/users/{uid}
  - email: string
  - displayName: string
  - role: 'admin' | 'analyst' | 'viewer' | 'system_agent'
  - createdAt: timestamp
  - lastLoginAt: timestamp
```

### 2. **dns_nodes** - DNS node instances
```
/dns_nodes/{nodeId}
  - name: string
  - description: string
  - ipAddress: string
  - port: number
  - status: 'online' | 'offline' | 'degraded'
  - lastHeartbeat: timestamp
  - createdAt: timestamp
  - updatedAt: timestamp
  - metadata: object (custom fields)
```

### 3. **policies** - DNS policies
```
/policies/{policyId}
  - name: string
  - description: string
  - type: 'allow' | 'block' | 'redirect'
  - domains: array[string]
  - redirectTarget: string (optional)
  - priority: number
  - enabled: boolean
  - appliedToNodes: array[string] (node IDs)
  - createdAt: timestamp
  - updatedAt: timestamp
  - createdBy: string (user ID)
```

### 4. **whitelisted_domains** - Allowed domains
```
/whitelisted_domains/{domainId}
  - domain: string
  - reason: string
  - addedAt: timestamp
  - addedBy: string (user ID)
  - expiresAt: timestamp (optional)
  - metadata: object
```

### 5. **blacklisted_domains** - Blocked domains
```
/blacklisted_domains/{domainId}
  - domain: string
  - threatLevel: 'critical' | 'high' | 'medium' | 'low'
  - threatSources: array[string] (e.g., 'malware', 'phishing', 'botnet')
  - reason: string
  - addedAt: timestamp
  - addedBy: string (user ID)
  - expiresAt: timestamp (optional)
  - metadata: object
```

### 6. **dns_query_logs** - DNS query history
```
/dns_query_logs/{logId}
  - nodeId: string
  - domain: string
  - queryType: string ('A', 'AAAA', 'MX', etc.)
  - result: 'allowed' | 'blocked' | 'redirected'
  - source: string (client IP)
  - timestamp: timestamp
  - responseTime: number (milliseconds)
  - decision: object
    - policyId: string (optional)
    - reason: string
```

### 7. **audit_logs** - Admin action audit trail
```
/audit_logs/{logId}
  - userId: string
  - action: string ('create_policy', 'delete_domain', etc.)
  - resourceType: 'policy' | 'domain' | 'node' | 'settings'
  - resourceId: string
  - changes: object
    - before: object (optional)
    - after: object (optional)
  - timestamp: timestamp
  - ipAddress: string (optional)
```

### 8. **settings** - System configuration
```
/settings/default
  - organizationName: string
  - logRetentionDays: number
  - enableAuditLogging: boolean
  - defaultQueryTimeout: number
  - updatedAt: timestamp
  - updatedBy: string (user ID)
```

## Firestore Security Rules

Use the repo rule file [firestore.rules](c:\Users\Gelo Martinez\Desktop\ATRAVA Domain Defense\firestore.rules) or paste the following into Firebase Console → Firestore Database → Rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isSelf(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function hasUserProfile() {
      return signedIn() && userDoc().exists();
    }

    function role() {
      return hasUserProfile() ? userDoc().data.role : null;
    }

    function isAdmin() {
      return role() == 'admin';
    }

    function isAnalyst() {
      return role() == 'analyst';
    }

    function isViewer() {
      return role() == 'viewer';
    }

    function canViewDashboardData() {
      return isAdmin() || isAnalyst() || isViewer();
    }

    match /users/{uid} {
      allow create: if isSelf(uid)
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.role in ['viewer', 'analyst'];

      allow read: if isSelf(uid) || isAdmin();

      allow update: if isAdmin()
        || (
          isSelf(uid)
          && request.resource.data.uid == resource.data.uid
          && request.resource.data.email == resource.data.email
          && request.resource.data.role == resource.data.role
        );

      allow delete: if isAdmin();
    }

    match /settings/{document=**} {
      allow read, write: if isAdmin();
    }

    match /nodes/{nodeId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /domains/{listType}/entries/{domainId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /auditLogs/{logId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /_system/{document=**} {
      allow read, write: if false;
    }

    match /dns_nodes/{nodeId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /whitelisted_domains/{domainId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /blacklisted_domains/{domainId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /audit_logs/{logId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /dns_query_logs/{logId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /policies/{policyId} {
      allow read: if canViewDashboardData();
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Notes:
- These rules use the role stored in `/users/{uid}` because the current app does not yet set Firebase Auth custom claims.
- Sensitive writes are intentionally server-only. Your Cloud Functions and node agent use Firebase Admin SDK, which bypasses Firestore rules.
- Self-registration is limited to `viewer` and `analyst`. Create the initial `admin` user manually in Firebase Console or through an Admin SDK script.

## Initial Setup Checklist

- [ ] Create Firebase project in Firebase Console
- [ ] Enable Firestore Database
- [ ] Enable Firebase Authentication (Email/Password or OAuth)
- [ ] Create service account for Cloud Functions
- [ ] Set environment variables in `.env.local`
- [ ] Deploy Firestore security rules
- [ ] Create initial system settings document: `/settings/default`
- [ ] Create initial admin user
- [ ] Test Firestore connections from frontend

## Next Steps

1. Set up Cloud Functions for backend APIs
2. Deploy DNS Node agent
3. Configure CoreDNS with policy sync
