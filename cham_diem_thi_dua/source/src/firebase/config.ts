import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = [firebaseConfig.projectId, firebaseConfig.appId, firebaseConfig.apiKey,
  firebaseConfig.authDomain].every(value => typeof value === 'string' && value.trim() !== '');

const app = initializeApp(isFirebaseConfigured ? firebaseConfig : {
  projectId: 'demo-unconfigured', apiKey: 'unconfigured', appId: 'unconfigured',
});

const databaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
export const db = databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);
