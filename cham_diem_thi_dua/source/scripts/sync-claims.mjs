import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [project, flag, ...extra] = process.argv.slice(2);
if (!project || !/^[a-z][a-z0-9-]+[a-z0-9]$/.test(project) || (flag && flag !== '--apply') || extra.length) {
  throw new Error('Cách dùng: npm run sync:claims -- <Firebase project ID> [--apply]');
}
const applying = flag === '--apply';
const app = initializeApp({ projectId: project });
const auth = getAuth(app);
const db = getFirestore(app);

try {
  const snapshot = await db.collection('users').get();
  const profiles = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const emailCounts = new Map();
  for (const profile of profiles) {
    const email = profile.email?.trim().toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  const pending = [];
  let skipped = 0;
  const legacy = profiles.filter(profile => 'customPassword' in profile || 'passwordUpdatedAt' in profile).length;
  for (const profile of profiles) {
    const email = profile.email?.trim().toLowerCase();
    if (!email || emailCounts.get(email) !== 1 || !['bgh', 'ttcm', 'btd', 'gv'].includes(profile.role) ||
        (profile.role === 'ttcm' && typeof profile.departmentId !== 'string')) {
      skipped++;
      continue;
    }
    let account;
    try { account = await auth.getUserByEmail(email); }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      skipped++;
      continue;
    }
    if (profile.authUid && profile.authUid !== account.uid) { skipped++; continue; }
    const current = account.customClaims ?? {};
    const departmentId = profile.role === 'ttcm' ? profile.departmentId : undefined;
    if (current.role === profile.role && current.staffId === profile.id && current.departmentId === departmentId) continue;
    const claims = { ...current, role: profile.role, staffId: profile.id };
    if (departmentId) claims.departmentId = departmentId;
    else delete claims.departmentId;
    pending.push({ uid: account.uid, claims });
  }

  console.log(`${project}: ${pending.length} tài khoản cần cấp lại quyền, ${skipped} hồ sơ cần đối chiếu, ${legacy} hồ sơ còn trường mật khẩu cũ.`);
  if (applying) {
    for (const { uid, claims } of pending) await auth.setCustomUserClaims(uid, claims);
    console.log(`Đã cập nhật quyền của ${pending.length} tài khoản Firebase Auth.`);
  } else {
    console.log('Chế độ kiểm tra. Thêm --apply khi đã duyệt dự án và danh sách hồ sơ.');
  }
} finally {
  await deleteApp(app);
}
