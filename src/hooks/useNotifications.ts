import { useState, useEffect, useCallback, useMemo } from 'react';
import { NotificationItem, UserRole } from '../types';
import { api } from '../api/client';
import {
  isNotificationForBarber,
  isNotificationForClient,
  getClearedNotificationIds,
  addClearedNotificationId,
  addMultipleClearedNotificationIds
} from '../utils/notifications';
import { playSuccessChime, playNotificationChime } from '../utils/audio';

export interface UseNotificationsOptions {
  role?: UserRole | 'all';
  barberId?: string;
  barberPhone?: string;
  barberName?: string;
  clientPhone?: string;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { role = 'all', barberId, barberPhone, barberName, clientPhone } = options;

  // Initial local state from cache (0ms instant sync)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return api.getCachedNotifications(role);
  });

  // Filtered list strictly scoped to the active role/barber/client
  const scopedNotifications = useMemo(() => {
    const clearedIds = getClearedNotificationIds();
    if (role === 'barber') {
      return notifications.filter((n) =>
        isNotificationForBarber(n, barberId, barberPhone, barberName, clearedIds)
      );
    }
    if (role === 'user') {
      return notifications.filter((n) =>
        isNotificationForClient(n, clientPhone, undefined, clearedIds)
      );
    }
    if (role === 'admin') {
      return notifications.filter(
        (n) =>
          !clearedIds.has(n.id) &&
          (n.forRole === 'admin' || (n.forRole === 'all' && !n.targetMemberTier && !n.targetClientPhone) || !n.forRole)
      );
    }
    if (role === 'superadmin') {
      return [];
    }
    return notifications.filter((n) => !clearedIds.has(n.id));
  }, [notifications, role, barberId, barberPhone, barberName, clientPhone]);

  const unreadCount = useMemo(() => {
    return scopedNotifications.filter((n) => !n.read).length;
  }, [scopedNotifications]);

  // Subscribe to realtime notifications (strictly scoped and limited query)
  useEffect(() => {
    if (role === 'superadmin') return;

    const unsubscribe = api.subscribeToNotifications(
      role,
      (fresh) => {
        setNotifications(fresh);
      },
      { barberId, limitCount: 20 }
    );

    return () => {
      unsubscribe();
    };
  }, [role, barberId]);

  // 1. OPTIMISTIC IN-MEMORY DELETE (ZERO SERVER RE-FETCH)
  const deleteNotification = useCallback(async (id: string) => {
    // a) Immediately remove from local React state
    addClearedNotificationId(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // b) Atomic delete to Firestore (Zero re-fetch, zero side-effects)
    try {
      await api.deleteNotification(id);
    } catch (err) {
      console.warn('Atomic deleteNotification failed:', err);
    }
  }, []);

  // 2. OPTIMISTIC IN-MEMORY CLEAR ALL / MULTIPLE (ZERO SERVER RE-FETCH)
  const clearNotifications = useCallback(
    async (ids?: string[]) => {
      const targetIds = ids || scopedNotifications.map((n) => n.id);
      if (targetIds.length === 0) return;

      addMultipleClearedNotificationIds(targetIds);
      const targetSet = new Set(targetIds);
      setNotifications((prev) => prev.filter((n) => !targetSet.has(n.id)));
      playSuccessChime();

      try {
        await api.clearAllNotifications(role, targetIds);
      } catch (err) {
        console.warn('Atomic clearAllNotifications failed:', err);
      }
    },
    [scopedNotifications, role]
  );

  // 3. OPTIMISTIC IN-MEMORY MARK READ (ZERO SERVER RE-FETCH)
  const markAsRead = useCallback(
    async (id: string) => {
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: n.readAt || nowIso } : n))
      );
      playNotificationChime();

      try {
        await api.markNotificationsRead(role, [id]);
      } catch (err) {
        console.warn('Atomic markNotificationsRead failed:', err);
      }
    },
    [role]
  );

  // 4. OPTIMISTIC IN-MEMORY MARK ALL AS READ (ZERO SERVER RE-FETCH)
  const markAllAsRead = useCallback(async () => {
    const unreadIds = scopedNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const nowIso = new Date().toISOString();
    const idSet = new Set(unreadIds);
    setNotifications((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, read: true, readAt: n.readAt || nowIso } : n))
    );
    playSuccessChime();

    try {
      await api.markNotificationsRead(role, unreadIds);
    } catch (err) {
      console.warn('Atomic markAllAsRead failed:', err);
    }
  }, [scopedNotifications, role]);

  return {
    notifications: scopedNotifications,
    rawNotifications: notifications,
    unreadCount,
    deleteNotification,
    clearNotifications,
    markAsRead,
    markAllAsRead,
    setNotifications,
  };
}
