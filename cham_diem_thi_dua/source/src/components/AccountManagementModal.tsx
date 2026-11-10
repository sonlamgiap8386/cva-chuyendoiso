import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Crown,
  Building2,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { UserProfile, Department, UserRole } from '../types';
import { requestPasswordReset } from '../firebase/authService';

interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  departments: Department[];
  currentUser: UserProfile;
  onSaveStaff: (staff: UserProfile) => Promise<void>;
  onEditStaffDetail: (staff: UserProfile) => void;
}

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  departments,
  currentUser,
  onSaveStaff,
  onEditStaffDetail,
}) => {
  if (!isOpen) return null;

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedRole, setSelectedRole] = useState<'all' | UserRole>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'locked'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Action Dialog States
  const [lockTargetUser, setLockTargetUser] = useState<UserProfile | null>(null);
  const [lockReason, setLockReason] = useState('Tạm ngưng quyền truy cập theo kế hoạch nhân sự nhà trường');
  const [presetReason, setPresetReason] = useState('Nghỉ công tác / Chuyển trường');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const locked = users.filter(u => u.status === 'locked').length;
    const active = total - locked;
    const bghCount = users.filter(u => u.role === 'bgh').length;
    const ttcmCount = users.filter(u => u.role === 'ttcm').length;
    const btdCount = users.filter(u => u.role === 'btd').length;
    const gvCount = users.filter(u => u.role === 'gv').length;
    return { total, active, locked, bghCount, ttcmCount, btdCount, gvCount };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (selectedDept !== 'all' && u.departmentId !== selectedDept) return false;
      if (selectedRole !== 'all' && u.role !== selectedRole) return false;
      if (selectedStatus === 'active' && u.status === 'locked') return false;
      if (selectedStatus === 'locked' && u.status !== 'locked') return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.code.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q)) ||
          u.position.toLowerCase().includes(q) ||
          u.departmentName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, selectedDept, selectedRole, selectedStatus, searchQuery]);

  // Preset reasons
  const presetReasons = [
    'Nghỉ công tác / Chuyển trường',
    'Nghỉ thai sản / Nghỉ ốm dài hạn',
    'Tạm đình chỉ công tác để xác minh',
    'Vi phạm quy chế thi đua / an toàn thông tin',
    'Chờ bàn giao công tác chuyên môn',
    'Khác (nhập chi tiết bên dưới)'
  ];

  const handleSelectPreset = (reason: string) => {
    setPresetReason(reason);
    if (reason !== 'Khác (nhập chi tiết bên dưới)') {
      setLockReason(reason);
    }
  };

  // Lock account handler
  const handleConfirmLock = async () => {
    if (!lockTargetUser) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const updated: UserProfile = {
        ...lockTargetUser,
        status: 'locked',
        lockedAt: new Date().toISOString(),
        lockedReason: lockReason.trim() || 'Theo quyết định của Ban Giám Hiệu',
        lockedBy: currentUser.name || 'Ban Giám Hiệu'
      };
      await onSaveStaff(updated);
      setFeedback({
        type: 'success',
        message: `Đã khóa quyền truy cập của cán bộ ${lockTargetUser.name} (${lockTargetUser.code}) thành công!`
      });
      setLockTargetUser(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Không thể khóa tài khoản: ${err?.message || 'Vui lòng thử lại'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restore/Unlock account handler
  const handleUnlockUser = async (user: UserProfile) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const updated: UserProfile = {
        ...user,
        status: 'active',
        lockedAt: undefined,
        lockedReason: undefined,
        lockedBy: undefined
      };
      await onSaveStaff(updated);
      setFeedback({
        type: 'success',
        message: `Đã cấp lại quyền truy cập thành công cho cán bộ ${user.name} (${user.code})!`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Không thể mở khóa tài khoản: ${err?.message || 'Vui lòng thử lại'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Role Change
  const handleRoleChange = async (user: UserProfile, newRole: UserRole) => {
    if (user.role === newRole) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const updated: UserProfile = {
        ...user,
        role: newRole
      };
      await onSaveStaff(updated);
      setFeedback({
        type: 'success',
        message: `Đã cập nhật vai trò của cán bộ ${user.name} thành "${
          newRole === 'bgh' ? 'Ban Giám Hiệu' : newRole === 'ttcm' ? 'Tổ trưởng Chuyên môn' : newRole === 'btd' ? 'Bí thư Đoàn' : 'Giáo viên bộ môn'
        }"!`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Lỗi cập nhật vai trò: ${err?.message || 'Vui lòng thử lại'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send password reset email via Google Firebase
  const handleSendResetEmail = async (user: UserProfile) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await requestPasswordReset(user.email);
      setFeedback({
        type: 'success',
        message: `Đã gửi liên kết khôi phục mật khẩu trực tiếp từ Google Firebase đến hòm thư: ${user.email}!`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Không thể gửi email khôi phục: ${err?.message || 'Vui lòng thử lại'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection handlers
  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  // Bulk actions
  const handleBulkUnlock = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    try {
      let count = 0;
      for (const id of selectedUserIds) {
        const u = users.find(x => x.id === id);
        if (u && u.status === 'locked') {
          await onSaveStaff({
            ...u,
            status: 'active',
            lockedAt: undefined,
            lockedReason: undefined,
            lockedBy: undefined
          });
          count++;
        }
      }
      setFeedback({
        type: 'success',
        message: `Đã mở khóa và cấp lại quyền cho ${count} tài khoản được chọn!`
      });
      setSelectedUserIds([]);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Lỗi thao tác hàng loạt: ${err?.message || 'Vui lòng thử lại'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#041d17] border border-[#104b3e] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white my-auto animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#072a23] via-[#05211b] to-[#041d17] border-b border-[#0e4438] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-sm shrink-0">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white font-serif tracking-wide">
                  Quản Lý Tài Khoản & Quyền Truy Cập (BGH)
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Phân Quyền Trực Tiếp
                </span>
              </div>
              <p className="text-xs text-emerald-300/70 mt-0.5">
                Khóa, mở khóa, cấp lại quyền và quản lý mật khẩu cán bộ giáo viên trên máy chủ Firebase mà không cần nhập lại file
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-400/70 hover:text-white hover:bg-[#072a23] transition-colors cursor-pointer border border-transparent hover:border-[#104b3e]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs opacity-70 hover:opacity-100 hover:underline cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="bg-[#05211b] p-3 rounded-2xl border border-[#0e4438]">
              <div className="text-[10px] text-emerald-300/70 font-medium">Tổng tài khoản</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">{stats.total}</div>
            </div>
            <div className="bg-[#05211b] p-3 rounded-2xl border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Đang hoạt động</span>
              </div>
              <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">{stats.active}</div>
            </div>
            <div className={`p-3 rounded-2xl border ${stats.locked > 0 ? 'bg-rose-950/30 border-rose-500/40' : 'bg-[#05211b] border-[#0e4438]'}`}>
              <div className="text-[10px] text-rose-300 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3 text-rose-400" />
                <span>Đã tạm khóa</span>
              </div>
              <div className="text-lg font-black text-rose-400 font-mono mt-0.5">{stats.locked}</div>
            </div>
            <div className="bg-[#05211b] p-3 rounded-2xl border border-[#0e4438]">
              <div className="text-[10px] text-emerald-300/70 font-medium">Ban Giám Hiệu</div>
              <div className="text-lg font-black text-amber-300 font-mono mt-0.5">{stats.bghCount}</div>
            </div>
            <div className="bg-[#05211b] p-3 rounded-2xl border border-[#0e4438]">
              <div className="text-[10px] text-emerald-300/70 font-medium">Tổ trưởng CM</div>
              <div className="text-lg font-black text-amber-300 font-mono mt-0.5">{stats.ttcmCount}</div>
            </div>
            <div className="bg-[#05211b] p-3 rounded-2xl border border-[#0e4438]">
              <div className="text-[10px] text-emerald-300/70 font-medium">Bí thư Đoàn</div>
              <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">{stats.btdCount}</div>
            </div>
            <div className="bg-[#05211b] p-3 rounded-2xl border border-[#0e4438]">
              <div className="text-[10px] text-emerald-300/70 font-medium">Giáo viên BM</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">{stats.gvCount}</div>
            </div>
          </div>

          {/* Search and Filters Toolbar */}
          <div className="bg-[#05211b] p-4 rounded-2xl border border-[#0e4438] flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
              <input
                type="text"
                placeholder="Tìm họ tên, mã CBVC, email, SĐT..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#041d17] border border-[#104b3e] rounded-xl text-xs text-white placeholder-emerald-400/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              {/* Department Filter */}
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-[#041d17] border border-[#104b3e] rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <option value="all">Tất cả tổ chuyên môn</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as any)}
                className="bg-[#041d17] border border-[#104b3e] rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="bgh">Ban Giám Hiệu</option>
                <option value="ttcm">Tổ trưởng CM</option>
                <option value="btd">Bí thư Đoàn</option>
                <option value="gv">Giáo viên</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as any)}
                className={`border rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                  selectedStatus === 'locked'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : selectedStatus === 'active'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-[#041d17] border-[#104b3e] text-white'
                }`}
              >
                <option value="all" className="bg-[#041d17] text-white">Tất cả trạng thái</option>
                <option value="active" className="bg-[#041d17] text-emerald-300">Đang hoạt động ({stats.active})</option>
                <option value="locked" className="bg-[#041d17] text-rose-300">Đã tạm khóa ({stats.locked})</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Bar if items selected */}
          {selectedUserIds.length > 0 && (
            <div className="bg-gradient-to-r from-amber-950/40 via-[#05211b] to-[#072a23] p-3 rounded-xl border border-amber-400/40 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-300">Đã chọn: {selectedUserIds.length} cán bộ</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkUnlock}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Cấp lại quyền (Mở khóa)</span>
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-2.5 py-1.5 rounded-lg bg-[#041d17] hover:bg-[#072a23] text-emerald-300 font-medium cursor-pointer border border-[#0e4438]"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          {/* Table of Accounts */}
          <div className="bg-[#05211b] rounded-2xl border border-[#0e4438] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#072a23] text-emerald-300/80 border-b border-[#0e4438] uppercase font-bold tracking-wider text-[11px]">
                    <th className="p-3 w-10 text-center">
                      <button
                        onClick={handleSelectAllFiltered}
                        className="cursor-pointer text-emerald-400 hover:text-white"
                        title="Chọn tất cả"
                      >
                        {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Họ và Tên / Mã CBVC</th>
                    <th className="p-3">Email Đăng Nhập</th>
                    <th className="p-3">Tổ Chuyên Môn / Chức Vụ</th>
                    <th className="p-3">Phân Quyền Vai Trò</th>
                    <th className="p-3 text-center">Trạng Thái Truy Cập</th>
                    <th className="p-3 text-right">Thao Tác Quản Lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e4438]/60">
                  {filteredUsers.map(user => {
                    const isLocked = user.status === 'locked';
                    const isSelected = selectedUserIds.includes(user.id);

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-[#072a23]/60 transition-colors ${
                          isLocked ? 'bg-rose-950/15' : ''
                        } ${isSelected ? 'bg-amber-400/10' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleSelectUser(user.id)}
                            className="cursor-pointer text-emerald-400 hover:text-amber-400"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Staff Name & Code */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-lg object-cover border border-amber-400/40 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-[#093c31] border border-amber-400/30 flex items-center justify-center font-bold text-amber-300 font-serif text-xs shrink-0">
                                {user.name ? user.name.trim().split(/\s+/).slice(-2).map(n => n[0]).join('').toUpperCase() : 'GV'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{user.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#041d17] text-amber-300 border border-[#0e4438]">
                                  {user.code}
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-300/60 mt-0.5">
                                {user.phone || 'Chưa có SĐT'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-3 font-mono text-[11px] text-emerald-200">
                          {user.email}
                        </td>

                        {/* Department & Position */}
                        <td className="p-3">
                          <div className="font-medium text-emerald-300">{user.departmentName}</div>
                          <div className="text-[11px] text-amber-300/80">{user.position}</div>
                        </td>

                        {/* Role Selector */}
                        <td className="p-3">
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                            className="bg-[#041d17] border border-[#104b3e] rounded-lg px-2 py-1 text-[11px] font-bold text-amber-300 cursor-pointer focus:border-amber-400 focus:outline-none"
                          >
                            <option value="bgh">Ban Giám Hiệu</option>
                            <option value="ttcm">Tổ trưởng CM</option>
                            <option value="btd">Bí thư Đoàn</option>
                            <option value="gv">Giáo viên</option>
                          </select>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 text-center">
                          {isLocked ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <Lock className="w-3 h-3 text-rose-400" />
                                <span>ĐÃ TẠM KHÓA</span>
                              </span>
                              {user.lockedReason && (
                                <span
                                  className="text-[9px] text-rose-300/70 max-w-[140px] truncate mt-0.5"
                                  title={user.lockedReason}
                                >
                                  {user.lockedReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>HOẠT ĐỘNG</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Lock / Unlock Toggle Button */}
                            {isLocked ? (
                              <button
                                onClick={() => handleUnlockUser(user)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                title="Cấp lại quyền truy cập cho cán bộ này"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Mở khóa</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setLockTargetUser(user);
                                  setLockReason('Tạm ngưng quyền truy cập theo kế hoạch nhân sự nhà trường');
                                  setPresetReason('Nghỉ công tác / Chuyển trường');
                                }}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-600/40 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                title="Tạm khóa quyền truy cập của cán bộ này"
                              >
                                <Lock className="w-3.5 h-3.5 text-rose-400" />
                                <span>Khóa</span>
                              </button>
                            )}

                            {/* Reset Password Button */}
                            <button
                              onClick={() => {
                                if (window.confirm(`Gửi liên kết đặt lại mật khẩu tới ${user.email}?`)) {
                                  void handleSendResetEmail(user);
                                }
                              }}
                              disabled={isSubmitting || !user.email}
                              className="p-1.5 rounded-lg bg-[#072a23] hover:bg-[#0a382e] text-emerald-300 hover:text-amber-300 border border-[#0e4438] cursor-pointer"
                              title="Gửi liên kết đặt lại mật khẩu"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Profile Button */}
                            <button
                              onClick={() => {
                                onClose();
                                onEditStaffDetail(user);
                              }}
                              className="p-1.5 rounded-lg bg-[#072a23] hover:bg-[#0a382e] text-emerald-300 hover:text-white border border-[#0e4438] cursor-pointer"
                              title="Chỉnh sửa toàn diện hồ sơ cán bộ"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-emerald-400/60 text-xs">
                Không tìm thấy cán bộ nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-[#031713] border-t border-[#0e4438] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-emerald-300/70">
            Hiển thị <strong className="text-amber-300">{filteredUsers.length}</strong> / {users.length} tài khoản trong hệ thống
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] font-bold transition-colors cursor-pointer"
          >
            Đóng Giao Diện Quản Lý
          </button>
        </div>
      </div>

      {/* Lock Account Confirmation Dialog */}
      {lockTargetUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#05211b] border border-rose-500/50 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white font-serif">
                  Khóa Quyền Truy Cập Cán Bộ
                </h3>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Tài khoản bị khóa sẽ không thể đăng nhập hoặc xem dữ liệu chấm điểm thi đua
                </p>
              </div>
              <button
                onClick={() => setLockTargetUser(null)}
                className="text-emerald-400/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#041d17] p-3 rounded-2xl border border-[#0e4438] text-xs space-y-1">
              <div className="text-white font-bold">
                Cán bộ: <span className="text-amber-300">{lockTargetUser.name}</span> ({lockTargetUser.code})
              </div>
              <div className="text-emerald-300/70">Email: {lockTargetUser.email}</div>
              <div className="text-emerald-300/70">Tổ: {lockTargetUser.departmentName} - {lockTargetUser.position}</div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-white">Chọn lý do khóa tài khoản:</label>
              <select
                value={presetReason}
                onChange={e => handleSelectPreset(e.target.value)}
                className="w-full bg-[#041d17] border border-[#104b3e] rounded-xl px-3 py-2 text-xs text-white cursor-pointer"
              >
                {presetReasons.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <label className="font-bold text-white block mt-2">Nội dung lý do chi tiết:</label>
              <textarea
                value={lockReason}
                onChange={e => setLockReason(e.target.value)}
                rows={3}
                placeholder="Ghi rõ lý do khóa để lưu nhật ký hành chính..."
                className="w-full bg-[#041d17] border border-[#104b3e] rounded-xl p-3 text-xs text-white placeholder-emerald-400/40 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setLockTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-[#041d17] hover:bg-[#072a23] text-emerald-300 font-bold text-xs cursor-pointer border border-[#0e4438]"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmLock}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Khóa Truy Cập'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
