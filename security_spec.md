# Security Specification — SIM-KANTOR Firestore Rules (Zero-Trust ABAC)

## 1. Data Invariants
1. **Authentication & Email Verification Invariant**: Every write operation and every read of PII requires a signed-in user with `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Isolation Invariant (`/participants/{participantId}`)**: A participant document contains PII (`email`, `nip`, `noHp`, `noRekening`). Only the document owner (`resource.data.ownerUid == request.auth.uid`) or a verified Committee Admin (`isAdmin()`) may `get` or `list` the document.
3. **Committee Admin Privilege Invariant (`/admins/{adminId}`)**: Only the bootstrapped owner (`brcloud070783@gmail.com` with `email_verified == true`) or a user registering their own UID with the valid committee access key (`pinHash == '2025'`) and `createdAt == request.time` may create an admin record.
4. **Speaker Financial Isolation (`/speakers/{speakerId}`)**: Contains NPWP and bank account numbers; strictly readable and writable only by `isAdmin()`.
5. **Immutable Audit Trail (`/auditLogs/{logId}`)**: Audit logs can only be created with `actorUid == request.auth.uid` and `createdAt == request.time`, and can never be updated or deleted (`allow update, delete: if false`).
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamp fields must strictly equal `request.time`.

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity & State)
1. **Payload 1 (Unauthenticated Participant Read)**: `auth = null` attempting `get(/participants/pst-001)` -> `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Admin Spoof)**: `auth = { uid: 'attacker', email: 'brcloud070783@gmail.com', email_verified: false }` attempting `get(/participants/pst-001)` -> `PERMISSION_DENIED`.
3. **Payload 3 (Cross-Participant PII Read)**: `auth = { uid: 'userA', email_verified: true }` attempting `get(/participants/userB)` where `ownerUid == 'userB'` -> `PERMISSION_DENIED`.
4. **Payload 4 (Blanket Participant List Scraping)**: `auth = { uid: 'userA', email_verified: true }` attempting unrestricted `list(/participants)` without `where('ownerUid', '==', 'userA')` -> `PERMISSION_DENIED`.
5. **Payload 5 (Identity Spoofing on Create)**: `auth = { uid: 'userA', email_verified: true }` creating `/participants/userA` with `ownerUid: 'userB'` -> `PERMISSION_DENIED`.
6. **Payload 6 (Shadow Field Injection)**: `auth = { uid: 'userA', email_verified: true }` creating `/participants/userA` with an undeclared field `isSuperAdmin: true` -> `PERMISSION_DENIED`.
7. **Payload 7 (Self-Verification Privilege Escalation)**: Non-admin participant attempting to update `statusBerkas` to `'TERVERIFIKASI'` or `statusBayar` to `'SUDAH_DIBAYAR'` -> `PERMISSION_DENIED`.
8. **Payload 8 (Owner UID Mutation on Update)**: Participant attempting to change `ownerUid` or `createdAt` during an update -> `PERMISSION_DENIED`.
9. **Payload 9 (Fake Client Timestamp)**: Participant creating `/participants/userA` with a past/future `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Payload 10 (Resource Poisoning / Oversized String)**: Participant submitting `nama` with 5,000 characters (> max 200) -> `PERMISSION_DENIED`.
11. **Payload 11 (Audit Log Tampering)**: Admin or user attempting `update` or `delete` on `/auditLogs/log-1` -> `PERMISSION_DENIED`.
12. **Payload 12 (Unauthorized Speaker Read)**: Non-admin participant attempting `get(/speakers/spk-001)` -> `PERMISSION_DENIED`.
