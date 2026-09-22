import { getClientSession } from '../lib/authCrypto';
import { sortBookingsMostRecentFirst } from './formatters';

/**
 * Notification Helper for Web Push & PWA & Web Audio Chime
 */

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    if (!globalAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        globalAudioCtx = new AudioCtx();
      }
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch (e) {
    return null;
  }
}

export function playAudioChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playBeepSequence(ctx)).catch(() => playBeepSequence(ctx));
    } else {
      playBeepSequence(ctx);
    }
  } catch (e) {
    console.warn('Audio chime play error:', e);
  }
}

function playBeepSequence(ctx: AudioContext) {
  try {
    const now = ctx.currentTime;

    // First Tone: High C (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second Tone: Vibrant High E (1174Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.15);
    gain2.gain.setValueAtTime(0.45, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.75);
  } catch (err) {
    console.warn('Beep sequence failed:', err);
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  // Resume audio context when user grants permission
  getAudioContext();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Browser does not support desktop notification');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerServiceWorker();
      }
      return permission === 'granted';
    } catch (e) {
      console.warn('Notification permission error:', e);
      return false;
    }
  }

  return false;
}

export async function sendLocalPushNotification(title: string, body: string, icon = '/icon-192.png') {
  try {
    // Play sound chime alongside push
    playAudioChime();

    const permissionStatus = getNotificationPermissionStatus();
    if (permissionStatus === 'unsupported') {
      return;
    }

    if (permissionStatus === 'granted') {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body,
              icon,
              badge: icon,
              vibrate: [150, 75, 150],
              data: { timestamp: Date.now(), url: '/' },
            } as any);
            return;
          }
        } catch (swErr) {
          console.warn('SW push failed, falling back to Notification API:', swErr);
        }
      }

      // Fallback to standard Notification API
      new Notification(title, { body, icon });
    }
  } catch (err) {
    console.error('Error triggering push notification:', err);
  }
}

export const LOCAL_CLEARED_NOTIFS_KEY = 'baba_cleared_notif_ids_v1';

// In-memory set of notifications that have already triggered audio/push alert in the current session
const alertedNotifIds = new Set<string>();

export function markNotificationAsAlerted(id: string) {
  alertedNotifIds.add(id);
}

export function hasNotificationBeenAlerted(id: string): boolean {
  return alertedNotifIds.has(id);
}

export function getClearedNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_CLEARED_NOTIFS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addClearedNotificationId(id: string) {
  try {
    const set = getClearedNotificationIds();
    set.add(id);
    localStorage.setItem(LOCAL_CLEARED_NOTIFS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function addMultipleClearedNotificationIds(ids: string[]) {
  try {
    const set = getClearedNotificationIds();
    ids.forEach((id) => set.add(id));
    localStorage.setItem(LOCAL_CLEARED_NOTIFS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function normalizePhoneNumber(phone?: string): string {
  if (!phone) return '';
  // Strip all non-digit characters (+, spaces, hyphens, parentheses, etc.)
  let clean = phone.replace(/[^0-9]/g, '');
  // Normalize Myanmar country code 959... to 09...
  if (clean.startsWith('959') && clean.length >= 10) {
    clean = '09' + clean.slice(3);
  } else if (clean.startsWith('95') && clean.length >= 9 && !clean.startsWith('959')) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('9') && clean.length >= 8 && clean.length <= 11 && !clean.startsWith('09')) {
    clean = '0' + clean;
  }
  return clean;
}

export function phonesMatch(p1?: string, p2?: string): boolean {
  const norm1 = normalizePhoneNumber(p1);
  const norm2 = normalizePhoneNumber(p2);
  if (!norm1 || !norm2) return false;
  
  // Ignore dummy placeholder zeroes
  if (
    norm1 === '0000000000' ||
    norm2 === '0000000000' ||
    norm1 === '0' ||
    norm2 === '0' ||
    norm1.startsWith('000000') ||
    norm2.startsWith('000000')
  ) {
    return false;
  }
  if (norm1.length < 7 || norm2.length < 7) return false;

  // Strict match after normalization
  if (norm1 === norm2) return true;

  // Stripped leading zero match (e.g. 979123456 vs 0979123456)
  const core1 = norm1.replace(/^0+/, '');
  const core2 = norm2.replace(/^0+/, '');
  if (core1 === core2 && core1.length >= 7) {
    return true;
  }

  return false;
}

export function namesMatch(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = name1.toLowerCase().replace(/[^a-z0-9\u1000-\u109F]/g, ' ').replace(/\s+/g, ' ').trim();
  const n2 = name2.toLowerCase().replace(/[^a-z0-9\u1000-\u109F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  // First word match (e.g. Alex vs Alex Vance)
  const w1 = n1.split(' ')[0];
  const w2 = n2.split(' ')[0];
  if (w1 && w2 && w1.length >= 3 && w1 === w2) return true;
  return false;
}

export const LOCAL_MY_BOOKINGS_KEY = 'baba_my_booking_ids_v1';

export function getMyBookingIds(clientPhone?: string): Set<string> {
  try {
    const norm = normalizePhoneNumber(clientPhone);
    if (norm) {
      const phoneScoped = localStorage.getItem(`${LOCAL_MY_BOOKINGS_KEY}_${norm}`);
      if (phoneScoped) return new Set(JSON.parse(phoneScoped));
    }
    const raw = localStorage.getItem(LOCAL_MY_BOOKINGS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveMyBookingId(bookingId: string, bookingCode?: string, clientPhone?: string) {
  try {
    const norm = normalizePhoneNumber(clientPhone);
    if (norm) {
      const phoneSet = getMyBookingIds(norm);
      if (bookingId) phoneSet.add(bookingId);
      if (bookingCode) phoneSet.add(bookingCode);
      localStorage.setItem(`${LOCAL_MY_BOOKINGS_KEY}_${norm}`, JSON.stringify(Array.from(phoneSet)));
    }
    const set = getMyBookingIds();
    if (bookingId) set.add(bookingId);
    if (bookingCode) set.add(bookingCode);
    localStorage.setItem(LOCAL_MY_BOOKINGS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function getClientBookings<T extends { id: string; bookingCode?: string; customerPhone?: string; createdAt?: string; date?: string; timeSlot?: string }>(
  allBookings: T[],
  clientPhone?: string
): T[] {
  const normPhone = normalizePhoneNumber(clientPhone);

  const filtered = (allBookings || []).filter((b) => {
    // If clientPhone is known, only match bookings that match clientPhone!
    if (normPhone && normPhone.length >= 7) {
      return Boolean(b.customerPhone && phonesMatch(b.customerPhone, normPhone));
    }
    // If no clientPhone is provided (e.g. anonymous guest), fallback to locally saved IDs
    const myIds = getMyBookingIds();
    if (myIds.has(b.id) || (b.bookingCode && myIds.has(b.bookingCode))) {
      return true;
    }
    return false;
  });

  return sortBookingsMostRecentFirst(filtered);
}

/**
 * Checks whether a notification belongs strictly to a specific client
 * - Broadcasts ('all', promo, announcement) are visible to all clients unless a specific phone or tier is targeted
 * - Specific booking updates are only visible if the booking customer phone matches the client's phone or client owns the booking ID
 * - Specific phone broadcasts are only visible to the designated client
 * - Tier broadcasts are only visible to clients belonging to that tier
 * - Admin/staff/barber internal notifications are NEVER visible to clients
 */
export function isNotificationForClient(
  notif: {
    id: string;
    forRole?: string;
    type?: string;
    bookingId?: string;
    customerPhone?: string;
    targetClientPhone?: string;
    targetClientId?: string;
    targetMemberTier?: string;
    designerId?: string;
    designerName?: string;
  },
  clientPhone?: string,
  clientBookings?: { id: string; bookingCode?: string; customerPhone?: string }[],
  clearedNotifIds?: Set<string>,
  clientTier?: string
): boolean {
  if (clearedNotifIds && clearedNotifIds.has(notif.id)) {
    return false;
  }

  // 1. If role is specifically for admin, superadmin, or barber staff, never show to client
  if (notif.forRole === 'admin' || notif.forRole === 'superadmin' || notif.forRole === 'barber') {
    return false;
  }

  // 2. Exclude internal admin types (such as new client self-registration or feedback alerts)
  if (notif.type === 'client_registered') {
    return false;
  }

  // Check client session token
  const session = getClientSession();
  if (!clientTier && session?.memberTier) clientTier = session.memberTier;

  // Gather all valid phone numbers strictly for this specific client
  const rawPhones: (string | undefined)[] = [
    clientPhone,
    session?.phone,
  ];

  let localUserId = session?.clientId || '';

  // Check user profile storage
  try {
    const rawProfile = localStorage.getItem('baba_user_profile_v1');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed.phone) rawPhones.push(parsed.phone);
      if (parsed.id && !localUserId) localUserId = parsed.id;
      if (!clientTier && parsed.memberTier) clientTier = parsed.memberTier;
    }
  } catch {}

  // Check verified local client booking phone
  try {
    const bPhone = localStorage.getItem('baba_booking_customer_phone');
    if (bPhone) rawPhones.push(bPhone);
  } catch {}

  const clientPhones = rawPhones.filter((p): p is string => {
    if (!p) return false;
    const norm = normalizePhoneNumber(p);
    return norm.length >= 7 && norm !== '0000000000' && !norm.startsWith('000000');
  });

  const effectiveTier = (clientTier || session?.memberTier || 'Bronze').toLowerCase();
  const primaryPhone = clientPhones[0] || '';
  const myStoredIds = getMyBookingIds(primaryPhone);

  // 3. If targeted to a specific client ID
  if (notif.targetClientId) {
    if (!localUserId || notif.targetClientId !== localUserId) {
      return false;
    }
    return true;
  }

  // 4. If targeted to a specific client phone number (direct 1-on-1 notification)
  if (notif.targetClientPhone && normalizePhoneNumber(notif.targetClientPhone) !== '0000000000') {
    if (clientPhones.length === 0) return false;
    const isPhoneMatch = clientPhones.some((p) => phonesMatch(p, notif.targetClientPhone));
    return isPhoneMatch;
  }

  // 5. If it is a booking-specific notification (status_change, new_booking, cancellation, reschedule)
  if (
    notif.bookingId ||
    notif.type === 'new_booking' ||
    notif.type === 'status_change' ||
    notif.type === 'cancellation' ||
    notif.type === 'reschedule'
  ) {
    // If the notification has a customerPhone and client has known phone(s)
    if (notif.customerPhone && normalizePhoneNumber(notif.customerPhone) !== '0000000000') {
      if (clientPhones.length > 0) {
        const isPhoneMatch = clientPhones.some((p) => phonesMatch(p, notif.customerPhone));
        // If phone matches, deliver. If phone DOES NOT match, STRICTLY REJECT (belongs to Client B, not Client A)
        return isPhoneMatch;
      }
    }

    // Check against this client's filtered bookings list
    if (notif.bookingId && clientBookings && clientBookings.length > 0) {
      const clientFiltered = getClientBookings(clientBookings, primaryPhone);
      const matchesBooking = clientFiltered.some(
        (b) => b.id === notif.bookingId || b.bookingCode === notif.bookingId
      );
      if (matchesBooking) {
        return true;
      }
    }

    // If client has NO phone registered (anonymous guest session only), allow if locally saved
    if (clientPhones.length === 0 && notif.bookingId && myStoredIds.has(notif.bookingId)) {
      return true;
    }

    // A booking notification that belongs to another customer must NEVER be visible
    return false;
  }

  // 6. If it has a specific customer phone (direct message)
  if (notif.customerPhone && normalizePhoneNumber(notif.customerPhone) !== '0000000000') {
    if (clientPhones.length === 0) return false;
    const isPhoneMatch = clientPhones.some((p) => phonesMatch(p, notif.customerPhone));
    return isPhoneMatch;
  }

  // 7. If targeted to a specific member tier (e.g. VIP only, Gold only)
  if (notif.targetMemberTier && notif.targetMemberTier !== 'All') {
    const targetTierNorm = notif.targetMemberTier.toLowerCase();
    if (effectiveTier !== targetTierNorm) {
      return false;
    }
    return true;
  }

  // 8. If general broadcast to all clients (without specific phone, without bookingId, without designer targeting)
  if (
    (notif.forRole === 'all' || notif.forRole === 'user' || !notif.forRole) &&
    !notif.bookingId &&
    !notif.customerPhone &&
    !notif.targetClientPhone &&
    !notif.targetClientId &&
    !notif.designerId &&
    (notif.type === 'broadcast' || notif.type === 'promo' || notif.type === 'announcement' || notif.type === 'notice' || !notif.type)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a notification belongs strictly to a specific barber
 */
export function isNotificationForBarber(
  notif: {
    id: string;
    forRole?: string;
    type?: string;
    bookingId?: string;
    designerId?: string;
    designerName?: string;
    designerPhone?: string;
    customerPhone?: string;
    targetClientPhone?: string;
    targetClientId?: string;
    targetMemberTier?: string;
  },
  barberId?: string,
  barberPhone?: string,
  barberName?: string,
  clearedNotifIds?: Set<string>
): boolean {
  if (clearedNotifIds && clearedNotifIds.has(notif.id)) {
    return false;
  }

  // 1. If specifically for user/client or superadmin or admin, barber should not receive it
  if (notif.forRole === 'user' || notif.forRole === 'superadmin' || notif.forRole === 'admin') {
    return false;
  }

  // 2. Barbers never receive client-specific or tier-specific promotions or internal admin registration alerts
  if (notif.targetMemberTier || notif.targetClientPhone || notif.targetClientId || notif.type === 'client_registered') {
    return false;
  }

  // Get active barber identifiers
  let activeId = barberId || localStorage.getItem('baba_active_barber_id') || '';
  let activePhone = barberPhone || localStorage.getItem('baba_active_barber_phone') || '';
  let activeName = barberName || localStorage.getItem('baba_active_barber_name') || '';

  // Check saved barber session as fallback
  if (!activeId) {
    try {
      const rawBarber = localStorage.getItem('baba_barber_session');
      if (rawBarber) {
        const parsed = JSON.parse(rawBarber);
        if (parsed.barberId || parsed.id) activeId = parsed.barberId || parsed.id;
        if (parsed.phone) activePhone = parsed.phone;
        if (parsed.barberName || parsed.name) activeName = parsed.barberName || parsed.name;
      }
    } catch {}
  }

  // Check active barber obj in localStorage
  if (!activeId || !activeName) {
    try {
      const rawObj = localStorage.getItem('baba_active_barber_obj');
      if (rawObj) {
        const parsedObj = JSON.parse(rawObj);
        if (parsedObj?.id && !activeId) activeId = parsedObj.id;
        if (parsedObj?.phone && !activePhone) activePhone = parsedObj.phone;
        if (parsedObj?.name && !activeName) activeName = parsedObj.name;
      }
    } catch {}
  }

  // If barber is not authenticated on this device, never deliver barber notifications
  if (!activeId && !activePhone && !activeName) {
    return false;
  }

  // 3. If notification is booking-related or has designer targeting
  if (
    notif.designerId ||
    notif.designerName ||
    (notif as any).designerPhone ||
    notif.bookingId ||
    notif.type === 'new_booking' ||
    notif.type === 'status_change' ||
    notif.type === 'cancellation' ||
    notif.type === 'reschedule'
  ) {
    let matched = false;

    // Direct ID match
    if (notif.designerId && activeId) {
      if (notif.designerId === activeId) {
        matched = true;
      } else {
        return false;
      }
    }

    // Phone match
    if (!matched && (notif as any).designerPhone && activePhone) {
      if (phonesMatch(activePhone, (notif as any).designerPhone)) {
        matched = true;
      } else {
        return false;
      }
    }

    // Flexible name match
    if (!matched && notif.designerName && activeName) {
      if (namesMatch(notif.designerName, activeName)) {
        matched = true;
      } else {
        return false;
      }
    }

    // If designer details were specified and didn't match, return false
    if (notif.designerId || notif.designerName || (notif as any).designerPhone) {
      return matched;
    }

    // If it's a general barber notification without specific designer tag
    if (notif.forRole === 'barber') {
      return true;
    }

    return matched;
  }

  // 4. If it's for barber role generally (staff announcement to all barbers)
  if (notif.forRole === 'barber') {
    return true;
  }

  // 5. General shop announcements for all (no booking, no designer, no customer, no tier)
  if (
    notif.forRole === 'all' &&
    (notif.type === 'announcement' || notif.type === 'broadcast' || notif.type === 'notice')
  ) {
    return true;
  }

  return false;
}

/**
 * Auto-delete read notifications after 5 minutes (300 seconds = 300,000 ms)
 */
export const NOTIFICATION_AUTO_EXPIRE_MS = 5 * 60 * 1000; // 5 minutes

export function getNotificationRemainingSeconds(n: { read: boolean; readAt?: string | number; timestamp: string }): number | null {
  if (!n.read) return null;
  const readTimestamp = n.readAt ? new Date(n.readAt).getTime() : new Date(n.timestamp).getTime();
  const elapsed = Date.now() - readTimestamp;
  const remainingMs = NOTIFICATION_AUTO_EXPIRE_MS - elapsed;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export function formatRemainingTime(seconds: number, lang: 'en' | 'my' = 'my'): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  return lang === 'my' ? `${formatted} တွင် ပျက်မည်` : `Clears in ${formatted}`;
}
