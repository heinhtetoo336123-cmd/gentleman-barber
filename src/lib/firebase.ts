import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = firebaseConfigJson.firestoreDatabaseId || undefined;

let db: any;

try {
  // Initialize Firestore with multi-tab persistent cache & auto-detect long polling fallback
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true
  }, dbId);
} catch (persistErr: any) {
  console.warn('Firestore persistent cache initialization warning:', persistErr);
  try {
    // Fallback: Use memory local cache (prevents QuotaExceededError or multi-tab locks in iOS standalone PWAs)
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true
    }, dbId);
  } catch (memErr) {
    try {
      db = getFirestore(app, dbId);
    } catch (fallbackErr) {
      db = getFirestore(app);
    }
  }
}

const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };

