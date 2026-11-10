import { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  MonthlyScoreRecord,
  Department
} from '../types';
import { DEPARTMENT_SKELETON } from '../data/departments';
import { CURRENT_SCHOOL_YEAR } from '../data/constants';
import {
  canListStaff,
  fetchDepartmentsFromFirestore,
  subscribeToScores,
  subscribeToStaff,
  subscribeToRankings,
  type DataScope
} from '../firebase/firebaseService';

/** Chuyển lỗi Firebase kỹ thuật thành thông báo người dùng hiểu được. */
export function describeFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'Bạn không có quyền thực hiện thao tác này, hoặc dữ liệu đã được khóa/duyệt.';
  if (code === 'unavailable' || code === 'network-request-failed') return 'Mất kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  if (code === 'failed-precondition') return 'Truy vấn cần chỉ mục Firestore. Quản trị viên vui lòng xem console trình duyệt để tạo chỉ mục.';
  return (err as { message?: string })?.message || 'Lỗi không xác định.';
}

export interface FirebaseStatusState {
  connected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  teachersCount: number;
  scoresCount: number;
}

export function useFirebaseSync(
  currentUser: UserProfile | null,
  authReady: boolean,
  setBannerError?: (msg: string) => void
) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENT_SKELETON);
  const [scores, setScores] = useState<MonthlyScoreRecord[]>([]);
  const [publicRankings, setPublicRankings] = useState<MonthlyScoreRecord[]>([]);

  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatusState>({
    connected: false,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
    teachersCount: 0,
    scoresCount: 0,
  });

  const userId = currentUser?.id;
  const userRole = currentUser?.role;
  const userDepartmentId = currentUser?.departmentId;

  // Lắng nghe dữ liệu thời gian thực từ Firestore
  useEffect(() => {
    if (!authReady || !userId || !userRole) {
      setScores([]);
      setAllUsers([]);
      return;
    }

    const scope: DataScope = {
      role: userRole,
      staffId: userId,
      departmentId: userDepartmentId,
      year: CURRENT_SCHOOL_YEAR,
    };
    let cancelled = false;
    let scoresReady = false;
    let staffReady = !canListStaff(scope);
    const unsubscribers: Array<() => void> = [];

    setFirebaseStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    const markReady = () => {
      if (scoresReady && staffReady) {
        setFirebaseStatus(prev => ({
          ...prev,
          connected: true,
          isSyncing: false,
          lastSyncedAt: new Date(),
          error: null,
        }));
      }
    };

    const fail = (err: Error) => {
      if (cancelled) return;
      setFirebaseStatus(prev => ({
        ...prev,
        connected: false,
        isSyncing: false,
        error: describeFirebaseError(err),
      }));
    };

    unsubscribers.push(
      subscribeToScores(
        scope,
        records => {
          if (cancelled) return;
          setScores(records);
          scoresReady = true;
          setFirebaseStatus(prev => ({ ...prev, scoresCount: records.length }));
          markReady();
        },
        fail
      )
    );

    if (canListStaff(scope)) {
      unsubscribers.push(
        subscribeToStaff(
          scope,
          staff => {
            if (cancelled) return;
            setAllUsers(staff);
            staffReady = true;
            setFirebaseStatus(prev => ({ ...prev, teachersCount: staff.length }));
            markReady();
          },
          fail
        )
      );
    } else {
      // Giáo viên thường chỉ xem hồ sơ chính mình
      if (currentUser) setAllUsers([currentUser]);
    }

    fetchDepartmentsFromFirestore()
      .then(cloudDepartments => {
        if (!cancelled && cloudDepartments.length > 0) setDepartments(cloudDepartments);
      })
      .catch(err => console.warn('Không tải được danh sách tổ chuyên môn:', err));

    return () => {
      cancelled = true;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [authReady, userId, userRole, userDepartmentId, currentUser]);

  // Đăng ký bảng xếp hạng công khai cho tài khoản không phải BGH
  useEffect(() => {
    if (!authReady || !userId || !userRole || userRole === 'bgh') return;
    const unsubscribe = subscribeToRankings(
      CURRENT_SCHOOL_YEAR,
      setPublicRankings,
      err => {
        if (setBannerError) {
          setBannerError(`Không tải được bảng xếp hạng: ${describeFirebaseError(err)}`);
        }
      }
    );
    return () => {
      unsubscribe();
      setPublicRankings([]);
    };
  }, [authReady, userId, userRole, setBannerError]);

  // Tính toán số lượng thành viên và tổ trưởng
  const departmentsView = useMemo(() => {
    if (userRole !== 'bgh') return departments;
    return departments.map(dept => {
      const members = allUsers.filter(u => u.departmentId === dept.id);
      const leader = members.find(u => u.role === 'ttcm');
      return {
        ...dept,
        leaderId: leader?.id ?? dept.leaderId,
        leaderName: leader?.name ?? dept.leaderName,
        memberCount: members.length,
      };
    });
  }, [departments, allUsers, userRole]);

  return {
    allUsers,
    setAllUsers,
    departments,
    setDepartments,
    departmentsView,
    scores,
    setScores,
    publicRankings,
    firebaseStatus,
    setFirebaseStatus,
  };
}
