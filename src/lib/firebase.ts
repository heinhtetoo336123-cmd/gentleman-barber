import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

const targetDbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

export const db = (() => {
  try {
    const firestoreSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: false
    };

    return targetDbId && targetDbId !== '(default)'
      ? initializeFirestore(app, firestoreSettings, targetDbId)
      : initializeFirestore(app, firestoreSettings);
  } catch (err) {
    console.warn('initializeFirestore fallback to getFirestore:', err);
    return targetDbId && targetDbId !== '(default)'
      ? getFirestore(app, targetDbId)
      : getFirestore(app);
  }
})();

export const auth = getAuth(app);
export const storage = null as any;
export { app };







