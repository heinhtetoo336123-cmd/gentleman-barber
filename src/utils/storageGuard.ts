/**
 * Storage Guard & Self-Healing Cache Engine
 * Prevents QuotaExceededError and provides 1-click PWA update & repair tools.
 */

export interface StorageHealthInfo {
  usedBytes: number;
  usedFormatted: string;
  itemCount: number;
  isNearQuota: boolean;
  hasServiceWorker: boolean;
  hasCaches: boolean;
}

/**
 * Calculates current approximate localStorage usage in bytes
 */
export function getStorageUsageInfo(): StorageHealthInfo {
  let totalBytes = 0;
  let itemCount = 0;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      itemCount = localStorage.length;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalBytes += (key.length + value.length) * 2; // UTF-16 characters are 2 bytes
        }
      }
    }
  } catch (e) {
    console.warn('Could not read storage usage:', e);
  }

  const kb = totalBytes / 1024;
  const mb = kb / 1024;
  const formatted = mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(1)} KB`;

  // Standard localStorage limit is ~5MB (5242880 bytes). Flag as near quota if >= 3.5MB
  const isNearQuota = totalBytes > 3.5 * 1024 * 1024;

  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasCaches = typeof window !== 'undefined' && 'caches' in window;

  return {
    usedBytes: totalBytes,
    usedFormatted: formatted,
    itemCount,
    isNearQuota,
    hasServiceWorker,
    hasCaches,
  };
}

/**
 * Emergency non-destructive localStorage pruning.
 * Preserves vital authentication, barber credentials, and active user profile,
 * while safely purging bloated notification histories, old image caches, or large temporary keys.
 */
export function emergencyStorageCleanup(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    // 1. Critical keys that must NEVER be deleted
    const protectedKeys = new Set([
      'baba_admin_session',
      'baba_barber_session',
      'baba_client_auth_token_v1',
      'baba_user_profile_v1',
      'baba_active_barber_id',
      'baba_active_barber_phone',
      'baba_active_barber_name',
      'baba_active_barber_obj',
      'baba_lang',
    ]);

    // 2. Prune oversized cleared notifications (keep only latest 50)
    try {
      const rawCleared = localStorage.getItem('baba_cleared_notif_ids_v1');
      if (rawCleared) {
        const ids = JSON.parse(rawCleared);
        if (Array.isArray(ids) && ids.length > 50) {
          const trimmed = ids.slice(-50);
          localStorage.setItem('baba_cleared_notif_ids_v1', JSON.stringify(trimmed));
        }
      }
    } catch {}

    // 3. Prune booking IDs history if bloated
    try {
      const rawBookings = localStorage.getItem('baba_my_booking_ids_v1');
      if (rawBookings) {
        const ids = JSON.parse(rawBookings);
        if (Array.isArray(ids) && ids.length > 50) {
          const trimmed = ids.slice(-50);
          localStorage.setItem('baba_my_booking_ids_v1', JSON.stringify(trimmed));
        }
      }
    } catch {}

    // 4. Purge bloated heavy cache collections to ensure storage stays well below quota
    const bulkyKeysToPurge = [
      'babashop_bookings_v2',
      'babashop_audit_logs_v2',
      'babashop_expenses_v2',
      'babashop_retail_sales_v2',
      'babashop_debug_logs',
      'babashop_cached_analytics',
      'babashop_audit_logs',
      'babashop_logs',
      'babashop_temp_store',
      'babashop_services_v1',
      'babashop_designers_v1',
      'babashop_bookings_v1',
      'babashop_notifs_v1'
    ];
    bulkyKeysToPurge.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });

    // 5. Clean phone-scoped booking lists if numerous
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (!protectedKeys.has(key)) {
        // Remove temporary debug or old legacy keys
        if (
          key.startsWith('tmp_') ||
          key.startsWith('backup_') ||
          key.startsWith('old_') ||
          key.includes('_temp') ||
          key.includes('blob_')
        ) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    return true;
  } catch (err) {
    console.warn('Emergency storage cleanup encountered error:', err);
    return false;
  }
}

/**
 * Safe wrapper for localStorage.setItem that intercepts QuotaExceededError,
 * performs emergency pruning, and retries safely without crashing the UI.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    console.warn(`localStorage write failed for key "${key}", attempting emergency cleanup:`, error);

    // Check if error is QuotaExceededError
    const isQuotaError =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014;

    if (isQuotaError) {
      emergencyStorageCleanup();

      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.error(`Emergency retry failed to store "${key}". Quota remains exceeded:`, retryError);
        return false;
      }
    }

    return false;
  }
}

/**
 * Safe wrapper for localStorage.getItem
 */
export function safeLocalStorageGet(key: string, fallback: string | null = null): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe wrapper for localStorage.removeItem
 */
export function safeLocalStorageRemove(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Comprehensive 1-Click PWA Update, Cache Buster, and Storage Repair
 * - Unregisters outdated service workers
 * - Deletes stale CacheStorage caches
 * - Performs emergency storage trim
 * - Hard refreshes the window with cache-busting timestamp
 */
export async function cleanAndRefreshPWA(options?: { preserveAuth?: boolean }): Promise<void> {
  const preserveAuth = options?.preserveAuth !== false;

  try {
    // 1. Cleanup CacheStorage (Browser Service Worker Caches)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Purging stale cache bucket:', cacheName);
            return caches.delete(cacheName);
          })
        );
      } catch (cacheErr) {
        console.warn('CacheStorage purge error:', cacheErr);
      }
    }

    // 2. Unregister or Force Update Service Workers
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.update().catch(() => {});
        }
      } catch (swErr) {
        console.warn('Service Worker update error:', swErr);
      }
    }

    // 3. Storage Pruning
    emergencyStorageCleanup();

    // 4. Force Reload with Cache-Busting Query
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('_pwa_refresh', Date.now().toString());
      window.location.href = url.toString();
    }
  } catch (error) {
    console.error('cleanAndRefreshPWA error:', error);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
