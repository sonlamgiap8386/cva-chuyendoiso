import { DatabaseBackup, Download } from 'lucide-react';
import type { CloudBackup } from '../types';
import { firebaseConfig } from '../firebase/config';

interface Props {
  backups: CloudBackup[];
  connected: boolean;
  onSnapshot: () => void;
}

export function CloudBackupView({ backups, connected, onSnapshot }: Props) {
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
