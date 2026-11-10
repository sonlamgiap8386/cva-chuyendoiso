import type { MonthlyScoreRecord, CloudBackup, AppNotification } from '../types';

const NOTIFS_KEY = 'cva_thidua_notifs_v1';
export const MAX_LOCAL_BACKUPS = 5;

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load notifications:', e);
  }
  return [];
}

export function saveNotifications(notifs: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
  } catch (e) {
    console.error('Failed to save notifications:', e);
  }
}

export function createCloudSnapshot(
  scores: MonthlyScoreRecord[],
  isAuto: boolean = false,
  description: string = 'Bản chụp điểm'
): CloudBackup {
  const date = new Date();
  const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const formattedTime = date.toISOString().replace('T', ' ').slice(0, 19);
  const jsonString = JSON.stringify(scores);
  const sizeKb = parseFloat((jsonString.length / 1024).toFixed(1));

  const backup: CloudBackup = {
    id: `bak-${Date.now()}`,
    createdAt: formattedTime,
    filename: `cva_thidua_snapshot_${dateStr}.json`,
    sizeKb: Math.max(12, sizeKb),
    recordsCount: scores.length,
    staffCount: new Set(scores.map(s => s.staffId)).size,
    isAuto,
    version: 'v2.5.0',
    description,
    // Store an immutable JSON-compatible copy so restore/download uses the
    // state that existed when the snapshot was created, not current state.
    records: JSON.parse(jsonString) as MonthlyScoreRecord[]
  };

  return backup;
}

/** Đối chiếu tệp JSON tải từ bản cũ hoặc bản mới, không ghi dữ liệu vào ứng dụng. */
export function inspectScoreSnapshot(text: string) {
  const payload = JSON.parse(text.replace(/^\uFEFF/, ''));
  const records: unknown[] = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(records)) throw new Error('Tệp không chứa danh sách bản ghi điểm.');
  const staff = new Set<string>();
  const years = new Set<string>();
  for (const [index, record] of records.entries()) {
    const row = record as Partial<MonthlyScoreRecord> | null;
    if (!row || typeof row.staffId !== 'string' || !row.staffId.trim() ||
        typeof row.year !== 'string' || !row.year.trim() ||
        typeof row.month !== 'number' || !Number.isInteger(row.month) || row.month < 1 || row.month > 12 ||
        typeof row.totalScore !== 'number' || !Number.isFinite(row.totalScore)) {
      throw new Error(`Bản ghi ${index + 1} thiếu thông tin hoặc sai định dạng điểm.`);
    }
    staff.add(row.staffId);
    years.add(row.year);
  }
  return { recordsCount: records.length, staffCount: staff.size, years: [...years].sort() };
}
