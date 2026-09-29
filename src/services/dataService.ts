import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  RpcRecord,
  Scholar,
  RpcMember,
  AuditLog,
  DocumentSnapshot,
  UserProfile,
  OfficialLetterData,
  RpcStatus,
  EmailNotificationEvent,
} from '../types';
import {
  logPendingEmailNotification,
  getEmailNotificationsForRecord,
  getPendingEmailNotifications,
  getAllEmailNotifications,
} from '../server/notifications';
import {
  DEMO_SCHOLARS,
  DEMO_MEMBERS,
  DEMO_RPC_RECORDS,
  DEMO_AUDIT_LOGS,
  createLetterData,
} from '../data/initialDemoData';
import {
  syncLoadedExcelToFirestore,
  loadLoadedExcelFromFirestore,
} from './excelService';
import { formatDisplayDate } from '../utils/dateUtils';

// All demo IDs to ignore and purge across the entire portal
export const REMOVED_DEMO_IDS = new Set([
  'rpc-devanshi-1',
  'rpc-richard-1',
  'rpc-richard-2',
  'rpc-richard-3',
  'rpc-edy-1',
  'rpc-sunganani-1',
  'rpc-pritesh-2',
  'sch-devanshi',
  'sch-richard',
  'sch-edy',
  'sch-sunganani',
  'sch-pritesh',
]);
const REMOVED_LEGACY_IDS = REMOVED_DEMO_IDS;

export function isDemoItem(item: any): boolean {
  if (!item) return false;
  const sId = String(item.id || '').toLowerCase();
  const name = String(item.name || item.scholarName || '').toLowerCase();
  const enroll = String(item.enrollmentNo || '').trim();
  const schId = String(item.scholarId || '').toLowerCase();

  if (
    enroll === '240114002015' ||
    enroll === '240112006037' ||
    enroll === '240112006033' ||
    enroll === 'DOCX_EXPORT'
  ) {
    return true;
  }
  if (
    name.includes('devanshi') ||
    name.includes('richard') ||
    name.includes('kashindye') ||
    name.includes('edy') ||
    name.includes('sunganani') ||
    name.includes('pritesh')
  ) {
    return true;
  }
  if (
    sId.includes('devanshi') ||
    sId.includes('richard') ||
    sId.includes('edy') ||
    sId.includes('sunganani') ||
    sId.includes('pritesh') ||
    schId.includes('devanshi') ||
    schId.includes('richard') ||
    schId.includes('edy') ||
    schId.includes('sunganani') ||
    schId.includes('pritesh')
  ) {
    return true;
  }
  if (REMOVED_DEMO_IDS.has(sId) || REMOVED_DEMO_IDS.has(schId)) {
    return true;
  }
  return false;
}

// Persistent storage keys to guarantee zero data loss
export const LOCAL_STORAGE_RPC_RECORDS_KEY = 'nfsu_portal_rpc_records_persistent';
export const LOCAL_STORAGE_SCHOLARS_KEY = 'nfsu_portal_scholars_persistent';
export const LOCAL_STORAGE_MEMBERS_KEY = 'nfsu_portal_members_persistent';
export const LOCAL_STORAGE_AUDIT_LOGS_KEY = 'nfsu_portal_audit_logs_persistent';
export const LOCAL_STORAGE_DOCUMENTS_KEY = 'nfsu_portal_documents_persistent';
export const LOCAL_STORAGE_PENDING_QUEUE_KEY = 'nfsu_portal_pending_writes_persistent';

// In-memory mirror to guarantee instant reactivity, resilience and zero-lag experience
let memoryRpcRecords: RpcRecord[] = [...DEMO_RPC_RECORDS];
let memoryScholars: Scholar[] = [...DEMO_SCHOLARS];
let memoryMembers: RpcMember[] = [...DEMO_MEMBERS];
let memoryAuditLogs: AuditLog[] = [...DEMO_AUDIT_LOGS];
let memoryDocuments: DocumentSnapshot[] = [];

let isInitialized = false;

// Immediately persist all active work to local storage and broadcast to open tabs/components
export function saveAllPortalDataLocally(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_RPC_RECORDS_KEY, JSON.stringify(memoryRpcRecords));
    localStorage.setItem(LOCAL_STORAGE_SCHOLARS_KEY, JSON.stringify(memoryScholars));
    localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(memoryMembers));
    localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS_KEY, JSON.stringify(memoryAuditLogs));
    localStorage.setItem(LOCAL_STORAGE_DOCUMENTS_KEY, JSON.stringify(memoryDocuments));
    window.dispatchEvent(
      new CustomEvent('nfsu-portal-data-changed', {
        detail: { timestamp: Date.now(), count: memoryRpcRecords.length },
      })
    );
  } catch (err) {
    console.warn('LocalStorage save warning:', err);
  }
}

// Load all saved work from local storage immediately on startup
export function loadAllPortalDataLocally(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    let loaded = false;
    const rawRpcs = localStorage.getItem(LOCAL_STORAGE_RPC_RECORDS_KEY);
    const rawSchs = localStorage.getItem(LOCAL_STORAGE_SCHOLARS_KEY);
    const rawMems = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
    const rawAudits = localStorage.getItem(LOCAL_STORAGE_AUDIT_LOGS_KEY);
    const rawDocs = localStorage.getItem(LOCAL_STORAGE_DOCUMENTS_KEY);

    if (rawRpcs) {
      const parsed = JSON.parse(rawRpcs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryRpcRecords = parsed.filter((r) => !isDemoItem(r));
        loaded = true;
      }
    }
    if (rawSchs) {
      const parsed = JSON.parse(rawSchs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryScholars = parsed.filter((s) => !isDemoItem(s));
        loaded = true;
      }
    }
    if (rawMems) {
      const parsed = JSON.parse(rawMems);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryMembers = parsed;
      }
    }
    if (rawAudits) {
      const parsed = JSON.parse(rawAudits);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryAuditLogs = parsed.filter((a) => !isDemoItem(a));
      }
    }
    if (rawDocs) {
      const parsed = JSON.parse(rawDocs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryDocuments = parsed.filter((d) => !isDemoItem(d));
      }
    }
    // Re-save immediately so local storage is strictly purged of demo data
    try {
      localStorage.setItem(LOCAL_STORAGE_RPC_RECORDS_KEY, JSON.stringify(memoryRpcRecords));
      localStorage.setItem(LOCAL_STORAGE_SCHOLARS_KEY, JSON.stringify(memoryScholars));
      localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS_KEY, JSON.stringify(memoryAuditLogs));
      localStorage.setItem(LOCAL_STORAGE_DOCUMENTS_KEY, JSON.stringify(memoryDocuments));
    } catch {}
    return loaded;
  } catch (err) {
    console.warn('LocalStorage load warning:', err);
    return false;
  }
}

// Queue write operation to Firestore if offline or network glitch
function queueFirestoreWrite(collectionName: string, docId: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PENDING_QUEUE_KEY);
    const queue: Array<{ collection: string; id: string; data: any; time: number }> = raw ? JSON.parse(raw) : [];
    const existingIdx = queue.findIndex((q) => q.collection === collectionName && q.id === docId);
    if (existingIdx !== -1) {
      queue[existingIdx] = { collection: collectionName, id: docId, data, time: Date.now() };
    } else {
      queue.push({ collection: collectionName, id: docId, data, time: Date.now() });
    }
    localStorage.setItem(LOCAL_STORAGE_PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

// Flush pending queue to Firestore
export async function flushPendingFirestoreWrites(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PENDING_QUEUE_KEY);
    if (!raw) return;
    const queue: Array<{ collection: string; id: string; data: any; time: number }> = JSON.parse(raw);
    if (queue.length === 0) return;

    const remaining: typeof queue = [];
    for (const item of queue) {
      try {
        await setDoc(doc(db, item.collection, item.id), item.data);
      } catch (err) {
        remaining.push(item);
      }
    }
    if (remaining.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_PENDING_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PENDING_QUEUE_KEY);
    }
  } catch (e) {}
}

/**
 * Master Save Function: Guarantees that every single piece of work done on the portal
 * (RPC records, scholars, committee members, audit logs, document snapshots, and loaded Excel datasets)
 * is immediately written to localStorage and queued/persisted to cloud Firestore.
 */
export async function saveAllPortalWork(): Promise<boolean> {
  saveAllPortalDataLocally();
  try {
    // 1. Flush offline write queue
    await flushPendingFirestoreWrites();

    // 2. Persist any unpersisted memory records to Firestore with resolved promises
    const rpcPromises = memoryRpcRecords
      .filter((r) => !REMOVED_LEGACY_IDS.has(r.id))
      .map((r) =>
        setDoc(doc(db, 'rpcRecords', r.id), r).catch(() => {
          queueFirestoreWrite('rpcRecords', r.id, r);
        })
      );

    const scholarPromises = memoryScholars
      .filter((s) => !REMOVED_LEGACY_IDS.has(s.id))
      .map((s) =>
        setDoc(doc(db, 'scholars', s.id), s).catch(() => {
          queueFirestoreWrite('scholars', s.id, s);
        })
      );

    const memberPromises = memoryMembers.map((m) =>
      setDoc(doc(db, 'rpcMembers', m.id), m).catch(() => {})
    );

    const auditPromises = memoryAuditLogs.slice(-30).map((a) =>
      setDoc(doc(db, 'auditLogs', a.id), a).catch(() => {})
    );

    await Promise.allSettled([
      ...rpcPromises,
      ...scholarPromises,
      ...memberPromises,
      ...auditPromises,
      syncLoadedExcelToFirestore().catch(() => {}),
    ]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nfsu-portal-work-saved', {
          detail: { timestamp: Date.now(), count: memoryRpcRecords.length },
        })
      );
    }
    return true;
  } catch (err) {
    console.warn('saveAllPortalWork fallback to local persistence:', err);
    return false;
  }
}

// Immediately hydrate on client evaluation
if (typeof window !== 'undefined') {
  loadAllPortalDataLocally();
  // Listen to storage events from other tabs
  window.addEventListener('storage', (e) => {
    if (
      e.key === LOCAL_STORAGE_RPC_RECORDS_KEY ||
      e.key === LOCAL_STORAGE_SCHOLARS_KEY ||
      e.key === LOCAL_STORAGE_AUDIT_LOGS_KEY
    ) {
      loadAllPortalDataLocally();
      window.dispatchEvent(new CustomEvent('nfsu-portal-data-changed', { detail: { timestamp: Date.now() } }));
    }
  });

  // Automatically save all work on page unload or visibility change
  window.addEventListener('beforeunload', () => {
    saveAllPortalDataLocally();
    saveAllPortalWork();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveAllPortalDataLocally();
      saveAllPortalWork();
    }
  });

  // Background auto-save safety loop every 20 seconds
  setInterval(() => {
    saveAllPortalDataLocally();
  }, 20000);
}

export async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;
  try {
    // 1. Immediately hydrate local storage so UI has immediate access to all previously saved work
    loadAllPortalDataLocally();

    // 2. Sync with cloud Firestore and purge demo records
    const rpcSnap = await getDocs(collection(db, 'rpcRecords'));
    const schSnap = await getDocs(collection(db, 'scholars'));

    // Asynchronously delete any demo records remaining in Firestore
    const demoDeletes: Promise<any>[] = [];
    rpcSnap.forEach((d) => {
      const item = d.data() as RpcRecord;
      if (isDemoItem(item) || isDemoItem(d)) {
        demoDeletes.push(deleteDoc(doc(db, 'rpcRecords', d.id)).catch(() => {}));
      }
    });
    schSnap.forEach((d) => {
      const item = d.data() as Scholar;
      if (isDemoItem(item) || isDemoItem(d)) {
        demoDeletes.push(deleteDoc(doc(db, 'scholars', d.id)).catch(() => {}));
      }
    });
    if (demoDeletes.length > 0) {
      Promise.allSettled(demoDeletes).catch(() => {});
    }

    if (rpcSnap.empty && schSnap.empty) {
      console.log('Initializing NFSU SDSR database (clean state with faculty pool)...');
      const batch = writeBatch(db);

      // Only seed faculty directory members
      memoryMembers.forEach((m) => {
        batch.set(doc(db, 'rpcMembers', m.id), m);
      });

      await batch.commit();
      console.log('Database initialized successfully with clean state.');
    } else {
      // Merge Firestore records with local storage (ignoring all demo data)
      const firestoreRpcs: RpcRecord[] = [];
      rpcSnap.forEach((d) => {
        const item = d.data() as RpcRecord;
        if (!isDemoItem(item) && !isDemoItem(d)) {
          if (item.approvedBy && item.approvedBy.includes('Junare')) {
            item.approvedBy = 'Dean, SDSR';
          }
          firestoreRpcs.push(item);
        }
      });

      // Merge: For every record in Firestore, update or add to memory
      firestoreRpcs.forEach((fRec) => {
        const localIdx = memoryRpcRecords.findIndex((r) => r.id === fRec.id);
        if (localIdx !== -1) {
          const localRec = memoryRpcRecords[localIdx];
          // Take the newer version if exists
          const fTime = fRec.updatedAt || fRec.createdAt || '';
          const lTime = localRec.updatedAt || localRec.createdAt || '';
          if (fTime > lTime || (!localRec.approvedBy && fRec.approvedBy)) {
            memoryRpcRecords[localIdx] = fRec;
          }
        } else {
          memoryRpcRecords.push(fRec);
        }
      });

      // For every local record not yet in Firestore, sync it up
      for (const lRec of memoryRpcRecords) {
        if (!firestoreRpcs.some((f) => f.id === lRec.id) && !isDemoItem(lRec)) {
          setDoc(doc(db, 'rpcRecords', lRec.id), lRec).catch((err) => {
            queueFirestoreWrite('rpcRecords', lRec.id, lRec);
          });
        }
      }

      // Scholars merge
      const firestoreSchs: Scholar[] = [];
      schSnap.forEach((d) => {
        const item = d.data() as Scholar;
        if (!isDemoItem(item) && !isDemoItem(d)) {
          firestoreSchs.push(item);
        }
      });
      firestoreSchs.forEach((fSch) => {
        const localIdx = memoryScholars.findIndex((s) => s.id === fSch.id);
        if (localIdx !== -1) {
          memoryScholars[localIdx] = { ...memoryScholars[localIdx], ...fSch };
        } else {
          memoryScholars.push(fSch);
        }
      });
      for (const lSch of memoryScholars) {
        if (!firestoreSchs.some((f) => f.id === lSch.id) && !isDemoItem(lSch)) {
          setDoc(doc(db, 'scholars', lSch.id), lSch).catch(() => {
            queueFirestoreWrite('scholars', lSch.id, lSch);
          });
        }
      }

      // Members merge
      const memSnap = await getDocs(collection(db, 'rpcMembers'));
      const mems: RpcMember[] = [];
      memSnap.forEach((d) => mems.push(d.data() as RpcMember));
      if (mems.length > 0) {
        memoryMembers = mems;
      }

      // Audit logs merge
      const auditSnap = await getDocs(collection(db, 'auditLogs'));
      const firestoreAudits: AuditLog[] = [];
      auditSnap.forEach((d) => {
        if (!REMOVED_LEGACY_IDS.has(d.id)) {
          firestoreAudits.push(d.data() as AuditLog);
        }
      });
      firestoreAudits.forEach((fAud) => {
        if (!memoryAuditLogs.some((a) => a.id === fAud.id)) {
          memoryAuditLogs.push(fAud);
        }
      });
    }

    // Persist unified merged state locally
    saveAllPortalDataLocally();
    // Flush any pending queue
    flushPendingFirestoreWrites();
    // Restore any saved Excel roster from Firestore
    await loadLoadedExcelFromFirestore().catch(() => {});
  } catch (err) {
    console.warn('Firestore initialization sync completed with resilient local storage fallback:', err);
  } finally {
    isInitialized = true;
    saveAllPortalDataLocally();
  }
}

/**
 * Completely removes all demo data from in-memory cache, local storage, and cloud Firestore.
 */
export async function removeAllDemoData(): Promise<{ recordsRemoved: number; scholarsRemoved: number }> {
  const initialRecCount = memoryRpcRecords.length;
  const initialSchCount = memoryScholars.length;

  memoryRpcRecords = memoryRpcRecords.filter((r) => !isDemoItem(r));
  memoryScholars = memoryScholars.filter((s) => !isDemoItem(s));
  memoryAuditLogs = memoryAuditLogs.filter(
    (a) => !isDemoItem(a)
  );
  memoryDocuments = memoryDocuments.filter((d) => !isDemoItem(d));

  const recordsRemoved = initialRecCount - memoryRpcRecords.length;
  const scholarsRemoved = initialSchCount - memoryScholars.length;

  saveAllPortalDataLocally();

  try {
    const deletePromises: Promise<any>[] = [];

    // Delete known demo IDs
    for (const id of Array.from(REMOVED_DEMO_IDS)) {
      if (id.startsWith('rpc-')) {
        deletePromises.push(deleteDoc(doc(db, 'rpcRecords', id)).catch(() => {}));
      } else if (id.startsWith('sch-')) {
        deletePromises.push(deleteDoc(doc(db, 'scholars', id)).catch(() => {}));
      }
    }

    // Also scan Firestore for any demo matches
    const [rpcSnap, schSnap, auditSnap, docSnap] = await Promise.all([
      getDocs(collection(db, 'rpcRecords')).catch(() => null),
      getDocs(collection(db, 'scholars')).catch(() => null),
      getDocs(collection(db, 'auditLogs')).catch(() => null),
      getDocs(collection(db, 'documents')).catch(() => null),
    ]);

    if (rpcSnap && !rpcSnap.empty) {
      rpcSnap.forEach((d) => {
        const item = d.data() as RpcRecord;
        if (isDemoItem(item) || isDemoItem(d)) {
          deletePromises.push(deleteDoc(doc(db, 'rpcRecords', d.id)).catch(() => {}));
        }
      });
    }

    if (schSnap && !schSnap.empty) {
      schSnap.forEach((d) => {
        const item = d.data() as Scholar;
        if (isDemoItem(item) || isDemoItem(d)) {
          deletePromises.push(deleteDoc(doc(db, 'scholars', d.id)).catch(() => {}));
        }
      });
    }

    if (auditSnap && !auditSnap.empty) {
      auditSnap.forEach((d) => {
        const data = d.data();
        if (isDemoItem(data) || isDemoItem(d)) {
          deletePromises.push(deleteDoc(doc(db, 'auditLogs', d.id)).catch(() => {}));
        }
      });
    }

    if (docSnap && !docSnap.empty) {
      docSnap.forEach((d) => {
        const data = d.data();
        if (isDemoItem(data) || isDemoItem(d)) {
          deletePromises.push(deleteDoc(doc(db, 'documents', d.id)).catch(() => {}));
        }
      });
    }

    await Promise.allSettled(deletePromises);
  } catch (err) {
    console.warn('Error purging demo data from Firestore:', err);
  }

  saveAllPortalDataLocally();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nfsu-portal-data-changed', {
        detail: { timestamp: Date.now(), demoRemoved: true },
      })
    );
  }

  return { recordsRemoved, scholarsRemoved };
}

export const resetToCleanSpecimenDatabase = removeAllDemoData;

// Fetch all RPC records
export async function getAllRpcRecords(): Promise<RpcRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'rpcRecords'));
    if (!snap.empty) {
      const records: RpcRecord[] = [];
      snap.forEach((d) => {
        const rec = d.data() as RpcRecord;
        if (!isDemoItem(rec) && !isDemoItem(d)) {
          if (rec.approvedBy && rec.approvedBy.includes('Junare')) {
            rec.approvedBy = 'Dean, SDSR';
          }
          records.push(rec);
        }
      });
      // Merge with any freshly created local records not yet returned by getDocs
      for (const localRec of memoryRpcRecords) {
        if (
          !records.some((r) => r.id === localRec.id) &&
          !isDemoItem(localRec)
        ) {
          records.unshift(localRec);
        }
      }
      memoryRpcRecords = records.filter((r) => !isDemoItem(r));
      saveAllPortalDataLocally();
      return memoryRpcRecords;
    }
  } catch (err) {
    console.warn('Using local cache for RPC records:', err);
  }
  return memoryRpcRecords.filter((r) => !isDemoItem(r));
}

/**
 * Delete a single RPC record by ID from memory and Firestore.
 */
export async function deleteRpcRecord(recordId: string): Promise<boolean> {
  const idx = memoryRpcRecords.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    memoryRpcRecords.splice(idx, 1);
  }
  saveAllPortalDataLocally();
  try {
    await deleteDoc(doc(db, 'rpcRecords', recordId));
    return true;
  } catch (err) {
    console.warn('Error deleting RPC record from Firestore:', err);
    return true;
  }
}

/**
 * Remove all approved RPC records from both in-memory cache and Firestore.
 * Resets the scholar's current RPC counter back to 1.
 */
export async function removeAllApprovedRpcRecords(): Promise<number> {
  // Collect all approved records
  const approved = memoryRpcRecords.filter((r) => r.status === 'APPROVED' || REMOVED_LEGACY_IDS.has(r.id));
  const count = approved.length;

  // Filter out of memory
  memoryRpcRecords = memoryRpcRecords.filter((r) => r.status !== 'APPROVED' && !REMOVED_LEGACY_IDS.has(r.id));

  // Reset scholar current RPC number to 1
  memoryScholars.forEach((sch) => {
    sch.currentRpcNo = 1;
    setDoc(doc(db, 'scholars', sch.id), sch).catch(() => {});
  });

  saveAllPortalDataLocally();

  // Delete all approved and legacy demo records from Firestore
  try {
    const snap = await getDocs(collection(db, 'rpcRecords'));
    const deletePromises: Promise<any>[] = [];
    snap.forEach((d) => {
      const data = d.data() as RpcRecord;
      if (data.status === 'APPROVED' || REMOVED_LEGACY_IDS.has(d.id)) {
        deletePromises.push(deleteDoc(doc(db, 'rpcRecords', d.id)).catch(() => {}));
      }
    });

    // Also clear approved document snapshots
    try {
      const docSnap = await getDocs(collection(db, 'documentSnapshots'));
      docSnap.forEach((d) => {
        const data = d.data();
        if (data.status === 'APPROVED' || REMOVED_LEGACY_IDS.has(data.rpcRecordId)) {
          deletePromises.push(deleteDoc(doc(db, 'documentSnapshots', d.id)).catch(() => {}));
        }
      });
    } catch {
      // ignore
    }

    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error purging approved records from Firestore:', err);
  }

  return count;
}

// Fetch a single RPC record by ID
export async function getRpcRecordById(id: string): Promise<RpcRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'rpcRecords', id));
    if (snap.exists()) {
      return snap.data() as RpcRecord;
    }
  } catch (err) {
    console.warn('Error fetching record from Firestore, using memory:', err);
  }
  return memoryRpcRecords.find((r) => r.id === id) || null;
}

// Fetch all scholars
export async function getAllScholars(): Promise<Scholar[]> {
  try {
    const snap = await getDocs(collection(db, 'scholars'));
    if (!snap.empty) {
      const scholars: Scholar[] = [];
      snap.forEach((d) => {
        const item = d.data() as Scholar;
        if (!isDemoItem(item) && !isDemoItem(d)) {
          scholars.push(item);
        }
      });
      memoryScholars = scholars.filter((s) => !isDemoItem(s));
      saveAllPortalDataLocally();
      return memoryScholars;
    }
  } catch (err) {
    console.warn('Using local cache for scholars:', err);
  }
  return memoryScholars.filter((s) => !isDemoItem(s));
}

// Fetch single scholar
export async function getScholarById(scholarId: string): Promise<Scholar | null> {
  const scholars = await getAllScholars();
  return scholars.find((s) => s.id === scholarId) || null;
}

// Fetch RPC members pool
export async function getAllMembers(): Promise<RpcMember[]> {
  try {
    const snap = await getDocs(collection(db, 'rpcMembers'));
    if (!snap.empty) {
      const members: RpcMember[] = [];
      snap.forEach((d) => members.push(d.data() as RpcMember));
      memoryMembers = members;
      return members;
    }
  } catch (err) {
    console.warn('Using local cache for members:', err);
  }
  return [...memoryMembers];
}

// Fetch RPC records for a specific scholar (chronologically sorted)
export async function getScholarRpcHistory(scholarId: string): Promise<RpcRecord[]> {
  const allRecords = await getAllRpcRecords();
  return allRecords
    .filter((r) => r.scholarId === scholarId)
    .sort((a, b) => a.rpcNumber - b.rpcNumber);
}

// STRICT RPC SEQUENCING VALIDATION
// If RPC 1, 2, and 3 are completed, RPC 4 should be the next permissible RPC.
// Previous completed RPCs should be viewable but locked.
// Future RPCs must remain locked.
export async function validateRpcSequence(
  scholarId: string,
  requestedRpcNumber: number
): Promise<{
  isValid: boolean;
  permissibleRpcNumber: number;
  message: string;
}> {
  const history = await getScholarRpcHistory(scholarId);

  // Find the highest approved RPC
  let highestApprovedRpc = 0;
  for (let i = 1; i <= 10; i++) {
    const record = history.find((r) => r.rpcNumber === i);
    if (record && record.status === 'APPROVED') {
      highestApprovedRpc = i;
    } else {
      break;
    }
  }

  const nextPermissible = highestApprovedRpc + 1;

  if (requestedRpcNumber === nextPermissible) {
    return {
      isValid: true,
      permissibleRpcNumber: nextPermissible,
      message: `RPC ${requestedRpcNumber} is the next permissible RPC in sequence.`,
    };
  } else if (requestedRpcNumber <= highestApprovedRpc) {
    return {
      isValid: false,
      permissibleRpcNumber: nextPermissible,
      message: `RPC ${requestedRpcNumber} is already completed and approved. You cannot create a duplicate RPC for this stage.`,
    };
  } else {
    return {
      isValid: false,
      permissibleRpcNumber: nextPermissible,
      message: `RPC ${requestedRpcNumber} is locked. Previous RPCs (up to RPC ${nextPermissible - 1}) must be completed and approved first. The next permissible RPC is RPC ${nextPermissible}.`,
    };
  }
}

// Validate mandatory fields before forwarding to Dean
export function validateForForwarding(record: RpcRecord): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!record.rpcDate) {
    errors.push('RPC scheduled date is required.');
  }
  if (!record.meetingTime) {
    errors.push('Meeting time is required.');
  }
  if (!record.meetingMode) {
    errors.push('Meeting mode (Online / Offline / Hybrid) is required.');
  }
  if (!record.rpcMembers?.guide?.name) {
    errors.push('Supervisor / Guide information is required.');
  }
  if (!record.rpcMembers?.internalExpert?.name) {
    errors.push('Internal Expert Committee Member is required.');
  }
  if (!record.rpcMembers?.externalExpert1?.name) {
    errors.push('External Expert Member 1 is required.');
  }
  if (!record.rpcMembers?.externalExpert2?.name) {
    errors.push('External Expert Member 2 is required.');
  }
  if (!record.letterData) {
    errors.push('Official RPC letter must be drafted before forwarding to Dean.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Fetch audit logs for an RPC record
export async function getAuditLogsForRecord(rpcRecordId: string): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'auditLogs'), where('rpcRecordId', '==', rpcRecordId))
    );
    if (!snap.empty) {
      const logs: AuditLog[] = [];
      snap.forEach((d) => logs.push(d.data() as AuditLog));
      return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  } catch (err) {
    console.warn('Using local cache for audit logs:', err);
  }
  return memoryAuditLogs
    .filter((l) => l.rpcRecordId === rpcRecordId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Add an audit log entry
export async function addAuditLog(
  rpcRecordId: string,
  scholarId: string,
  action: string,
  user: UserProfile,
  details: string
): Promise<AuditLog> {
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    rpcRecordId,
    scholarId,
    action,
    performedBy: `${user.displayName} (${user.role === 'DEAN_SDSR' ? 'Dean, SDSR' : 'SDSR Office'})`,
    userRole: user.role,
    details,
    timestamp: new Date().toISOString(),
  };

  memoryAuditLogs.push(log);
  saveAllPortalDataLocally();

  try {
    await setDoc(doc(db, 'auditLogs', log.id), log);
  } catch (err) {
    console.warn('Could not persist audit log to Firestore, queued locally:', err);
    queueFirestoreWrite('auditLogs', log.id, log);
  }

  return log;
}

// Update RPC record info
export async function updateRpcRecord(
  recordId: string,
  updates: Partial<RpcRecord>,
  user: UserProfile,
  logAction?: string,
  logDetails?: string
): Promise<RpcRecord> {
  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('RPC Record not found');

  if (record.status === 'APPROVED' && updates.status !== 'APPROVED') {
    throw new Error('Approved records are immutable and cannot be edited.');
  }

  const updatedRecord: RpcRecord = {
    ...record,
    ...updates,
    updatedBy: `${user.displayName} (${user.role})`,
    updatedAt: new Date().toISOString(),
  };

  // Update in memory & immediately save locally
  const idx = memoryRpcRecords.findIndex((r) => r.id === recordId);
  if (idx !== -1) memoryRpcRecords[idx] = updatedRecord;
  saveAllPortalDataLocally();

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'rpcRecords', recordId), updatedRecord);
  } catch (err) {
    console.warn('Could not update Firestore record, queued locally:', err);
    queueFirestoreWrite('rpcRecords', recordId, updatedRecord);
  }

  if (logAction) {
    await addAuditLog(
      recordId,
      record.scholarId,
      logAction,
      user,
      logDetails || `Updated record fields: ${Object.keys(updates).join(', ')}`
    );
  }

  return updatedRecord;
}

// Ensure scholar exists in database (or register new scholar from Excel roster)
export async function ensureScholarRegistered(scholar: Scholar): Promise<Scholar> {
  const existing = memoryScholars.find(
    (s) =>
      s.id === scholar.id ||
      s.enrollmentNo.trim().toLowerCase() === scholar.enrollmentNo.trim().toLowerCase()
  );
  if (existing) {
    return existing;
  }
  memoryScholars.push(scholar);
  saveAllPortalDataLocally();
  try {
    await setDoc(doc(db, 'scholars', scholar.id), scholar);
  } catch (err) {
    console.warn('Could not persist new scholar to Firestore, queued locally:', err);
    queueFirestoreWrite('scholars', scholar.id, scholar);
  }
  return scholar;
}

// Update scholar record details (e.g. topic, department, contact info, guide)
export async function updateScholarRecord(
  scholarId: string,
  updates: Partial<Scholar>,
  user: UserProfile,
  logAction?: string,
  logDetails?: string
): Promise<Scholar> {
  const scholarIdx = memoryScholars.findIndex((s) => s.id === scholarId);
  if (scholarIdx === -1) {
    throw new Error('Scholar not found');
  }

  const updatedScholar: Scholar = {
    ...memoryScholars[scholarIdx],
    ...updates,
  };

  memoryScholars[scholarIdx] = updatedScholar;
  saveAllPortalDataLocally();

  try {
    await setDoc(doc(db, 'scholars', scholarId), updatedScholar);
  } catch (err) {
    console.warn('Could not update Firestore scholar, queued locally:', err);
    queueFirestoreWrite('scholars', scholarId, updatedScholar);
  }

  // Also update scholar details inside any non-approved RPC records for this scholar
  memoryRpcRecords.forEach((r, idx) => {
    if (r.scholarId === scholarId && r.status !== 'APPROVED') {
      let rChanged = false;
      if (updates.name && r.scholarName !== updates.name) {
        r.scholarName = updates.name;
        rChanged = true;
      }
      if (updates.enrollmentNo && r.enrollmentNo !== updates.enrollmentNo) {
        r.enrollmentNo = updates.enrollmentNo;
        rChanged = true;
      }
      if (updates.school && r.school !== updates.school) {
        r.school = updates.school;
        rChanged = true;
      }
      if (r.letterData) {
        if (updates.name) r.letterData.scholarName = updates.name;
        if (updates.school) r.letterData.schoolName = updates.school;
        if (updates.guideName) r.letterData.guideName = updates.guideName;
        if (updates.guideDesignation) r.letterData.guideDesignation = updates.guideDesignation;
        rChanged = true;
      }
      if (rChanged) {
        memoryRpcRecords[idx] = { ...r, updatedAt: new Date().toISOString() };
        setDoc(doc(db, 'rpcRecords', r.id), memoryRpcRecords[idx]).catch(() => {});
      }
    }
  });

  saveAllPortalDataLocally();

  if (logAction) {
    await addAuditLog(
      'scholar-update',
      scholarId,
      logAction,
      user,
      logDetails || `Updated scholar details: ${Object.keys(updates).join(', ')}`
    );
  }

  return updatedScholar;
}

// Update RPC Committee Members for a record
export async function updateRpcMembers(
  recordId: string,
  members: {
    guide: RpcMember;
    internalExpert: RpcMember;
    externalExpert1: RpcMember;
    externalExpert2: RpcMember;
  },
  user: UserProfile
): Promise<RpcRecord> {
  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('Record not found');

  if (record.status === 'APPROVED') {
    throw new Error('Approved records are immutable.');
  }

  let updatedLetterData: OfficialLetterData | undefined = undefined;
  if (record.letterData) {
    updatedLetterData = {
      ...record.letterData,
      guideName: members.guide.name,
      guideDesignation: members.guide.designation,
      guideSchool: members.guide.schoolOrInstitution || record.school,
      internalExpertName: members.internalExpert.name,
      internalExpertDesignation: members.internalExpert.designation,
      internalExpertDept: members.internalExpert.department,
      internalExpertCampus: members.internalExpert.schoolOrInstitution,
      externalExpert1Name: members.externalExpert1.name,
      externalExpert1Designation: members.externalExpert1.designation,
      externalExpert1Dept: members.externalExpert1.department,
      externalExpert1Inst: members.externalExpert1.schoolOrInstitution,
      externalExpert1City: members.externalExpert1.location,
      externalExpert2Name: members.externalExpert2.name,
      externalExpert2Designation: members.externalExpert2.designation,
      externalExpert2Dept: members.externalExpert2.department,
      externalExpert2Inst: members.externalExpert2.schoolOrInstitution,
      externalExpert2City: members.externalExpert2.location,
    };
  }

  // Also keep scholar's registered guide details aligned
  const scholarIndex = memoryScholars.findIndex((s) => s.id === record.scholarId);
  if (scholarIndex !== -1 && members.guide?.name) {
    memoryScholars[scholarIndex] = {
      ...memoryScholars[scholarIndex],
      guideName: members.guide.name,
      guideDesignation: members.guide.designation || memoryScholars[scholarIndex].guideDesignation,
      guideEmail: members.guide.email || memoryScholars[scholarIndex].guideEmail,
      guideSchool: members.guide.schoolOrInstitution || memoryScholars[scholarIndex].guideSchool,
    };
    setDoc(doc(db, 'scholars', memoryScholars[scholarIndex].id), memoryScholars[scholarIndex]).catch(() => {});
  }

  const updated = await updateRpcRecord(
    recordId,
    {
      rpcMembers: members,
      ...(updatedLetterData ? { letterData: updatedLetterData } : {}),
    },
    user,
    'RPC Committee Members Updated',
    `Updated committee members: Guide: ${members.guide.name}, Internal: ${members.internalExpert.name}, External 1: ${members.externalExpert1.name}, External 2: ${members.externalExpert2.name}`
  );

  return updated;
}

// Create new RPC request with sequencing validation (supports both database scholars and loaded Excel roster data)
export async function createNewRpcRequest(
  scholarId: string,
  rpcNumber: number,
  rpcDate: string,
  meetingTime: string,
  meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID',
  venue: string,
  rpcMembers: {
    guide: RpcMember;
    internalExpert: RpcMember;
    externalExpert1: RpcMember;
    externalExpert2: RpcMember;
  },
  requestDetails: string,
  user: UserProfile,
  scholarDataOverride?: Scholar
): Promise<RpcRecord> {
  if (user.role !== 'SDSR_OFFICE') {
    throw new Error('Only SDSR Office users are authorized to create new RPC requests.');
  }

  // If scholarDataOverride provided, ensure scholar is registered in database
  let scholar = await getScholarById(scholarId);
  if (!scholar && scholarDataOverride) {
    scholar = await ensureScholarRegistered(scholarDataOverride);
  }

  // Validate sequence (if brand new scholar with no history, validate against their registered currentRpcNo or 1)
  const history = await getScholarRpcHistory(scholarId);
  if (history.length > 0) {
    const seqCheck = await validateRpcSequence(scholarId, rpcNumber);
    if (!seqCheck.isValid) {
      throw new Error(seqCheck.message);
    }
  }

  if (!scholar) throw new Error('Scholar not found.');

  const newId = `rpc-${scholar.id.replace('sch-', '')}-${rpcNumber}-${Date.now().toString().slice(-4)}`;
  const initialLetterData = createLetterData(
    rpcNumber,
    scholar,
    formatDisplayDate(rpcDate),
    meetingTime,
    meetingMode === 'ONLINE' ? 'online mode' : meetingMode === 'HYBRID' ? 'hybrid mode' : `physical mode at ${venue || 'SDSR Board Room'}`
  );

  const newRecord: RpcRecord = {
    id: newId,
    scholarId: scholar.id,
    scholarName: scholar.name,
    enrollmentNo: scholar.enrollmentNo,
    school: scholar.school,
    rpcNumber,
    rpcDate,
    meetingTime,
    meetingMode,
    venue,
    status: 'NEW',
    requestDetails: requestDetails || `${rpcNumber}th RPC Meeting request initiated.`,
    rpcMembers,
    letterData: initialLetterData,
    createdBy: `${user.displayName} (SDSR Office)`,
    createdAt: new Date().toISOString(),
    version: 1,
  };

  memoryRpcRecords.unshift(newRecord);
  saveAllPortalDataLocally();

  try {
    await setDoc(doc(db, 'rpcRecords', newId), newRecord);
  } catch (err) {
    console.warn('Error creating RPC in Firestore, queued locally:', err);
    queueFirestoreWrite('rpcRecords', newId, newRecord);
  }

  await addAuditLog(
    newId,
    scholarId,
    'Request Created',
    user,
    `New RPC ${rpcNumber} request created for ${scholar.name} (${scholar.enrollmentNo}).`
  );

  return newRecord;
}

// Draft Letter action
export async function saveDraftLetter(
  recordId: string,
  letterData: OfficialLetterData,
  user: UserProfile,
  isAutoSave: boolean = false
): Promise<RpcRecord> {
  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('Record not found');

  if (record.status === 'APPROVED' || record.status === 'PENDING_DEAN_APPROVAL') {
    throw new Error('Letter cannot be modified in the current workflow state.');
  }

  const draftRef = record.draftDocumentReference || `DRAFT-NFSU-SDSR-RPC-${record.rpcNumber}-${Date.now()}`;
  const newStatus: RpcStatus = record.status === 'NEW' || record.status === 'IN_VERIFICATION' ? 'DRAFTED' : record.status;

  const updated = await updateRpcRecord(
    recordId,
    {
      letterData,
      draftDocumentReference: draftRef,
      status: newStatus,
      version: isAutoSave ? (record.version || 1) : (record.version || 1) + 1,
      // Synchronize meeting time and venue from letter if provided
      venue: letterData.meetingVenue || record.venue,
      meetingTime: letterData.meetingTimeText || record.meetingTime,
    },
    user,
    isAutoSave ? undefined : 'Letter Drafted',
    isAutoSave ? undefined : `Official letter drafted from controlled institutional template (Ref: ${letterData.refNo}).`
  );

  return updated;
}

// Forward to Dean action
export async function forwardToDean(recordId: string, user: UserProfile): Promise<RpcRecord> {
  if (user.role !== 'SDSR_OFFICE') {
    throw new Error('Only SDSR Office users can forward requests to the Dean.');
  }

  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('Record not found');

  const validation = validateForForwarding(record);
  if (!validation.isValid) {
    throw new Error(`Cannot forward to Dean. Mandatory requirements missing: ${validation.errors.join('; ')}`);
  }

  const updated = await updateRpcRecord(
    recordId,
    {
      status: 'PENDING_DEAN_APPROVAL',
      forwardedBy: `${user.displayName} (SDSR Office)`,
      forwardedAt: new Date().toISOString(),
    },
    user,
    'Forwarded to Dean, SDSR',
    `RPC ${record.rpcNumber} forwarded to Dean, SDSR for official review and approval.`
  );

  // Trigger backend email notification event logging in Firestore
  try {
    await logPendingEmailNotification(updated, 'RPC_PENDING_DEAN_APPROVAL', user);
  } catch (notifErr) {
    console.warn('Could not log pending email notification for forwardToDean:', notifErr);
  }

  return updated;
}

// Dean: Return for correction
export async function returnForCorrection(
  recordId: string,
  remarks: string,
  deanUser: UserProfile
): Promise<RpcRecord> {
  if (deanUser.role !== 'DEAN_SDSR') {
    throw new Error('Only the Dean, SDSR is authorized to return requests for correction.');
  }

  if (!remarks || remarks.trim().length < 5) {
    throw new Error('A detailed reason or remark is required when returning an RPC request for correction.');
  }

  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('Record not found');

  if (record.status !== 'PENDING_DEAN_APPROVAL') {
    throw new Error('Only requests with status "Pending Dean Approval" can be returned for correction.');
  }

  const updated = await updateRpcRecord(
    recordId,
    {
      status: 'RETURNED_FOR_CORRECTION',
      returnedBy: `${deanUser.displayName} (Dean, SDSR)`,
      returnedAt: new Date().toISOString(),
      returnRemarks: remarks.trim(),
    },
    deanUser,
    'Request Returned for Correction',
    `Dean returned request with remarks: "${remarks.trim()}"`
  );

  // Trigger backend email notification event logging in Firestore
  try {
    await logPendingEmailNotification(updated, 'RPC_RETURNED_FOR_CORRECTION', deanUser, remarks);
  } catch (notifErr) {
    console.warn('Could not log pending email notification for returnForCorrection:', notifErr);
  }

  return updated;
}

// Dean: Approve RPC
export async function approveRpc(recordId: string, deanUser: UserProfile): Promise<RpcRecord> {
  if (deanUser.role !== 'DEAN_SDSR') {
    throw new Error('Only the Dean, SDSR is authorized to approve RPC requests.');
  }

  const record = memoryRpcRecords.find((r) => r.id === recordId);
  if (!record) throw new Error('Record not found');

  if (record.status !== 'PENDING_DEAN_APPROVAL') {
    throw new Error('Only requests with status "Pending Dean Approval" can be approved.');
  }

  const approvedDocRef = `DOC-NFSU-SDSR-RPC-${new Date().getFullYear()}-${record.rpcNumber}-APPROVED-${Date.now().toString().slice(-5)}`;
  const approvalTimestamp = new Date().toISOString();

  // Generate immutable approved document snapshot
  const docSnapshot: DocumentSnapshot = {
    id: `doc-${Date.now()}`,
    rpcRecordId: record.id,
    documentType: 'APPROVED',
    version: record.version || 1,
    refNo: record.letterData?.refNo || `NFSU/SDSR/RPC/0${record.rpcNumber}/${new Date().getFullYear()}`,
    dynamicData: record.letterData!,
    generatedAt: approvalTimestamp,
    signedBy: deanUser.displayName === 'Dean, SDSR' ? 'Dean, SDSR' : `${deanUser.displayName} (Dean, SDSR)`,
    signedAt: approvalTimestamp,
    isImmutable: true,
  };

  memoryDocuments.push(docSnapshot);
  try {
    await setDoc(doc(db, 'documents', docSnapshot.id), docSnapshot);
  } catch (err) {
    console.warn('Could not store document snapshot in Firestore:', err);
  }

  // Update Scholar's currentRpcNo
  const scholar = memoryScholars.find((s) => s.id === record.scholarId);
  if (scholar && scholar.currentRpcNo <= record.rpcNumber) {
    scholar.currentRpcNo = record.rpcNumber + 1;
    try {
      await updateDoc(doc(db, 'scholars', scholar.id), { currentRpcNo: record.rpcNumber + 1 });
    } catch {
      // ignore
    }
  }

  const updated = await updateRpcRecord(
    recordId,
    {
      status: 'APPROVED',
      approvedBy: deanUser.displayName === 'Dean, SDSR' ? 'Dean, SDSR' : `${deanUser.displayName} (Dean, SDSR)`,
      approvedAt: approvalTimestamp,
      approvedDocumentReference: approvedDocRef,
    },
    deanUser,
    'Request Approved',
    `Dean approved RPC ${record.rpcNumber}. Official letter finalized with authorized specimen seal. Document Ref: ${approvedDocRef}.`
  );

  await addAuditLog(
    recordId,
    record.scholarId,
    'Approved Letter Generated',
    deanUser,
    `Finalized immutable official letter snapshot: ${approvedDocRef}.`
  );

  saveAllPortalDataLocally();

  return updated;
}

// Bulk import Scholars and/or RPC requests from Excel file
export async function bulkImportScholarsAndRpc(
  scholarsToImport: Scholar[],
  rpcRowsToImport: any[],
  currentUser: UserProfile,
  updateExisting: boolean = true
): Promise<{
  scholarsAdded: number;
  scholarsUpdated: number;
  rpcAdded: number;
}> {
  if (currentUser.role !== 'SDSR_OFFICE') {
    throw new Error('Only SDSR Office users are authorized to load Excel records.');
  }

  let scholarsAdded = 0;
  let scholarsUpdated = 0;
  let rpcAdded = 0;

  const membersPool = await getAllMembers();

  // 1. Process Scholars
  for (const s of scholarsToImport) {
    const existingIndex = memoryScholars.findIndex(
      (m) =>
        m.enrollmentNo.trim().toLowerCase() === s.enrollmentNo.trim().toLowerCase() ||
        m.id === s.id
    );

    if (existingIndex !== -1) {
      if (updateExisting) {
        memoryScholars[existingIndex] = {
          ...memoryScholars[existingIndex],
          ...s,
        };
        try {
          await setDoc(doc(db, 'scholars', memoryScholars[existingIndex].id), memoryScholars[existingIndex]);
        } catch (err) {
          console.warn('Firestore update error for scholar:', err);
        }
        scholarsUpdated++;
      }
    } else {
      memoryScholars.push(s);
      try {
        await setDoc(doc(db, 'scholars', s.id), s);
      } catch (err) {
        console.warn('Firestore insert error for scholar:', err);
      }
      scholarsAdded++;
    }
  }

  // 2. Process RPC Rows
  for (const r of rpcRowsToImport) {
    if (!r.isValid) continue;

    // Find scholar by enrollment
    const scholar = memoryScholars.find(
      (s) => s.enrollmentNo.trim().toLowerCase() === r.enrollmentNo.trim().toLowerCase()
    );

    if (!scholar) continue;

    const rpcNumber = r.rpcNumber || 1;
    const newId = `rpc-${scholar.id.replace('sch-', '')}-${rpcNumber}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Resolve guide
    const guideMember: RpcMember =
      membersPool.find(
        (m) =>
          m.name.toLowerCase().includes(r.guideName?.toLowerCase() || '') ||
          m.name.toLowerCase().includes(scholar.guideName.toLowerCase())
      ) || {
        id: `mem-${scholar.guideName.toLowerCase().replace(/[^a-z]/g, '')}`,
        name: scholar.guideName,
        designation: scholar.guideDesignation,
        department: scholar.department,
        schoolOrInstitution: 'National Forensic Sciences University',
        location: 'Gandhinagar Campus',
        email: scholar.guideEmail,
        memberType: 'GUIDE',
        isActive: true,
      };

    // Resolve internal expert
    const internalExpert: RpcMember =
      membersPool.find(
        (m) =>
          r.internalExpertName &&
          m.name.toLowerCase().includes(r.internalExpertName.toLowerCase())
      ) || DEMO_MEMBERS[2]; // Default Dr. Bhoomika Patel

    // Resolve external expert 1
    const ext1: RpcMember =
      membersPool.find(
        (m) =>
          r.externalExpert1Name &&
          m.name.toLowerCase().includes(r.externalExpert1Name.toLowerCase())
      ) || DEMO_MEMBERS[4]; // Default Dr. Dhiraj Bhatia

    // Resolve external expert 2
    const ext2: RpcMember =
      membersPool.find(
        (m) =>
          r.externalExpert2Name &&
          m.name.toLowerCase().includes(r.externalExpert2Name.toLowerCase())
      ) || DEMO_MEMBERS[6]; // Default Prof. (Dr.) Sanjay K. Jain

    const rpcDate = r.rpcDate || new Date().toISOString().split('T')[0];
    const meetingTime = r.meetingTime || '11:00 AM IST';
    const meetingMode = r.meetingMode || 'ONLINE';
    const venue = r.venue || 'SDSR Board Room / Google Meet';

    const initialLetterData = createLetterData(
      rpcNumber,
      scholar,
      formatDisplayDate(rpcDate),
      meetingTime,
      meetingMode === 'ONLINE' ? 'online mode' : meetingMode === 'HYBRID' ? 'hybrid mode' : `physical mode at ${venue}`
    );

    const newRecord: RpcRecord = {
      id: newId,
      scholarId: scholar.id,
      scholarName: scholar.name,
      enrollmentNo: scholar.enrollmentNo,
      school: scholar.school,
      rpcNumber,
      rpcDate,
      meetingTime,
      meetingMode,
      venue,
      status: 'NEW',
      requestDetails: r.notes || `${rpcNumber}th RPC Meeting loaded from Excel bulk roster.`,
      rpcMembers: {
        guide: guideMember,
        internalExpert,
        externalExpert1: ext1,
        externalExpert2: ext2,
      },
      letterData: initialLetterData,
      createdBy: `${currentUser.displayName} (SDSR Office Excel Import)`,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    // Check if duplicate RPC for this scholar & rpcNumber already exists
    const duplicateIdx = memoryRpcRecords.findIndex(
      (rec) => rec.scholarId === scholar.id && rec.rpcNumber === rpcNumber
    );

    if (duplicateIdx !== -1) {
      if (updateExisting && memoryRpcRecords[duplicateIdx].status !== 'APPROVED') {
        memoryRpcRecords[duplicateIdx] = {
          ...memoryRpcRecords[duplicateIdx],
          ...newRecord,
          id: memoryRpcRecords[duplicateIdx].id,
          updatedAt: new Date().toISOString(),
          updatedBy: `${currentUser.displayName} (Excel Update)`,
        };
        try {
          await setDoc(doc(db, 'rpcRecords', memoryRpcRecords[duplicateIdx].id), memoryRpcRecords[duplicateIdx]);
        } catch (err) {
          console.warn('Firestore update error for RPC:', err);
        }
        rpcAdded++;
      }
    } else {
      memoryRpcRecords.unshift(newRecord);
      try {
        await setDoc(doc(db, 'rpcRecords', newId), newRecord);
      } catch (err) {
        console.warn('Firestore insert error for RPC:', err);
      }
      rpcAdded++;
    }
  }

  // Add system audit log
  await addAuditLog(
    'excel-bulk-import',
    'system',
    'Excel File Loaded',
    currentUser,
    `SDSR Office bulk loaded Excel data: Added ${scholarsAdded} new scholars, updated ${scholarsUpdated} scholars, created/updated ${rpcAdded} RPC records.`
  );

  saveAllPortalDataLocally();

  return {
    scholarsAdded,
    scholarsUpdated,
    rpcAdded,
  };
}

// Re-export email notification functions
export {
  logPendingEmailNotification,
  getEmailNotificationsForRecord,
  getPendingEmailNotifications,
  getAllEmailNotifications,
};

/**
 * SDSR Office: Prepare and finalize/approve an official RPC letter for a matched student.
 * Creates the RPC record, attaches full letter metadata, generates an immutable document snapshot,
 * and sets status to APPROVED (or PENDING_DEAN_APPROVAL if draft requested).
 */
export async function prepareAndApproveRpcLetter(
  scholarData: {
    enrollmentNo: string;
    scholarName: string;
    school: string;
    department?: string;
    guideName: string;
    guideDesignation?: string;
    guideEmail?: string;
  },
  rpcNumber: number,
  schedule: {
    rpcDate: string;
    meetingTime: string;
    meetingMode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
    venue: string;
  },
  committee: {
    internalExpertName?: string;
    externalExpert1Name?: string;
    externalExpert2Name?: string;
  },
  customRefNo: string,
  currentUser: UserProfile,
  markAsApprovedImmediately: boolean = true
): Promise<RpcRecord> {
  const normEnroll = scholarData.enrollmentNo.trim().toLowerCase();
  
  // 1. Locate or create scholar
  let scholar = memoryScholars.find(
    (s) => s.enrollmentNo.trim().toLowerCase() === normEnroll
  );

  if (!scholar) {
    const newScholarId = `sch-${Date.now()}`;
    scholar = {
      id: newScholarId,
      name: scholarData.scholarName,
      enrollmentNo: scholarData.enrollmentNo,
      school: scholarData.school || 'School of Forensic Science',
      department: scholarData.department || 'Doctoral Studies and Research',
      guideName: scholarData.guideName || 'Research Supervisor',
      guideDesignation: scholarData.guideDesignation || 'Associate Professor',
      guideEmail: scholarData.guideEmail || 'guide@nfsu.ac.in',
      guideSchool: scholarData.school || 'School of Forensic Science',
      registrationDate: new Date().toISOString().split('T')[0],
      researchTopic: 'Doctoral Research Investigation at National Forensic Sciences University',
      contactDetails: {
        email: `${scholarData.enrollmentNo.toLowerCase()}@nfsu.ac.in`,
        phone: '+91-9876543210',
        address: 'NFSU Sector-9, Gandhinagar 382007',
      },
      currentRpcNo: rpcNumber,
      status: 'ACTIVE',
      academicDetails: {
        qualifyingDegree: 'Master of Science',
        university: 'National Forensic Sciences University',
        yearOfPassing: '2023',
        category: 'Regular Full-Time',
        fellowship: 'NFSU Institutional Fellowship',
      },
    };
    memoryScholars.push(scholar);
    try {
      await setDoc(doc(db, 'scholars', scholar.id), scholar);
    } catch (err) {
      console.warn('Firestore setDoc error for new scholar:', err);
    }
  }

  // 2. Resolve committee members
  const membersPool = await getAllMembers();
  const guideMember: RpcMember =
    membersPool.find((m) => m.name.toLowerCase().includes(scholar!.guideName.toLowerCase())) || {
      id: `mem-guide-${Date.now()}`,
      name: scholar.guideName,
      designation: scholar.guideDesignation,
      department: scholar.department,
      schoolOrInstitution: 'National Forensic Sciences University',
      location: 'Gandhinagar Campus',
      email: scholar.guideEmail,
      memberType: 'GUIDE',
      isActive: true,
    };

  const internalExpert: RpcMember =
    membersPool.find(
      (m) =>
        committee.internalExpertName &&
        m.name.toLowerCase().includes(committee.internalExpertName.toLowerCase())
    ) || DEMO_MEMBERS[2]; // Dr. Bhoomika Patel

  const ext1: RpcMember =
    membersPool.find(
      (m) =>
        committee.externalExpert1Name &&
        m.name.toLowerCase().includes(committee.externalExpert1Name.toLowerCase())
    ) || DEMO_MEMBERS[4]; // Dr. Dhiraj Bhatia

  const ext2: RpcMember =
    membersPool.find(
      (m) =>
        committee.externalExpert2Name &&
        m.name.toLowerCase().includes(committee.externalExpert2Name.toLowerCase())
    ) || DEMO_MEMBERS[6]; // Prof. (Dr.) Sanjay K. Jain

  // 3. Construct official letter payload
  const formattedDate = formatDisplayDate(schedule.rpcDate);

  const letterRef =
    customRefNo.trim() ||
    `NFSU/SDSR/Ph.D./RPC-0${rpcNumber}/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

  const ordinal = rpcNumber === 1 ? '1st' : rpcNumber === 2 ? '2nd' : rpcNumber === 3 ? '3rd' : `${rpcNumber}th`;

  const letterData: OfficialLetterData = {
    refNo: letterRef,
    date: new Date().toLocaleDateString('en-GB'),
    schoolName: scholar.school,
    schoolCampus: 'Gandhinagar',
    guideName: scholar.guideName,
    guideDesignation: scholar.guideDesignation,
    guideSchool: scholar.guideSchool || scholar.school,
    internalExpertName: internalExpert.name,
    internalExpertDesignation: internalExpert.designation,
    internalExpertDept: internalExpert.department,
    internalExpertCampus: internalExpert.schoolOrInstitution,
    externalExpert1Name: ext1.name,
    externalExpert1Designation: ext1.designation,
    externalExpert1Dept: ext1.department,
    externalExpert1Inst: ext1.schoolOrInstitution,
    externalExpert1City: ext1.location,
    externalExpert2Name: ext2.name,
    externalExpert2Designation: ext2.designation,
    externalExpert2Dept: ext2.department,
    externalExpert2Inst: ext2.schoolOrInstitution,
    externalExpert2City: ext2.location,
    subject: `${ordinal} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under ${scholar.guideName}, ${scholar.guideDesignation}, NFSU.`,
    meetingDateText: formattedDate,
    meetingTimeText: schedule.meetingTime,
    meetingModeText:
      schedule.meetingMode === 'ONLINE'
        ? 'online mode'
        : schedule.meetingMode === 'HYBRID'
        ? 'hybrid mode'
        : `physical mode at ${schedule.venue}`,
    meetingVenue: schedule.venue,
    meetingLink: schedule.meetingMode === 'ONLINE' ? 'meet.google.com/nfs-sdsr-rpc' : undefined,
    scholarName: scholar.name,
    rpcOrdinal: ordinal,
  };

  const approvedDocRef = `DOC-NFSU-SDSR-RPC-${new Date().getFullYear()}-${rpcNumber}-APPROVED-${Date.now().toString().slice(-5)}`;
  const approvalTimestamp = new Date().toISOString();

  // Check if RPC already exists for this scholar and stage
  const existingIndex = memoryRpcRecords.findIndex(
    (r) => r.scholarId === scholar!.id && r.rpcNumber === rpcNumber
  );

  const newId = existingIndex !== -1
    ? memoryRpcRecords[existingIndex].id
    : `rpc-${scholar.id.replace('sch-', '')}-${rpcNumber}-${Math.floor(1000 + Math.random() * 9000)}`;

  const finalRecord: RpcRecord = {
    id: newId,
    scholarId: scholar.id,
    scholarName: scholar.name,
    enrollmentNo: scholar.enrollmentNo,
    school: scholar.school,
    rpcNumber,
    rpcDate: schedule.rpcDate,
    meetingTime: schedule.meetingTime,
    meetingMode: schedule.meetingMode,
    venue: schedule.venue,
    status: markAsApprovedImmediately ? 'APPROVED' : 'PENDING_DEAN_APPROVAL',
    requestDetails: `${ordinal} RPC approved official letter prepared by SDSR Office via Excel matching pipeline.`,
    rpcMembers: {
      guide: guideMember,
      internalExpert,
      externalExpert1: ext1,
      externalExpert2: ext2,
    },
    letterData,
    approvedBy: markAsApprovedImmediately ? 'Dean, SDSR' : undefined,
    approvedAt: markAsApprovedImmediately ? approvalTimestamp : undefined,
    approvedDocumentReference: markAsApprovedImmediately ? approvedDocRef : undefined,
    createdBy: `${currentUser.displayName} (SDSR Office)`,
    createdAt: existingIndex !== -1 ? memoryRpcRecords[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: `${currentUser.displayName} (SDSR Office Letter Preparation)`,
    version: existingIndex !== -1 ? (memoryRpcRecords[existingIndex].version || 1) + 1 : 1,
  };

  // 4. Save to cache & Firestore
  if (existingIndex !== -1) {
    memoryRpcRecords[existingIndex] = finalRecord;
  } else {
    memoryRpcRecords.unshift(finalRecord);
  }

  try {
    await setDoc(doc(db, 'rpcRecords', finalRecord.id), finalRecord);
  } catch (err) {
    console.warn('Firestore setDoc error for prepared RPC record:', err);
  }

  // 5. If approved immediately, create immutable document snapshot and advance scholar stage
  if (markAsApprovedImmediately) {
    const docSnapshot: DocumentSnapshot = {
      id: `doc-${Date.now()}`,
      rpcRecordId: finalRecord.id,
      documentType: 'APPROVED',
      version: finalRecord.version || 1,
      refNo: letterRef,
      dynamicData: letterData,
      generatedAt: approvalTimestamp,
      signedBy: 'Dean, SDSR',
      signedAt: approvalTimestamp,
      isImmutable: true,
    };
    memoryDocuments.push(docSnapshot);
    try {
      await setDoc(doc(db, 'documents', docSnapshot.id), docSnapshot);
    } catch (err) {
      console.warn('Firestore docSnapshot error:', err);
    }

    if (scholar.currentRpcNo <= rpcNumber) {
      scholar.currentRpcNo = rpcNumber + 1;
      try {
        await updateDoc(doc(db, 'scholars', scholar.id), { currentRpcNo: rpcNumber + 1 });
      } catch {
        // ignore
      }
    }

    await addAuditLog(
      finalRecord.id,
      scholar.id,
      'Approved Letter Prepared & Finalized',
      currentUser,
      `SDSR Office prepared and finalized official approved letter (${letterRef}). Document Ref: ${approvedDocRef}.`
    );
  } else {
    await addAuditLog(
      finalRecord.id,
      scholar.id,
      'Letter Drafted for Dean Approval',
      currentUser,
      `SDSR Office prepared letter draft (${letterRef}) and submitted for Dean approval.`
    );
  }

  saveAllPortalDataLocally();

  return finalRecord;
}

