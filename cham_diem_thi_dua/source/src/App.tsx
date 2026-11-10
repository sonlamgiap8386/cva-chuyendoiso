import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { HelpCircle } from 'lucide-react';
import { ScoringGuideModal } from './components/ScoringGuideModal';

// These screens are only needed after navigation. Splitting them keeps the
// first dashboard render responsive, especially because reports includes XLSX.
const MonthlyScoringTable = lazy(() => import('./components/MonthlyScoringTable').then(({ MonthlyScoringTable }) => ({ default: MonthlyScoringTable })));
const ScoringModal = lazy(() => import('./components/ScoringModal').then(({ ScoringModal }) => ({ default: ScoringModal })));
const RealTimeLeaderboard = lazy(() => import('./components/RealTimeLeaderboard').then(({ RealTimeLeaderboard }) => ({ default: RealTimeLeaderboard })));
const CriteriaGuide = lazy(() => import('./components/CriteriaGuide').then(({ CriteriaGuide }) => ({ default: CriteriaGuide })));
const ReportsView = lazy(() => import('./components/ReportsView').then(({ ReportsView }) => ({ default: ReportsView })));
const CloudBackupView = lazy(() => import('./components/CloudBackupView').then(({ CloudBackupView }) => ({ default: CloudBackupView })));
const FutureModulesView = lazy(() => import('./components/FutureModulesView').then(({ FutureModulesView }) => ({ default: FutureModulesView })));
const StaffDirectory = lazy(() => import('./components/StaffDirectory').then(({ StaffDirectory }) => ({ default: StaffDirectory })));
const PushNotificationDrawer = lazy(() => import('./components/PushNotificationDrawer').then(({ PushNotificationDrawer }) => ({ default: PushNotificationDrawer })));
const LoginPage = lazy(() => import('./components/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })));
const ChangeOwnPasswordModal = lazy(() => import('./components/ChangeOwnPasswordModal').then(({ ChangeOwnPasswordModal }) => ({ default: ChangeOwnPasswordModal })));

const LoadingView = () => (
  <div className="py-12 text-center text-sm text-emerald-300">Đang tải dữ liệu…</div>
);

import {
  UserProfile,
  MonthlyScoreRecord,
  AppNotification,
  CloudBackup,
  CriterionItem,
  Department,
  UserRole
} from './types';
import { DEPARTMENT_SKELETON } from './data/departments';
import { SCHOOL_AVATAR, CURRENT_SCHOOL_YEAR, MONTHLY_BASE_SCORE } from './data/constants';
import { CRITERIA_LIST } from './data/criteria';
import {
  loadNotifications,
  saveNotifications,
  createCloudSnapshot,
  purgeLegacyStorage,
  MAX_LOCAL_BACKUPS,
} from './utils/storage';
import {
  canListStaff,
  saveStaffWithScores,
  saveDepartmentLeaders,
  deleteStaffFromFirestore,
  saveSingleScoreToFirestore,
  saveScoreFeedback,
  saveScoreReviewStates,
  publishRankings,
  fetchStaffById,
  observeStaffProfile,
  subscribeToCriteria,
  saveCriteria,
  type SharedCriteria,
} from './firebase/firebaseService';
import { useFirebaseSync, describeFirebaseError } from './hooks/useFirebaseSync';
import { isOfficialResult } from './utils/rankings';
import { getAuthorizationClaims, observeAuthState, signOutUser } from './firebase/authService';
import { SCHOOL_YEAR_MONTHS } from './utils/academicYear';

type Banner = { kind: 'error' | 'info'; text: string };

export default function App() {
  // Application state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [currentMonth, setCurrentMonth] = useState<number>(9);

  const setBannerError = useCallback((msg: string) => {
    setBanner({ kind: 'error', text: msg });
  }, []);

  // Firebase Live Sync & Data Hook
  const {
    allUsers,
    departments,
    setDepartments,
    departmentsView,
    scores,
    setScores,
    publicRankings,
    firebaseStatus,
    setFirebaseStatus,
  } = useFirebaseSync(currentUser, authReady, setBannerError);

  // Persistent data state
  const [backupSession, setBackupSession] = useState<{ owner: string; snapshots: CloudBackup[] } | null>(null);
  const [sharedCriteria, setSharedCriteria] = useState<SharedCriteria | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadNotifications());

  // UI state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedRecordToScore, setSelectedRecordToScore] = useState<MonthlyScoreRecord | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleLogout = async () => {
    await signOutUser();
    setBackupSession(null);
    setSelectedRecordToScore(null);
    setCurrentTab('overview');
    setCurrentUser(null);
    setBanner(null);
  };

  const reportSaveError = useCallback((action: string, err: unknown) => {
    console.error(`Lỗi khi ${action}:`, err);
    setBanner({ kind: 'error', text: `Không thể ${action}: ${describeFirebaseError(err)}` });
  }, []);

  useEffect(() => { purgeLegacyStorage(); }, []);

  // Công bố lại bảng xếp hạng công khai cho các tháng bị ảnh hưởng (chỉ BGH được ghi).
  const republishRankings = useCallback((months: number[]) => {
    if (currentUser?.role !== 'bgh' || months.length === 0) return;
    publishRankings(CURRENT_SCHOOL_YEAR, months)
      .catch(err => reportSaveError('công bố bảng xếp hạng (dùng nút Đồng bộ để công bố lại)', err));
  }, [currentUser?.role, reportSaveError]);

  useEffect(() => observeAuthState(async firebaseUser => {
    if (!firebaseUser) {
      setBackupSession(null);
      setCurrentUser(null);
      setAuthReady(true);
      return;
    }
    try {
      const claims = await getAuthorizationClaims(firebaseUser);
      const profile = claims ? await fetchStaffById(claims.staffId) : null;
      if (!claims || !profile) {
        throw new Error('Tài khoản chưa được cấp quyền truy cập hoặc không tìm thấy hồ sơ cán bộ. Vui lòng liên hệ quản trị viên.');
      }

      // Kiểm tra trạng thái khóa tài khoản do BGH thiết lập
      if (profile.status === 'locked') {
        const reason = profile.lockedReason ? ` (Lý do: ${profile.lockedReason})` : '';
        throw new Error(`Tài khoản "${profile.name}" (${profile.code}) đã bị Ban Giám Hiệu tạm khóa quyền truy cập${reason}. Vui lòng liên hệ BGH để được cấp lại quyền.`);
      }

      if (profile.role !== claims.role || (claims.role === 'ttcm' && profile.departmentId !== claims.departmentId)) {
        throw new Error('Quyền truy cập chưa khớp với hồ sơ. Vui lòng liên hệ quản trị viên và đăng nhập lại.');
      }
      setAuthNotice('');
      setCurrentUser(profile);
    } catch (err) {
      setAuthNotice(
        (err as { code?: string })?.code
          ? describeFirebaseError(err)
          : err instanceof Error ? err.message : 'Không thể xác thực tài khoản.'
      );
      await signOutUser().catch(console.error);
      setCurrentUser(null);
    } finally {
      setAuthReady(true);
    }
  }), []);

  const staffId = currentUser?.id;
  const staffRole = currentUser?.role;
  const staffDepartment = currentUser?.departmentId;
  useEffect(() => {
    if (!staffId) return;
    const endSession = (message: string) => {
      setAuthNotice(message);
      setCurrentUser(null);
      setBackupSession(null);
      setSelectedRecordToScore(null);
      setCurrentTab('overview');
      void signOutUser().catch(console.error);
    };
    const stopProfile = observeStaffProfile(staffId, profile => {
      if (!profile || profile.status === 'locked' || profile.role !== staffRole ||
          (staffRole === 'ttcm' && profile.departmentId !== staffDepartment)) {
        endSession('Quyền truy cập đã thay đổi hoặc tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
      }
    }, error => {
      if ((error as { code?: string }).code === 'permission-denied') endSession('Phiên làm việc đã hết quyền truy cập.');
    });
    const stopCriteria = subscribeToCriteria(setSharedCriteria, error => {
      setSharedCriteria(null);
      setBannerError(`Không tải được bộ tiêu chí: ${describeFirebaseError(error)}`);
    });
    return () => {
      stopProfile();
      stopCriteria();
      setSharedCriteria(null);
    };
  }, [staffId, staffRole, staffDepartment, setBannerError]);

  const handleSaveCriteria = async (items: CriterionItem[]) => {
    if (staffRole !== 'bgh' || !sharedCriteria) throw new Error('Chưa tải được bộ tiêu chí hoặc tài khoản không có quyền sửa.');
    await saveCriteria(items, sharedCriteria.revision);
  };

  // Firestore is the source of truth. Browser storage is never used as an offline
  // fallback for scores, because that would make unsaved changes look official.

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  // Tab titles
  const tabTitles: Record<NavTab, string> = {
    overview: 'Tổng quan tháng',
    scoring: 'Chấm điểm tháng',
    leaderboard: 'Bảng xếp hạng (Thời gian thực)',
    staff: 'Danh sách CBVC',
    criteria: 'Bộ tiêu chí thi đua',
    reports: 'Báo cáo & Xuất Excel',
    backup: 'Lưu trữ Firebase Cloud',
    modules: 'Module mở rộng',
  };

  const handlePerformBackup = (isAuto = false, description = 'Bản chụp điểm thủ công', snapshotScores = scores) => {
    if (currentUser?.role !== 'bgh') return;
    const owner = currentUser.id;
    const snapshot = createCloudSnapshot(snapshotScores, isAuto, description);
    setBackupSession(previous => ({
      owner,
      snapshots: [snapshot, ...(previous?.owner === owner ? previous.snapshots : [])].slice(0, MAX_LOCAL_BACKUPS),
    }));
  };

  const buildDrafts = (staff: UserProfile): MonthlyScoreRecord[] => SCHOOL_YEAR_MONTHS.map(month => ({
    id: `score-${staff.id}-${month}-${CURRENT_SCHOOL_YEAR}`,
    staffId: staff.id, staffName: staff.name, staffCode: staff.code,
    departmentId: staff.departmentId, departmentName: staff.departmentName, position: staff.position,
    month, year: CURRENT_SCHOOL_YEAR, baseScore: MONTHLY_BASE_SCORE,
    bonusItems: [], penaltyItems: [], totalBonus: 0, totalPenalty: 0,
    totalScore: MONTHLY_BASE_SCORE, status: 'draft',
  }));

  const handleSaveStaff = async (staff: UserProfile) => {
    if (currentUser?.role !== 'bgh') throw new Error('Tài khoản không có quyền cập nhật danh bạ.');
    if (staff.id === currentUser.id && (staff.role !== 'bgh' || staff.status === 'locked')) {
      throw new Error('Không thể khóa hoặc đổi quyền của tài khoản đang quản trị.');
    }
    const code = staff.code.trim().toUpperCase();
    const email = staff.email.trim().toLowerCase();
    if (allUsers.some(user => user.id !== staff.id &&
      (user.code.trim().toUpperCase() === code || (email && user.email.trim().toLowerCase() === email)))) {
      throw new Error('Mã CBVC hoặc email đã được sử dụng.');
    }
    const isNew = !allUsers.some(user => user.id === staff.id);
    const existing = scores.filter(score => score.staffId === staff.id);
    const canonicalStaff = { ...staff, code, email, avatar: SCHOOL_AVATAR };
    await saveStaffWithScores(canonicalStaff, existing, isNew ? buildDrafts(canonicalStaff) : []);
    republishRankings(existing.filter(isOfficialResult).map(score => score.month));
    markSaved();
    if (isNew) setBanner({ kind: 'info', text: 'Đã thêm hồ sơ. Cấp tài khoản và quyền trong Firebase Authentication theo README.' });
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (currentUser?.role !== 'bgh' || staffId === currentUser.id) throw new Error('Không thể xóa hồ sơ này.');
    await deleteStaffFromFirestore(staffId);
    republishRankings(scores.filter(score => score.staffId === staffId && isOfficialResult(score)).map(score => score.month));
    markSaved();
    setBanner({ kind: 'info', text: 'Đã xóa hồ sơ và điểm. Vô hiệu hóa tài khoản tương ứng trong Firebase Authentication nếu còn tồn tại.' });
  };

  const handleBatchImportStaff = async (incoming: UserProfile[]) => {
    if (currentUser?.role !== 'bgh') throw new Error('Tài khoản không có quyền nhập danh bạ.');
    const byCode = new Map<string, UserProfile>(allUsers.map(user => [user.code.trim().toUpperCase(), user]));
    const reservedEmails = new Map<string, string>(allUsers.filter(user => user.email).map(user => [user.email.trim().toLowerCase(), user.code.trim().toUpperCase()]));
    const fileCodes = new Set<string>();
    const plan = incoming.map(item => {
      const code = item.code.trim().toUpperCase();
      const email = item.email.trim().toLowerCase();
      if (fileCodes.has(code) || (email && reservedEmails.has(email) && reservedEmails.get(email) !== code)) {
        throw new Error(`Mã CBVC hoặc email bị trùng tại hồ sơ ${code}.`);
      }
      fileCodes.add(code);
      if (email) reservedEmails.set(email, code);
      const existing = byCode.get(code);
      const staff = existing
        ? { ...existing, name: item.name, position: item.position, departmentId: item.departmentId,
            departmentName: item.departmentName, email: email || existing.email, subject: item.subject ?? existing.subject,
            phone: item.phone ?? existing.phone, concurrentJob: item.concurrentJob ?? existing.concurrentJob,
            homeroomClass: item.homeroomClass ?? existing.homeroomClass,
            isHomeroomTeacher: item.homeroomClass ? true : existing.isHomeroomTeacher }
        : { ...item, code, email, role: 'gv' as const };
      return { staff, isNew: !existing, scores: scores.filter(score => score.staffId === staff.id) };
    });

    const affectedMonths: number[] = [];
    let committed = 0;
    try {
      for (const item of plan) {
        await saveStaffWithScores(item.staff, item.scores, item.isNew ? buildDrafts(item.staff) : []);
        affectedMonths.push(...item.scores.filter(isOfficialResult).map(score => score.month));
        committed++;
      }
    } catch (error) {
      throw new Error(`Đã lưu ${committed}/${plan.length} hồ sơ. ${describeFirebaseError(error)}`);
    } finally {
      republishRankings(affectedMonths);
      if (committed) markSaved();
    }
  };

  // Handler for Admin configuring Department Leaders (TTCM)
  const handleSaveDepartmentLeaders = async (leadersMap: { [departmentId: string]: string }) => {
    if (currentUser?.role !== 'bgh') throw new Error('Tài khoản không có quyền phân công tổ trưởng.');
    const leaders = Object.values(leadersMap).filter(Boolean);
    if (leaders.length !== new Set(leaders).size ||
        Object.entries(leadersMap).some(([departmentId, id]) => id && !allUsers.some(user =>
          user.id === id && user.role !== 'bgh' && user.status !== 'locked' && user.departmentId === departmentId))) {
      throw new Error('Mỗi tổ trưởng phải là cán bộ đang hoạt động trong đúng tổ chuyên môn.');
    }
    // 1. Update allUsers roles & positions
    const updatedUsers = allUsers.map(u => {
      // Check if user is appointed as leader for any department in the map
      const assignedDeptId = Object.keys(leadersMap).find(deptId => leadersMap[deptId] === u.id);
      if (assignedDeptId) {
        const targetDept = departments.find(d => d.id === assignedDeptId);
        return {
          ...u,
          role: 'ttcm' as UserRole,
          departmentId: assignedDeptId,
          departmentName: targetDept?.name || u.departmentName,
          position: u.position.includes('Tổ trưởng') ? u.position : 'Tổ trưởng chuyên môn'
        };
      } else if (u.role === 'ttcm') {
        // If this user was TTCM but is no longer assigned as TTCM for their department
        const isStillLeader = Object.values(leadersMap).includes(u.id);
        if (!isStillLeader) {
          return {
            ...u,
            role: 'gv' as UserRole,
            position: u.position.replace(/Tổ trưởng chuyên môn/gi, 'Giáo viên').replace(/^Tổ trưởng/gi, 'Giáo viên') || `Giáo viên ${u.subject || ''}`
          };
        }
      }
      return u;
    });

    // 2. Update departments state
    const updatedDepartments = departments.map(d => {
      const leaderId = leadersMap[d.id] || '';
      const leaderUser = updatedUsers.find(u => u.id === leaderId);
      const members = updatedUsers.filter(u => u.departmentId === d.id);
      return {
        ...d,
        leaderId,
        leaderName: leaderUser ? leaderUser.name : 'Chưa chỉ định',
        memberCount: members.length
      };
    });

    const originalUsers = new Set(allUsers);
    await saveDepartmentLeaders(updatedUsers.filter(user => !originalUsers.has(user)), updatedDepartments);
    setDepartments(updatedDepartments);

    // 4. Create system notification
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'Cập nhật phân quyền Tổ trưởng chuyên môn',
      message: 'Quản trị viên đã cập nhật phân quyền chấm điểm thi đua cho các Tổ chuyên môn.',
      timestamp: 'Vừa xong',
      type: 'system',
      targetRoles: ['bgh', 'ttcm', 'gv', 'btd'],
      read: false
    };
    setNotifications(prev => [notif, ...prev]);

    markSaved();
    setBanner({ kind: 'info', text: 'Đã lưu phân công. Đồng bộ quyền Firebase Auth theo README để áp dụng cho tài khoản tổ trưởng.' });
  };

  const markSaved = () => setFirebaseStatus(previous => ({ ...previous, lastSyncedAt: new Date() }));

  const handleSaveScoreRecord = async (record: MonthlyScoreRecord) => {
    await saveSingleScoreToFirestore(record);
    markSaved();
    if (isOfficialResult(record)) republishRankings([record.month]);
  };

  const handleSaveFeedback = async (id: string, feedback: string) => {
    await saveScoreFeedback(id, feedback);
    markSaved();
  };

  const applyReview = async (before: MonthlyScoreRecord[], after: MonthlyScoreRecord[], action: string) => {
    try {
      await saveScoreReviewStates(before, after);
      markSaved();
      republishRankings(after.filter(isOfficialResult).map(score => score.month));
      return true;
    } catch (error) {
      reportSaveError(action, error);
      return false;
    }
  };

  const approve = (record: MonthlyScoreRecord, reviewer: UserProfile, score: number, notes: string): MonthlyScoreRecord => ({
    ...record,
    status: 'approved',
    bghApprovedScore: score,
    bghNotes: notes,
    approvedBy: reviewer.id,
    approvedByName: reviewer.name,
    approvedAt: new Date().toLocaleString('vi-VN'),
  });

  const handleApproveRecord = (recordId: string, approvedScore?: number, note?: string) => {
    if (currentUser?.role !== 'bgh') return;
    const record = scores.find(score => score.id === recordId);
    if (!record || record.status === 'locked') return;
    void applyReview([record], [approve(record, currentUser, approvedScore ?? record.totalScore, note || 'BGH phê duyệt kết quả thi đua.')], 'duyệt hồ sơ');
  };

  const captureReviewSnapshot = (updated: MonthlyScoreRecord[], description: string) => {
    const byId = new Map(updated.map(score => [score.id, score]));
    handlePerformBackup(true, description, scores.map(score => byId.get(score.id) ?? score));
  };

  const handleApproveAll = async (month: number) => {
    if (currentUser?.role !== 'bgh') return;
    const before = scores.filter(score => score.month === month && score.status === 'submitted');
    if (!before.length) return;
    const after = before.map(score => approve(score, currentUser, score.totalScore, 'BGH duyệt theo đề xuất của Tổ chuyên môn.'));
    if (await applyReview(before, after, 'duyệt toàn bộ hồ sơ')) {
      captureReviewSnapshot(after, `Bản chụp sau khi BGH duyệt hồ sơ tháng ${month}`);
      setBanner({ kind: 'info', text: `Đã duyệt ${after.length} hồ sơ tháng ${month}.` });
    }
  };

  const handleSubmitToBgh = async (month: number, departmentId: string) => {
    if (currentUser?.role !== 'ttcm' || currentUser.departmentId !== departmentId) return;
    const before = scores.filter(score => score.month === month && score.departmentId === departmentId && score.status === 'draft');
    if (!before.length) return;
    const after = before.map((score): MonthlyScoreRecord => ({
      ...score,
      status: 'submitted',
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toLocaleString('vi-VN'),
    }));
    if (await applyReview(before, after, 'nộp bảng điểm')) {
      setBanner({ kind: 'info', text: `Đã gửi ${after.length} hồ sơ tháng ${month} cho BGH.` });
    }
  };

  const handleLockMonth = async (month: number) => {
    if (currentUser?.role !== 'bgh') return;
    const monthly = scores.filter(score => score.month === month);
    if (monthly.some(score => score.status === 'draft' || score.status === 'submitted')) {
      setBanner({ kind: 'error', text: `Tháng ${month} còn hồ sơ chưa được BGH duyệt. Hãy duyệt các hồ sơ trước khi khóa sổ.` });
      return;
    }
    const before = monthly.filter(score => score.status === 'approved');
    if (!before.length) return;
    const after = before.map((score): MonthlyScoreRecord => ({ ...score, status: 'locked' }));
    if (await applyReview(before, after, 'khóa sổ tháng')) {
      captureReviewSnapshot(after, `Bản chụp sau khi khóa sổ tháng ${month}`);
      setBanner({ kind: 'info', text: `Đã khóa ${after.length} hồ sơ tháng ${month}.` });
    }
  };

  // Notifications handlers
  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleSendReminder = (title: string, message: string) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      timestamp: 'Vừa xong',
      type: 'reminder',
      targetRoles: ['ttcm', 'gv'],
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // If user is not authenticated / logged out, show Login Portal
  if (!currentUser) {
    return (
      <Suspense fallback={<LoadingView />}>
        <LoginPage notice={authNotice} />
        {/* Floating Guide Button at bottom-right corner */}
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-950/60 border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer group"
            title="Nhấn để xem hướng dẫn cách chấm điểm và quy trình nộp điểm cho Ban Giám Hiệu"
          >
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950 group-hover:rotate-12 transition-transform" />
            <span className="font-sans">Hướng dẫn</span>
          </button>
        </div>
        <ScoringGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#031713] flex flex-col md:flex-row text-emerald-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        currentUser={currentUser}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header with Logout on Profile click */}
        <Header
          currentUser={currentUser}
          notifications={notifications}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          firebaseConnected={firebaseStatus.connected}
          firebaseSyncing={firebaseStatus.isSyncing}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                banner.kind === 'error'
                  ? 'border-rose-500/50 bg-rose-950/60 text-rose-200'
                  : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="shrink-0 rounded px-2 text-xs font-bold hover:bg-white/10 cursor-pointer"
                aria-label="Đóng thông báo"
              >
                Đóng
              </button>
            </div>
          )}
          {firebaseStatus.error && !firebaseStatus.connected && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-500/50 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
              Không tải được dữ liệu từ máy chủ: {firebaseStatus.error}
            </div>
          )}
          <Suspense fallback={<LoadingView />}>
          {currentTab === 'overview' && (
            <DashboardOverview
              scores={scores}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              currentUser={currentUser}
              onNavigate={setCurrentTab}
              onSelectRecordToScore={record => setSelectedRecordToScore(record)}
            />
          )}

          {currentTab === 'scoring' && (
            <MonthlyScoringTable
              scores={scores}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              currentUser={currentUser}
              departments={departmentsView}
              onSelectRecordToScore={record => setSelectedRecordToScore(record)}
              onApproveRecord={handleApproveRecord}
              onApproveAll={handleApproveAll}
              onSubmitToBgh={handleSubmitToBgh}
              onLockMonth={handleLockMonth}
            />
          )}

          {currentTab === 'leaderboard' && currentUser.role !== 'bgh' && (
            <div role="note" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
              Bảng xếp hạng công khai toàn trường, hiển thị kết quả đã được Ban Giám Hiệu duyệt hoặc khóa sổ.
            </div>
          )}
          {currentTab === 'leaderboard' && (
            <RealTimeLeaderboard
              scores={currentUser.role === 'bgh' ? scores : publicRankings}
              currentMonth={currentMonth}
              currentUser={currentUser}
              departments={departmentsView}
            />
          )}

          {currentTab === 'staff' && (
            <StaffDirectory
              users={allUsers}
              departments={departmentsView}
              scores={scores}
              currentMonth={currentMonth}
              currentUser={currentUser}
              onSaveStaff={handleSaveStaff}
              onDeleteStaff={handleDeleteStaff}
              onBatchImportStaff={handleBatchImportStaff}
              onSaveDepartmentLeaders={handleSaveDepartmentLeaders}
              isFirebaseSyncing={firebaseStatus.isSyncing}
              lastSyncedAt={firebaseStatus.lastSyncedAt}
            />
          )}

          {currentTab === 'criteria' && <CriteriaGuide currentUser={currentUser}
            criteria={sharedCriteria?.items ?? CRITERIA_LIST} canSave={Boolean(sharedCriteria)} onSave={handleSaveCriteria} />}

          {currentTab === 'reports' && (
            <ReportsView
              scores={scores}
              currentMonth={currentMonth}
              departments={departmentsView}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'backup' && currentUser.role === 'bgh' && (
            <CloudBackupView
              backups={backupSession?.owner === currentUser.id ? backupSession.snapshots : []}
              connected={firebaseStatus.connected}
              onSnapshot={() => handlePerformBackup()}
            />
          )}

          {currentTab === 'modules' && <FutureModulesView />}
          </Suspense>
        </main>

        {/* Mobile Navigation Bottom Bar */}
        <div className="md:hidden sticky bottom-0 z-30 bg-[#05211b] border-t border-[#0e4438] text-emerald-300 flex items-center justify-around px-2 py-2">
          {[
            { id: 'overview' as NavTab, label: 'Tổng quan' },
            { id: 'scoring' as NavTab, label: 'Chấm điểm' },
            { id: 'leaderboard' as NavTab, label: 'Xếp hạng' },
            { id: 'staff' as NavTab, label: 'Danh bạ' },
            { id: 'reports' as NavTab, label: 'Excel' },
            ...(currentUser.role === 'bgh' ? [{ id: 'backup' as NavTab, label: 'Sao lưu' }] : []),
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold cursor-pointer ${
                currentTab === item.id ? 'text-amber-400 font-extrabold' : 'hover:text-white'
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Scoring Modal */}
      {selectedRecordToScore && (
        <Suspense fallback={null}>
          <ScoringModal
            record={selectedRecordToScore}
            onClose={() => setSelectedRecordToScore(null)}
            onSave={handleSaveScoreRecord}
            onSaveFeedback={handleSaveFeedback}
            currentUser={currentUser}
            criteria={sharedCriteria?.items ?? CRITERIA_LIST}
            allScores={scores}
          />
        </Suspense>
      )}

      {/* Push Notification Drawer */}
      {isNotificationsOpen && (
        <Suspense fallback={null}>
          <PushNotificationDrawer
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onSendReminder={handleSendReminder}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isChangePasswordOpen && (
        <Suspense fallback={null}>
          <ChangeOwnPasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
        </Suspense>
      )}

      {/* Floating Guide Button at bottom-right corner */}
      <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-950/70 border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer group"
          title="Nhấn để xem hướng dẫn cách chấm điểm và quy trình nộp điểm cho Ban Giám Hiệu"
        >
          <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950 group-hover:rotate-12 transition-transform" />
          <span className="font-sans font-bold">Hướng dẫn</span>
        </button>
      </div>

      {/* Scoring and Process Guide Modal */}
      <ScoringGuideModal
        criteria={sharedCriteria?.items ?? CRITERIA_LIST}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
