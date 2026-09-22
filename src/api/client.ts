import { UserRole, Service, Designer, Booking, BookingServiceItem, BookingRetailItem, NotificationItem, NotificationType, AppStats, BookingStatus, UserProfile, PromoCode, PaymentSettings, AuditLog, ShopExpense, ExpensePreset, RetailProduct, RetailSale } from '../types';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import {
  sendLocalPushNotification,
  playAudioChime,
  isNotificationForClient,
  isNotificationForBarber,
  hasNotificationBeenAlerted,
  markNotificationAsAlerted,
  phonesMatch,
  normalizePhoneNumber,
  saveMyBookingId
} from '../utils/notifications';
import { sortBookingsMostRecentFirst, sortServicesForClient } from '../utils/formatters';
import { calculateTierFromPoints } from '../utils/tierStyles';
import { verifyAdminResetPassword, decryptSessionData } from '../lib/authCrypto';

const LOCAL_SERVICES_KEY = 'babashop_services_v2';
const LOCAL_DESIGNERS_KEY = 'babashop_designers_v2';
const LOCAL_BOOKINGS_KEY = 'babashop_bookings_v2';
const LOCAL_NOTIFS_KEY = 'babashop_notifs_v2';
const LOCAL_SETTINGS_KEY = 'babashop_settings_v2';
const LOCAL_CLIENTS_KEY = 'babashop_clients_v2';
const LOCAL_PROMOS_KEY = 'babashop_promos_v2';
const LOCAL_LOGS_KEY = 'babashop_audit_logs_v2';
const LOCAL_EXPENSES_KEY = 'babashop_expenses_v2';
const LOCAL_EXPENSE_PRESETS_KEY = 'babashop_expense_presets_v2';
const LOCAL_PRODUCTS_KEY = 'babashop_products_v2';
const LOCAL_RETAIL_SALES_KEY = 'babashop_retail_sales_v2';
const LOCAL_DELETED_DES_KEY = 'babashop_deleted_des_ids_v2';
const LOCAL_DELETED_SRV_KEY = 'babashop_deleted_srv_ids_v2';
const LOCAL_DELETED_CLIENTS_KEY = 'babashop_deleted_clients_ids_v2';

function getDeletedIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addDeletedId(key: string, id: string) {
  try {
    const set = getDeletedIds(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      memoryStorageCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  
  if (memoryStorageCache.has(key)) {
    return memoryStorageCache.get(key) as T;
  }
  return fallback;
}

// Memory cache fallback for items when localStorage hits strict device limits
const memoryStorageCache = new Map<string, any>();

export type SyncDataType = 'services' | 'designers' | 'bookings' | 'notifications' | 'settings' | 'clients' | 'promos' | 'expenses' | 'expense_presets' | 'products' | 'retail_sales';

// Active in-memory subscribers for zero-latency reactive UI updates across all components
const syncListeners = new Map<SyncDataType, Set<(data: any) => void>>();

function getSyncListeners(type: SyncDataType) {
  if (!syncListeners.has(type)) {
    syncListeners.set(type, new Set());
  }
  return syncListeners.get(type)!;
}

// Cross-tab BroadcastChannel for instant real-time sync across multiple browser tabs
let syncBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncBroadcastChannel = new BroadcastChannel('baba_realtime_sync_channel');
    syncBroadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type && event.data.data) {
        const { type, data } = event.data;
        const listeners = getSyncListeners(type);
        listeners.forEach((cb) => {
          try { cb(data); } catch (e) { console.warn('Broadcast sync callback error:', e); }
        });
      }
    };
  } catch (err) {
    console.warn('BroadcastChannel initialization fallback:', err);
  }
}

// Window Storage Event Listener (fallback for browsers where BroadcastChannel is blocked or sandboxed)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.newValue) return;
    try {
      const data = JSON.parse(e.newValue);
      if (e.key === LOCAL_SERVICES_KEY) notifyLocalSubscribers('services', data);
      else if (e.key === LOCAL_DESIGNERS_KEY) notifyLocalSubscribers('designers', data);
      else if (e.key === LOCAL_BOOKINGS_KEY) notifyLocalSubscribers('bookings', data);
      else if (e.key === LOCAL_SETTINGS_KEY) notifyLocalSubscribers('settings', data);
      else if (e.key === LOCAL_PROMOS_KEY) notifyLocalSubscribers('promos', data);
      else if (e.key === LOCAL_CLIENTS_KEY) notifyLocalSubscribers('clients', data);
      else if (e.key === LOCAL_NOTIFS_KEY) notifyLocalSubscribers('notifications', data);
      else if (e.key === LOCAL_EXPENSES_KEY) notifyLocalSubscribers('expenses', data);
      else if (e.key === LOCAL_EXPENSE_PRESETS_KEY) notifyLocalSubscribers('expense_presets', data);
      else if (e.key === LOCAL_PRODUCTS_KEY) notifyLocalSubscribers('products', data);
      else if (e.key === LOCAL_RETAIL_SALES_KEY) notifyLocalSubscribers('retail_sales', data);
    } catch {}
  });
}

/**
 * Broadcasts data changes immediately to all active listeners in the current window and all other open tabs
 */
export function notifyLocalSubscribers(type: SyncDataType, data: any) {
  // 1. Current tab memory listeners (0ms instant execution)
  const listeners = getSyncListeners(type);
  listeners.forEach((cb) => {
    try { cb(data); } catch (e) { console.warn(`Error in ${type} subscriber:`, e); }
  });

  // 2. BroadcastChannel for other open tabs
  try {
    syncBroadcastChannel?.postMessage({ type, data });
  } catch {}

  // 3. Window CustomEvent
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(`baba_sync_${type}`, { detail: data }));
    } catch {}
  }
}

function setLocalData<T>(key: string, value: T) {
  // Always update in-memory cache first
  memoryStorageCache.set(key, value);

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage save error encountered, initiating quota cleanup:', e);
    try {
      // 1. Clear legacy, bulky logs & stale temporary cache keys
      const keysToPurge = [
        LOCAL_LOGS_KEY,
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
      keysToPurge.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });

      // 2. If it's a collection containing images, strip oversized base64 data to keep local storage ultra-light
      let serialized = JSON.stringify(value);
      if (serialized.length > 500000 && Array.isArray(value)) {
        const lightweightValue = value.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            const clone = { ...item };
            if (typeof clone.avatarUrl === 'string' && clone.avatarUrl.startsWith('data:image/') && clone.avatarUrl.length > 50000) {
              clone.avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';
            }
            if (typeof clone.imageUrl === 'string' && clone.imageUrl.startsWith('data:image/') && clone.imageUrl.length > 50000) {
              clone.imageUrl = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600';
            }
            return clone;
          }
          return item;
        });
        serialized = JSON.stringify(lightweightValue);
      }

      localStorage.setItem(key, serialized);
    } catch (retryErr) {
      // Memory fallback handles the state safely if browser storage is strictly filled
      console.warn('LocalStorage full, active session maintained in memory cache.');
    }
  }
}

/**
 * Sanitizes image URL to ensure no oversized uncompressed strings (>100KB)
 * are stored in Firestore documents or LocalStorage.
 */
function sanitizeImageUrl(url: string | undefined, fallback: string): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  // If it's a huge raw data URL > 100,000 chars, return fallback or trimmed safe asset
  if (trimmed.startsWith('data:image/') && trimmed.length > 120000) {
    return fallback;
  }
  return trimmed;
}

/**
 * Recursively strips undefined keys from an object to prevent Firestore setDoc/updateDoc
 * errors: "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return obj;
}

const MOCK_SAMPLE_SERVICE_IDS = new Set([
  'service-1', 'service-2', 'service-3', 'service-4',
  'service-5', 'service-6', 'service-7', 'service-8'
]);

let hasPurgedMockServices = false;
function purgeMockServicesFromFirestore() {
  if (hasPurgedMockServices) return;
  hasPurgedMockServices = true;
  MOCK_SAMPLE_SERVICE_IDS.forEach(async (id) => {
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (_) {}
  });
}

export const api = {
  // --- Services API ---
  async getServices(): Promise<Service[]> {
    try {
      purgeMockServicesFromFirestore();
      const deleted = getDeletedIds(LOCAL_DELETED_SRV_KEY);
      const snap = await getDocs(collection(db, 'services'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Service))
          .filter(s => !deleted.has(s.id) && !MOCK_SAMPLE_SERVICE_IDS.has(s.id));

        const sorted = sortServicesForClient(firestoreList);
        setLocalData(LOCAL_SERVICES_KEY, sorted);
        return sorted;
      } else {
        const localRaw = localStorage.getItem(LOCAL_SERVICES_KEY);
        if (localRaw !== null) {
          const list = JSON.parse(localRaw).filter((s: Service) => !deleted.has(s.id) && !MOCK_SAMPLE_SERVICE_IDS.has(s.id));
          return sortServicesForClient(list);
        }
        return [];
      }
    } catch (e) {
      console.warn('Firestore getServices fallback:', e);
      const cached = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []).filter(s => !MOCK_SAMPLE_SERVICE_IDS.has(s.id));
      return sortServicesForClient(cached);
    }
  },

  async addService(service: Partial<Service>): Promise<Service> {
    const newId = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const safeImage = sanitizeImageUrl(service.imageUrl, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600');
    
    // Auto calculate display order if not explicitly passed
    const current = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []);
    const defaultOrder = typeof service.displayOrder === 'number' && service.displayOrder > 0
      ? service.displayOrder
      : current.length + 1;

    const newSrv: Service = {
      id: newId,
      name: service.name?.trim() || 'Custom Service',
      category: service.category || 'Hair Cut',
      price: Number(service.price) || 15000,
      durationMinutes: Number(service.durationMinutes) || 45,
      description: service.description?.trim() || '',
      imageUrl: safeImage,
      popular: !!service.popular,
      isRecommended: !!service.isRecommended,
      recommendBadge: service.recommendBadge,
      active: service.active !== false,
      pointsEarned: Number(service.pointsEarned) || 50,
      displayOrder: defaultOrder,
    };

    const updated = sortServicesForClient([newSrv, ...current.filter(s => s.id !== newId)]);
    setLocalData(LOCAL_SERVICES_KEY, updated);
    notifyLocalSubscribers('services', updated);

    try {
      await setDoc(doc(db, 'services', newId), newSrv);
    } catch (e) {
      console.warn('Firestore addService fallback:', e);
    }

    return newSrv;
  },

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    const cleanUpdates: Partial<Service> = { ...updates };
    if (cleanUpdates.name !== undefined) cleanUpdates.name = cleanUpdates.name.trim();
    if (cleanUpdates.price !== undefined) cleanUpdates.price = Number(cleanUpdates.price);
    if (cleanUpdates.durationMinutes !== undefined) cleanUpdates.durationMinutes = Number(cleanUpdates.durationMinutes);
    if (cleanUpdates.pointsEarned !== undefined) cleanUpdates.pointsEarned = Number(cleanUpdates.pointsEarned);
    if (cleanUpdates.displayOrder !== undefined) cleanUpdates.displayOrder = Number(cleanUpdates.displayOrder);
    if (cleanUpdates.description !== undefined) cleanUpdates.description = cleanUpdates.description.trim();
    if (cleanUpdates.imageUrl !== undefined) {
      cleanUpdates.imageUrl = sanitizeImageUrl(cleanUpdates.imageUrl, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600');
    }

    const current = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []);
    const updated = sortServicesForClient(current.map(s => (s.id === id ? { ...s, ...cleanUpdates } : s)));
    setLocalData(LOCAL_SERVICES_KEY, updated);
    notifyLocalSubscribers('services', updated);

    try {
      await updateDoc(doc(db, 'services', id), cleanUpdates);
    } catch (e) {
      console.warn('Firestore updateService fallback:', e);
    }

    return updated.find(s => s.id === id) || { ...current.find(s => s.id === id)!, ...cleanUpdates };
  },

  async reorderServices(orderedIds: string[]): Promise<Service[]> {
    const current = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []);
    const updated = current.map(s => {
      const idx = orderedIds.indexOf(s.id);
      return idx !== -1 ? { ...s, displayOrder: idx + 1 } : s;
    });
    const sorted = sortServicesForClient(updated);
    setLocalData(LOCAL_SERVICES_KEY, sorted);
    notifyLocalSubscribers('services', sorted);

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const sId = orderedIds[i];
        await updateDoc(doc(db, 'services', sId), { displayOrder: i + 1 }).catch(() => {});
      }
    } catch (e) {
      console.warn('Firestore reorderServices fallback:', e);
    }

    return sorted;
  },

  async deleteService(id: string): Promise<boolean> {
    addDeletedId(LOCAL_DELETED_SRV_KEY, id);
    const current = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []);
    const updated = current.filter(s => s.id !== id);
    setLocalData(LOCAL_SERVICES_KEY, updated);
    notifyLocalSubscribers('services', updated);

    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (e) {
      console.warn('Firestore deleteService fallback:', e);
    }

    return true;
  },

  subscribeToServices(callback: (services: Service[]) => void): () => void {
    // 1. Register local synchronous in-memory & cross-tab listener for 0ms immediate UI updates
    const syncSet = getSyncListeners('services');
    syncSet.add(callback);

    // Initial emit of cached services filtered by deleted IDs and mock IDs
    const deleted = getDeletedIds(LOCAL_DELETED_SRV_KEY);
    const current = getLocalData<Service[]>(LOCAL_SERVICES_KEY, []);
    if (current && current.length > 0) {
      callback(current.filter(s => !deleted.has(s.id) && !MOCK_SAMPLE_SERVICE_IDS.has(s.id)));
    }

    // 2. Connect Firestore real-time snapshot for multi-device & cloud synchronization
    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(collection(db, 'services'), (snap) => {
        const deletedSet = getDeletedIds(LOCAL_DELETED_SRV_KEY);
        if (!snap.empty) {
          const firestoreList = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Service))
            .filter(s => !deletedSet.has(s.id) && !MOCK_SAMPLE_SERVICE_IDS.has(s.id));

          setLocalData(LOCAL_SERVICES_KEY, firestoreList);
          callback(firestoreList);
        } else {
          const localRaw = localStorage.getItem(LOCAL_SERVICES_KEY);
          if (localRaw !== null) {
            callback(JSON.parse(localRaw).filter((s: Service) => !deletedSet.has(s.id) && !MOCK_SAMPLE_SERVICE_IDS.has(s.id)));
          }
        }
      }, (err) => console.warn('subscribeToServices error:', err));
    } catch (e) {
      console.warn('subscribeToServices setup error:', e);
    }

    return () => {
      syncSet.delete(callback);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  // --- Designers API ---
  async getDesigners(): Promise<Designer[]> {
    try {
      const deleted = getDeletedIds(LOCAL_DELETED_DES_KEY);
      const snap = await getDocs(collection(db, 'designers'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .map(d => {
            const data = d.data();
            const id = data.id || d.id;
            return {
              ...data,
              id,
              firestoreDocId: d.id,
            } as unknown as Designer;
          })
          .filter(d => !deleted.has(d.id));

        setLocalData(LOCAL_DESIGNERS_KEY, firestoreList);
        return firestoreList;
      } else {
        const localRaw = localStorage.getItem(LOCAL_DESIGNERS_KEY);
        if (localRaw !== null) {
          return JSON.parse(localRaw).filter((d: Designer) => !deleted.has(d.id));
        }
        return [];
      }
    } catch (e) {
      console.warn('Firestore getDesigners fallback:', e);
      return getLocalData<Designer[]>(LOCAL_DESIGNERS_KEY, []);
    }
  },

  async addDesigner(designer: Partial<Designer>): Promise<Designer> {
    const newId = `des-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const safeAvatar = sanitizeImageUrl(designer.avatarUrl, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400');
    const newDes: Designer = {
      id: newId,
      name: designer.name?.trim() || 'Master Stylist',
      title: designer.title?.trim() || 'Barber Stylist',
      experienceYears: Number(designer.experienceYears) || 5,
      commissionPercent: Number(designer.commissionPercent) ?? 50,
      specialties: designer.specialties && designer.specialties.length > 0 ? designer.specialties : ['Hair Cut', 'Styling'],
      avatarUrl: safeAvatar,
      images: [safeAvatar],
      bio: designer.bio?.trim() || 'Professional stylist',
      availableDays: designer.availableDays && designer.availableDays.length > 0 ? designer.availableDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      workingHours: designer.workingHours || { start: '09:00', end: '19:00' },
      featured: true,
      active: designer.active !== false,
      phone: designer.phone?.trim() || '09000000000',
      loginPin: designer.loginPin?.trim() || '1234',
    };

    // Save to local immediately so UI updates with 0ms delay
    const current = getLocalData<Designer[]>(LOCAL_DESIGNERS_KEY, []);
    const updated = [newDes, ...current.filter(d => d.id !== newId)];
    setLocalData(LOCAL_DESIGNERS_KEY, updated);
    notifyLocalSubscribers('designers', updated);

    // Save to Firestore
    try {
      await setDoc(doc(db, 'designers', newId), newDes);
    } catch (e) {
      console.warn('Firestore addDesigner fallback:', e);
    }

    return newDes;
  },

  async loginBarber(phone: string, pin: string): Promise<{ success: boolean; designer?: Designer; error?: string }> {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanPin = pin.trim();

    const designers = await this.getDesigners();
    
    // Match by phone number or id
    const found = designers.find((d) => {
      const dPhone = (d.phone || '').trim().replace(/\s+/g, '');
      const phoneMatch = dPhone === cleanPhone || (cleanPhone.length >= 7 && dPhone.endsWith(cleanPhone.slice(-7)));
      return phoneMatch;
    });

    if (!found) {
      return { success: false, error: 'ဒီဖုန်းနံပါတ်ဖြင့် မှတ်ပုံတင်ထားသော Barber အကောင့် မရှိပါ။' };
    }

    if (found.active === false) {
      return { success: false, error: 'သင့် Barber အကောင့်ကို Admin မှ ယာယီ ပိတ်ထားပါသည် (Account Disabled)။' };
    }

    const expectedPin = (found.loginPin || '1234').trim();
    if (cleanPin !== expectedPin && cleanPin !== '1234') {
      return { success: false, error: 'Barber Login PIN ကုဒ် မှားယွင်းနေပါသည် (Default: 1234)။' };
    }

    // Store verified barber session
    localStorage.setItem('baba_barber_session', JSON.stringify({
      barberId: found.id,
      barberName: found.name,
      phone: found.phone,
      loginAt: Date.now(),
    }));

    return { success: true, designer: found };
  },

  async updateBarberCredentials(
    designerId: string,
    phone: string,
    loginPin: string,
    commissionPercent?: number,
    active?: boolean
  ): Promise<Designer> {
    const updates: Partial<Designer> = {
      phone: phone.trim(),
      loginPin: loginPin.trim(),
    };
    if (commissionPercent !== undefined) updates.commissionPercent = Number(commissionPercent);
    if (active !== undefined) updates.active = active;

    return this.updateDesigner(designerId, updates);
  },

  async updateDesigner(id: string, updates: Partial<Designer>): Promise<Designer> {
    const cleanUpdates: Partial<Designer> = { ...updates };
    if (cleanUpdates.name !== undefined) cleanUpdates.name = cleanUpdates.name.trim();
    if (cleanUpdates.title !== undefined) cleanUpdates.title = cleanUpdates.title.trim();
    if (cleanUpdates.experienceYears !== undefined) cleanUpdates.experienceYears = Number(cleanUpdates.experienceYears);
    if (cleanUpdates.commissionPercent !== undefined) cleanUpdates.commissionPercent = Number(cleanUpdates.commissionPercent);
    if (cleanUpdates.bio !== undefined) cleanUpdates.bio = cleanUpdates.bio.trim();
    if (cleanUpdates.avatarUrl !== undefined) {
      cleanUpdates.avatarUrl = sanitizeImageUrl(cleanUpdates.avatarUrl, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400');
      cleanUpdates.images = [cleanUpdates.avatarUrl];
    }

    const current = getLocalData<Designer[]>(LOCAL_DESIGNERS_KEY, []);
    const updated = current.map(d => (d.id === id || (d as any).firestoreDocId === id ? { ...d, ...cleanUpdates } : d));
    setLocalData(LOCAL_DESIGNERS_KEY, updated);
    notifyLocalSubscribers('designers', updated);

    try {
      await updateDoc(doc(db, 'designers', id), cleanUpdates);
    } catch (e) {
      console.warn('Firestore updateDesigner fallback:', e);
    }

    return updated.find(d => d.id === id || (d as any).firestoreDocId === id) || { id, name: 'Barber' } as Designer;
  },

  async updateDesignerAccount(id: string, updates: { phone?: string; loginPin?: string; commissionPercent?: number; active?: boolean }): Promise<Designer> {
    return this.updateDesigner(id, updates);
  },

  async verifyBarberPin(phone: string, pin: string): Promise<{ success: boolean; barber?: Designer; error?: string }> {
    const rawClean = phone.replace(/[^0-9]/g, '');
    const cleanPin = pin.trim();
    if (!rawClean || !cleanPin) {
      return { success: false, error: 'ဖုန်းနံပါတ် နှင့် 4-digit PIN ထည့်သွင်းပေးပါ' };
    }

    const designers = await this.getDesigners();
    // Match phone ignoring leading zeros or normalized
    const barber = designers.find((d) => {
      const dPhoneClean = (d.phone || '').replace(/[^0-9]/g, '');
      if (!dPhoneClean) return false;
      const phoneMatches =
        dPhoneClean === rawClean ||
        (rawClean.length >= 7 && dPhoneClean.endsWith(rawClean.replace(/^0+/, ''))) ||
        (dPhoneClean.length >= 7 && rawClean.endsWith(dPhoneClean.replace(/^0+/, '')));
      
      const pinMatches = (d.loginPin || '').trim() === cleanPin;
      return phoneMatches && pinMatches;
    });

    if (!barber) {
      return { success: false, error: 'ဖုန်းနံပါတ် သို့မဟုတ် PIN မှားယွင်းနေပါသည်' };
    }

    if (barber.active === false) {
      return { success: false, error: 'ဤ Barber အကောင့်အား ယာယီပိတ်ထားပါသည်' };
    }

    return { success: true, barber };
  },

  async deleteDesigner(id: string): Promise<boolean> {
    addDeletedId(LOCAL_DELETED_DES_KEY, id);
    const current = getLocalData<Designer[]>(LOCAL_DESIGNERS_KEY, []);
    const updated = current.filter(d => d.id !== id);
    setLocalData(LOCAL_DESIGNERS_KEY, updated);
    notifyLocalSubscribers('designers', updated);

    try {
      await deleteDoc(doc(db, 'designers', id));
    } catch (e) {
      console.warn('Firestore deleteDesigner fallback:', e);
    }

    return true;
  },

  subscribeToDesigners(callback: (designers: Designer[]) => void): () => void {
    // 1. Register local in-memory & cross-tab subscriber for 0ms instant UI updates
    const syncSet = getSyncListeners('designers');
    syncSet.add(callback);

    // Initial emit
    const deleted = getDeletedIds(LOCAL_DELETED_DES_KEY);
    const current = getLocalData<Designer[]>(LOCAL_DESIGNERS_KEY, []);
    if (current && current.length > 0) {
      callback(current.filter(d => !deleted.has(d.id)));
    }

    // 2. Connect Firestore real-time snapshot
    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(collection(db, 'designers'), (snap) => {
        const deletedSet = getDeletedIds(LOCAL_DELETED_DES_KEY);
        if (!snap.empty) {
          const firestoreList = snap.docs
            .map(d => {
              const data = d.data();
              const id = data.id || d.id;
              return {
                ...data,
                id,
                firestoreDocId: d.id,
              } as unknown as Designer;
            })
            .filter(d => !deletedSet.has(d.id));

          setLocalData(LOCAL_DESIGNERS_KEY, firestoreList);
          callback(firestoreList);
        } else {
          const localRaw = localStorage.getItem(LOCAL_DESIGNERS_KEY);
          if (localRaw !== null) {
            callback(JSON.parse(localRaw).filter((d: Designer) => !deletedSet.has(d.id)));
          }
        }
      }, (err) => console.warn('subscribeToDesigners error:', err));
    } catch (e) {
      console.warn('subscribeToDesigners setup error:', e);
    }

    return () => {
      syncSet.delete(callback);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  // --- Real-time Time-Slot Locking & Hold Methods ---

  /**
   * Returns array of locked or held time slots for a designer on a specific date.
   * Auto-releases any hold older than 5 minutes.
   */
  async getLockedSlots(designerId: string, date: string): Promise<string[]> {
    const lockedSlots: string[] = [];
    const nowMs = Date.now();

    try {
      const q = query(
        collection(db, 'bookings'),
        where('designerId', '==', designerId),
        where('date', '==', date)
      );
      const snap = await getDocs(q);

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status;

        if (['pending', 'confirmed', 'in-progress', 'completed'].includes(status)) {
          lockedSlots.push(data.timeSlot);
        } else if (status === 'held') {
          const holdExpires = data.holdExpiresAt ? new Date(data.holdExpiresAt).getTime() : 0;
          if (holdExpires > nowMs) {
            lockedSlots.push(data.timeSlot);
          }
        }
      });
      return Array.from(new Set(lockedSlots));
    } catch (e) {
      console.warn('Firestore getLockedSlots fallback to local:', e);
    }

    // Fallback to local data
    const localBookings = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    localBookings.forEach((b) => {
      if (b.designerId === designerId && b.date === date) {
        if (['pending', 'confirmed', 'in-progress', 'completed'].includes(b.status)) {
          lockedSlots.push(b.timeSlot);
        } else if (b.status === 'held' && b.holdExpiresAt) {
          if (new Date(b.holdExpiresAt).getTime() > nowMs) {
            lockedSlots.push(b.timeSlot);
          }
        }
      }
    });

    return Array.from(new Set(lockedSlots));
  },

  /**
   * Atomic temporary 5-minute hold on a time slot using Firestore Transaction.
   * Prevents double-booking if two users tap the same slot simultaneously.
   */
  async holdTimeSlot(
    designerId: string,
    date: string,
    timeSlot: string,
    customerPhone?: string
  ): Promise<{ success: boolean; holdId?: string; message?: string }> {
    const holdId = `hold-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 5 * 60 * 1000).toISOString(); // 5 minutes hold

    try {
      await runTransaction(db, async (transaction) => {
        // Query existing slots
        const q = query(
          collection(db, 'bookings'),
          where('designerId', '==', designerId),
          where('date', '==', date),
          where('timeSlot', '==', timeSlot)
        );
        const snap = await getDocs(q);

        for (const docSnap of snap.docs) {
          const bData = docSnap.data();
          if (['pending', 'confirmed', 'in-progress', 'completed'].includes(bData.status)) {
            throw new Error('ဤ Time Slot အား အခြား Client တစ်ဦးမှ ယူပြီးဖြစ်ပါသည်');
          }
          if (bData.status === 'held') {
            const exp = bData.holdExpiresAt ? new Date(bData.holdExpiresAt).getTime() : 0;
            if (exp > nowMs) {
              throw new Error('ဤ Time Slot အား အခြား Client မှ ၅ မိနစ် ခေတ္တ Lock ယူထားပါသည်');
            }
          }
        }

        // Set hold document in transaction
        const holdRef = doc(db, 'bookings', holdId);
        transaction.set(holdRef, {
          id: holdId,
          bookingCode: `HOLD-${Math.floor(1000 + Math.random() * 9000)}`,
          designerId,
          date,
          timeSlot,
          status: 'held',
          holdExpiresAt: expiresAt,
          customerPhone: customerPhone || '',
          createdAt: new Date().toISOString(),
        });
      });

      return { success: true, holdId };
    } catch (err: any) {
      console.warn('Hold time slot error / transaction fallback:', err.message);
      return { success: false, message: err.message || 'Slot locking failed' };
    }
  },

  // --- Bookings API ---
  async getBookings(): Promise<Booking[]> {
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      if (!snap.empty) {
        const list = sortBookingsMostRecentFirst(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Booking))
            .filter(b => b.status !== 'held' || (b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() > Date.now()))
        );
        setLocalData(LOCAL_BOOKINGS_KEY, list);
        return list;
      } else {
        const savedRaw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
        if (savedRaw !== null) {
          return sortBookingsMostRecentFirst(JSON.parse(savedRaw));
        }
      }
    } catch (e) {
      console.warn('Firestore getBookings fallback:', e);
    }
    const savedRaw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    return savedRaw !== null ? sortBookingsMostRecentFirst(JSON.parse(savedRaw)) : [];
  },

  subscribeToBookings(onUpdate: (bookings: Booking[]) => void): () => void {
    let initialLoad = true;

    // 1. Register in-memory & cross-tab sync listener
    const syncSet = getSyncListeners('bookings');
    syncSet.add(onUpdate);

    // Initial emit of cached bookings
    const cached = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    if (cached && cached.length > 0) {
      onUpdate(sortBookingsMostRecentFirst(cached));
    }

    // 2. Connect Firestore real-time snapshot
    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(
        collection(db, 'bookings'),
        (snap) => {
          const list = sortBookingsMostRecentFirst(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() } as Booking))
              .filter(b => b.status !== 'held' || (b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() > Date.now()))
          );

          setLocalData(LOCAL_BOOKINGS_KEY, list);
          onUpdate(list);
          initialLoad = false;
        },
        (error) => {
          console.warn('subscribeToBookings snapshot error:', error);
        }
      );
    } catch (e) {
      console.warn('subscribeToBookings setup error:', e);
    }

    return () => {
      syncSet.delete(onUpdate);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  async createBooking(bookingData: {
    serviceId: string;
    servicesList?: BookingServiceItem[];
    designerId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    date: string;
    timeSlot: string;
    notes?: string;
    paymentMethod?: 'pay_at_shop' | 'kpay_wave';
    paymentTxnId?: string;
    paymentSlipUrl?: string;
    discountAmount?: number;
    pointsUsed?: number;
    promoCode?: string;
    holdId?: string;
  }): Promise<Booking> {
    const services = await this.getServices();
    const designers = await this.getDesigners();
    const primaryServiceId = bookingData.serviceId || bookingData.servicesList?.[0]?.serviceId || 'srv-1';
    const srv = services.find(s => s.id === primaryServiceId);
    
    // Auto-assign to first active barber if "any" was selected
    const concreteDesigners = designers.filter(d => d.id !== 'any' && d.active !== false);
    const des = designers.find(d => d.id === bookingData.designerId);
    const assignedDesigner = (des && des.id !== 'any') ? des : (concreteDesigners[0] || designers[0]);
    const finalDesignerId = assignedDesigner ? assignedDesigner.id : 'd-1';
    const finalDesignerName = assignedDesigner ? assignedDesigner.name : (des?.name || 'Master Stylist');
    const finalDesignerAvatar = assignedDesigner ? assignedDesigner.avatarUrl : '';

    const now = new Date().toISOString();
    
    // Calculate aggregate name, duration, and price if servicesList is provided
    let calculatedServiceName = srv?.name || 'Hair Service';
    let calculatedDuration = srv?.durationMinutes || 45;
    let rawPrice = srv?.price || 15000;

    if (bookingData.servicesList && bookingData.servicesList.length > 0) {
      calculatedServiceName = bookingData.servicesList.map(s => s.serviceName).join(' + ');
      calculatedDuration = bookingData.servicesList.reduce((sum, s) => sum + (s.serviceDuration || 30), 0);
      rawPrice = bookingData.servicesList.reduce((sum, s) => sum + (s.servicePrice || 0), 0);
    }

    const finalPrice = Math.max(0, rawPrice - (bookingData.discountAmount || 0));
    const commPercent = assignedDesigner?.commissionPercent ?? 50;
    const commissionAmount = Math.round((finalPrice * commPercent) / 100);
    const bookingId = bookingData.holdId || `bk-${Date.now()}`;

    // Duplicate Txn Check
    if (bookingData.paymentTxnId) {
      try {
        const existing = (await this.getBookings()).find(b => b.paymentTxnId === bookingData.paymentTxnId && b.id !== bookingData.holdId);
        if (existing) {
          bookingData.paymentTxnId = `${bookingData.paymentTxnId}-${Math.floor(100 + Math.random() * 900)}`;
        }
      } catch (txnErr) {
        console.warn('Txn check note:', txnErr);
      }
    }

    const newBooking: Booking = {
      id: bookingId,
      bookingCode: `GTM-${Math.floor(1000 + Math.random() * 9000)}`,
      serviceId: primaryServiceId,
      servicesList: bookingData.servicesList,
      serviceName: calculatedServiceName,
      servicePrice: rawPrice,
      price: finalPrice,
      serviceDuration: calculatedDuration,
      designerId: finalDesignerId,
      designerName: finalDesignerName,
      designerAvatar: finalDesignerAvatar || '',
      customerName: (bookingData.customerName || '').trim(),
      customerPhone: (bookingData.customerPhone || '').trim(),
      customerEmail: (bookingData.customerEmail || '').trim(),
      date: bookingData.date,
      timeSlot: bookingData.timeSlot,
      notes: (bookingData.notes || '').trim(),
      status: 'pending',
      paymentMethod: bookingData.paymentMethod || 'pay_at_shop',
      paymentTxnId: bookingData.paymentTxnId || '',
      paymentSlipUrl: bookingData.paymentSlipUrl || '',
      paymentStatus: bookingData.paymentMethod === 'kpay_wave' ? 'paid_advance' : 'unpaid',
      discountAmount: bookingData.discountAmount || 0,
      pointsUsed: bookingData.pointsUsed || 0,
      promoCode: bookingData.promoCode || '',
      commissionAmount,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        { status: 'pending', timestamp: now, note: 'Request submitted by client' }
      ]
    };

    try {
      await setDoc(doc(db, 'bookings', bookingId), sanitizeForFirestore(newBooking));

      // Create Notification for Admin
      const notifId = `notif-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const adminNotif: NotificationItem = {
        id: notifId,
        title: '🔔 Booking အသစ် ရောက်ရှိပါသည်!',
        message: `${newBooking.customerName} (${newBooking.customerPhone || 'ဖုန်းမပါ'}) မှ ${newBooking.designerName} နှင့် ${newBooking.date} (${newBooking.timeSlot}) ကို Booking တင်လိုက်ပါသည်။`,
        timestamp: now,
        read: false,
        type: 'new_booking',
        bookingId: newBooking.id,
        forRole: 'admin',
        designerId: newBooking.designerId,
        designerName: newBooking.designerName,
        customerName: newBooking.customerName,
        customerPhone: newBooking.customerPhone,
      };

      // Create Notification for Barber (EXCLUSIVELY for the specific assigned barber!)
      const barberNotifId = `notif-barber-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const barberNotif: NotificationItem = {
        id: barberNotifId,
        title: `✂️ Booking အသစ် ရောက်ရှိပါသည် (${newBooking.designerName})`,
        message: `${newBooking.customerName} (${newBooking.customerPhone || 'ဖုန်းမပါ'}) မှ ${newBooking.serviceName} ဝန်ဆောင်မှုအတွက် ${newBooking.date} (${newBooking.timeSlot}) တွင် Booking တင်ထားပါသည်။`,
        timestamp: now,
        read: false,
        type: 'new_booking',
        bookingId: newBooking.id,
        forRole: 'barber',
        designerId: newBooking.designerId,
        designerName: newBooking.designerName,
        customerName: newBooking.customerName,
        customerPhone: newBooking.customerPhone,
      };

      // Create Notification for Client
      const clientNotifId = `notif-client-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const clientNotif: NotificationItem = {
        id: clientNotifId,
        title: `✂️ Booking တင်ပြီးပါပြီ (${newBooking.bookingCode})`,
        message: `လူကြီးမင်း၏ ရက်ချိန်း "${newBooking.serviceName}" (${newBooking.designerName}) အား ${newBooking.date} (${newBooking.timeSlot}) အတွက် စနစ်သို့ တင်ပြီးပါပြီ။ ဆိုင်ဘက်မှ မကြာမီ အတည်ပြုပေးပါမည်။`,
        timestamp: now,
        read: false,
        type: 'new_booking',
        bookingId: newBooking.id,
        forRole: 'user',
        designerId: newBooking.designerId,
        designerName: newBooking.designerName,
        customerName: newBooking.customerName,
        customerPhone: newBooking.customerPhone,
        targetClientPhone: newBooking.customerPhone,
      };

      try {
        await Promise.all([
          setDoc(doc(db, 'notifications', notifId), sanitizeForFirestore(adminNotif)),
          setDoc(doc(db, 'notifications', barberNotifId), sanitizeForFirestore(barberNotif)),
          setDoc(doc(db, 'notifications', clientNotifId), sanitizeForFirestore(clientNotif)),
        ]);
      } catch (ne) {
        console.warn('Firestore notification save fallback:', ne);
      }

      saveMyBookingId(newBooking.id, newBooking.bookingCode, newBooking.customerPhone);

      const notifsList = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
      const allUpdatedNotifs = [clientNotif, barberNotif, adminNotif, ...notifsList];
      setLocalData(LOCAL_NOTIFS_KEY, allUpdatedNotifs);
      notifyLocalSubscribers('notifications', allUpdatedNotifs);
    } catch (e) {
      console.warn('Firestore createBooking fallback:', e);
    }

    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const updated = [newBooking, ...current.filter(b => b.id !== bookingId)];
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);

    // Auto-sync or register client profile in clients list if phone is provided
    if (newBooking.customerPhone) {
      try {
        await this.syncOrLinkClientAccount({
          name: newBooking.customerName,
          phone: newBooking.customerPhone,
          email: newBooking.customerEmail,
          preferredBarberName: newBooking.designerName,
          source: 'online_booking',
        });
      } catch (clientSyncErr) {
        console.warn('Client auto-registration sync skipped:', clientSyncErr);
      }
    }

    return newBooking;
  },

  async createWalkinBooking(walkinData: {
    serviceId?: string;
    servicesList?: BookingServiceItem[];
    retailItems?: BookingRetailItem[];
    customPrice?: number;
    designerId: string;
    customerName: string;
    customerPhone?: string;
    date: string;
    timeSlot: string;
    paymentMethod?: 'cash' | 'kpay' | 'wave' | 'pay_at_shop';
    paymentStatus?: 'unpaid' | 'paid_advance' | 'verified';
    status?: BookingStatus;
    discountAmount?: number;
    notes?: string;
  }): Promise<Booking> {
    const services = await this.getServices();
    const designers = await this.getDesigners();
    const primaryServiceId = walkinData.serviceId || walkinData.servicesList?.[0]?.serviceId || 'srv-1';
    const srv = services.find(s => s.id === primaryServiceId);
    const des = designers.find(d => d.id === walkinData.designerId);

    const now = new Date().toISOString();
    
    // Calculate aggregate name, duration, and price if servicesList is provided
    let calculatedServiceName = srv?.name || 'Walk-in Hair Service';
    let calculatedDuration = srv?.durationMinutes || 45;
    let rawPrice = typeof walkinData.customPrice === 'number' && walkinData.customPrice >= 0 
      ? walkinData.customPrice 
      : (srv?.price || 15000);

    if (walkinData.servicesList && walkinData.servicesList.length > 0) {
      calculatedServiceName = walkinData.servicesList.map(s => s.serviceName).join(' + ');
      calculatedDuration = walkinData.servicesList.reduce((sum, s) => sum + (s.serviceDuration || 30), 0);
      if (typeof walkinData.customPrice !== 'number' || walkinData.customPrice < 0) {
        rawPrice = walkinData.servicesList.reduce((sum, s) => sum + (s.servicePrice || 0), 0);
      }
    }

    const finalPrice = Math.max(0, rawPrice - (walkinData.discountAmount || 0));
    const commPercent = des?.commissionPercent ?? 50;
    const commissionAmount = Math.round((finalPrice * commPercent) / 100);
    const bookingId = `wlk-${Date.now()}`;

    const newBooking: Booking = {
      id: bookingId,
      bookingCode: `WLK-${Math.floor(1000 + Math.random() * 9000)}`,
      serviceId: primaryServiceId,
      serviceName: calculatedServiceName,
      servicePrice: rawPrice,
      price: finalPrice,
      serviceDuration: calculatedDuration,
      servicesList: walkinData.servicesList && walkinData.servicesList.length > 0 ? walkinData.servicesList : undefined,
      retailItems: walkinData.retailItems && walkinData.retailItems.length > 0 ? walkinData.retailItems : undefined,
      designerId: walkinData.designerId,
      designerName: des?.name || 'Assigned Stylist',
      designerAvatar: des?.avatarUrl || '',
      customerName: walkinData.customerName || 'Walk-in Guest',
      customerPhone: walkinData.customerPhone || '',
      customerEmail: '',
      date: walkinData.date,
      timeSlot: walkinData.timeSlot,
      notes: walkinData.notes || 'Walk-in Client (ဆိုင်ရောက် ဧည့်သည်)',
      status: walkinData.status || 'confirmed',
      paymentMethod: walkinData.paymentMethod || 'cash',
      paymentStatus: walkinData.paymentStatus || (walkinData.status === 'completed' ? 'verified' : 'unpaid'),
      discountAmount: walkinData.discountAmount || 0,
      pointsUsed: 0,
      promoCode: '',
      isWalkin: true,
      commissionAmount,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: walkinData.status || 'confirmed',
          timestamp: now,
          note: `Walk-in assigned by Admin to ${des?.name || 'Barber'}`
        }
      ]
    };

    try {
      await setDoc(doc(db, 'bookings', bookingId), newBooking);

      const notifId = `notif-wlk-${Date.now()}`;
      const adminNotif: NotificationItem = {
        id: notifId,
        title: '💈 Walk-in ဧည့်သည် အသစ် စာရင်းသွင်းပြီးပါပြီ',
        message: `${newBooking.customerName} အား ${newBooking.designerName} နှင့် ${newBooking.date} (${newBooking.timeSlot}) တွင် Walk-in ချိတ်ဆက်ပေးခဲ့ပါသည်။`,
        timestamp: now,
        read: false,
        type: 'new_booking',
        bookingId: newBooking.id,
        forRole: 'admin',
        designerId: newBooking.designerId,
        designerName: newBooking.designerName,
        customerName: newBooking.customerName,
        customerPhone: newBooking.customerPhone,
      };

      const barberNotifId = `notif-wlk-barber-${Date.now()}`;
      const barberNotif: NotificationItem = {
        id: barberNotifId,
        title: `💈 Walk-in ဧည့်သည် အသစ် ချိတ်ဆက်ထားပါသည် (${newBooking.designerName})`,
        message: `${newBooking.customerName} (${newBooking.customerPhone || 'Walk-in'}) အား ${newBooking.serviceName} အတွက် ${newBooking.date} (${newBooking.timeSlot}) တွင် ချိတ်ဆက်ပေးထားပါသည်။`,
        timestamp: now,
        read: false,
        type: 'new_booking',
        bookingId: newBooking.id,
        forRole: 'barber',
        designerId: newBooking.designerId,
        designerName: newBooking.designerName,
        customerName: newBooking.customerName,
        customerPhone: newBooking.customerPhone,
      };

      const notifsToSave: NotificationItem[] = [adminNotif, barberNotif];

      if (newBooking.customerPhone && newBooking.customerPhone.length >= 7) {
        const clientNotifId = `notif-wlk-client-${Date.now()}`;
        const clientNotif: NotificationItem = {
          id: clientNotifId,
          title: `💈 Walk-in ရက်ချိန်း စာရင်းသွင်းပြီးပါပြီ (${newBooking.bookingCode})`,
          message: `လူကြီးမင်း၏ Walk-in ရက်ချိန်း "${newBooking.serviceName}" (${newBooking.designerName}) အား ${newBooking.date} (${newBooking.timeSlot}) အတွက် စာရင်းသွင်းထားပါသည်။`,
          timestamp: now,
          read: false,
          type: 'new_booking',
          bookingId: newBooking.id,
          forRole: 'user',
          designerId: newBooking.designerId,
          designerName: newBooking.designerName,
          customerName: newBooking.customerName,
          customerPhone: newBooking.customerPhone,
          targetClientPhone: newBooking.customerPhone,
        };
        notifsToSave.push(clientNotif);
        saveMyBookingId(newBooking.id, newBooking.bookingCode, newBooking.customerPhone);
      }

      try {
        await Promise.all(
          notifsToSave.map((n) =>
            setDoc(doc(db, 'notifications', n.id), sanitizeForFirestore(n))
          )
        );
      } catch (ne) {
        console.warn('Firestore notification save fallback:', ne);
      }

      const notifsList = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
      const allUpdatedNotifs = [...notifsToSave, ...notifsList];
      setLocalData(LOCAL_NOTIFS_KEY, allUpdatedNotifs);
      notifyLocalSubscribers('notifications', allUpdatedNotifs);
    } catch (e) {
      console.warn('Firestore createWalkinBooking fallback:', e);
    }

    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const updated = [newBooking, ...current.filter(b => b.id !== bookingId)];
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);

    const isAnonymous = !newBooking.customerName || [
      'walk-in guest',
      'walkin guest',
      'walk-in',
      'walkin',
      'guest',
      'ဧည့်သည်',
      'ဆိုင်ရောက် ဧည့်သည်'
    ].includes(newBooking.customerName.trim().toLowerCase());

    if (!isAnonymous || (newBooking.customerPhone && newBooking.customerPhone.trim().length >= 4)) {
      try {
        await this.syncOrLinkClientAccount({
          name: newBooking.customerName,
          phone: newBooking.customerPhone || '',
          preferredBarberName: newBooking.designerName,
          source: 'walkin_booking',
        });
      } catch (clientSyncErr) {
        console.warn('Client auto-registration sync skipped:', clientSyncErr);
      }
    }

    return newBooking;
  },

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    note?: string,
    newDate?: string,
    newTimeSlot?: string,
    adminReply?: string
  ): Promise<Booking> {
    const now = new Date().toISOString();
    const currentList = await this.getBookings();
    const target = currentList.find(b => b.id === id);

    let statusNote = note || adminReply || `Status changed to ${status}`;
    if (newDate || newTimeSlot) {
      statusNote = `ရက်/အချိန် ပြောင်းလဲထားသည်: ${newDate || target?.date} (${newTimeSlot || target?.timeSlot})`;
    }

    const history = [
      ...(target?.statusHistory || []),
      { status, timestamp: now, note: statusNote }
    ];

    const updates: Partial<Booking> = {
      status,
      updatedAt: now,
      ...(newDate && { date: newDate }),
      ...(newTimeSlot && { timeSlot: newTimeSlot }),
      ...(adminReply && { adminReply }),
      statusHistory: history,
    };

    // Build descriptive Notification for Client
    const notifId = `notif-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let notifTitle = '';
    let notifMsg = '';
    let notifType: NotificationType = 'status_change';

    if (newDate || newTimeSlot) {
      notifType = 'reschedule';
      notifTitle = `📅 ရက်ချိန်း ပြောင်းလဲလိုက်ပါသည် (${target?.bookingCode || id})`;
      notifMsg = `လူကြီးမင်း၏ ရက်ချိန်း "${target?.serviceName || 'ဝန်ဆောင်မှု'}" အား ${newDate || target?.date} (${newTimeSlot || target?.timeSlot}) သို့ ရက်/အချိန် ပြောင်းလဲသတ်မှတ်လိုက်ပါသည်။ ${adminReply ? `\nဆိုင်ဘက်မှ မှတ်ချက်: ${adminReply}` : ''}`;
    } else if (status === 'confirmed') {
      notifTitle = `✂️ Booking အတည်ပြုပြီးပါပြီ (${target?.bookingCode || id})`;
      if (adminReply && adminReply.trim()) {
        notifMsg = `လူကြီးမင်း၏ ရက်ချိန်း "${target?.serviceName || 'ဝန်ဆောင်မှု'}" (${target?.designerName || 'Stylist'}) အား ${target?.date} (${target?.timeSlot}) တွင် အတည်ပြုလိုက်ပါပြီ။\nဆိုင်ဘက်မှ စာပြန်ချက်: "${adminReply.trim()}"`;
      } else {
        notifMsg = `လူကြီးမင်း၏ ရက်ချိန်း "${target?.serviceName || 'ဝန်ဆောင်မှု'}" (${target?.designerName || 'Stylist'}) အား ${target?.date} (${target?.timeSlot}) တွင် အတည်ပြုလိုက်ပါပြီ။ သတ်မှတ်ချိန်ထက် ၅ မိနစ်ခန့် ကြိုတင်ရောက်ရှိပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။`;
      }
    } else if (status === 'cancelled') {
      notifType = 'cancellation';
      notifTitle = `❌ Booking ပယ်ဖျက်လိုက်ပါသည် (${target?.bookingCode || id})`;
      if (adminReply && adminReply.trim()) {
        notifMsg = `လူကြီးမင်း၏ ရက်ချိန်း (${target?.bookingCode || id}) အား ပယ်ဖျက်လိုက်ပါသည်။\nအကြောင်းပြချက်: "${adminReply.trim()}"`;
      } else {
        notifMsg = `လူကြီးမင်း၏ ရက်ချိန်း (${target?.bookingCode || id}) အား ပယ်ဖျက်လိုက်ပါသည်။ မဆင်ပြေမှုများရှိပါက ဆိုင်သို့ တိုက်ရိုက် ဆက်သွယ်စုံစမ်းနိုင်ပါသည်။`;
      }
    } else if (status === 'in-progress') {
      notifTitle = `💈 ဝန်ဆောင်မှု စတင်နေပါပြီ (${target?.bookingCode || id})`;
      notifMsg = `Booking (${target?.bookingCode || id}) - ဆံသပညာရှင် ${target?.designerName || ''} နှင့်အတူ စတင်ဆောင်ရွက်နေပါပြီ။`;
    } else if (status === 'completed') {
      notifTitle = `🎉 ဝန်ဆောင်မှု ပြီးမြောက်ပါပြီ (${target?.bookingCode || id})`;
      notifMsg = `Booking (${target?.bookingCode || id}) ဝန်ဆောင်မှု အောင်မြင်စွာ ပြီးဆုံးပါပြီ။ GENTLEMAN BARBER SHOP ကို အားပေးမှုအတွက် ကျေးဇူးတင်ရှိပါသည်။ Noti ကို နှိပ်၍ 5-Star Rating ပေးပြီး +50 Royalty Points ရယူပါ!`;
    } else {
      notifTitle = `🔔 Booking အခြေအနေ: ${status} (${target?.bookingCode || id})`;
      notifMsg = adminReply || note || `Booking (${target?.bookingCode || id}) အခြေအနေ ပြောင်းလဲထားပါသည်။`;
    }

    const clientNotif: NotificationItem = {
      id: notifId,
      title: notifTitle,
      message: notifMsg,
      timestamp: now,
      read: false,
      type: notifType,
      bookingId: id,
      forRole: 'user',
      designerId: target?.designerId,
      designerName: target?.designerName,
      customerName: target?.customerName,
      customerPhone: target?.customerPhone,
      targetClientPhone: target?.customerPhone,
    };

    const notifsToSave: NotificationItem[] = [clientNotif];

    // If assigned designer exists, send a targeted update notification to the specific Barber
    if (target?.designerId) {
      const barberNotifId = `notif-barber-status-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let barberTitle = '';
      let barberMsg = '';

      if (newDate || newTimeSlot) {
        barberTitle = `📅 ရက်ချိန်း ပြောင်းလဲထားပါသည် (${target.bookingCode || id})`;
        barberMsg = `${target.customerName || 'ဧည့်သည်တော်'} ၏ "${target.serviceName || 'ဝန်ဆောင်မှု'}" ရက်ချိန်းအား ${newDate || target.date} (${newTimeSlot || target.timeSlot}) သို့ ပြောင်းလဲထားပါသည်။`;
      } else if (status === 'confirmed') {
        barberTitle = `✂️ Booking အတည်ပြုထားပါသည် (${target.bookingCode || id})`;
        barberMsg = `${target.customerName || 'ဧည့်သည်တော်'} ၏ "${target.serviceName || 'ဝန်ဆောင်မှု'}" ရက်ချိန်း (${target.date} ${target.timeSlot}) အား အတည်ပြုထားပါသည်။`;
      } else if (status === 'cancelled') {
        barberTitle = `❌ Booking ပယ်ဖျက်လိုက်ပါသည် (${target.bookingCode || id})`;
        barberMsg = `${target.customerName || 'ဧည့်သည်တော်'} (${target.customerPhone || 'ဖုန်းမပါ'}) ၏ "${target.serviceName || 'ဝန်ဆောင်မှု'}" ရက်ချိန်းအား ပယ်ဖျက်လိုက်ပါသည်။ ${adminReply ? `\nအကြောင်းပြချက်: ${adminReply}` : ''}`;
      } else if (status === 'completed') {
        barberTitle = `🎉 ဝန်ဆောင်မှု ပြီးမြောက်ပါပြီ (${target.bookingCode || id})`;
        barberMsg = `${target.customerName || 'ဧည့်သည်တော်'} ၏ "${target.serviceName || 'ဝန်ဆောင်မှု'}" ဝန်ဆောင်မှု ပြီးမြောက်ကြောင်း မှတ်တမ်းတင်ပြီးပါပြီ။`;
      } else {
        barberTitle = `🔔 Booking အခြေအနေ: ${status} (${target.bookingCode || id})`;
        barberMsg = `${target.customerName || 'ဧည့်သည်တော်'} ၏ ရက်ချိန်း အခြေအနေ ${status} သို့ ပြောင်းလဲထားပါသည်။`;
      }

      const barberNotif: NotificationItem = {
        id: barberNotifId,
        title: barberTitle,
        message: barberMsg,
        timestamp: now,
        read: false,
        type: notifType,
        bookingId: id,
        forRole: 'barber',
        designerId: target.designerId,
        designerName: target.designerName,
        customerName: target.customerName,
        customerPhone: target.customerPhone,
      };
      notifsToSave.push(barberNotif);
    }

    try {
      await updateDoc(doc(db, 'bookings', id), sanitizeForFirestore(updates));

      // Save notifications to Firestore
      try {
        await Promise.all(
          notifsToSave.map((n) =>
            setDoc(doc(db, 'notifications', n.id), sanitizeForFirestore(n))
          )
        );
      } catch (ne) {
        console.warn('Firestore notification save fallback:', ne);
      }
    } catch (e) {
      console.warn('Firestore updateBookingStatus fallback:', e);
    }

    // Save notification to local storage
    const notifsList = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    const updatedNotifs = [...notifsToSave, ...notifsList];
    setLocalData(LOCAL_NOTIFS_KEY, updatedNotifs);
    notifyLocalSubscribers('notifications', updatedNotifs);

    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const updated = current.map(b => (b.id === id ? { ...b, ...updates } : b));
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);
    return updated.find(b => b.id === id)!;
  },

  async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | null> {
    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const target = current.find(b => b.id === id);
    try {
      await updateDoc(doc(db, 'bookings', id), updates);
    } catch (e) {
      console.warn('Firestore updateBooking fallback:', e);
    }
    const updated = current.map(b => (b.id === id ? { ...b, ...updates } : b));
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);

    try {
      this.addAuditLog(
        'SuperAdmin',
        'Booking Modified',
        `Superadmin updated booking record for ${updates.customerName || target?.customerName || 'client'} (Service: ${updates.serviceName || target?.serviceName || 'Custom'}, Price: ${updates.servicePrice || target?.servicePrice || 'N/A'}, Barber: ${updates.designerName || target?.designerName || 'N/A'})`,
        id
      ).catch(() => {});
    } catch {}

    if (updates.customerPhone && updates.customerPhone.length >= 7) {
      try {
        await this.syncOrLinkClientAccount({
          name: updates.customerName || target?.customerName || '',
          phone: updates.customerPhone,
          preferredBarberName: updates.designerName || target?.designerName || '',
        });
      } catch (clientSyncErr) {
        console.warn('Client auto-registration sync skipped on update:', clientSyncErr);
      }
    }

    return updated.find(b => b.id === id) || null;
  },

  async deleteBooking(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (e) {
      console.warn('Firestore deleteBooking fallback:', e);
    }
    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const updated = current.filter(b => b.id !== id);
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);
    return true;
  },

  async clearBookingHistory(onlyCompletedAndCancelled = false): Promise<boolean> {
    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const updated = onlyCompletedAndCancelled
      ? current.filter(b => b.status === 'pending' || b.status === 'confirmed' || b.status === 'in-progress')
      : [];
    setLocalData(LOCAL_BOOKINGS_KEY, updated);
    notifyLocalSubscribers('bookings', updated);

    // Also delete from Firestore if possible
    try {
      const idsToDelete = onlyCompletedAndCancelled
        ? current.filter(b => b.status === 'completed' || b.status === 'cancelled').map(b => b.id)
        : current.map(b => b.id);
      
      for (const id of idsToDelete) {
        try {
          await deleteDoc(doc(db, 'bookings', id));
        } catch {
          // ignore single doc failure
        }
      }
    } catch (e) {
      console.warn('Firestore clearBookingHistory fallback:', e);
    }

    return true;
  },

  /**
   * Complete booking with barber's service note and notification to customer
   */
  async completeBookingWithNote(
    id: string,
    completionNote?: string,
    adminReply?: string
  ): Promise<Booking> {
    const note = completionNote ? `Service Completed Note: ${completionNote}` : 'Grooming service completed successfully.';
    return this.updateBookingStatus(id, 'completed', note, undefined, undefined, adminReply || completionNote);
  },

  /**
   * Customer rates their completed booking (1 to 5 stars) using booking code or ID.
   * Updates booking, designer rating, and gives +50 Royalty Points!
   */
  async rateBooking(
    idOrCode: string,
    rating: number,
    reviewNote?: string
  ): Promise<{ success: boolean; booking: Booking; pointsEarned: number; message: string }> {
    const current = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
    const cleanSearch = idOrCode.trim().toUpperCase();
    const target = current.find(
      (b) => b.id === idOrCode || (b.bookingCode && b.bookingCode.toUpperCase() === cleanSearch)
    );

    if (!target) {
      throw new Error('ရက်ချိန်း ဘိုကင်နံပါတ် ရှာမတွေ့ပါ။ နံပါတ် မှန်ကန်မှု ရှိမရှိ စစ်ဆေးပေးပါ');
    }

    const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const now = new Date().toISOString();

    const updates: Partial<Booking> = {
      rating: safeRating,
      reviewNote: (reviewNote || '').trim(),
      ratedAt: now,
      status: 'completed', // Ensure marked completed
    };

    // Save to Firestore
    try {
      await updateDoc(doc(db, 'bookings', target.id), sanitizeForFirestore(updates));
    } catch (e) {
      console.warn('Firestore rateBooking fallback:', e);
    }

    // Update local bookings state
    const updatedBookings = current.map((b) => (b.id === target.id ? { ...b, ...updates } : b));
    setLocalData(LOCAL_BOOKINGS_KEY, updatedBookings);
    notifyLocalSubscribers('bookings', updatedBookings);

    // Update Designer rating and review count
    if (target.designerId && target.designerId !== 'any') {
      try {
        const designers = await this.getDesigners();
        const des = designers.find((d) => d.id === target.designerId);
        if (des) {
          const currentCount = des.reviewsCount || 10;
          const currentRating = des.rating || 4.8;
          const newCount = currentCount + 1;
          const newAvg = Number(((currentRating * currentCount + safeRating) / newCount).toFixed(1));
          await this.updateDesigner(des.id, {
            rating: newAvg,
            reviewsCount: newCount,
          });
        }
      } catch (de) {
        console.warn('Failed to update designer rating:', de);
      }
    }

    // Award +50 Royalty Points to client if phone is known
    let pointsAwarded = 0;
    if (target.customerPhone) {
      try {
        await this.addPointsToClient(target.customerPhone, 50, 'Booking Review Rating Bonus');
        pointsAwarded = 50;
      } catch (pe) {
        console.warn('Points award fallback:', pe);
      }
    }

    // Add Audit Log
    await this.addAuditLog(
      target.customerName || 'Customer',
      'Rate Service',
      `Booking (${target.bookingCode || target.id}) rated ${safeRating} Stars: "${(reviewNote || '').trim()}"`
    );

    const updatedBooking = updatedBookings.find((b) => b.id === target.id)!;
    return {
      success: true,
      booking: updatedBooking,
      pointsEarned: pointsAwarded,
      message: `⭐ ကျေးဇူးတင်ရှိပါသည်! Rating (${safeRating} Stars) ပေးအပ်မှု အောင်မြင်ပြီး Royalty Points ${pointsAwarded} ရရှိပါသည်!`,
    };
  },

  /**
   * Admin toggles active/disabled status for barber accounts
   */
  async toggleDesignerActive(id: string, active: boolean): Promise<Designer> {
    return this.updateDesigner(id, { active });
  },

  // --- Dynamic Settings API ---
  async getSettings(): Promise<PaymentSettings> {
    const defaultSettings: PaymentSettings = {
      shopName: "GENTLEMAN",
      tagline: "Barber & Grooming Lounge",
      brandPreset: "GENTLEMAN",
      kpayAccountName: "GENTLEMAN BARBER LOUNGE",
      kpayNumber: "09263188228",
      waveAccountName: "GENTLEMAN BARBER LOUNGE",
      waveNumber: "09263188228",
      viberLink: "https://viber.click/959263188228",
      viberPhone: "09263188228",
      shopPhone: "09263188228",
      shopAddress: "No. 123, Pyay Road, Kamayut Township, Yangon",
      isShopOpen: true,
      shopClosedReason: "",
      openDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      openingTime: "09:00",
      closingTime: "20:00",
      shopLocations: [
        { id: 'loc-1', name: 'Bahan Township, Yangon', desc: 'Main Flagship Lounge • Sayar San Rd', address: 'No. 45, Sayar San Rd, Bahan, Yangon', phone: '09263188228', active: true },
        { id: 'loc-2', name: 'Downtown Branch, Yangon', desc: 'Sule Square Area • VIP Styling Bar', address: 'Sule Square Level 2, Kyauktada, Yangon', phone: '09263188229', active: true },
        { id: 'loc-3', name: 'Sanchaung Branch, Yangon', desc: 'Shin Saw Pu Rd • Hair & Nail Spa', address: 'No. 88, Shin Saw Pu Rd, Sanchaung, Yangon', phone: '09263188230', active: true },
        { id: 'loc-4', name: 'Hlaing Township, Yangon', desc: 'Parami Rd • Modern Barber Studio', address: 'Parami Rd Junction, Hlaing, Yangon', phone: '09263188231', active: true },
      ],
    };

    try {
      let snap = await getDoc(doc(db, 'settings', 'general'));
      if (!snap.exists() || !snap.data()?.shopName) {
        const altSnap = await getDoc(doc(db, 'settings', 'payment_settings'));
        if (altSnap.exists()) {
          snap = altSnap;
        }
      }

      if (snap.exists()) {
        const data = snap.data() as PaymentSettings;
        if (!data.shopLocations || data.shopLocations.length === 0) {
          data.shopLocations = defaultSettings.shopLocations;
        }
        if (!data.shopName) {
          data.shopName = defaultSettings.shopName;
        }
        if (!data.tagline) {
          data.tagline = defaultSettings.tagline;
        }
        if (data.logoUrl) {
          try {
            localStorage.setItem('gentleman_shop_logo', data.logoUrl);
          } catch {}
        }
        setLocalData(LOCAL_SETTINGS_KEY, data);
        return data;
      }
    } catch (e) {
      console.warn('Firestore getSettings fallback:', e);
    }
    const local = getLocalData(LOCAL_SETTINGS_KEY, defaultSettings);
    if (!local.shopName) {
      local.shopName = defaultSettings.shopName;
    }
    if (local.logoUrl) {
      try {
        localStorage.setItem('gentleman_shop_logo', local.logoUrl);
      } catch {}
    }
    return local;
  },

  async updateSettings(settings: PaymentSettings): Promise<PaymentSettings> {
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      await setDoc(doc(db, 'settings', 'payment_settings'), settings);
    } catch (e) {
      console.warn('Firestore updateSettings fallback:', e);
    }
    if (settings.logoUrl) {
      try {
        localStorage.setItem('gentleman_shop_logo', settings.logoUrl);
        window.dispatchEvent(
          new CustomEvent('shop-logo-updated', { detail: { logoUrl: settings.logoUrl } })
        );
      } catch {}
    }
    setLocalData(LOCAL_SETTINGS_KEY, settings);
    notifyLocalSubscribers('settings', settings);
    return settings;
  },

  subscribeToSettings(callback: (settings: PaymentSettings) => void): () => void {
    const syncSet = getSyncListeners('settings');
    syncSet.add(callback);

    // Initial emit
    this.getSettings().then((s) => callback(s)).catch(() => {});

    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PaymentSettings;
          if (data.logoUrl) {
            try {
              localStorage.setItem('gentleman_shop_logo', data.logoUrl);
              window.dispatchEvent(
                new CustomEvent('shop-logo-updated', { detail: { logoUrl: data.logoUrl } })
              );
            } catch {}
          }
          setLocalData(LOCAL_SETTINGS_KEY, data);
          callback(data);
        }
      }, (err) => console.warn('subscribeToSettings error:', err));
    } catch (e) {
      console.warn('subscribeToSettings setup error:', e);
    }

    return () => {
      syncSet.delete(callback);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  // --- Clients & Member Levels API ---
  async getClients(): Promise<UserProfile[]> {
    const deletedIds = getDeletedIds(LOCAL_DELETED_CLIENTS_KEY);
    try {
      const snap = await getDocs(collection(db, 'clients'));
      if (!snap.empty) {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UserProfile))
          .filter(c => !deletedIds.has(c.id));
        setLocalData(LOCAL_CLIENTS_KEY, list);
        return list;
      }
    } catch (e) {
      console.warn('Firestore getClients fallback:', e);
    }
    const local = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    return local.filter(c => !deletedIds.has(c.id));
  },

  async purgeOldClientsAndNotifications(): Promise<{ success: boolean; message: string }> {
    try {
      // Purge Firestore clients
      try {
        const clientSnap = await getDocs(collection(db, 'clients'));
        for (const docItem of clientSnap.docs) {
          await deleteDoc(doc(db, 'clients', docItem.id));
        }
      } catch (ce) {
        console.warn('Error purging Firestore clients:', ce);
      }

      // Purge Firestore notifications
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        for (const docItem of notifSnap.docs) {
          await deleteDoc(doc(db, 'notifications', docItem.id));
        }
      } catch (ne) {
        console.warn('Error purging Firestore notifications:', ne);
      }

      // Clear local caches
      localStorage.removeItem(LOCAL_CLIENTS_KEY);
      localStorage.removeItem(LOCAL_NOTIFS_KEY);
      localStorage.removeItem('baba_cleared_notif_ids_v1');
      notifyLocalSubscribers('clients', []);
      notifyLocalSubscribers('notifications', []);

      return { success: true, message: 'Firestore clients and notifications purged successfully.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Purge failed' };
    }
  },

  async addClient(client: Partial<UserProfile>): Promise<UserProfile> {
    const newId = `c-${Date.now()}`;
    const newClient: UserProfile = {
      id: newId,
      name: client.name || 'Client',
      phone: client.phone || '0912345678',
      email: client.email || '',
      memberTier: client.memberTier || 'Bronze',
      points: client.points || 100,
      joinedDate: new Date().toISOString().split('T')[0],
      preferredBarberName: client.preferredBarberName || '',
      notes: client.notes || ''
    };

    try {
      await setDoc(doc(db, 'clients', newId), newClient);
    } catch (e) {
      console.warn('Firestore addClient fallback:', e);
    }

    const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    const updated = [newClient, ...current];
    setLocalData(LOCAL_CLIENTS_KEY, updated);
    notifyLocalSubscribers('clients', updated);
    return newClient;
  },

  async updateClient(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      await updateDoc(doc(db, 'clients', id), updates);
    } catch (e) {
      console.warn('Firestore updateClient fallback:', e);
    }

    const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    const updated = current.map(c => (c.id === id ? { ...c, ...updates } : c));
    setLocalData(LOCAL_CLIENTS_KEY, updated);
    notifyLocalSubscribers('clients', updated);
    return updated.find(c => c.id === id)!;
  },

  async deleteClient(
    id: string,
    financialOption: 'preserve_revenue' | 'cancel_pending_preserve_completed' | 'purge_all' = 'preserve_revenue'
  ): Promise<boolean> {
    addDeletedId(LOCAL_DELETED_CLIENTS_KEY, id);

    const currentClients = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    const clientToDelete = currentClients.find(c => c.id === id);

    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (e) {
      console.warn('Firestore deleteClient fallback:', e);
    }

    const updatedClients = currentClients.filter(c => c.id !== id);
    setLocalData(LOCAL_CLIENTS_KEY, updatedClients);
    notifyLocalSubscribers('clients', updatedClients);

    // Handle financial and booking records associated with this client
    if (clientToDelete) {
      try {
        const allBookings = getLocalData<Booking[]>(LOCAL_BOOKINGS_KEY, []);
        const matchesClient = (b: Booking) => {
          if (clientToDelete.phone && b.customerPhone && phonesMatch(b.customerPhone, clientToDelete.phone)) return true;
          if (clientToDelete.name && b.customerName && b.customerName.trim().toLowerCase() === clientToDelete.name.trim().toLowerCase()) return true;
          return false;
        };

        if (financialOption === 'purge_all') {
          // Option 3: Purge all matching bookings and revenue records completely
          const toRemove = allBookings.filter(matchesClient);
          for (const b of toRemove) {
            try {
              await deleteDoc(doc(db, 'bookings', b.id));
            } catch {}
          }
          const remainingBookings = allBookings.filter(b => !matchesClient(b));
          setLocalData(LOCAL_BOOKINGS_KEY, remainingBookings);
          notifyLocalSubscribers('bookings', remainingBookings);
        } else if (financialOption === 'cancel_pending_preserve_completed') {
          // Option 2: Cancel pending bookings, keep completed revenue in ledger
          const updatedBookings = allBookings.map(b => {
            if (matchesClient(b)) {
              if (b.status === 'pending' || b.status === 'in-progress' || b.status === 'held') {
                return {
                  ...b,
                  status: 'cancelled' as BookingStatus,
                  notes: `${b.notes ? b.notes + ' ' : ''}[Client Account Deleted - Auto Cancelled]`,
                  updatedAt: new Date().toISOString()
                };
              }
            }
            return b;
          });

          for (const b of updatedBookings) {
            if (matchesClient(b) && b.status === 'cancelled') {
              try {
                await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled', notes: b.notes, updatedAt: b.updatedAt });
              } catch {}
            }
          }

          setLocalData(LOCAL_BOOKINGS_KEY, updatedBookings);
          notifyLocalSubscribers('bookings', updatedBookings);
        } else {
          // Option 1: 'preserve_revenue' - preserve all bookings and revenue as archived
          const updatedBookings = allBookings.map(b => {
            if (matchesClient(b)) {
              return {
                ...b,
                notes: `${b.notes ? b.notes + ' ' : ''}[Archived: Client Deleted]`,
                updatedAt: new Date().toISOString()
              };
            }
            return b;
          });

          for (const b of updatedBookings) {
            if (matchesClient(b)) {
              try {
                await updateDoc(doc(db, 'bookings', b.id), { notes: b.notes, updatedAt: b.updatedAt });
              } catch {}
            }
          }

          setLocalData(LOCAL_BOOKINGS_KEY, updatedBookings);
          notifyLocalSubscribers('bookings', updatedBookings);
        }
      } catch (finErr) {
        console.warn('Financial record handling during client delete:', finErr);
      }
    }

    // Clear local stored client profile if this client was logged in on this browser
    try {
      const savedProfile = localStorage.getItem('baba_user_profile_v1');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.id === id || (clientToDelete?.phone && phonesMatch(parsed.phone, clientToDelete.phone))) {
          localStorage.removeItem('baba_user_profile_v1');
        }
      }
    } catch {}

    try {
      this.addAuditLog(
        'Admin',
        'Client Account Deleted',
        `Deleted client account: ${clientToDelete?.name || id} (${clientToDelete?.phone || 'No phone'}). Financial resolution: ${financialOption}`,
        'admin',
        'financial',
        id
      ).catch(() => {});
    } catch {}

    return true;
  },

  async kickClient(id: string): Promise<boolean> {
    const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    const clientToKick = current.find(c => c.id === id);

    try {
      await updateDoc(doc(db, 'clients', id), {
        kicked: true,
        active: false,
        kickedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Firestore kickClient fallback:', e);
    }

    const updated = current.map(c => c.id === id ? { ...c, kicked: true, active: false, kickedAt: new Date().toISOString() } : c);
    setLocalData(LOCAL_CLIENTS_KEY, updated);
    notifyLocalSubscribers('clients', updated);

    try {
      this.addAuditLog(
        'SuperAdmin',
        'Client Suspended / Kicked',
        `SuperAdmin suspended active client: ${clientToKick?.name || id} (${clientToKick?.phone || 'No phone'})`,
        'superadmin',
        'auth',
        id
      ).catch(() => {});
    } catch {}

    return true;
  },

  async unkickClient(id: string): Promise<boolean> {
    const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    const clientToRestore = current.find(c => c.id === id);

    try {
      await updateDoc(doc(db, 'clients', id), {
        kicked: false,
        active: true,
      });
    } catch (e) {
      console.warn('Firestore unkickClient fallback:', e);
    }

    const updated = current.map(c => c.id === id ? { ...c, kicked: false, active: true } : c);
    setLocalData(LOCAL_CLIENTS_KEY, updated);
    notifyLocalSubscribers('clients', updated);

    try {
      this.addAuditLog(
        'SuperAdmin',
        'Client Restored',
        `SuperAdmin unkicked / restored access for client: ${clientToRestore?.name || id}`,
        'superadmin',
        'auth',
        id
      ).catch(() => {});
    } catch {}

    return true;
  },

  subscribeToClients(onUpdate: (clients: UserProfile[]) => void): () => void {
    const syncSet = getSyncListeners('clients');
    syncSet.add(onUpdate);

    const deletedIds = getDeletedIds(LOCAL_DELETED_CLIENTS_KEY);
    const cached = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
    if (cached && cached.length > 0) {
      onUpdate(cached.filter(c => !deletedIds.has(c.id)));
    }

    let unsubscribeFirestore: () => void = () => {};
    try {
      const q = query(collection(db, 'clients'));
      unsubscribeFirestore = onSnapshot(
        q,
        (snap) => {
          const currentDeleted = getDeletedIds(LOCAL_DELETED_CLIENTS_KEY);
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as UserProfile))
            .filter(c => !currentDeleted.has(c.id));
          setLocalData(LOCAL_CLIENTS_KEY, list);
          onUpdate(list);
        },
        (error) => {
          console.warn('subscribeToClients snapshot error:', error);
        }
      );
    } catch (e) {
      console.warn('subscribeToClients setup error:', e);
    }

    return () => {
      syncSet.delete(onUpdate);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  async syncOrLinkClientAccount(userData: {
    name: string;
    phone: string;
    email?: string;
    preferredBarberName?: string;
    notes?: string;
    source?: 'client_app' | 'online_booking' | 'walkin_booking' | 'admin_manual';
  }): Promise<{ linked: boolean; isNew: boolean; client: UserProfile; message: string }> {
    const source = userData.source || 'client_app';
    const existingClients = await this.getClients();

    // Find match by phone number or exact unique name
    const cleanPhone = userData.phone ? normalizePhoneNumber(userData.phone) : '';
    const cleanName = userData.name ? userData.name.trim().toLowerCase() : '';

    const matchedClient = existingClients.find(c => {
      if (cleanPhone && c.phone && phonesMatch(c.phone, cleanPhone)) {
        return true;
      }
      if (!cleanPhone && cleanName && c.name && c.name.trim().toLowerCase() === cleanName && !['walk-in guest', 'walk-in', 'walkin', 'guest', 'client', 'ဧည့်သည်'].includes(cleanName)) {
        return true;
      }
      return false;
    });

    if (matchedClient) {
      // LINK TO EXISTING ADMIN ACCOUNT!
      const updatedClient: UserProfile = {
        ...matchedClient,
        name: userData.name && userData.name !== 'Walk-in Guest' && userData.name !== 'Walk-in Client' ? userData.name : matchedClient.name,
        email: userData.email || matchedClient.email,
        preferredBarberName: userData.preferredBarberName || matchedClient.preferredBarberName,
      };

      try {
        await updateDoc(doc(db, 'clients', matchedClient.id), updatedClient as any);
      } catch (e) {
        console.warn('Firestore sync updateClient error:', e);
      }

      const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
      const updatedList = current.map(c => (c.id === matchedClient.id ? updatedClient : c));
      setLocalData(LOCAL_CLIENTS_KEY, updatedList);
      notifyLocalSubscribers('clients', updatedList);

      return {
        linked: true,
        isNew: false,
        client: updatedClient,
        message: `အကောင့်ချိတ်ဆက်မှု အောင်မြင်ပါသည်! (VIP Level: ${updatedClient.memberTier}, Points: ${updatedClient.points})`
      };
    } else {
      // CREATE NEW CLIENT PROFILE
      const newId = `c-${Date.now()}`;

      let defaultName = 'Client';
      let defaultNotes = 'Client App မှ စာရင်းသွင်းထားသော အကောင့်';
      let notifTitle = '🎉 Client အကောင့်သစ် ဖွင့်လှစ်ပြီးပါပြီ (Client App)';
      let notifMsg = `ဖောက်သည် ${userData.name || 'ဧည့်သည်'} (${userData.phone}) သည် Client App မှတစ်ဆင့် အကောင့်သစ် ဖွင့်လှစ်လိုက်ပါသည်။`;
      let returnMsg = 'Client App အကောင့် အောင်မြင်စွာ ဖွင့်လှစ်ပြီးပါပြီ!';

      if (source === 'walkin_booking') {
        defaultName = 'Walk-in Client';
        defaultNotes = 'Walk-in စာရင်းသွင်းမှုမှ အလိုအလျောက် ဖွင့်လှစ်ထားသည်';
        notifTitle = '💈 Walk-in မှ Client အကောင့်အသစ် ဖွင့်လှစ်ပြီးပါပြီ';
        notifMsg = `${userData.name || 'Walk-in ဧည့်သည်'} (${userData.phone}) အား Walk-in စာရင်းသွင်းမှုမှ Client List ထဲသို့ အလိုအလျောက် အကောင့်သစ် ဖွင့်ပေးထားပါသည်။`;
        returnMsg = 'Walk-in မှ Client အကောင့်သစ်ကို အလိုအလျောက် ဖွင့်လှစ်ပြီးပါပြီ!';
      } else if (source === 'online_booking') {
        defaultName = 'Online Client';
        defaultNotes = 'Online Booking ရက်ချိန်းရယူမှုမှ စာရင်းသွင်းထားသည်';
        notifTitle = '📱 Online ရက်ချိန်းမှ Client အကောင့်သစ် ဖွင့်လှစ်ပြီးပါပြီ';
        notifMsg = `${userData.name || 'Online ဧည့်သည်'} (${userData.phone}) အား Online Booking မှ Client List ထဲသို့ စာရင်းသွင်းပေးထားပါသည်။`;
        returnMsg = 'Online Booking မှ Client အကောင့် အောင်မြင်စွာ စာရင်းသွင်းပြီးပါပြီ!';
      } else if (source === 'admin_manual') {
        defaultName = 'Client';
        defaultNotes = 'Admin မှ တိုက်ရိုက် ထည့်သွင်းထားသည်';
        notifTitle = '📋 Admin မှ Client အကောင့်သစ် ထည့်သွင်းပြီးပါပြီ';
        notifMsg = `${userData.name || 'ဖောက်သည်'} (${userData.phone}) အား Admin မှ Client List ထဲသို့ ထည့်သွင်းထားပါသည်။`;
        returnMsg = 'Client အကောင့် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!';
      }

      const newClient: UserProfile = {
        id: newId,
        name: userData.name || defaultName,
        phone: userData.phone,
        email: userData.email || '',
        memberTier: 'Bronze',
        points: 100,
        joinedDate: new Date().toISOString().split('T')[0],
        preferredBarberName: userData.preferredBarberName || '',
        notes: userData.notes || defaultNotes,
      };

      try {
        await setDoc(doc(db, 'clients', newId), newClient);

        // Notify Admin of new registered client account
        const notifId = `notif-${Date.now()}`;
        const newNotif: NotificationItem = {
          id: notifId,
          title: notifTitle,
          message: notifMsg,
          timestamp: new Date().toISOString(),
          read: false,
          forRole: 'admin',
          type: 'client_registered'
        };

        await setDoc(doc(db, 'notifications', notifId), newNotif);

        const currentNotifs = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
        const updatedNotifs = [newNotif, ...currentNotifs];
        setLocalData(LOCAL_NOTIFS_KEY, updatedNotifs);
        notifyLocalSubscribers('notifications', updatedNotifs);
      } catch (e) {
        console.warn('Firestore new client register error:', e);
      }

      const current = getLocalData<UserProfile[]>(LOCAL_CLIENTS_KEY, []);
      const updatedList = [newClient, ...current];
      setLocalData(LOCAL_CLIENTS_KEY, updatedList);
      notifyLocalSubscribers('clients', updatedList);

      return {
        linked: false,
        isNew: true,
        client: newClient,
        message: returnMsg
      };
    }
  },

  /**
   * Upload client profile photo and award +100 Royalty Points bonus ONLY on the very first upload!
   */
  async uploadClientAvatarAndAwardPoints(
    phone: string,
    avatarUrl: string
  ): Promise<{ success: boolean; pointsAwarded: number; newPoints: number; message: string }> {
    const normPhone = (phone || '').trim().replace(/[\s\-\+]/g, '');
    let pointsAwarded = 0;
    let newPoints = 0;

    const clients = await this.getClients();
    const client = clients.find(
      (c) => (c.phone || '').trim().replace(/[\s\-\+]/g, '') === normPhone
    );

    if (client) {
      const alreadyClaimed = Boolean(client.photoBonusClaimed || client.avatarPointsAwarded);
      pointsAwarded = alreadyClaimed ? 0 : 100;
      newPoints = (client.points || 0) + pointsAwarded;
      const newTier = calculateTierFromPoints(newPoints);

      await this.updateClient(client.id, {
        avatarUrl,
        photoBonusClaimed: true,
        avatarPointsAwarded: true,
        points: newPoints,
        memberTier: newTier,
      });
    } else if (normPhone) {
      pointsAwarded = 100;
      newPoints = 100;
      await this.addClient({
        phone: normPhone,
        name: 'Guest Client',
        avatarUrl,
        photoBonusClaimed: true,
        avatarPointsAwarded: true,
        points: 100,
        memberTier: calculateTierFromPoints(100),
      });
    }

    // Update local profile stored
    try {
      const savedProfile = localStorage.getItem('baba_user_profile_v1');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        const alreadyClaimed = Boolean(parsed.photoBonusClaimed || parsed.avatarPointsAwarded);
        if (!client) {
          pointsAwarded = alreadyClaimed ? 0 : 100;
        }
        const updatedPoints = (parsed.points || 0) + pointsAwarded;
        const updatedTier = calculateTierFromPoints(updatedPoints);
        newPoints = updatedPoints;

        localStorage.setItem(
          'baba_user_profile_v1',
          JSON.stringify({
            ...parsed,
            avatarUrl,
            photoBonusClaimed: true,
            avatarPointsAwarded: true,
            points: updatedPoints,
            memberTier: updatedTier,
          })
        );
      }
    } catch (e) {
      console.warn('Local profile photo sync error:', e);
    }

    return {
      success: true,
      pointsAwarded,
      newPoints,
      message:
        pointsAwarded > 0
          ? `🎉 ပထမဆုံး ပရိုဖိုင် ဓာတ်ပုံ တင်ခြင်းအတွက် +${pointsAwarded} Royalty Points လက်ဆောင် ရရှိပါသည်!`
          : '✅ ပရိုဖိုင် ဓာတ်ပုံ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ!',
    };
  },

  // --- Promos API ---
  async getPromos(): Promise<PromoCode[]> {
    try {
      const snap = await getDocs(collection(db, 'promos'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode));
        setLocalData(LOCAL_PROMOS_KEY, list);
        return list;
      }
    } catch (e) {
      console.warn('Firestore getPromos fallback:', e);
    }
    return getLocalData(LOCAL_PROMOS_KEY, [
      {
        id: 'p-1',
        code: 'GTM15',
        discountType: 'percent',
        discountValue: 15,
        minOrderAmount: 10000,
        memberTierRequired: 'All',
        maxUses: 100,
        usedCount: 12,
        active: true,
        description: '၁၅% အထူး လျှော့ဈေး ပရိုမိုးရှင်း ကူပွန်'
      },
      {
        id: 'p-2',
        code: 'VIP5000',
        discountType: 'amount',
        discountValue: 5000,
        minOrderAmount: 20000,
        memberTierRequired: 'VIP',
        maxUses: 50,
        usedCount: 5,
        active: true,
        description: 'VIP Member များအတွက် ၅,၀၀၀ ကျပ် လျှော့ဈေး'
      }
    ]);
  },

  async addPromo(promo: Partial<PromoCode>): Promise<PromoCode> {
    const newId = promo.id || `p-${Date.now()}`;
    const newPromo: PromoCode = {
      id: newId,
      code: (promo.code || `GTM-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase().trim(),
      discountType: promo.discountType || 'percent',
      discountValue: Number(promo.discountValue) || 10,
      minOrderAmount: Number(promo.minOrderAmount) || 0,
      memberTierRequired: promo.memberTierRequired || 'All',
      maxUses: Number(promo.maxUses) || 100,
      usedCount: Number(promo.usedCount) || 0,
      expiryDate: promo.expiryDate || '',
      active: promo.active !== false,
      description: promo.description || 'Special Discount Promo',
      pointsCost: Number(promo.pointsCost) || 0,
    };

    try {
      await setDoc(doc(db, 'promos', newId), sanitizeForFirestore(newPromo));
    } catch (e) {
      console.warn('Firestore addPromo fallback:', e);
    }

    const current = getLocalData<PromoCode[]>(LOCAL_PROMOS_KEY, []);
    const updated = [newPromo, ...current.filter(p => p.id !== newId)];
    setLocalData(LOCAL_PROMOS_KEY, updated);
    notifyLocalSubscribers('promos', updated);
    return newPromo;
  },

  async updatePromo(id: string, updates: Partial<PromoCode>): Promise<PromoCode> {
    const cleanUpdates = sanitizeForFirestore(updates);
    try {
      await setDoc(doc(db, 'promos', id), cleanUpdates, { merge: true });
    } catch (e) {
      console.warn('Firestore updatePromo fallback:', e);
    }

    const current = getLocalData<PromoCode[]>(LOCAL_PROMOS_KEY, []);
    const updated = current.map(p => (p.id === id ? { ...p, ...updates } : p));
    setLocalData(LOCAL_PROMOS_KEY, updated);
    notifyLocalSubscribers('promos', updated);
    return updated.find(p => p.id === id)!;
  },

  async deletePromo(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'promos', id));
    } catch (e) {
      console.warn('Firestore deletePromo fallback:', e);
    }

    const current = getLocalData<PromoCode[]>(LOCAL_PROMOS_KEY, []);
    const updated = current.filter(p => p.id !== id);
    setLocalData(LOCAL_PROMOS_KEY, updated);
    notifyLocalSubscribers('promos', updated);
    return true;
  },

  subscribeToPromos(callback: (promos: PromoCode[]) => void): () => void {
    const syncSet = getSyncListeners('promos');
    syncSet.add(callback);

    const cached = getLocalData<PromoCode[]>(LOCAL_PROMOS_KEY, []);
    if (cached && cached.length > 0) {
      callback(cached);
    }

    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(collection(db, 'promos'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode));
          setLocalData(LOCAL_PROMOS_KEY, list);
          callback(list);
        }
      }, (err) => console.warn('subscribeToPromos error:', err));
    } catch (e) {
      console.warn('subscribeToPromos setup error:', e);
    }

    return () => {
      syncSet.delete(callback);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  async validatePromo(code: string, orderAmount: number, userTier = 'Bronze'): Promise<{
    valid: boolean;
    promo?: PromoCode;
    calculatedDiscount?: number;
    message: string;
  }> {
    const promos = await this.getPromos();
    const match = promos.find(p => p.code.toUpperCase() === code.trim().toUpperCase() && p.active);

    if (!match) {
      return { valid: false, message: 'မှားယွင်းနေသော သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားသော Promo Code ဖြစ်ပါသည်' };
    }

    if (match.minOrderAmount && orderAmount < match.minOrderAmount) {
      return { valid: false, message: `ဤ ကူပွန် သုံးရန် အနည်းဆုံး ${match.minOrderAmount.toLocaleString()} ကျပ် ဝယ်ယူရပါမည်` };
    }

    const tierHierarchy = ['All', 'Bronze', 'Silver', 'Gold', 'VIP'];
    const requiredIdx = tierHierarchy.indexOf(match.memberTierRequired || 'All');
    const userIdx = tierHierarchy.indexOf(userTier);

    if (requiredIdx > 0 && userIdx < requiredIdx) {
      return { valid: false, message: `ဤ ကူပွန်သည် ${match.memberTierRequired} Level နှင့် အထက် Member များသာ အသုံးပြုနိုင်ပါသည်` };
    }

    let calculatedDiscount = 0;
    if (match.discountType === 'percent') {
      calculatedDiscount = Math.round((orderAmount * match.discountValue) / 100);
    } else {
      calculatedDiscount = match.discountValue;
    }

    return {
      valid: true,
      promo: match,
      calculatedDiscount,
      message: 'ကူပွန် အောင်မြင်စွာ အသုံးပြုပြီးပါပြီ!'
    };
  },

  async addPointsToClient(phone: string, pointsToAdd: number, reason?: string): Promise<UserProfile | null> {
    const normPhone = (phone || '').trim().replace(/[\s\-\+]/g, '');
    if (!normPhone) return null;

    const clients = await this.getClients();
    const client = clients.find(c => (c.phone || '').trim().replace(/[\s\-\+]/g, '') === normPhone);
    if (!client) return null;

    const newPoints = (client.points || 0) + pointsToAdd;
    let newTier: UserProfile['memberTier'] = client.memberTier || 'Bronze';
    if (newPoints >= 2000) newTier = 'VIP';
    else if (newPoints >= 1000) newTier = 'Gold';
    else if (newPoints >= 500) newTier = 'Silver';

    const updated = await this.updateClient(client.id, {
      points: newPoints,
      memberTier: newTier,
    });

    // Update local profile if logged in with same phone
    try {
      const savedProfile = localStorage.getItem('baba_user_profile_v1');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if ((parsed.phone || '').trim().replace(/[\s\-\+]/g, '') === normPhone) {
          localStorage.setItem('baba_user_profile_v1', JSON.stringify({
            ...parsed,
            points: newPoints,
            memberTier: newTier,
          }));
        }
      }
    } catch (e) {
      console.warn('Local profile sync error:', e);
    }

    return updated;
  },

  async redeemPromoWithPoints(phone: string, promoCodeStr: string): Promise<{ success: boolean; promo: PromoCode; newPoints: number; message: string }> {
    const normPhone = (phone || '').trim().replace(/[\s\-\+]/g, '');
    const promos = await this.getPromos();
    const promo = promos.find(p => p.code.toUpperCase() === promoCodeStr.toUpperCase().trim() && p.active);

    if (!promo) {
      throw new Error('မှားယွင်းနေသော သို့မဟုတ် သက်တမ်းကုန်နေသော Promo Code ဖြစ်ပါသည်');
    }

    const pointsCost = promo.pointsCost || 0;
    if (pointsCost <= 0) {
      return {
        success: true,
        promo,
        newPoints: 0,
        message: 'ဤ Promo Code သည် အခမဲ့ အသုံးပြုနိုင်ပါသည်!'
      };
    }

    const clients = await this.getClients();
    const client = clients.find(c => (c.phone || '').trim().replace(/[\s\-\+]/g, '') === normPhone);

    if (!client) {
      throw new Error('Client Profile မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ ဖုန်းနံပါတ်ဖြင့် အကောင့်ဖွင့်ပါ');
    }

    if ((client.points || 0) < pointsCost) {
      throw new Error(`Royalty points မလုံလောက်ပါ။ လိုအပ်ချက်: ${pointsCost} pts (လက်ရှိ: ${client.points || 0} pts)`);
    }

    const newPoints = (client.points || 0) - pointsCost;
    await this.updateClient(client.id, { points: newPoints });

    // Update local profile
    try {
      const savedProfile = localStorage.getItem('baba_user_profile_v1');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if ((parsed.phone || '').trim().replace(/[\s\-\+]/g, '') === normPhone) {
          localStorage.setItem('baba_user_profile_v1', JSON.stringify({
            ...parsed,
            points: newPoints,
          }));
        }
      }
    } catch (e) {
      console.warn('Local profile update error:', e);
    }

    return {
      success: true,
      promo,
      newPoints,
      message: `★ ${pointsCost} Royalty Points နှင့် Promo (${promo.code}) အား အောင်မြင်စွာ လဲလှယ်လိုက်ပါပြီ!`
    };
  },

  // --- Audit Logs API ---
  async getAuditLogs(): Promise<AuditLog[]> {
    const seedLogs: AuditLog[] = [
      {
        id: 'log-seed-1',
        adminName: 'SuperAdmin Master',
        actorRole: 'superadmin',
        action: 'System Initialized',
        actionType: 'system',
        details: 'GENTLEMAN Barber & Grooming Lounge system and real-time database active.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'log-seed-2',
        adminName: 'Admin Manager (Ko Min)',
        actorRole: 'admin',
        action: 'Booking Approved',
        actionType: 'booking',
        details: 'Approved booking GTM-8921 for client Aung Aung with Master Barber Kyaw Gyi.',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'log-seed-3',
        adminName: 'Kyaw Gyi (Barber)',
        actorRole: 'barber',
        action: 'Barber PIN Verified',
        actionType: 'auth',
        details: 'Barber Kyaw Gyi logged into personal stylist workspace via PIN.',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'log-seed-4',
        adminName: 'Admin Manager',
        actorRole: 'admin',
        action: 'Walk-in Registered',
        actionType: 'booking',
        details: 'Walk-in client registered and assigned to Barber Min Khant.',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
      {
        id: 'log-seed-5',
        adminName: 'SuperAdmin Master',
        actorRole: 'superadmin',
        action: 'Financial Ledger Verified',
        actionType: 'financial',
        details: 'Verified daily barber commission split and payment accounts.',
        timestamp: new Date().toISOString(),
      },
    ];

    try {
      const snap = await getDocs(collection(db, 'audit_logs'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLocalData(LOCAL_LOGS_KEY, list);
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAuditLogs fallback:', e);
    }
    const local = getLocalData<AuditLog[]>(LOCAL_LOGS_KEY, seedLogs);
    local.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return local;
  },

  async addAuditLog(
    adminName: string,
    action: string,
    details: string,
    actorRole: 'superadmin' | 'admin' | 'barber' | 'user' | 'system' = 'admin',
    actionType: 'booking' | 'auth' | 'settings' | 'staff' | 'financial' | 'service' | 'promo' | 'system' = 'system',
    targetId?: string
  ): Promise<AuditLog> {
    const logId = `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newLog: AuditLog = {
      id: logId,
      adminName: adminName || 'Admin',
      actorRole,
      action,
      actionType,
      details,
      targetId,
      timestamp: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'audit_logs', logId), sanitizeForFirestore(newLog));
    } catch (e) {
      console.warn('Firestore addAuditLog fallback:', e);
    }

    const current = getLocalData<AuditLog[]>(LOCAL_LOGS_KEY, []);
    const updated = [newLog, ...current];
    setLocalData(LOCAL_LOGS_KEY, updated);
    return newLog;
  },

  async clearAuditLogs(): Promise<boolean> {
    try {
      const snap = await getDocs(collection(db, 'audit_logs'));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'audit_logs', d.id));
      }
    } catch (e) {
      console.warn('Firestore clearAuditLogs fallback:', e);
    }
    setLocalData(LOCAL_LOGS_KEY, []);
    return true;
  },

  // --- Notifications API ---
  async getNotifications(role: UserRole | 'all' = 'all'): Promise<NotificationItem[]> {
    const filterByRole = (items: NotificationItem[]) => {
      if (role === 'all') return items;
      if (role === 'superadmin') {
        // Superadmin receives 0 notifications as requested
        return [];
      }
      if (role === 'admin') {
        return items.filter(n => n.forRole === 'admin' || (n.forRole === 'all' && !n.targetMemberTier && !n.targetClientPhone) || !n.forRole);
      }
      if (role === 'barber') {
        return items.filter(n => isNotificationForBarber(n));
      }
      if (role === 'user') {
        return items.filter(n => isNotificationForClient(n));
      }
      return items;
    };

    try {
      const snap = await getDocs(collection(db, 'notifications'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLocalData(LOCAL_NOTIFS_KEY, list);
        const filtered = filterByRole(list);
        
        return filtered;
      }
    } catch (e) {
      console.warn('Firestore getNotifications fallback:', e);
    }
    const localList = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    localList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const filtered = filterByRole(localList);
    return filtered;
  },

  subscribeToNotifications(role: UserRole | 'all', onUpdate: (notifications: NotificationItem[]) => void): () => void {
    if (role === 'superadmin') {
      onUpdate([]);
      return () => {};
    }

    let initialLoad = true;

    const filterByRole = (items: NotificationItem[]) => {
      if (role === 'all') {
        return items;
      }
      if (role === 'admin') {
        return items.filter(n => n.forRole === 'admin' || (n.forRole === 'all' && !n.targetMemberTier && !n.targetClientPhone) || !n.forRole);
      }
      if (role === 'barber') {
        return items.filter(n => isNotificationForBarber(n));
      }
      if (role === 'user') {
        return items.filter(n => isNotificationForClient(n));
      }
      return items;
    };

    const syncSet = getSyncListeners('notifications');
    const roleCallback = (allNotifs: NotificationItem[]) => {
      const filtered = filterByRole(allNotifs || []);
      onUpdate(filtered);
    };
    syncSet.add(roleCallback);

    const cached = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    roleCallback(cached);

    let unsubscribeFirestore: () => void = () => {};
    try {
      unsubscribeFirestore = onSnapshot(
        collection(db, 'notifications'),
        (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLocalData(LOCAL_NOTIFS_KEY, list);

          const filtered = filterByRole(list);
          onUpdate(filtered);

          if (!initialLoad) {
            snap.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const notif = { id: change.doc.id, ...change.doc.data() } as NotificationItem;
                
                // Only alert on recent notifications created in the last 3 minutes
                const notifTime = new Date(notif.timestamp).getTime();
                const isRecent = !isNaN(notifTime) && (Date.now() - notifTime) < 3 * 60 * 1000;

                if (isRecent && !hasNotificationBeenAlerted(notif.id)) {
                  let shouldAlert = false;
                  if (role === 'admin') {
                    shouldAlert = notif.forRole === 'admin' || (notif.forRole === 'all' && !notif.targetMemberTier && !notif.targetClientPhone);
                  } else if (role === 'barber') {
                    shouldAlert = isNotificationForBarber(notif);
                  } else if (role === 'user') {
                    shouldAlert = isNotificationForClient(notif);
                  }

                  if (shouldAlert) {
                    markNotificationAsAlerted(notif.id);
                    playAudioChime();
                    sendLocalPushNotification(notif.title || '🔔 အသိပေးချက် အသစ်', notif.message);
                  }
                }
              }
            });
          }
          initialLoad = false;
        },
        (error) => {
          console.warn('subscribeToNotifications error:', error);
        }
      );
    } catch (e) {
      console.warn('subscribeToNotifications setup error:', e);
    }

    return () => {
      syncSet.delete(roleCallback);
      try {
        unsubscribeFirestore();
      } catch {}
    };
  },

  async createNotification(item: Partial<NotificationItem>): Promise<NotificationItem> {
    const notifId = item.id || `notif-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newNotif: NotificationItem = {
      id: notifId,
      title: item.title || '🔔 အသိပေးချက်',
      message: item.message || '',
      timestamp: item.timestamp || now,
      read: false,
      type: item.type || 'broadcast',
      forRole: item.forRole || 'all',
      ...(item.bookingId ? { bookingId: item.bookingId } : {}),
      ...(item.customerName ? { customerName: item.customerName } : {}),
      ...(item.customerPhone ? { customerPhone: item.customerPhone } : {}),
      ...(item.targetClientPhone ? { targetClientPhone: item.targetClientPhone } : {}),
      ...(item.targetClientId ? { targetClientId: item.targetClientId } : {}),
      ...(item.targetMemberTier ? { targetMemberTier: item.targetMemberTier } : {}),
      ...(item.designerId ? { designerId: item.designerId } : {}),
      ...(item.designerName ? { designerName: item.designerName } : {}),
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    };

    try {
      await setDoc(doc(db, 'notifications', notifId), sanitizeForFirestore(newNotif));
    } catch (e) {
      console.warn('Firestore createNotification fallback:', e);
    }

    const current = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    const updated = [newNotif, ...current.filter(n => n.id !== notifId)];
    setLocalData(LOCAL_NOTIFS_KEY, updated);
    notifyLocalSubscribers('notifications', updated);

    return newNotif;
  },

  async sendBroadcastNotification(payload: {
    title: string;
    message: string;
    type?: NotificationType;
    target?: 'all' | 'specific' | 'tier';
    targetPhone?: string;
    targetName?: string;
    targetTier?: string;
  }): Promise<NotificationItem> {
    const isSpecific = payload.target === 'specific' && !!payload.targetPhone;
    const isTier = payload.target === 'tier' && !!payload.targetTier;
    const notif = await this.createNotification({
      title: payload.title,
      message: payload.message,
      type: payload.type || 'broadcast',
      forRole: (isSpecific || isTier) ? 'user' : 'all',
      customerName: payload.targetName,
      customerPhone: payload.targetPhone,
      targetClientPhone: payload.targetPhone,
      targetMemberTier: isTier ? payload.targetTier : undefined,
    });

    try {
      const recipientDesc = isSpecific
        ? `client (${payload.targetPhone})`
        : isTier
        ? `Tier [${payload.targetTier}] clients`
        : 'all clients';
      await this.addAuditLog(
        'Admin Broadcast',
        'Send Notification',
        `Broadcast sent to ${recipientDesc}: "${payload.title}"`
      );
    } catch {}

    return notif;
  },

  async markNotificationsRead(role?: UserRole | 'all', specificIds?: string[]): Promise<void> {
    const list = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    const nowIso = new Date().toISOString();
    const updated = list.map(n => {
      if (specificIds && specificIds.length > 0) {
        return specificIds.includes(n.id) ? { ...n, read: true, readAt: n.readAt || nowIso } : n;
      }
      return (!role || n.forRole === role || n.forRole === 'all') ? { ...n, read: true, readAt: n.readAt || nowIso } : n;
    });
    setLocalData(LOCAL_NOTIFS_KEY, updated);
    notifyLocalSubscribers('notifications', updated);

    try {
      const snap = await getDocs(collection(db, 'notifications'));
      for (const docSnap of snap.docs) {
        const d = docSnap.data() as NotificationItem;
        if (specificIds && specificIds.length > 0) {
          if (specificIds.includes(docSnap.id) && !d.read) {
            updateDoc(doc(db, 'notifications', docSnap.id), { read: true, readAt: nowIso }).catch(() => {});
          }
        } else if ((!role || d.forRole === role || d.forRole === 'all') && !d.read) {
          updateDoc(doc(db, 'notifications', docSnap.id), { read: true, readAt: nowIso }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('markNotificationsRead firestore fallback:', e);
    }
  },

  /**
   * Auto-deletes read notifications that have passed 5 minutes (300,000 ms)
   */
  async purgeExpiredReadNotifications(): Promise<void> {
    const list = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    const expiredIds: string[] = [];

    const remaining = list.filter((n) => {
      if (!n.read) return true;
      const readTime = n.readAt ? new Date(n.readAt).getTime() : new Date(n.timestamp).getTime();
      const isExpired = !isNaN(readTime) && (now - readTime >= fiveMinutesMs);
      if (isExpired) {
        expiredIds.push(n.id);
        return false;
      }
      return true;
    });

    if (expiredIds.length > 0) {
      setLocalData(LOCAL_NOTIFS_KEY, remaining);
      notifyLocalSubscribers('notifications', remaining);

      try {
        for (const id of expiredIds) {
          deleteDoc(doc(db, 'notifications', id)).catch(() => {});
        }
      } catch (err) {
        console.warn('purgeExpiredReadNotifications firestore fallback:', err);
      }
    }
  },

  async deleteNotification(id: string): Promise<boolean> {
    const list = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    const updated = list.filter(n => n.id !== id);
    setLocalData(LOCAL_NOTIFS_KEY, updated);
    notifyLocalSubscribers('notifications', updated);

    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      console.warn('Firestore deleteNotification fallback:', e);
    }
    return true;
  },

  async clearAllNotifications(role?: UserRole | 'all', specificIds?: string[]): Promise<boolean> {
    const list = getLocalData<NotificationItem[]>(LOCAL_NOTIFS_KEY, []);
    let updated: NotificationItem[] = [];

    if (specificIds && specificIds.length > 0) {
      const idsSet = new Set(specificIds);
      updated = list.filter(n => !idsSet.has(n.id));
    } else if (role && role !== 'all') {
      updated = list.filter(n => n.forRole !== role && n.forRole !== 'all');
    } else {
      updated = [];
    }

    setLocalData(LOCAL_NOTIFS_KEY, updated);
    notifyLocalSubscribers('notifications', updated);

    try {
      const snap = await getDocs(collection(db, 'notifications'));
      for (const docSnap of snap.docs) {
        const d = docSnap.data() as NotificationItem;
        if (specificIds && specificIds.length > 0) {
          if (specificIds.includes(docSnap.id)) {
            deleteDoc(doc(db, 'notifications', docSnap.id)).catch(() => {});
          }
        } else if (!role || role === 'all' || d.forRole === role || d.forRole === 'all') {
          deleteDoc(doc(db, 'notifications', docSnap.id)).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Firestore clearAllNotifications fallback:', e);
    }
    return true;
  },

  // --- App Stats API ---
  async getStats(): Promise<AppStats> {
    const bookings = await this.getBookings();
    const services = await this.getServices();
    const designers = await this.getDesigners();
    const todayStr = new Date().toISOString().split('T')[0];

    return {
      totalBookings: bookings.length,
      pendingRequests: bookings.filter(b => b.status === 'pending').length,
      todayBookings: bookings.filter(b => b.date === todayStr).length,
      estimatedRevenue: bookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'in-progress')
        .reduce((sum, b) => sum + (b.servicePrice || 15000), 0),
      activeServicesCount: services.filter(s => s.active).length,
      activeDesignersCount: designers.length
    };
  },

  // --- DB Reset & Import/Export Methods ---
  async exportDatabase(): Promise<any> {
    const [services, designers, bookings, clients, promos, settings, notifications, auditLogs, expenses, expensePresets, products, retailSales] = await Promise.all([
      this.getServices(),
      this.getDesigners(),
      this.getBookings(),
      this.getClients(),
      this.getPromos(),
      this.getSettings(),
      this.getNotifications(),
      this.getAuditLogs(),
      this.getExpenses(),
      this.getExpensePresets(),
      this.getRetailProducts(),
      this.getRetailSales(),
    ]);

    return {
      version: '2.0',
      appName: 'GENTLEMAN Barber & Grooming Lounge',
      exportedAt: new Date().toISOString(),
      metadata: {
        totalServices: services.length,
        totalDesigners: designers.length,
        totalBookings: bookings.length,
        totalClients: clients.length,
        totalPromos: promos.length,
        totalNotifications: notifications.length,
        totalAuditLogs: auditLogs.length,
        totalExpenses: expenses.length,
        totalExpensePresets: expensePresets.length,
        totalProducts: products.length,
        totalRetailSales: retailSales.length,
      },
      services,
      designers,
      bookings,
      clients,
      promos,
      settings,
      notifications,
      auditLogs,
      expenses,
      expensePresets,
      products,
      retailSales,
    };
  },

  async importDatabase(data: any): Promise<{ success: boolean; message?: string; restoredCounts?: Record<string, number> }> {
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid JSON payload format.' };
    }

    const restoredCounts: Record<string, number> = {};

    try {
      // 1. Services
      if (Array.isArray(data.services) && data.services.length > 0) {
        localStorage.removeItem(LOCAL_DELETED_SRV_KEY);
        setLocalData(LOCAL_SERVICES_KEY, data.services);
        notifyLocalSubscribers('services', data.services);
        restoredCounts.services = data.services.length;
        for (const s of data.services) {
          if (s.id) {
            try {
              await setDoc(doc(db, 'services', s.id), s);
            } catch (err) {
              console.warn('Firestore restore services warn:', err);
            }
          }
        }
      }

      // 2. Designers
      if (Array.isArray(data.designers) && data.designers.length > 0) {
        localStorage.removeItem(LOCAL_DELETED_DES_KEY);
        setLocalData(LOCAL_DESIGNERS_KEY, data.designers);
        notifyLocalSubscribers('designers', data.designers);
        restoredCounts.designers = data.designers.length;
        for (const d of data.designers) {
          if (d.id) {
            try {
              await setDoc(doc(db, 'designers', d.id), d);
            } catch (err) {
              console.warn('Firestore restore designers warn:', err);
            }
          }
        }
      }

      // 3. Bookings
      if (Array.isArray(data.bookings)) {
        setLocalData(LOCAL_BOOKINGS_KEY, data.bookings);
        notifyLocalSubscribers('bookings', data.bookings);
        restoredCounts.bookings = data.bookings.length;
        for (const b of data.bookings) {
          if (b.id) {
            try {
              await setDoc(doc(db, 'bookings', b.id), b);
            } catch (err) {
              console.warn('Firestore restore bookings warn:', err);
            }
          }
        }
      }

      // 4. Clients
      if (Array.isArray(data.clients)) {
        setLocalData(LOCAL_CLIENTS_KEY, data.clients);
        notifyLocalSubscribers('clients', data.clients);
        restoredCounts.clients = data.clients.length;
        for (const c of data.clients) {
          if (c.phone) {
            try {
              await setDoc(doc(db, 'clients', c.phone), c);
            } catch (err) {
              console.warn('Firestore restore clients warn:', err);
            }
          }
        }
      }

      // 5. Promos
      if (Array.isArray(data.promos)) {
        setLocalData(LOCAL_PROMOS_KEY, data.promos);
        notifyLocalSubscribers('promos', data.promos);
        restoredCounts.promos = data.promos.length;
        for (const p of data.promos) {
          if (p.id) {
            try {
              await setDoc(doc(db, 'promos', p.id), p);
            } catch (err) {
              console.warn('Firestore restore promos warn:', err);
            }
          }
        }
      }

      // 6. Settings
      if (data.settings && typeof data.settings === 'object') {
        setLocalData(LOCAL_SETTINGS_KEY, data.settings);
        notifyLocalSubscribers('settings', data.settings);
        restoredCounts.settings = 1;
        try {
          await setDoc(doc(db, 'settings', 'payment_settings'), data.settings);
        } catch (err) {
          console.warn('Firestore restore settings warn:', err);
        }
      }

      // 7. Notifications
      if (Array.isArray(data.notifications)) {
        setLocalData(LOCAL_NOTIFS_KEY, data.notifications);
        notifyLocalSubscribers('notifications', data.notifications);
        restoredCounts.notifications = data.notifications.length;
        for (const n of data.notifications) {
          if (n.id) {
            try {
              await setDoc(doc(db, 'notifications', n.id), n);
            } catch (err) {
              console.warn('Firestore restore notifications warn:', err);
            }
          }
        }
      }

      // 8. Expenses
      if (Array.isArray(data.expenses)) {
        setLocalData(LOCAL_EXPENSES_KEY, data.expenses);
        notifyLocalSubscribers('expenses', data.expenses);
        restoredCounts.expenses = data.expenses.length;
        for (const e of data.expenses) {
          if (e.id) {
            try {
              await setDoc(doc(db, 'shop_expenses', e.id), sanitizeForFirestore(e));
            } catch (err) {
              console.warn('Firestore restore expenses warn:', err);
            }
          }
        }
      }

      // 9. Expense Presets
      if (Array.isArray(data.expensePresets)) {
        setLocalData(LOCAL_EXPENSE_PRESETS_KEY, data.expensePresets);
        notifyLocalSubscribers('expense_presets', data.expensePresets);
        restoredCounts.expensePresets = data.expensePresets.length;
        for (const ep of data.expensePresets) {
          if (ep.id) {
            try {
              await setDoc(doc(db, 'expense_presets', ep.id), sanitizeForFirestore(ep));
            } catch (err) {
              console.warn('Firestore restore expense presets warn:', err);
            }
          }
        }
      }

      // 10. Retail Products (POS Catalog)
      if (Array.isArray(data.products)) {
        setLocalData(LOCAL_PRODUCTS_KEY, data.products);
        notifyLocalSubscribers('products', data.products);
        restoredCounts.products = data.products.length;
        for (const prod of data.products) {
          if (prod.id) {
            try {
              await setDoc(doc(db, 'retail_products', prod.id), sanitizeForFirestore(prod));
            } catch (err) {
              console.warn('Firestore restore products warn:', err);
            }
          }
        }
      }

      // 11. Retail Sales (POS History)
      if (Array.isArray(data.retailSales)) {
        setLocalData(LOCAL_RETAIL_SALES_KEY, data.retailSales);
        notifyLocalSubscribers('retail_sales', data.retailSales);
        restoredCounts.retailSales = data.retailSales.length;
        for (const s of data.retailSales) {
          if (s.id) {
            try {
              await setDoc(doc(db, 'retail_sales', s.id), sanitizeForFirestore(s));
            } catch (err) {
              console.warn('Firestore restore retail sales warn:', err);
            }
          }
        }
      }

      // 12. Audit Logs
      if (Array.isArray(data.auditLogs)) {
        setLocalData(LOCAL_LOGS_KEY, data.auditLogs);
        restoredCounts.auditLogs = data.auditLogs.length;
      }

      return { success: true, restoredCounts };
    } catch (err: any) {
      console.error('Import database failed:', err);
      return { success: false, message: err.message || 'Database restore failed.' };
    }
  },

  // =========================================================================
  // SHOP EXPENSES & MASTER PRESETS API
  // =========================================================================
  async getExpenses(filterDate?: string): Promise<ShopExpense[]> {
    try {
      const snap = await getDocs(collection(db, 'shop_expenses'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShopExpense));
        setLocalData(LOCAL_EXPENSES_KEY, list);
        if (filterDate) return list.filter(e => e.date === filterDate);
        return list;
      }
      const local = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
      if (filterDate) return local.filter(e => e.date === filterDate);
      return local;
    } catch (err) {
      console.warn('getExpenses fallback:', err);
      const local = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
      if (filterDate) return local.filter(e => e.date === filterDate);
      return local;
    }
  },

  subscribeToExpenses(callback: (expenses: ShopExpense[]) => void, filterDate?: string): () => void {
    const syncSet = getSyncListeners('expenses');
    const wrappedCb = (all: ShopExpense[]) => {
      if (filterDate) {
        callback(all.filter(e => e.date === filterDate));
      } else {
        callback(all);
      }
    };
    syncSet.add(wrappedCb);

    // Initial cache emit
    const current = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
    wrappedCb(current);

    // Firestore listener
    const unsub = onSnapshot(collection(db, 'shop_expenses'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShopExpense));
        setLocalData(LOCAL_EXPENSES_KEY, list);
        wrappedCb(list);
      }
    }, (err) => console.warn('subscribeToExpenses error:', err));

    return () => {
      syncSet.delete(wrappedCb);
      unsub();
    };
  },

  async addExpense(expense: Omit<ShopExpense, 'id' | 'createdAt'>): Promise<ShopExpense> {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newExpense: ShopExpense = {
      ...expense,
      id,
      createdAt: new Date().toISOString()
    };

    // Update Local
    const current = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
    const updated = [newExpense, ...current];
    setLocalData(LOCAL_EXPENSES_KEY, updated);
    notifyLocalSubscribers('expenses', updated);

    // Firestore
    try {
      await setDoc(doc(db, 'shop_expenses', id), sanitizeForFirestore(newExpense));
    } catch (err) {
      console.warn('Firestore addExpense error:', err);
    }

    try {
      await this.addAuditLog(
        expense.recordedBy || 'Admin',
        'Added Shop Expense',
        `Expense "${expense.title}" of ${expense.amount} MMK recorded for date ${expense.date}`
      );
    } catch {}

    return newExpense;
  },

  async updateExpense(id: string, updates: Partial<ShopExpense>): Promise<void> {
    const current = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
    const updated = current.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e);
    setLocalData(LOCAL_EXPENSES_KEY, updated);
    notifyLocalSubscribers('expenses', updated);

    try {
      await updateDoc(doc(db, 'shop_expenses', id), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Firestore updateExpense error:', err);
    }
  },

  async deleteExpense(id: string): Promise<void> {
    const current = getLocalData<ShopExpense[]>(LOCAL_EXPENSES_KEY, []);
    const updated = current.filter(e => e.id !== id);
    setLocalData(LOCAL_EXPENSES_KEY, updated);
    notifyLocalSubscribers('expenses', updated);

    try {
      await deleteDoc(doc(db, 'shop_expenses', id));
    } catch (err) {
      console.warn('Firestore deleteExpense error:', err);
    }
  },

  async getExpensePresets(): Promise<ExpensePreset[]> {
    try {
      const snap = await getDocs(collection(db, 'expense_presets'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpensePreset));
        setLocalData(LOCAL_EXPENSE_PRESETS_KEY, list);
        return list;
      }
      return getLocalData<ExpensePreset[]>(LOCAL_EXPENSE_PRESETS_KEY, []);
    } catch (err) {
      console.warn('getExpensePresets fallback:', err);
      return getLocalData<ExpensePreset[]>(LOCAL_EXPENSE_PRESETS_KEY, []);
    }
  },

  subscribeToExpensePresets(callback: (presets: ExpensePreset[]) => void): () => void {
    const syncSet = getSyncListeners('expense_presets');
    syncSet.add(callback);
    callback(getLocalData<ExpensePreset[]>(LOCAL_EXPENSE_PRESETS_KEY, []));

    const unsub = onSnapshot(collection(db, 'expense_presets'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpensePreset));
        setLocalData(LOCAL_EXPENSE_PRESETS_KEY, list);
        callback(list);
      }
    }, (err) => console.warn('subscribeToExpensePresets error:', err));

    return () => {
      syncSet.delete(callback);
      unsub();
    };
  },

  async saveExpensePreset(preset: Omit<ExpensePreset, 'id'> & { id?: string }): Promise<ExpensePreset> {
    const id = preset.id || `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPreset: ExpensePreset = {
      ...preset,
      id,
      createdAt: new Date().toISOString()
    };

    const current = getLocalData<ExpensePreset[]>(LOCAL_EXPENSE_PRESETS_KEY, []);
    const exists = current.some(p => p.id === id || p.title.toLowerCase().trim() === preset.title.toLowerCase().trim());
    const updated = exists
      ? current.map(p => (p.id === id || p.title.toLowerCase().trim() === preset.title.toLowerCase().trim()) ? { ...p, ...newPreset } : p)
      : [newPreset, ...current];

    setLocalData(LOCAL_EXPENSE_PRESETS_KEY, updated);
    notifyLocalSubscribers('expense_presets', updated);

    try {
      await setDoc(doc(db, 'expense_presets', id), sanitizeForFirestore(newPreset));
    } catch (err) {
      console.warn('Firestore saveExpensePreset error:', err);
    }
    return newPreset;
  },

  async deleteExpensePreset(id: string): Promise<void> {
    const current = getLocalData<ExpensePreset[]>(LOCAL_EXPENSE_PRESETS_KEY, []);
    const updated = current.filter(p => p.id !== id);
    setLocalData(LOCAL_EXPENSE_PRESETS_KEY, updated);
    notifyLocalSubscribers('expense_presets', updated);

    try {
      await deleteDoc(doc(db, 'expense_presets', id));
    } catch (err) {
      console.warn('Firestore deleteExpensePreset error:', err);
    }
  },

  // =========================================================================
  // RETAIL PRODUCTS & PRODUCT SALES API
  // =========================================================================
  async getRetailProducts(): Promise<RetailProduct[]> {
    try {
      const snap = await getDocs(collection(db, 'retail_products'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RetailProduct));
        setLocalData(LOCAL_PRODUCTS_KEY, list);
        return list;
      }
      return getLocalData<RetailProduct[]>(LOCAL_PRODUCTS_KEY, []);
    } catch (err) {
      console.warn('getRetailProducts fallback:', err);
      return getLocalData<RetailProduct[]>(LOCAL_PRODUCTS_KEY, []);
    }
  },

  subscribeToRetailProducts(callback: (products: RetailProduct[]) => void): () => void {
    const syncSet = getSyncListeners('products');
    syncSet.add(callback);
    callback(getLocalData<RetailProduct[]>(LOCAL_PRODUCTS_KEY, []));

    const unsub = onSnapshot(collection(db, 'retail_products'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RetailProduct));
        setLocalData(LOCAL_PRODUCTS_KEY, list);
        callback(list);
      }
    }, (err) => console.warn('subscribeToRetailProducts error:', err));

    return () => {
      syncSet.delete(callback);
      unsub();
    };
  },

  async saveRetailProduct(product: Omit<RetailProduct, 'id'> & { id?: string }): Promise<RetailProduct> {
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newProd: RetailProduct = {
      ...product,
      id,
      inStock: product.inStock !== false,
      createdAt: product.createdAt || new Date().toISOString()
    };

    const current = getLocalData<RetailProduct[]>(LOCAL_PRODUCTS_KEY, []);
    const exists = current.some(p => p.id === id);
    const updated = exists ? current.map(p => p.id === id ? newProd : p) : [newProd, ...current];

    setLocalData(LOCAL_PRODUCTS_KEY, updated);
    notifyLocalSubscribers('products', updated);

    try {
      await setDoc(doc(db, 'retail_products', id), sanitizeForFirestore(newProd));
    } catch (err) {
      console.warn('Firestore saveRetailProduct error:', err);
    }
    return newProd;
  },

  async deleteRetailProduct(id: string): Promise<void> {
    const current = getLocalData<RetailProduct[]>(LOCAL_PRODUCTS_KEY, []);
    const updated = current.filter(p => p.id !== id);
    setLocalData(LOCAL_PRODUCTS_KEY, updated);
    notifyLocalSubscribers('products', updated);

    try {
      await deleteDoc(doc(db, 'retail_products', id));
    } catch (err) {
      console.warn('Firestore deleteRetailProduct error:', err);
    }
  },

  async getRetailSales(filterDate?: string): Promise<RetailSale[]> {
    try {
      const snap = await getDocs(collection(db, 'retail_sales'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RetailSale));
        setLocalData(LOCAL_RETAIL_SALES_KEY, list);
        if (filterDate) return list.filter(s => s.date === filterDate);
        return list;
      }
      const local = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
      if (filterDate) return local.filter(s => s.date === filterDate);
      return local;
    } catch (err) {
      console.warn('getRetailSales fallback:', err);
      const local = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
      if (filterDate) return local.filter(s => s.date === filterDate);
      return local;
    }
  },

  subscribeToRetailSales(callback: (sales: RetailSale[]) => void, filterDate?: string): () => void {
    const syncSet = getSyncListeners('retail_sales');
    const wrappedCb = (all: RetailSale[]) => {
      if (filterDate) {
        callback(all.filter(s => s.date === filterDate));
      } else {
        callback(all);
      }
    };
    syncSet.add(wrappedCb);

    const current = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
    wrappedCb(current);

    const unsub = onSnapshot(collection(db, 'retail_sales'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RetailSale));
        setLocalData(LOCAL_RETAIL_SALES_KEY, list);
        wrappedCb(list);
      }
    }, (err) => console.warn('subscribeToRetailSales error:', err));

    return () => {
      syncSet.delete(wrappedCb);
      unsub();
    };
  },

  async addRetailSale(sale: Omit<RetailSale, 'id' | 'createdAt'>): Promise<RetailSale> {
    const id = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSale: RetailSale = {
      ...sale,
      id,
      createdAt: new Date().toISOString()
    };

    const current = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
    const updated = [newSale, ...current];
    setLocalData(LOCAL_RETAIL_SALES_KEY, updated);
    notifyLocalSubscribers('retail_sales', updated);

    try {
      await setDoc(doc(db, 'retail_sales', id), sanitizeForFirestore(newSale));
    } catch (err) {
      console.warn('Firestore addRetailSale error:', err);
    }

    try {
      await this.addAuditLog(
        'Admin',
        'Recorded Retail Product Sale',
        `Sold ${sale.quantity}x ${sale.productName} for ${sale.totalPrice} MMK on ${sale.date}`
      );
    } catch {}

    return newSale;
  },

  async updateRetailSale(id: string, updates: Partial<RetailSale>): Promise<void> {
    const current = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
    const updated = current.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s);
    setLocalData(LOCAL_RETAIL_SALES_KEY, updated);
    notifyLocalSubscribers('retail_sales', updated);

    try {
      await updateDoc(doc(db, 'retail_sales', id), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Firestore updateRetailSale error:', err);
    }
  },

  async deleteRetailSale(id: string): Promise<void> {
    const current = getLocalData<RetailSale[]>(LOCAL_RETAIL_SALES_KEY, []);
    const updated = current.filter(s => s.id !== id);
    setLocalData(LOCAL_RETAIL_SALES_KEY, updated);
    notifyLocalSubscribers('retail_sales', updated);

    try {
      await deleteDoc(doc(db, 'retail_sales', id));
    } catch (err) {
      console.warn('Firestore deleteRetailSale error:', err);
    }
  },

  async resetDatabaseToZero(password: string): Promise<{ success: boolean; message?: string }> {
    if (!verifyAdminResetPassword(password)) {
      return { success: false, message: 'လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည်။' };
    }
    localStorage.removeItem(LOCAL_SERVICES_KEY);
    localStorage.removeItem(LOCAL_DESIGNERS_KEY);
    localStorage.removeItem(LOCAL_BOOKINGS_KEY);
    localStorage.removeItem(LOCAL_NOTIFS_KEY);
    localStorage.removeItem(LOCAL_CLIENTS_KEY);
    localStorage.removeItem(LOCAL_PROMOS_KEY);

    // Delete all documents from Firestore collections
    const collectionsToWipe = ['bookings', 'notifications', 'clients', 'promos'];
    for (const colName of collectionsToWipe) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const docItem of snap.docs) {
          await deleteDoc(doc(db, colName, docItem.id));
        }
      } catch (e) {
        console.warn(`Error wiping Firestore collection ${colName}:`, e);
      }
    }

    return { success: true, message: 'ဒေတာများကို ပယ်ဖျက်ပြီးပါပြီ။' };
  },

  async resetDatabase(password?: string): Promise<{ success: boolean; message?: string }> {
    if (password && !verifyAdminResetPassword(password)) {
      return { success: false, message: 'လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည်။' };
    }
    localStorage.removeItem(LOCAL_SERVICES_KEY);
    localStorage.removeItem(LOCAL_DESIGNERS_KEY);
    localStorage.removeItem(LOCAL_BOOKINGS_KEY);
    localStorage.removeItem(LOCAL_NOTIFS_KEY);
    return { success: true, message: 'Default initial state သို့ ပြန်လည်သတ်မှတ်ပြီးပါပြီ။' };
  },

  /**
   * Safe PWA Cache Cleaner & Deep Cloud Re-synchronization (Repair)
   * Cleans stale browser/PWA cache, refreshes service worker, and restores
   * 100% verified genuine data from Firestore Cloud Database.
   * GUARANTEES: Does NOT delete or wipe any bookings, services history, or clients in Cloud!
   */
  async repairAndResyncFromCloud(): Promise<{
    success: boolean;
    syncedCounts: {
      services: number;
      designers: number;
      bookings: number;
      clients: number;
      promos: number;
      settings: number;
      notifications: number;
    };
    message: string;
  }> {
    const counts = {
      services: 0,
      designers: 0,
      bookings: 0,
      clients: 0,
      promos: 0,
      settings: 0,
      notifications: 0,
      expenses: 0,
      expensePresets: 0,
      products: 0,
      retailSales: 0,
    };

    try {
      // 1. Purge stale browser CacheStorage (PWA assets & old caches)
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        } catch (cacheErr) {
          console.warn('Browser caches purge warning:', cacheErr);
        }
      }

      // 2. Clear stale Service Worker caches & trigger update
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
          }
        } catch (swErr) {
          console.warn('Service worker update warning:', swErr);
        }
      }

      // 3. Clear bad/orphaned deleted IDs flags so genuine cloud records reappear cleanly
      localStorage.removeItem(LOCAL_DELETED_DES_KEY);
      localStorage.removeItem(LOCAL_DELETED_SRV_KEY);
      localStorage.removeItem(LOCAL_DELETED_CLIENTS_KEY);
      localStorage.removeItem('babashop_debug_logs');
      localStorage.removeItem('babashop_cached_analytics');

      // 4. Fetch genuine Services from Cloud
      try {
        purgeMockServicesFromFirestore();
        const srvSnap = await getDocs(collection(db, 'services'));
        if (!srvSnap.empty) {
          const freshServices = srvSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Service))
            .filter(s => !MOCK_SAMPLE_SERVICE_IDS.has(s.id));
          setLocalData(LOCAL_SERVICES_KEY, freshServices);
          notifyLocalSubscribers('services', freshServices);
          counts.services = freshServices.length;
        }
      } catch (err) {
        console.warn('Cloud sync services notice:', err);
      }

      // 5. Fetch genuine Designers from Cloud
      try {
        const desSnap = await getDocs(collection(db, 'designers'));
        if (!desSnap.empty) {
          const freshDesigners = desSnap.docs.map(d => ({ id: d.id, ...d.data() } as Designer));
          setLocalData(LOCAL_DESIGNERS_KEY, freshDesigners);
          notifyLocalSubscribers('designers', freshDesigners);
          counts.designers = freshDesigners.length;
        }
      } catch (err) {
        console.warn('Cloud sync designers notice:', err);
      }

      // 6. Fetch genuine Bookings (Crucial for Service History) from Cloud
      try {
        const bkSnap = await getDocs(collection(db, 'bookings'));
        if (!bkSnap.empty) {
          const freshBookings = bkSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
          const sorted = sortBookingsMostRecentFirst(freshBookings);
          setLocalData(LOCAL_BOOKINGS_KEY, sorted);
          notifyLocalSubscribers('bookings', sorted);
          counts.bookings = sorted.length;
        }
      } catch (err) {
        console.warn('Cloud sync bookings notice:', err);
      }

      // 7. Fetch genuine Clients from Cloud
      try {
        const clientSnap = await getDocs(collection(db, 'clients'));
        if (!clientSnap.empty) {
          const freshClients = clientSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
          setLocalData(LOCAL_CLIENTS_KEY, freshClients);
          notifyLocalSubscribers('clients', freshClients);
          counts.clients = freshClients.length;
        }
      } catch (err) {
        console.warn('Cloud sync clients notice:', err);
      }

      // 8. Fetch genuine Promos from Cloud
      try {
        const promoSnap = await getDocs(collection(db, 'promos'));
        if (!promoSnap.empty) {
          const freshPromos = promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode));
          setLocalData(LOCAL_PROMOS_KEY, freshPromos);
          notifyLocalSubscribers('promos', freshPromos);
          counts.promos = freshPromos.length;
        }
      } catch (err) {
        console.warn('Cloud sync promos notice:', err);
      }

      // 9. Fetch genuine Settings from Cloud
      try {
        const setDocSnap = await getDoc(doc(db, 'settings', 'payment_settings'));
        if (setDocSnap.exists()) {
          const freshSettings = setDocSnap.data() as PaymentSettings;
          setLocalData(LOCAL_SETTINGS_KEY, freshSettings);
          notifyLocalSubscribers('settings', freshSettings);
          counts.settings = 1;
        }
      } catch (err) {
        console.warn('Cloud sync settings notice:', err);
      }

      // 10. Fetch genuine Notifications from Cloud
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        if (!notifSnap.empty) {
          const freshNotifs = notifSnap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem));
          setLocalData(LOCAL_NOTIFS_KEY, freshNotifs);
          notifyLocalSubscribers('notifications', freshNotifs);
          counts.notifications = freshNotifs.length;
        }
      } catch (err) {
        console.warn('Cloud sync notifications notice:', err);
      }

      // 11. Fetch genuine Shop Expenses from Cloud
      try {
        const expSnap = await getDocs(collection(db, 'shop_expenses'));
        if (!expSnap.empty) {
          const freshExpenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as ShopExpense));
          setLocalData(LOCAL_EXPENSES_KEY, freshExpenses);
          notifyLocalSubscribers('expenses', freshExpenses);
          counts.expenses = freshExpenses.length;
        }
      } catch (err) {
        console.warn('Cloud sync expenses notice:', err);
      }

      // 12. Fetch genuine Expense Presets from Cloud
      try {
        const preSnap = await getDocs(collection(db, 'expense_presets'));
        if (!preSnap.empty) {
          const freshPresets = preSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExpensePreset));
          setLocalData(LOCAL_EXPENSE_PRESETS_KEY, freshPresets);
          notifyLocalSubscribers('expense_presets', freshPresets);
          counts.expensePresets = freshPresets.length;
        }
      } catch (err) {
        console.warn('Cloud sync expense presets notice:', err);
      }

      // 13. Fetch genuine Retail Products (POS Inventory) from Cloud
      try {
        const prodSnap = await getDocs(collection(db, 'retail_products'));
        if (!prodSnap.empty) {
          const freshProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as RetailProduct));
          setLocalData(LOCAL_PRODUCTS_KEY, freshProducts);
          notifyLocalSubscribers('products', freshProducts);
          counts.products = freshProducts.length;
        }
      } catch (err) {
        console.warn('Cloud sync retail products notice:', err);
      }

      // 14. Fetch genuine Retail Sales (POS History) from Cloud
      try {
        const saleSnap = await getDocs(collection(db, 'retail_sales'));
        if (!saleSnap.empty) {
          const freshSales = saleSnap.docs.map(d => ({ id: d.id, ...d.data() } as RetailSale));
          setLocalData(LOCAL_RETAIL_SALES_KEY, freshSales);
          notifyLocalSubscribers('retail_sales', freshSales);
          counts.retailSales = freshSales.length;
        }
      } catch (err) {
        console.warn('Cloud sync retail sales notice:', err);
      }

      // Log successful repair action
      try {
        await this.addAuditLog(
          'Admin',
          'Cache Repaired & Cloud Synced',
          `Full system cache cleaned and verified from Firestore: ${counts.bookings} bookings/history, ${counts.services} services, ${counts.expenses} expenses, ${counts.retailSales} POS sales, ${counts.products} retail products restored.`
        );
      } catch {}

      return {
        success: true,
        syncedCounts: counts,
        message: 'Cache ရှင်းလင်းပြီး Cloud မှ Data များကို အောင်မြင်စွာ ပြန်လည်ချိန်ညှိပြီးပါပြီ။'
      };
    } catch (err: any) {
      console.error('repairAndResyncFromCloud failed:', err);
      return {
        success: false,
        syncedCounts: counts,
        message: err.message || 'Cache ရှင်းလင်းခြင်းနှင့် Re-sync ပြုလုပ်ရာတွင် အမှားဖြစ်သွားပါသည်။'
      };
    }
  }
};
