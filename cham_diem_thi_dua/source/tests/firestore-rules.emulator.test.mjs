/*
 * Kiểm thử HÀNH VI của firestore.rules trên Firestore Emulator.
 * Chạy: npm run test:rules   (cần Java 11+ và kết nối để firebase-tools tải emulator lần đầu)
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

let env;

const score = (o = {}) => ({
  id: 's1', staffId: 'u-gv1', staffName: 'GV 1', departmentId: 'dept-a', month: 9, year: '2026-2027',
  baseScore: 230, bonusItems: [], penaltyItems: [], totalBonus: 0, totalPenalty: 0, totalScore: 230,
  status: 'draft', ...o,
});

before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(?:127\.0\.0\.1|localhost):\d+$/);
  env = await initializeTestEnvironment({
    projectId: 'demo-cva',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => {
  if (!env) return;
  try { await env.clearFirestore(); } finally { await env.cleanup(); }
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'u-bgh'), { id: 'u-bgh', name: 'BGH', role: 'bgh', departmentId: 'office' });
    await setDoc(doc(db, 'users', 'u-gv1'), { id: 'u-gv1', name: 'GV 1', code: 'A1', role: 'gv', departmentId: 'dept-a' });
    await setDoc(doc(db, 'users', 'u-gv2'), { id: 'u-gv2', name: 'GV 2', code: 'B1', role: 'gv', departmentId: 'dept-b' });
    await setDoc(doc(db, 'users', 'u-ttcm-a'), { id: 'u-ttcm-a', name: 'TT A', code: 'A0', role: 'ttcm', departmentId: 'dept-a' });
    await setDoc(doc(db, 'scores', 's1'), score());
    await setDoc(doc(db, 'scores', 's2'), score({ id: 's2', staffId: 'u-gv2', departmentId: 'dept-b' }));
    await setDoc(doc(db, 'scores', 's3'), score({ id: 's3', month: 10, status: 'approved', bghApprovedScore: 230 }));
    await setDoc(doc(db, 'departments', 'dept-a'), { id: 'dept-a', name: 'Tổ A' });
    await setDoc(doc(db, 'rankings', '2026-2027_9'), { year: '2026-2027', month: 9, entries: [], updatedAt: '2026-10-01T00:00:00.000Z' });
  });
});

const bgh = () => env.authenticatedContext('uid-bgh', { role: 'bgh', staffId: 'u-bgh' }).firestore();
const ttcmA = () => env.authenticatedContext('uid-tt', { role: 'ttcm', staffId: 'u-ttcm-a', departmentId: 'dept-a' }).firestore();
const gv1 = () => env.authenticatedContext('uid-gv1', { role: 'gv', staffId: 'u-gv1', departmentId: 'dept-a' }).firestore();
const noClaims = () => env.authenticatedContext('uid-x', {}).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test('anonymous and claim-less accounts read nothing', async () => {
  await assertFails(getDoc(doc(anon(), 'scores', 's1')));
  await assertFails(getDoc(doc(noClaims(), 'scores', 's1')));
  await assertFails(getDocs(collection(noClaims(), 'users')));
});

test('BGH reads and manages everything', async () => {
  const db = bgh();
  await assertSucceeds(getDocs(query(collection(db, 'scores'), where('year', '==', '2026-2027'))));
  await assertSucceeds(getDocs(collection(db, 'users')));
  await assertSucceeds(setDoc(doc(db, 'scores', 's9'), score({ id: 's9', month: 11 })));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { status: 'locked' }));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { status: 'approved', bghApprovedScore: 230 }));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { status: 'locked' }));
  await assertFails(updateDoc(doc(db, 'users', 'u-gv1'), { customPassword: 'fixture-only' }));
  await assertSucceeds(deleteDoc(doc(db, 'scores', 's2')));
});

test('leader reads only their own department, and only with a scoped query', async () => {
  const db = ttcmA();
  await assertSucceeds(getDocs(query(collection(db, 'scores'), where('departmentId', '==', 'dept-a'), where('year', '==', '2026-2027'))));
  await assertSucceeds(getDocs(query(collection(db, 'users'), where('departmentId', '==', 'dept-a'))));
  await assertFails(getDocs(collection(db, 'scores')));
  await assertFails(getDocs(collection(db, 'users')));
  await assertFails(getDocs(query(collection(db, 'scores'), where('departmentId', '==', 'dept-b'))));
  await assertFails(getDoc(doc(db, 'scores', 's2')));
});

test('leader can edit a draft in their department with consistent totals', async () => {
  const db = ttcmA();
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), {
    bonusItems: [{ id: 'b1', title: 'x', points: 5, quantity: 1 }], totalBonus: 5, totalScore: 235,
  }));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { status: 'submitted' }));
});

test('leader cannot forge totals, approve, lock, edit approved, or change identity fields', async () => {
  const db = ttcmA();
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { totalScore: 999 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { totalBonus: 769, totalScore: 999 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { totalBonus: 5, totalScore: 230 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { status: 'approved' }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { status: 'locked' }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { baseScore: 300, totalScore: 300 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { departmentId: 'dept-b' }));
  await assertFails(updateDoc(doc(db, 'scores', 's3'), { feedback: 'sửa sau khi duyệt' }));
  await assertFails(updateDoc(doc(db, 'scores', 's2'), { feedback: 'tổ khác' }));
  await assertFails(setDoc(doc(db, 'scores', 's9'), score({ id: 's9', month: 11 })));
  await assertFails(deleteDoc(doc(db, 'scores', 's1')));
});

test('a teacher can only update feedback on their own unlocked record', async () => {
  const db = gv1();
  await assertSucceeds(getDocs(query(collection(db, 'scores'), where('staffId', '==', 'u-gv1'), where('year', '==', '2026-2027'))));
  await assertSucceeds(getDoc(doc(db, 'users', 'u-gv1')));
  await assertFails(getDocs(collection(db, 'scores')));
  await assertFails(getDoc(doc(db, 'scores', 's2')));
  await assertFails(getDoc(doc(db, 'users', 'u-gv2')));
  await assertFails(getDocs(collection(db, 'users')));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { feedback: 'x' }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { feedback: 'x', totalScore: 999 }));
  await assertFails(updateDoc(doc(db, 'scores', 's2'), { feedback: 'x' }));
});

test('an existing token cannot read scores after its profile is locked or role changes', async () => {
  const db = gv1();
  await assertSucceeds(getDoc(doc(db, 'scores', 's1')));
  await assertSucceeds(updateDoc(doc(bgh(), 'users', 'u-gv1'), { status: 'locked' }));
  await assertSucceeds(getDoc(doc(db, 'users', 'u-gv1')));
  await assertFails(getDoc(doc(db, 'scores', 's1')));
  await assertSucceeds(updateDoc(doc(bgh(), 'users', 'u-gv1'), { status: 'active', role: 'ttcm' }));
  await assertFails(getDoc(doc(db, 'scores', 's1')));
});

test('maximum number of scoring items can be saved and a capped item cannot inflate totals', async () => {
  const db = ttcmA();
  const items = Array.from({ length: 8 }, (_, index) => ({ id: String(index), title: 'QA', points: 1, quantity: 1, criterionId: String(index), creditedPoints: 1 }));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { bonusItems: items, totalBonus: 8, totalScore: 238 }));
  await assertSucceeds(updateDoc(doc(db, 'scores', 's1'), { bonusItems: items.slice(0, 4), penaltyItems: items.slice(4), totalBonus: 4, totalPenalty: 4, totalScore: 230 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), { bonusItems: [...items, items[0]], penaltyItems: [], totalBonus: 9, totalPenalty: 0, totalScore: 239 }));
  await assertFails(updateDoc(doc(db, 'scores', 's1'), {
    bonusItems: [{ ...items[0], criterionId: 'c1', points: 4, quantity: 3, creditedPoints: 5 }],
    penaltyItems: [], totalBonus: 12, totalPenalty: 0, totalScore: 242,
  }));
});

test('BGH can lock 104 approved score records in a single batch', async () => {
  const ids = Array.from({ length: 104 }, (_, index) => `qa-lock-${index}`);
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = writeBatch(db);
    ids.forEach(id => batch.set(doc(db, 'scores', id), score({ id, status: 'approved', bghApprovedScore: 230 })));
    await batch.commit();
  });
  const db = bgh();
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, 'scores', id), { status: 'locked' }));
  await assertSucceeds(batch.commit());
});

test('departments are readable by signed-in users but only BGH can write', async () => {
  await assertSucceeds(getDocs(collection(gv1(), 'departments')));
  await assertFails(setDoc(doc(ttcmA(), 'departments', 'dept-a'), { name: 'đổi tên' }));
  await assertSucceeds(setDoc(doc(bgh(), 'departments', 'dept-a'), { name: 'Tổ A (mới)' }, { merge: true }));
  await assertFails(getDoc(doc(gv1(), 'system_meta', 'staff_sync')));
});

test('public rankings: every authorized account reads them, only BGH writes', async () => {
  const q = db => getDocs(query(collection(db, 'rankings'), where('year', '==', '2026-2027')));
  await assertSucceeds(q(gv1()));
  await assertSucceeds(q(ttcmA()));
  await assertSucceeds(q(bgh()));
  await assertFails(q(anon()));
  await assertFails(q(noClaims()));
  const entry = { year: '2026-2027', month: 10, entries: [], updatedAt: 'x' };
  await assertFails(setDoc(doc(gv1(), 'rankings', '2026-2027_10'), entry));
  await assertFails(setDoc(doc(ttcmA(), 'rankings', '2026-2027_10'), entry));
  await assertSucceeds(setDoc(doc(bgh(), 'rankings', '2026-2027_10'), entry));
});
