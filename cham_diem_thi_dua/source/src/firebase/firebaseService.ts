import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  onSnapshot,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { UserProfile, MonthlyScoreRecord, Department, UserRole, CriterionItem } from '../types';
import { SCHOOL_AVATAR } from '../data/constants';
import { CRITERIA_LIST } from '../data/criteria';
import { RANKING_COLLECTION, buildRankingDoc, isOfficialResult, rankingDocId, rankingDocToRecords } from '../utils/rankings';


/**
 * Phạm vi dữ liệu mà một tài khoản được phép đọc. PHẢI khớp firestore.rules:
 * Firestore từ chối cả truy vấn nếu không chứng minh được mọi bản ghi trả về đều được phép,
 * nên tài khoản không phải BGH bắt buộc truy vấn có điều kiện `where`.
 */
export interface DataScope {
  role: UserRole;
  staffId: string;
  departmentId?: string | null;
  year: string;
}

export interface FirebaseSyncStatus {
  connected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  totalTeachersInCloud: number;
  totalRecordsInCloud: number;
}

// ==========================================
// In-memory Mock Data Store (AI Studio Preview)
// ==========================================
let mockStaff: UserProfile[] = [];
let mockDepartments: Department[] = [];
let mockScores: MonthlyScoreRecord[] = [];

type Listener<T> = (data: T) => void;
const staffListeners = new Set<{ scope: DataScope; cb: Listener<UserProfile[]> }>();
const scoreListeners = new Set<{ scope: DataScope; cb: Listener<MonthlyScoreRecord[]> }>();
const rankingListeners = new Set<{ year: string; cb: Listener<MonthlyScoreRecord[]> }>();

function notifyStaffListeners() {
  staffListeners.forEach(({ scope, cb }) => {
    try {
      const q = scope.role === 'bgh'
        ? mockStaff
        : mockStaff.filter(u => u.departmentId === (scope.departmentId ?? ''));
      cb([...q].sort((a, b) => a.code.localeCompare(b.code)));
    } catch (e) {
      console.error(e);
    }
  });
}

function notifyScoreListeners() {
  scoreListeners.forEach(({ scope, cb }) => {
    try {
      let filtered = mockScores.filter(s => s.year === scope.year);
      if (scope.role === 'ttcm' && scope.departmentId) {
        filtered = filtered.filter(s => s.departmentId === scope.departmentId);
      } else if (scope.role !== 'bgh') {
        filtered = filtered.filter(s => s.staffId === scope.staffId);
      }
      cb(filtered);
    } catch (e) {
      console.error(e);
    }
  });
}

function notifyRankingListeners(year: string) {
  rankingListeners.forEach(({ year: lYear, cb }) => {
    if (lYear === year) {
      try {
        const approvedOrLocked = mockScores.filter(s => s.year === year && isOfficialResult(s));
        cb(approvedOrLocked);
      } catch (e) {
        console.error(e);
      }
    }
  });
}

// Test Firebase connection
export async function testFirebaseConnection(): Promise<boolean> {
  if (!isFirebaseConfigured) return true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network restricted:', error.message);
      return false;
    }
    return true;
  }
}

// Chunking helper for Firestore batch limit of 500 operations
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Recursively removes any object properties whose values are `undefined`.
 */
export function cleanDataForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => cleanDataForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = cleanDataForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Sync Departments
 */
export async function syncDepartmentsToFirestore(departments: Department[]): Promise<void> {
  if (!isFirebaseConfigured) {
    mockDepartments = [...departments];
    return;
  }
  try {
    const batch = writeBatch(db);
    departments.forEach(dept => {
      const ref = doc(db, 'departments', dept.id);
      batch.set(ref, cleanDataForFirestore(dept), { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('Error syncing departments to Firestore:', err);
    throw err;
  }
}

export async function fetchDepartmentsFromFirestore(): Promise<Department[]> {
  if (!isFirebaseConfigured) {
    return [...mockDepartments];
  }
  try {
    const snap = await getDocs(collection(db, 'departments'));
    if (snap.empty) return [];
    return snap.docs.map(d => d.data() as Department);
  } catch (err) {
    console.error('Error fetching departments from Firestore:', err);
    throw err;
  }
}

/**
 * Sync & Fetch Teachers (User Profiles)
 */
export async function saveStaffBatchToFirestore(staffList: UserProfile[]): Promise<void> {
  if (!isFirebaseConfigured) {
    const map = new Map(mockStaff.map(s => [s.id, s]));
    staffList.forEach(s => map.set(s.id, s));
    mockStaff = Array.from(map.values());
    notifyStaffListeners();
    return;
  }
  const chunks = chunkArray(staffList, 200);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(staff => {
      const { avatar: _avatar, ...profile } = staff;
      batch.set(doc(db, 'users', staff.id), cleanDataForFirestore(profile), { merge: true });
    });
    await batch.commit();
  }
}

export async function saveStaffWithScores(staff: UserProfile, existing: MonthlyScoreRecord[], drafts: MonthlyScoreRecord[]) {
  const details = {
    staffName: staff.name, staffCode: staff.code, departmentId: staff.departmentId,
    departmentName: staff.departmentName, position: staff.position,
  };
  if (!isFirebaseConfigured) {
    await saveStaffBatchToFirestore([staff]);
    await saveMultipleScoresToFirestore([...existing.map(score => ({ ...score, ...details })), ...drafts]);
    return;
  }
  const { avatar: _avatar, ...profile } = staff;
  await runTransaction(db, async transaction => {
    const draftRefs = drafts.map(score => doc(db, 'scores', score.id));
    const found = await Promise.all(draftRefs.map(ref => transaction.get(ref)));
    if (found.some(snapshot => snapshot.exists())) throw new Error('Hồ sơ điểm đã tồn tại. Tải lại danh bạ và thử lại.');
    transaction.set(doc(db, 'users', staff.id), cleanDataForFirestore(profile), { merge: true });
    existing.forEach(score => transaction.update(doc(db, 'scores', score.id), cleanDataForFirestore(details)));
    drafts.forEach((score, index) => transaction.set(draftRefs[index], cleanDataForFirestore(score)));
  });
}

export async function saveDepartmentLeaders(staff: UserProfile[], departments: Department[]) {
  if (!isFirebaseConfigured) {
    await saveStaffBatchToFirestore(staff);
    await syncDepartmentsToFirestore(departments);
    return;
  }
  const batch = writeBatch(db);
  staff.forEach(user => {
    const { avatar: _avatar, ...profile } = user;
    batch.set(doc(db, 'users', user.id), cleanDataForFirestore(profile), { merge: true });
  });
  departments.forEach(department => batch.set(doc(db, 'departments', department.id), department, { merge: true }));
  await batch.commit();
}

export async function syncStaffListToFirestore(staffList: UserProfile[]): Promise<{ success: boolean; count: number; syncedAt: string }> {
  if (!isFirebaseConfigured) {
    mockStaff = [...staffList];
    notifyStaffListeners();
    return { success: true, count: staffList.length, syncedAt: new Date().toISOString() };
  }
  try {
    await saveStaffBatchToFirestore(staffList);

    const syncedAt = new Date().toISOString();
    await setDoc(doc(db, 'system_meta', 'staff_sync'), {
      lastSyncedAt: syncedAt,
      totalStaff: staffList.length,
      status: 'officially_stored'
    }, { merge: true });

    return { success: true, count: staffList.length, syncedAt };
  } catch (err) {
    console.error('Error syncing staff list to Firestore:', err);
    throw err;
  }
}

export async function fetchStaffSyncMetaFromFirestore(): Promise<{ lastSyncedAt: string | null; totalStaff: number } | null> {
  if (!isFirebaseConfigured) {
    return { lastSyncedAt: new Date().toISOString(), totalStaff: mockStaff.length };
  }
  try {
    const metaRef = doc(db, 'system_meta', 'staff_sync');
    const snap = await getDoc(metaRef);
    if (snap.exists()) {
      return snap.data() as { lastSyncedAt: string | null; totalStaff: number };
    }
    return null;
  } catch (err) {
    console.warn('Error fetching staff sync meta:', err);
    return null;
  }
}

/** Xóa hồ sơ nhân sự VÀ toàn bộ bản ghi điểm của người đó */
export async function deleteStaffFromFirestore(staffId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    mockStaff = mockStaff.filter(u => u.id !== staffId);
    mockScores = mockScores.filter(s => s.staffId !== staffId);
    notifyStaffListeners();
    notifyScoreListeners();
    return;
  }
  try {
    const scoreSnap = await getDocs(query(collection(db, 'scores'), where('staffId', '==', staffId)));
    for (const chunk of chunkArray(scoreSnap.docs, 400)) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'users', staffId));
  } catch (err) {
    console.error(`Failed to delete staff ${staffId} from Firestore:`, err);
    throw err;
  }
}

export async function fetchStaffFromFirestore(): Promise<UserProfile[]> {
  if (!isFirebaseConfigured) {
    return [...mockStaff].sort((a, b) => a.code.localeCompare(b.code));
  }
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (snap.empty) return [];

    const map = new Map<string, UserProfile>();
    snap.docs.forEach(d => {
      const raw = d.data();
      const data = readStaff(d.id, raw);
      // Bỏ qua bản ghi tạm thời trỏ sang staffId khác
      if (raw.staffId && raw.staffId !== d.id) {
        return;
      }
      const staffKey = (data.id || d.id).trim();
      const emailKey = (data.email || '').trim().toLowerCase();

      // Tránh lặp lại cán bộ
      if (!map.has(staffKey)) {
        if (emailKey && Array.from(map.values()).some(existing => existing.email?.trim().toLowerCase() === emailKey)) {
          return;
        }
        map.set(staffKey, {
          ...data,
          id: staffKey,
          avatar: data.avatar || SCHOOL_AVATAR
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  } catch (err) {
    console.warn('Error fetching staff from Firestore:', err);
    throw err;
  }
}

/**
 * Sync & Fetch Monthly Scores
 */
export async function syncScoresToFirestore(scores: MonthlyScoreRecord[]): Promise<void> {
  if (!isFirebaseConfigured) {
    const map = new Map(mockScores.map(s => [s.id, s]));
    scores.forEach(s => map.set(s.id, s));
    mockScores = Array.from(map.values());
    notifyScoreListeners();
    return;
  }
  try {
    const chunks = chunkArray(scores, 200);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(score => {
        const ref = doc(db, 'scores', score.id);
        batch.set(ref, cleanDataForFirestore(score), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error syncing scores to Firestore:', err);
    throw err;
  }
}

export async function fetchScoresFromFirestore(): Promise<MonthlyScoreRecord[]> {
  if (!isFirebaseConfigured) {
    return [...mockScores];
  }
  try {
    const snap = await getDocs(collection(db, 'scores'));
    if (snap.empty) return [];
    return snap.docs.map(d => d.data() as MonthlyScoreRecord);
  } catch (err) {
    console.warn('Error fetching scores from Firestore:', err);
    throw err;
  }
}

/** Returns the staff profile associated with an authenticated Firebase account. */
export async function fetchStaffById(staffId: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured) return mockStaff.find(staff => staff.id === staffId) ?? null;
  const snapshot = await getDocFromServer(doc(db, 'users', staffId));
  return snapshot.exists() ? readStaff(snapshot.id, snapshot.data()) : null;
}

function readStaff(id: string, data: Record<string, unknown>): UserProfile {
  const { customPassword: _password, passwordUpdatedAt: _passwordDate, ...staff } = data;
  return { ...staff, id, avatar: SCHOOL_AVATAR } as UserProfile;
}

export function observeStaffProfile(staffId: string, onChange: (staff: UserProfile | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, 'users', staffId), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache) onChange(snapshot.exists() ? readStaff(snapshot.id, snapshot.data()) : null);
  }, onError);
}

export interface SharedCriteria {
  items: CriterionItem[];
  revision: number;
  legacyUpdatedAt?: string | null;
}

export function subscribeToCriteria(onChange: (criteria: SharedCriteria) => void, onError: (error: Error) => void) {
  let stopLegacy: Unsubscribe | undefined;
  const stopCurrent = onSnapshot(doc(db, 'criteria', 'default'), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache) return;
    const data = snapshot.data();
    if (!data) {
      stopLegacy ??= onSnapshot(doc(db, 'settings', 'criteria'), { includeMetadataChanges: true }, legacy => {
        if (legacy.metadata.fromCache) return;
        const old = legacy.data();
        if (old && (!Array.isArray(old.items) || typeof old.updatedAt !== 'string')) {
          onError(new Error('Bộ tiêu chí cũ trên Firestore có định dạng không hợp lệ.'));
          return;
        }
        onChange({ items: old?.items.length ? old.items : CRITERIA_LIST, revision: 0, legacyUpdatedAt: old?.updatedAt ?? null });
      }, onError);
      return;
    }
    stopLegacy?.();
    stopLegacy = undefined;
    if (!Array.isArray(data.items) || !Number.isInteger(data.revision) || data.revision < 1) {
      onError(new Error('Bộ tiêu chí trên Firestore có định dạng không hợp lệ.'));
      return;
    }
    onChange({ items: data.items, revision: data.revision });
  }, onError);
  return () => {
    stopCurrent();
    stopLegacy?.();
  };
}

export async function saveCriteria(items: CriterionItem[], expected: SharedCriteria) {
  await runTransaction(db, async transaction => {
    const ref = doc(db, 'criteria', 'default');
    const snapshot = await transaction.get(ref);
    if ((snapshot.data()?.revision ?? 0) !== expected.revision) {
      throw new Error('Bộ tiêu chí đã được cập nhật từ phiên khác. Vui lòng kiểm tra rồi lưu lại.');
    }
    if (expected.revision === 0) {
      const legacy = await transaction.get(doc(db, 'settings', 'criteria'));
      if ((legacy.data()?.updatedAt ?? null) !== expected.legacyUpdatedAt) {
        throw new Error('Bộ tiêu chí cũ đã thay đổi. Vui lòng kiểm tra rồi lưu lại.');
      }
    }
    transaction.set(ref, cleanDataForFirestore({ items, revision: expected.revision + 1 }));
  });
}

/**
 * Save / Update a single score record in Firestore
 */
export async function saveSingleScoreToFirestore(record: MonthlyScoreRecord): Promise<void> {
  if (!isFirebaseConfigured) {
    const idx = mockScores.findIndex(s => s.id === record.id);
    if (idx >= 0) {
      mockScores[idx] = { ...record, feedback: mockScores[idx].feedback };
    } else {
      mockScores.push(record);
    }
    notifyScoreListeners();
    return;
  }
  try {
    const ref = doc(db, 'scores', record.id);
    const { feedback: _feedback, ...changes } = record;
    await updateDoc(ref, cleanDataForFirestore(changes));
  } catch (err) {
    console.error(`Failed to save score ${record.id} to Firestore:`, err);
    throw err;
  }
}

export async function saveScoreFeedback(id: string, feedback: string): Promise<void> {
  if (!isFirebaseConfigured) {
    mockScores = mockScores.map(score => score.id === id ? { ...score, feedback } : score);
    notifyScoreListeners();
    return;
  }
  await updateDoc(doc(db, 'scores', id), { feedback });
}

export async function saveScoreReviewStates(before: MonthlyScoreRecord[], after: MonthlyScoreRecord[]): Promise<void> {
  if (!isFirebaseConfigured) {
    await saveMultipleScoresToFirestore(after);
    return;
  }
  await runTransaction(db, async transaction => {
    const refs = after.map(score => doc(db, 'scores', score.id));
    const current = await Promise.all(refs.map(ref => transaction.get(ref)));
    current.forEach((snapshot, index) => {
      const previous = before[index];
      const data = snapshot.data();
      if (!data || data.status !== previous.status || data.staffId !== previous.staffId ||
          data.departmentId !== previous.departmentId || data.baseScore !== previous.baseScore ||
          data.totalBonus !== previous.totalBonus || data.totalPenalty !== previous.totalPenalty ||
          data.totalScore !== previous.totalScore || data.bghApprovedScore !== previous.bghApprovedScore ||
          JSON.stringify(data.bonusItems) !== JSON.stringify(previous.bonusItems) ||
          JSON.stringify(data.penaltyItems) !== JSON.stringify(previous.penaltyItems)) {
        throw new Error('Hồ sơ đã thay đổi. Vui lòng kiểm tra lại trước khi thao tác.');
      }
      if ((after[index].status === 'submitted' || after[index].status === 'approved') &&
          (![data.baseScore, data.totalBonus, data.totalPenalty, data.totalScore].every(Number.isFinite) ||
            data.totalBonus < 0 || data.totalPenalty < 0 || data.totalScore < 0 ||
            Math.abs(data.totalScore - (data.baseScore + data.totalBonus - data.totalPenalty)) >= 0.001)) {
        throw new Error(`Hồ sơ ${previous.staffCode || previous.id} có tổng điểm đã lưu không khớp. Cần đối chiếu trước khi nộp hoặc duyệt.`);
      }
    });
    after.forEach((score, index) => {
      const changes = score.status === 'approved'
        ? { status: score.status, bghApprovedScore: score.bghApprovedScore, bghNotes: score.bghNotes,
            approvedBy: score.approvedBy, approvedByName: score.approvedByName, approvedAt: score.approvedAt }
        : score.status === 'submitted'
          ? { status: score.status, reviewedBy: score.reviewedBy, reviewedByName: score.reviewedByName, reviewedAt: score.reviewedAt }
          : { status: score.status };
      transaction.update(refs[index], cleanDataForFirestore(changes));
    });
  });
}

/**
 * Save multiple score records in Firestore
 */
export async function saveMultipleScoresToFirestore(records: MonthlyScoreRecord[]): Promise<void> {
  if (!isFirebaseConfigured) {
    const map = new Map(mockScores.map(s => [s.id, s]));
    records.forEach(r => map.set(r.id, r));
    mockScores = Array.from(map.values());
    notifyScoreListeners();
    return;
  }
  try {
    const chunks = chunkArray(records, 200);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        const ref = doc(db, 'scores', rec.id);
        batch.set(ref, cleanDataForFirestore(rec), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Failed to save multiple scores to Firestore:', err);
    throw err;
  }
}

function scoresQuery(scope: DataScope) {
  const col = collection(db, 'scores');
  if (scope.role === 'bgh') {
    return query(col, where('year', '==', scope.year));
  }
  if (scope.role === 'ttcm' && scope.departmentId) {
    return query(col, where('departmentId', '==', scope.departmentId), where('year', '==', scope.year));
  }
  return query(col, where('staffId', '==', scope.staffId), where('year', '==', scope.year));
}

export function subscribeToScores(
  scope: DataScope,
  onUpdate: (records: MonthlyScoreRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const entry = { scope, cb: onUpdate };
    scoreListeners.add(entry);
    // Initial emission
    setTimeout(() => {
      let filtered = mockScores.filter(s => s.year === scope.year);
      if (scope.role === 'ttcm' && scope.departmentId) {
        filtered = filtered.filter(s => s.departmentId === scope.departmentId);
      } else if (scope.role !== 'bgh') {
        filtered = filtered.filter(s => s.staffId === scope.staffId);
      }
      onUpdate(filtered);
    }, 0);
    return () => {
      scoreListeners.delete(entry);
    };
  }

  return onSnapshot(
    scoresQuery(scope),
    snapshot => onUpdate(snapshot.docs.map(d => d.data() as MonthlyScoreRecord)),
    error => {
      console.warn('Firestore scores subscription error:', error);
      if (onError) onError(error);
    }
  );
}

/** BGH đọc toàn bộ hồ sơ; Tổ trưởng chỉ đọc tổ mình. Vai trò khác không có quyền liệt kê. */
export function canListStaff(scope: DataScope): boolean {
  return scope.role === 'bgh' || (scope.role === 'ttcm' && !!scope.departmentId);
}

export function subscribeToStaff(
  scope: DataScope,
  onUpdate: (staff: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const entry = { scope, cb: onUpdate };
    staffListeners.add(entry);
    setTimeout(() => {
      const q = scope.role === 'bgh'
        ? mockStaff
        : mockStaff.filter(u => u.departmentId === (scope.departmentId ?? ''));
      onUpdate([...q].sort((a, b) => a.code.localeCompare(b.code)));
    }, 0);
    return () => {
      staffListeners.delete(entry);
    };
  }

  const col = collection(db, 'users');
  const q = scope.role === 'bgh' ? col : query(col, where('departmentId', '==', scope.departmentId ?? ''));
  return onSnapshot(
    q,
    snapshot => {
      const items = snapshot.docs.map(d => readStaff(d.id, d.data()));
      onUpdate(items.sort((a, b) => a.code.localeCompare(b.code)));
    },
    error => {
      console.warn('Firestore staff subscription error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Bảng xếp hạng công khai.
 */
export async function publishRankings(year: string, months: readonly number[]): Promise<void> {
  const uniqueMonths = Array.from(new Set(months));
  if (uniqueMonths.length === 0) return;

  if (!isFirebaseConfigured) {
    notifyRankingListeners(year);
    return;
  }

  await Promise.all(uniqueMonths.map(month => runTransaction(db, async transaction => {
    const ranking = doc(db, RANKING_COLLECTION, rankingDocId(year, month));
    const previous = await transaction.get(ranking);
    const current = await getDocsFromServer(query(collection(db, 'scores'), where('year', '==', year), where('month', '==', month)));
    const records = current.docs.map(score => score.data() as MonthlyScoreRecord);
    transaction.set(ranking, cleanDataForFirestore(buildRankingDoc(records, year, month, new Date(), previous.data())));
  })));
}

/** Mọi tài khoản đã cấp quyền đều nghe được bảng xếp hạng công khai của năm học. */
export function subscribeToRankings(
  year: string,
  onUpdate: (records: MonthlyScoreRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const entry = { year, cb: onUpdate };
    rankingListeners.add(entry);
    setTimeout(() => {
      const approvedOrLocked = mockScores.filter(s => s.year === year && isOfficialResult(s));
      onUpdate(approvedOrLocked);
    }, 0);
    return () => {
      rankingListeners.delete(entry);
    };
  }

  return onSnapshot(
    query(collection(db, RANKING_COLLECTION), where('year', '==', year)),
    snapshot => onUpdate(snapshot.docs.flatMap(d => rankingDocToRecords(d.data()))),
    error => {
      console.warn('Firestore rankings subscription error:', error);
      if (onError) onError(error);
    }
  );
}
