import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence non-fatal Firestore network handshake & connection retry messages
try {
  setLogLevel('silent');
} catch {}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Dedicated Firestore named database: barber-db with robust offline cache persistence
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, 'barber-db');
} catch (err) {
  try {
    firestoreInstance = getFirestore(app, 'barber-db');
  } catch (fallbackErr) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = null as any;
export { app };







