import { loadEnv } from 'vite';

const project = process.argv[2];
if (!project) throw new Error('Cách dùng: npm run check:release -- <Firebase project ID>');

const env = loadEnv('production', process.cwd(), 'VITE_FIREBASE_');
const required = ['PROJECT_ID', 'APP_ID', 'API_KEY', 'AUTH_DOMAIN'];
const missing = required.filter(name => !env[`VITE_FIREBASE_${name}`]?.trim());
if (missing.length) throw new Error(`Thiếu cấu hình Firebase: ${missing.join(', ')}`);
if (env.VITE_FIREBASE_PROJECT_ID !== project) {
  throw new Error('Dự án của bản dựng khác dự án chỉ định để phát hành.');
}
if (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID && env.VITE_FIREBASE_FIRESTORE_DATABASE_ID !== '(default)') {
  throw new Error('firebase.json hiện triển khai quy tắc cho cơ sở dữ liệu (default).');
}
console.log(`Cấu hình bản dựng khớp dự án ${project}.`);
