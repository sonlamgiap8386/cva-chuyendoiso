import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectScoreSnapshot } from '../src/utils/storage.ts';

test('inspect both historical JSON backup formats without loading records into the app', () => {
  const sample = { staffId: 'test-gv', year: '2026-2027', month: 9, totalScore: 242, bghNotes: 'Dữ liệu giả' };
  const records = [sample, { ...sample, month: 10 }];
  const expected = { recordsCount: 2, staffCount: 1, years: ['2026-2027'] };
  assert.deepEqual(inspectScoreSnapshot(JSON.stringify(records)), expected);
  assert.deepEqual(inspectScoreSnapshot('\uFEFF' + JSON.stringify({ records, description: 'Bản cũ' })), expected);
  assert.throws(() => inspectScoreSnapshot(JSON.stringify({ records: [{ ...sample, month: 13 }] })), /Bản ghi 1/);
  assert.throws(() => inspectScoreSnapshot('{"description":"chỉ có mô tả"}'), /không chứa/);
});
