/**
 * Service Worker Update Manager & Version Lifecycle
 */

type UpdateCallback = (hasUpdate: boolean, updateFn: () => void) => void;

let updateListeners: UpdateCallback[] = [];
let waitingWorker: ServiceWorker | null = null;
let isUpdateAvailable = false;

export function subscribeToAppUpdates(callback: UpdateCallback): () => void {
  updateListeners.push(callback);
  if (isUpdateAvailable) {
    callback(true, triggerPWAUpdate);
  }
  return () => {
    updateListeners = updateListeners.filter((cb) => cb !== callback);
  };
}

function notifyListeners() {
  updateListeners.forEach((cb) => cb(isUpdateAvailable, triggerPWAUpdate));
}

export function triggerPWAUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    // If no waiting worker, reload to fetch newest network assets
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

/**
 * Initializes proactive Service Worker Registration with automatic update listeners
 */
export async function initializePWAUpdateService(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Check if there is already an updated worker waiting
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      isUpdateAvailable = true;
      notifyListeners();
    }

    // Listen for new service worker installation
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version is installed and waiting to activate
          waitingWorker = newWorker;
          isUpdateAvailable = true;
          notifyListeners();
        }
      });
    });

    // Handle controller change (when new SW takes over, reload to apply fresh bundles)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Check for updates on visibility change (e.g. user opens PWA app from home screen or background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });

    // Periodic check every 15 minutes
    setInterval(() => {
      registration.update().catch(() => {});
    }, 15 * 60 * 1000);

    return registration;
  } catch (error) {
    console.warn('PWA update manager init error:', error);
    return null;
  }
}
