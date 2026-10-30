/**
 * Phase 0 Security Test Specification for SIM-KANTOR Firestore Rules
 * Verifies that all 12 Dirty Dozen payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Participant Read',
    collection: 'participants',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: 'participants',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Participant PII Read',
    collection: 'participants',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Blanket Participant List Scraping',
    collection: 'participants',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Participant Create',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Field Injection on Participant Create',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Participant Self-Approval of Financial Status',
    collection: 'participants',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable ownerUid Mutation Attempt',
    collection: 'participants',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Forged Client Timestamp on Create',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized String Resource Poisoning',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Audit Log Deletion Attempt',
    collection: 'auditLogs',
    operation: 'delete',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Speaker NPWP Read by Participant',
    collection: 'speakers',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
];
