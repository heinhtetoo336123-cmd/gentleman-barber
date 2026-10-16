/**
 * Service Worker Update Manager & Silent Auto-Update Lifecycle
 */

type UpdateCallback = (hasUpdate: boolean, updateFn: () => void) => void;

let updateListeners: UpdateCallback[] = [];
let waitingWorker: ServiceWorker | null = null;
let isUpdateAvailable = false;
let isRefreshing = false;

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
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Initializes proactive Service Worker Registration with silent automatic updates
 */
export async function initializePWAUpdateService(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Check if a service worker controller already controlled this page BEFORE registration
  const hadPreviousController = Boolean(navigator.serviceWorker.controller);

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // 1. If an updated worker is already waiting and there was a previous controller, trigger update
    if (registration.waiting && hadPreviousController) {
      waitingWorker = registration.waiting;
      isUpdateAvailable = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      notifyListeners();
    } else if (registration.waiting) {
      // First-time device load: activate silently without alerting user
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // 2. Listen for new service worker installation lifecycle
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          // Only flag as available update if this device was already running an older worker version
          if (navigator.serviceWorker.controller && hadPreviousController) {
            waitingWorker = newWorker;
            isUpdateAvailable = true;
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            notifyListeners();
          } else {
            // First install: activate silently
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      });
    });

    // 3. Handle controllerchange: Only notify if updating from an existing controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('ℹ️ Service Worker controller updated.');
      if (hadPreviousController && !isUpdateAvailable) {
        isUpdateAvailable = true;
        notifyListeners();
      }
    });

    // 4. Proactive Background Update Checks:
    // Check for SW updates on document visibility change (user re-opens PWA app from home screen or background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });

    // Check for SW updates when window regains focus
    window.addEventListener('focus', () => {
      registration.update().catch(() => {});
    });

    // Check for SW updates when internet connection is restored
    window.addEventListener('online', () => {
      registration.update().catch(() => {});
    });

    // Periodic check every 15 minutes
    setInterval(() => {
      registration.update().catch(() => {});
    }, 15 * 60 * 1000);

    // Initial check after 3 seconds to catch newly deployed bundles immediately
    setTimeout(() => {
      registration.update().catch(() => {});
    }, 3000);

    return registration;
  } catch (error) {
    console.warn('PWA update manager init error:', error);
    return null;
  }
}
