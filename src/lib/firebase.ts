import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence non-fatal Firestore network handshake & connection retry messages
try {
  setLogLevel('silent');
} catch {}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Dedicated Firestore named database: barber-db
export const db = getFirestore(app, 'barber-db');

// Legacy / Default database containing pre-existing bookings, services and staff
export const legacyDb = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const defaultDb = legacyDb;

export const auth = getAuth(app);
export const storage = null as any;
export { app };







