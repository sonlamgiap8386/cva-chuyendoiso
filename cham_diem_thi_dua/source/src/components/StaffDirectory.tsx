import React, { useState, useRef } from 'react';
import {
  Users2,
  Search,
  Mail,
  Phone,
  Award,
  Database,
  CloudUpload,
  UserPlus,
  Pencil,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Building2,
  GraduationCap,
  Crown,
  ShieldCheck,
  Unlock,
  ShieldAlert,
  KeyRound,
  UserCog,
  AlertTriangle,
  X
} from 'lucide-react';
import { UserProfile, Department, MonthlyScoreRecord } from '../types';
import { StaffEditModal } from './StaffEditModal';
import { DepartmentLeadersModal } from './DepartmentLeadersModal';
import { AccountManagementModal } from './AccountManagementModal';
import { isAdministrator } from '../utils/auth';
import { downloadSampleStaffExcel, exportStaffAccountsToExcel, parseStaffFromExcel } from '../utils/excelExport';

interface StaffDirectoryProps {
  users: UserProfile[];
  departments: Department[];
  scores: MonthlyScoreRecord[];
  currentMonth: number;
  currentUser: UserProfile;
  onSaveStaff?: (staff: UserProfile) => Promise<void>;
  onDeleteStaff?: (staffId: string) => Promise<void>;
  onBatchImportStaff?: (staffList: UserProfile[]) => Promise<void>;
  onSyncStaffToFirebase?: () => Promise<void>;
  onSaveDepartmentLeaders?: (leadersMap: { [departmentId: string]: string }) => Promise<void>;
  isFirebaseSyncing?: boolean;
  lastSyncedAt?: Date | null;
}

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  users,
  departments,
  scores,
  currentMonth,
  currentUser,
  onSaveStaff,
  onDeleteStaff,
  onBatchImportStaff,
  onSyncStaffToFirebase,
  onSaveDepartmentLeaders,
  isFirebaseSyncing = false,
  lastSyncedAt = null,
}) => {
  const isBgh = currentUser?.role === 'bgh';
  const isAdmin = isAdministrator(currentUser);
  const isTtcm = currentUser?.role === 'ttcm';
  const isTeacher = currentUser?.role === 'gv';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (isTeacher && currentUser?.departmentId) {
      return currentUser.departmentId;
    }
    return 'all';
  });
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'bgh' | 'ttcm' | 'gvcn' | 'gv'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [showFullPhone, setShowFullPhone] = useState(isAdmin || isBgh || isTtcm);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message: string } | null>(null);

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [isLeadersModalOpen, setIsLeadersModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Quick Lock Dialog State
  const [quickLockTarget, setQuickLockTarget] = useState<UserProfile | null>(null);
  const [quickLockReason, setQuickLockReason] = useState('Tạm ngưng quyền truy cập theo kế hoạch nhân sự nhà trường');
  const [isProcessingLock, setIsProcessingLock] = useState(false);

  // File Input Ref for Excel Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter users
  const filteredUsers = users.filter(u => {
    if (selectedDept !== 'all' && u.departmentId !== selectedDept) return false;
    if (selectedRoleFilter === 'bgh' && u.role !== 'bgh') return false;
    if (selectedRoleFilter === 'ttcm' && u.role !== 'ttcm') return false;
    if (selectedRoleFilter === 'gvcn' && !u.isHomeroomTeacher) return false;
    if (selectedRoleFilter === 'gv' && u.role !== 'gv') return false;
    if (selectedStatusFilter === 'active' && u.status === 'locked') return false;
    if (selectedStatusFilter === 'locked' && u.status !== 'locked') return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        u.position.toLowerCase().includes(q) ||
        (u.subject && u.subject.toLowerCase().includes(q)) ||
        (u.concurrentJob && u.concurrentJob.toLowerCase().includes(q)) ||
        (u.homeroomClass && u.homeroomClass.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Quick Unlock Handler for BGH directly on card
  const handleQuickUnlock = async (staff: UserProfile) => {
    if (!onSaveStaff) return;
    try {
      await onSaveStaff({
        ...staff,
        status: 'active',
        lockedAt: undefined,
        lockedReason: undefined,
        lockedBy: undefined
      });
      setSyncFeedback(`Đã mở khóa & cấp lại quyền truy cập thành công cho cán bộ ${staff.name} (${staff.code})`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      alert(`Lỗi mở khóa tài khoản: ${err?.message || 'Vui lòng thử lại'}`);
    }
  };

  // Quick Lock Confirm Handler
  const handleQuickConfirmLock = async () => {
    if (!quickLockTarget || !onSaveStaff) return;
    setIsProcessingLock(true);
    try {
      await onSaveStaff({
        ...quickLockTarget,
        status: 'locked',
        lockedAt: new Date().toISOString(),
        lockedReason: quickLockReason.trim() || 'Theo quyết định của Ban Giám Hiệu',
        lockedBy: currentUser.name || 'Ban Giám Hiệu'
      });
      setSyncFeedback(`Đã tạm khóa quyền truy cập của cán bộ ${quickLockTarget.name} (${quickLockTarget.code})`);
      setTimeout(() => setSyncFeedback(null), 4000);
      setQuickLockTarget(null);
    } catch (err: any) {
      alert(`Lỗi khóa tài khoản: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsProcessingLock(false);
    }
  };

  const handleManualSync = async () => {
    if (!onSyncStaffToFirebase) return;
    try {
      setSyncFeedback('Đang đồng bộ danh sách cán bộ lên Firebase Firestore...');
      await onSyncStaffToFirebase();
      setSyncFeedback('Đã đồng bộ thành công dữ liệu cán bộ lên máy chủ Firebase Firestore!');
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback(`Lỗi khi lưu Firestore: ${err?.message || 'Vui lòng thử lại'}`);
    }
  };

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (staff: UserProfile) => {
    setEditingStaff(staff);
    setIsEditModalOpen(true);
  };

  const renderPhone = (phone?: string) => {
    if (!phone) return 'Chưa cập nhật';
    if (showFullPhone) return phone;
    if (phone.length >= 7) {
      return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
    }
    return '***';
  };

  const handleDownloadSampleExcel = async () => {
    try {
      await downloadSampleStaffExcel();
    } catch (err: any) {
      console.error('Lỗi tải file mẫu:', err);
      alert('Không thể tạo file mẫu Excel: ' + (err?.message || 'Lỗi không xác định'));
    }
  };

  const handleExportStaffAccounts = async () => {
    if (!isAdmin) return;
    try {
      await exportStaffAccountsToExcel(users);
    } catch (err: any) {
      console.error('Lỗi xuất tài khoản:', err);
      alert('Không thể xuất danh sách tài khoản: ' + (err?.message || 'Lỗi không xác định'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) throw new Error('Không đọc được dữ liệu file.');

        const parsedStaffList = await parseStaffFromExcel(bstr, departments, users.length);

        if (parsedStaffList.length === 0) {
          setImportStatus({ success: false, message: 'Không tìm thấy dòng thông tin giáo viên hợp lệ nào trong file.' });
          return;
        }

        if (onBatchImportStaff) {
          await onBatchImportStaff(parsedStaffList);
          setImportStatus({
            success: true,
            message: `Đã nhập và đồng bộ thành công ${parsedStaffList.length} cán bộ giáo viên từ file Excel!`
          });
          setTimeout(() => setImportStatus(null), 6000);
        }
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setImportStatus({ success: false, message: `Lỗi đọc file Excel: ${err?.message || 'Định dạng không khớp'}` });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            <span>HỒ SƠ CÁN BỘ VIÊN CHỨC & TỔ CHUYÊN MÔN</span>
            <span className="text-emerald-700">·</span>
            <span className="text-emerald-300 font-semibold flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              FIREBASE FIRESTORE DATABASE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif flex items-center gap-2">
            <Users2 className="w-7 h-7 text-amber-400" />
            <span>Danh Sách Cán Bộ, Giáo Viên Toàn Trường</span>
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 max-w-2xl">
            Quản lý hồ sơ định danh, phân công chuyên môn và kiểm soát phân quyền xem danh bạ. Dữ liệu được lưu trữ chính thức và bảo mật trên đám mây Firebase Firestore.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Direct Account & Access Management Button for BGH */}
          {(isAdmin || isBgh) && onSaveStaff && (
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 text-[#031713] text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 border border-amber-300"
              title="Giao diện quản lý tài khoản: Khóa, mở khóa, cấp lại quyền và quản lý tài khoản CBVC trực tiếp"
            >
              <UserCog className="w-4 h-4 text-[#031713]" />
              <span>Quản Lý Tài Khoản (BGH)</span>
            </button>
          )}

          {/* Configure Department Leaders (TTCM) Button */}
          {(isAdmin || isBgh) && onSaveDepartmentLeaders && (
            <button
              onClick={() => setIsLeadersModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#072a23] hover:bg-[#0a382e] text-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 border border-[#0e4438]"
              title="Cấu hình giáo viên nào làm Tổ trưởng chuyên môn (TTCM) để chấm điểm thi đua"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Phân quyền TTCM</span>
            </button>
          )}

          {(isAdmin || isBgh) && (
            <button
              onClick={handleExportStaffAccounts}
              className="px-3.5 py-2 rounded-xl bg-[#072a23] hover:bg-[#0a382e] text-emerald-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer border border-[#0e4438]"
              title="Xuất danh sách tài khoản CB/GV và mật khẩu mặc định"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Xuất tài khoản CB/GV</span>
            </button>
          )}

          {/* Sample template download */}
          {(isAdmin || isBgh) && (
            <button
              onClick={handleDownloadSampleExcel}
              className="px-3.5 py-2 rounded-xl bg-[#072a23] hover:bg-[#0a382e] text-emerald-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer border border-[#0e4438]"
              title="Tải file Excel mẫu để nhập danh sách cán bộ giáo viên"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Tải file Excel mẫu</span>
            </button>
          )}

          {/* Import Excel Button */}
          {(isAdmin || isBgh) && onBatchImportStaff && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer border border-emerald-600/50"
                title="Nhập danh sách giáo viên tự động từ file Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Nhập từ Excel</span>
              </button>
            </div>
          )}

          {/* Save to Firestore */}
          {onSyncStaffToFirebase && (
            <button
              onClick={handleManualSync}
              disabled={isFirebaseSyncing}
              className="px-3.5 py-2 rounded-xl bg-[#0b483c] hover:bg-[#115e4f] text-emerald-200 hover:text-white border border-[#1b7360] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
              title="Lưu danh bạ chính thức lên Firebase Firestore"
            >
              <CloudUpload className={`w-4 h-4 ${isFirebaseSyncing ? 'animate-bounce text-amber-400' : ''}`} />
              <span>{isFirebaseSyncing ? 'Đang lưu...' : 'Lưu Firestore'}</span>
            </button>
          )}

          {/* Add Staff Button */}
          {(isAdmin || isBgh) && onSaveStaff && (
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm CBVC Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
            importStatus.success
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          {importStatus.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* Firebase Cloud Official Storage Banner */}
      <div className="bg-gradient-to-r from-[#072a23] via-[#05211b] to-[#041d17] text-white rounded-3xl p-5 border border-[#0e4438] shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-mono font-bold tracking-wide uppercase text-emerald-400">
                Firestore Cloud: Collection &quot;users&quot;
              </span>
              <span className="text-[10px] bg-[#041d17] px-2 py-0.5 rounded text-emerald-300 font-mono border border-[#0e4438]">
                THPT Chu Văn An
              </span>
            </div>
            <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Đã lưu trữ chính thức:</span>
              <span className="text-amber-400 font-extrabold font-mono text-lg">{users.length} Cán bộ giáo viên</span>
              <span className="text-xs font-normal text-emerald-300/70">trên máy chủ cơ sở dữ liệu</span>
            </div>
            <div className="text-xs text-emerald-300/60">
              {lastSyncedAt ? (
                <span>Thời điểm đồng bộ gần nhất: {lastSyncedAt.toLocaleString('vi-VN')}</span>
              ) : (
                <span>Trạng thái: Dữ liệu đang được kết nối và lắng nghe thời gian thực (Realtime Live Sync)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden md:block text-xs">
              <div className="text-emerald-300/70 font-medium">Phân quyền danh bạ:</div>
              <div className="text-amber-400 font-bold">
                {isAdmin ? 'Quản trị viên' : isBgh ? 'Toàn quyền BGH' : isTtcm ? 'Quyền Tổ trưởng CM' : 'Phân quyền Giáo viên'}
              </div>
            </div>
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-3 pt-3 border-t border-[#0e4438] text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* Privacy Notice for Standard Teachers */}
      {isTeacher && !isAdmin && (
        <div className="bg-[#072d24] border border-[#145b4c] rounded-2xl p-4 text-xs text-emerald-200 flex items-start gap-3">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-white">
              Chế độ bảo mật thông tin cán bộ giáo viên (Quyền: {currentUser?.name || 'Giáo viên'} - {currentUser?.departmentName || 'Tổ Chuyên Môn'})
            </div>
            <div className="text-emerald-200/80 leading-relaxed">
              Hệ thống mặc định hiển thị danh sách các thầy cô trong <strong>{currentUser?.departmentName || 'Tổ Chuyên Môn'}</strong> của bạn. Số điện thoại cá nhân được ẩn bớt để đảm bảo quyền riêng tư. Bạn có thể chọn xem toàn trường để tra cứu chuyên môn khi cần phối hợp công tác.
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#062921] p-4 rounded-2xl border border-[#0e4438] shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/70" />
          <input
            type="text"
            placeholder="Tìm theo tên GV, mã CBVC, môn dạy, lớp CN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#041d17] border border-[#104b3e] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="bg-[#041d17] border border-[#104b3e] rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            <option value="all" className="bg-[#05211b]">Toàn trường ({users.length} CBVC)</option>
            {departments.map(d => {
              const count = users.filter(u => u.departmentId === d.id).length;
              return (
                <option key={d.id} value={d.id} className="bg-[#05211b]">
                  {d.name} ({count} GV)
                </option>
              );
            })}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value as any)}
            className="bg-[#041d17] border border-[#104b3e] rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            <option value="all" className="bg-[#05211b]">Tất cả chức danh</option>
            <option value="bgh" className="bg-[#05211b]">Ban Giám Hiệu</option>
            <option value="ttcm" className="bg-[#05211b]">Tổ trưởng chuyên môn</option>
            <option value="gvcn" className="bg-[#05211b]">Giáo viên chủ nhiệm</option>
            <option value="gv" className="bg-[#05211b]">Giáo viên bộ môn</option>
          </select>

          {/* Status Filter for Access Rights */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value as any)}
            className={`border rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
              selectedStatusFilter === 'locked'
                ? 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                : selectedStatusFilter === 'active'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : 'bg-[#041d17] border-[#104b3e] text-white'
            }`}
          >
            <option value="all" className="bg-[#05211b] text-white">Tất cả trạng thái quyền</option>
            <option value="active" className="bg-[#05211b] text-emerald-300">
              Đang hoạt động ({users.filter(u => u.status !== 'locked').length})
            </option>
            <option value="locked" className="bg-[#05211b] text-rose-300">
              Đã tạm khóa ({users.filter(u => u.status === 'locked').length})
            </option>
          </select>

          {/* Phone Visibility Toggle */}
          <button
            onClick={() => setShowFullPhone(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showFullPhone
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                : 'bg-[#041d17] border-[#104b3e] text-emerald-300 hover:bg-[#072a23]'
            }`}
            title="Ẩn/Hiện số điện thoại liên hệ"
          >
            {showFullPhone ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{showFullPhone ? 'SĐT: Đầy đủ' : 'SĐT: Đang ẩn'}</span>
          </button>
        </div>
      </div>

      {/* Staff Count Label */}
      <div className="flex items-center justify-between text-xs text-emerald-400/70 px-1">
        <span>
          Hiển thị <strong className="text-amber-300">{filteredUsers.length}</strong> / {users.length} cán bộ giáo viên
        </span>
        {isBgh && (
          <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
            Quyền BGH: Được phép Thêm, Sửa, Xóa hồ sơ trên Firestore & Nhập Excel
          </span>
        )}
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const score = scores.find(s => s.staffId === user.id && s.month === currentMonth);
          const finalScore = score ? (score.bghApprovedScore ?? score.totalScore) : 230;
          const isLocked = user.status === 'locked';

          return (
            <div
              key={user.id}
              className={`rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${
                isLocked
                  ? 'bg-[#140808] border-rose-600/50 hover:border-rose-400 shadow-rose-950/20'
                  : 'bg-[#05211b] border-[#0e4438] hover:border-amber-400'
              }`}
            >
              <div>
                <div className="flex items-start gap-3 mb-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-400/50 shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-[#093c31] border border-amber-400/40 flex items-center justify-center font-bold text-amber-300 shrink-0 font-serif text-sm shadow-2xs group-hover:scale-105 transition-transform">
                      {user.name ? user.name.trim().split(/\s+/).slice(-2).map(n => n[0]).join('').toUpperCase() : 'GV'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm truncate font-serif">
                        {user.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#041d17] text-amber-300 border border-[#0e4438]">
                        {user.code}
                      </span>
                    </div>
                    <div className="text-xs text-amber-300 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{user.position}</span>
                      {user.role === 'ttcm' && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5 text-amber-400" />
                          <span>TTCM · Quyền chấm điểm</span>
                        </span>
                      )}
                      {user.role === 'bgh' && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>BGH</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-emerald-300/70">
                      {user.departmentName}
                    </div>
                    {user.subject && (
                      <div className="mt-1">
                        <span className="inline-block text-[10px] font-semibold bg-[#093c31] text-emerald-300 border border-[#1b7360] px-2 py-0.5 rounded-md">
                          Môn: {user.subject}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Locked Account Warning Banner */}
                {isLocked && (
                  <div className="mt-1 mb-2.5 p-2 rounded-xl bg-rose-950/70 border border-rose-500/50 flex items-start gap-2 text-rose-200 text-xs">
                    <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-bold text-[11px] text-rose-300 flex items-center gap-1">
                        <span>ĐÃ TẠM KHÓA QUYỀN TRUY CẬP</span>
                      </div>
                      <div className="text-[10px] text-rose-300/80 leading-tight truncate mt-0.5">
                        {user.lockedReason || 'Theo quyết định của Ban Giám Hiệu'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-emerald-200/80 pt-2 border-t border-[#0e4438]">
                  {user.concurrentJob && (
                    <div className="flex items-start gap-1.5 text-amber-300 font-medium text-[11px] bg-[#041d17] p-1.5 rounded-lg border border-[#0e4438]">
                      <Award className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>Kiêm nhiệm: <span className="font-semibold text-white">{user.concurrentJob}</span></span>
                    </div>
                  )}
                  {user.isHomeroomTeacher && (
                    <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                      <span className="font-bold text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md border border-emerald-500/40">GVCN</span>
                      <span>Lớp: <strong className="text-white">{user.homeroomClass}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/70">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-[11px] text-white">{renderPhone(user.phone)}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Monthly Score & BGH Management Actions */}
              <div className="mt-4 pt-3 border-t border-[#0e4438] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-emerald-400/70">Điểm T0{currentMonth}:</span>
                  <span className="text-xs font-black text-amber-300 font-mono bg-[#093c31] px-2 py-0.5 rounded-md border border-[#1b7360]">
                    {finalScore} đ
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Quick Lock / Unlock for BGH directly on the card */}
                  {(isAdmin || isBgh) && onSaveStaff && (
                    isLocked ? (
                      <button
                        onClick={() => handleQuickUnlock(user)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        title="Cấp lại quyền truy cập (Mở khóa) cho cán bộ này"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>Cấp lại quyền</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setQuickLockTarget(user);
                          setQuickLockReason('Tạm ngưng quyền truy cập theo kế hoạch nhân sự');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Khóa quyền truy cập của cán bộ này"
                      >
                        <Lock className="w-3 h-3 text-rose-400" />
                        <span>Khóa</span>
                      </button>
                    )
                  )}

                  {(isAdmin || isBgh) && onSaveStaff && (
                    <button
                      onClick={() => handleOpenEditModal(user)}
                      className="p-1.5 rounded-lg bg-[#072a23] hover:bg-[#0a382e] text-emerald-200 hover:text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-[#0e4438]"
                      title="Chỉnh sửa thông tin cán bộ giáo viên trên Firebase"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">Sửa</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <div className="bg-[#05211b] rounded-2xl p-12 text-center border border-[#0e4438] text-emerald-400/70 space-y-2">
          <Users2 className="w-10 h-10 mx-auto text-emerald-600" />
          <div className="font-bold text-white">Không tìm thấy cán bộ giáo viên nào</div>
          <div className="text-xs">Vui lòng thử tìm kiếm theo từ khóa khác hoặc chọn tất cả tổ chuyên môn.</div>
        </div>
      )}

      {/* Staff Edit Modal */}
      {isEditModalOpen && onSaveStaff && (
        <StaffEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          staff={editingStaff}
          departments={departments}
          existingStaffCount={users.length}
          onSave={onSaveStaff}
          onDelete={onDeleteStaff}
        />
      )}

      {/* Department Leaders & Permissions Config Modal */}
      {isLeadersModalOpen && onSaveDepartmentLeaders && (
        <DepartmentLeadersModal
          isOpen={isLeadersModalOpen}
          onClose={() => setIsLeadersModalOpen(false)}
          departments={departments}
          users={users}
          onSaveDepartmentLeaders={onSaveDepartmentLeaders}
          currentUser={currentUser}
        />
      )}

      {/* Account Management & Direct Access Rights Modal (BGH) */}
      {isAccountModalOpen && onSaveStaff && (
        <AccountManagementModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          users={users}
          departments={departments}
          currentUser={currentUser}
          onSaveStaff={onSaveStaff}
          onEditStaffDetail={(staff) => {
            handleOpenEditModal(staff);
          }}
        />
      )}

      {/* Quick Lock Confirmation Dialog for Staff Card */}
      {quickLockTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#05211b] border border-rose-500/50 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white font-serif">
                  Xác Nhận Khóa Quyền Truy Cập
                </h3>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Tài khoản của cán bộ sẽ bị tạm dừng đăng nhập hệ thống
                </p>
              </div>
              <button
                onClick={() => setQuickLockTarget(null)}
                className="text-emerald-400/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#041d17] p-3 rounded-2xl border border-[#0e4438] text-xs space-y-1">
              <div className="text-white font-bold">
                Cán bộ: <span className="text-amber-300">{quickLockTarget.name}</span> ({quickLockTarget.code})
              </div>
              <div className="text-emerald-300/70">Email: {quickLockTarget.email}</div>
              <div className="text-emerald-300/70">Tổ: {quickLockTarget.departmentName} - {quickLockTarget.position}</div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-white">Lý do khóa quyền truy cập:</label>
              <input
                type="text"
                value={quickLockReason}
                onChange={e => setQuickLockReason(e.target.value)}
                placeholder="Nhập lý do khóa..."
                className="w-full bg-[#041d17] border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
              />
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-1">
                {['Nghỉ công tác / Chuyển trường', 'Nghỉ thai sản', 'Tạm đình chỉ xác minh', 'Vi phạm quy chế'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuickLockReason(tag)}
                    className="px-2 py-0.5 rounded bg-[#041d17] hover:bg-[#072a23] text-rose-200 border border-rose-500/30 cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setQuickLockTarget(null)}
                className="px-4 py-2 rounded-xl bg-[#041d17] hover:bg-[#072a23] text-emerald-300 font-bold text-xs cursor-pointer border border-[#0e4438]"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleQuickConfirmLock}
                disabled={isProcessingLock}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isProcessingLock ? 'Đang khóa...' : 'Xác Nhận Khóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
