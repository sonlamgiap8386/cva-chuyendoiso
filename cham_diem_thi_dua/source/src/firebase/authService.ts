import {
  EmailAuthProvider, getIdTokenResult, onAuthStateChanged, reauthenticateWithCredential,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';
import type { UserRole } from '../types';

interface AuthorizationClaims {
  role: UserRole;
  staffId: string;
  departmentId?: string;
}

export async function signIn(email: string, password: string) {
  if (!isFirebaseConfigured) {
    throw new Error('Chưa cấu hình Firebase cho môi trường này. Vui lòng liên hệ quản trị viên.');
  }
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function requestPasswordReset(email: string) {
  if (!isFirebaseConfigured) throw new Error('Chưa cấu hình Firebase.');
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function observeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function signOutUser() {
  return signOut(auth);
}

export async function getAuthorizationClaims(user: User): Promise<AuthorizationClaims | null> {
  const { claims } = await getIdTokenResult(user, true);
  const { role, staffId, departmentId } = claims;
  if ((role !== 'bgh' && role !== 'ttcm' && role !== 'btd' && role !== 'gv') ||
      typeof staffId !== 'string' || !staffId || staffId.includes('/')) return null;
  if (role === 'ttcm' && (typeof departmentId !== 'string' || !departmentId)) return null;
  return { role, staffId, departmentId: typeof departmentId === 'string' ? departmentId : undefined };
}

export async function changeCurrentPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}
