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

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true,
      },
      (firebaseConfig as any).firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  }
})();

export const auth = getAuth(app);
export const storage = null as any;
export { app };







