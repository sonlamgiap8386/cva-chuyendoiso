import { DatabaseBackup, Download } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import type { CloudBackup } from '../types';
import { firebaseConfig } from '../firebase/config';
import { inspectScoreSnapshot } from '../utils/storage';

interface Props {
  backups: CloudBackup[];
  connected: boolean;
  onSnapshot: () => void;
}

export function CloudBackupView({ backups, connected, onSnapshot }: Props) {
  const [inspection, setInspection] = useState<ReturnType<typeof inspectScoreSnapshot> | null>(null);
  const [inspectionError, setInspectionError] = useState('');
  const [inspecting, setInspecting] = useState(false);

  async function inspectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setInspection(null);
    setInspectionError('');
    setInspecting(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Chỉ kiểm tra tệp tối đa 25 MB.');
      setInspection(inspectScoreSnapshot(await file.text()));
    } catch (error) {
      setInspectionError(error instanceof SyntaxError ? 'Tệp không phải JSON hợp lệ.' : error instanceof Error ? error.message : 'Không thể đọc tệp.');
    } finally {
      setInspecting(false);
    }
  }

  function download(backup: CloudBackup) {
    if (!backup.records) return;
    const blob = new Blob([JSON.stringify(backup.records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backup.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="space-y-5 text-emerald-100">
      <h2 className="flex items-center gap-2 text-xl font-bold text-white">
        <DatabaseBackup className="size-6 text-amber-400" /> Xuất dữ liệu và sao lưu
      </h2>
      <div className="space-y-2 rounded-2xl border border-[#0e4438] bg-[#05211b] p-5">
        <h3 className="font-bold text-white">Sao lưu và phục hồi Firestore</h3>
        <p>Dự án {firebaseConfig.projectId} · {connected ? 'Đã kết nối' : 'Đang chờ kết nối'}</p>
        <p>Quản trị viên dùng chức năng xuất và nhập do Firestore quản lý. Diễn tập phục hồi trên cơ sở dữ liệu thử nghiệm trước khi áp dụng cho dữ liệu vận hành.</p>
        <a className="text-amber-300 underline" href="https://firebase.google.com/docs/firestore/manage-data/export-import"
          target="_blank" rel="noreferrer">Hướng dẫn sao lưu và phục hồi Firestore</a>
      </div>
      <div className="space-y-2 rounded-2xl border border-[#0e4438] bg-[#05211b] p-5">
        <h3 className="font-bold text-white">Đối chiếu tệp sao lưu điểm</h3>
        <p className="text-sm">Kiểm tra số hồ sơ và năm học từ tệp JSON đã tải. Tệp được đọc trên thiết bị này.</p>
        <label className="block text-sm font-semibold">
          Chọn tệp JSON
          <input type="file" accept=".json,application/json" disabled={inspecting} onChange={inspectFile} className="mt-1 block max-w-full" />
        </label>
        {inspectionError && <p role="alert" className="text-rose-300">{inspectionError}</p>}
        {inspection && <p role="status">{inspection.recordsCount} bản ghi · {inspection.staffCount} cán bộ, giáo viên
          {inspection.years.length > 0 && ` · Năm học ${inspection.years.join(', ')}`}</p>}
      </div>
      <div className="space-y-3 rounded-2xl border border-[#0e4438] bg-[#05211b] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-white">Bản chụp điểm trong phiên làm việc</h3>
          <button type="button" onClick={onSnapshot} disabled={!connected}
            className="rounded-lg bg-amber-400 px-3 py-2 font-bold text-stone-950 disabled:opacity-50">Tạo bản chụp điểm</button>
        </div>
        <p className="text-sm">Tệp JSON chứa điểm và ghi chú dưới dạng đọc được. Danh sách bản chụp hết hiệu lực khi tải lại trang hoặc đăng xuất. Tệp phục vụ đối chiếu và lưu trữ nội bộ.</p>
        <ul className="divide-y divide-[#0e4438]">
          {backups.map(backup => (
            <li key={backup.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-bold">{backup.description}</p>
                <p className="text-sm text-emerald-300">{backup.createdAt} · {backup.recordsCount} bản ghi</p>
              </div>
              <button type="button" onClick={() => download(backup)} className="flex items-center gap-1 rounded-lg border border-emerald-700 px-3 py-2">
                <Download className="size-4" /> Tải JSON
              </button>
            </li>
          ))}
        </ul>
        {!backups.length && <p className="text-sm text-emerald-300">Phiên này chưa có bản chụp.</p>}
      </div>
    </section>
  );
}
