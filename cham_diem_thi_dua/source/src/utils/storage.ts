import { MonthlyScoreRecord, CloudBackup, AppNotification } from '../types';

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

/** Xóa dữ liệu cũ do các phiên bản trước để lại trong trình duyệt (hồ sơ người dùng, điểm mẫu). */
export function purgeLegacyStorage(): void {
  try {
    localStorage.removeItem('cva_auth_user_v1');
    localStorage.removeItem('cva_thidua_scores_v4');
  } catch {
    /* localStorage không khả dụng */
  }
}
