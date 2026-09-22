import React, { useState, useEffect, useRef } from 'react';
import { NotificationItem, UserRole, Booking } from '../types';
import { Language, translations } from '../data/i18n';
import { api } from '../api/client';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import {
  isNotificationForClient,
  isNotificationForBarber,
  getClearedNotificationIds,
  addClearedNotificationId,
  addMultipleClearedNotificationIds,
} from '../utils/notifications';
import {
  Bell,
  CheckCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  Trash2,
  Megaphone,
  Gift,
  Star,
  Check,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminBroadcastModal } from './AdminBroadcastModal';
import { AutoDeleteCountdownBadge } from './AutoDeleteCountdownBadge';

interface NotificationsFeedProps {
  notifications: NotificationItem[];
  bookings?: Booking[];
  role: UserRole;
  lang: Language;
  onMarkAllRead: () => void;
  onRefreshAll?: () => void | Promise<void>;
  onOpenBookingDetails?: (booking: Booking) => void;
  onSwitchTab?: (tabId: string) => void;
}

export const NotificationsFeed: React.FC<NotificationsFeedProps> = ({
  notifications,
  bookings = [],
  role,
  lang,
  onMarkAllRead,
  onRefreshAll,
  onOpenBookingDetails,
}) => {
  const t = translations[lang];

  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'bookings' | 'broadcasts' | 'unread'>('all');
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => getClearedNotificationIds());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selection mode for long-press & batch operations
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Client profile for notification matching
  const [clientPhone, setClientPhone] = useState<string>('');

  // Rating via Notification states
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [ratingToast, setRatingToast] = useState<string | null>(null);

  // Long press timer ref
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('baba_user_profile_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.phone) setClientPhone(parsed.phone);
      }
    } catch {}
  }, []);

  const refreshClearedList = () => {
    setClearedIds(getClearedNotificationIds());
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    playNotificationChime();
    refreshClearedList();
    try {
      if (onRefreshAll) {
        await onRefreshAll();
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter notifications based on role and phone/booking scoping
  const relevantNotifs = notifications.filter((n) => {
    if (clearedIds.has(n.id)) return false;
    if (role === 'superadmin') return false;
    if (role === 'admin') {
      return n.forRole === 'admin' || n.forRole === 'all' || !n.forRole;
    }
    if (role === 'barber') {
      return isNotificationForBarber(n, undefined, undefined, undefined, clearedIds);
    }
    return isNotificationForClient(n, clientPhone, bookings, clearedIds);
  });

  const unreadCount = relevantNotifs.filter((n) => !n.read).length;

  const bookingsNotifCount = relevantNotifs.filter(
    (n) => n.bookingId || n.type === 'new_booking' || n.type === 'status_change' || n.type === 'cancellation'
  ).length;

  const broadcastsNotifCount = relevantNotifs.filter(
    (n) => n.type === 'broadcast' || n.type === 'promo' || n.type === 'announcement'
  ).length;

  const displayedNotifs = relevantNotifs.filter((n) => {
    if (filterType === 'unread') return !n.read;
    if (filterType === 'bookings') {
      return n.bookingId || n.type === 'new_booking' || n.type === 'status_change' || n.type === 'cancellation';
    }
    if (filterType === 'broadcasts') {
      return n.type === 'broadcast' || n.type === 'promo' || n.type === 'announcement';
    }
    return true;
  });

  // Long press handler functions
  const handleTouchStart = (id: string) => {
    isLongPressTriggeredRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsSelectionMode(true);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      playNotificationChime();
    }, 450);
  };

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const toggleSelectId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayedNotifs.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(displayedNotifs.map((n) => n.id)));
      setIsSelectionMode(true);
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    const targetIds = Array.from(selectedIds);
    try {
      await api.markNotificationsRead(role, targetIds);
      displayedNotifs.forEach((n) => {
        if (selectedIds.has(n.id)) {
          n.read = true;
        }
      });
      playSuccessChime();
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const targetIds = Array.from(selectedIds);
    try {
      addMultipleClearedNotificationIds(targetIds);
      refreshClearedList();
      for (const id of targetIds) {
        await api.deleteNotification(id);
      }
      playSuccessChime();
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      if (selectedNotif && targetIds.includes(selectedNotif.id)) {
        setSelectedNotif(null);
      }
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (isLongPressTriggeredRef.current) return;
    if (isSelectionMode) {
      toggleSelectId(item.id);
      return;
    }

    playNotificationChime();
    setSelectedNotif(item);
    if (!item.read) {
      try {
        await api.markNotificationsRead(role, [item.id]);
        item.read = true;
        item.readAt = new Date().toISOString();
      } catch {}
    }
  };

  const findRelatedBooking = (relatedId?: string): Booking | undefined => {
    if (!relatedId) return undefined;
    return bookings.find((b) => b.id === relatedId || b.bookingCode === relatedId);
  };

  const handleDeleteSingleNotification = async (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation();
    try {
      addClearedNotificationId(id);
      refreshClearedList();
      await api.deleteNotification(id);
      if (selectedNotif?.id === id) setSelectedNotif(null);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoExpire = (id: string) => {
    handleDeleteSingleNotification(null, id);
  };

  const handleOpenRatingFromNotif = (booking: Booking, defaultRating = 5, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRatingBooking(booking);
    setSelectedRating(defaultRating);
    setReviewNote('');
    playNotificationChime();
  };

  const handleSubmitRatingFromNotif = async () => {
    if (!ratingBooking) return;
    setRatingSubmitting(true);
    try {
      await api.rateBooking(ratingBooking.id, selectedRating, reviewNote.trim() || undefined);
      playSuccessChime();
      setRatingBooking(null);
      setRatingToast(
        lang === 'my'
          ? `ကျေးဇူးတင်ပါသည်! Rating ${selectedRating}⭐️ ပေးပြီး +50 Points ရရှိပါသည်!`
          : `Thank you! Rated ${selectedRating}⭐️ (+50 Points credited)!`
      );
      if (onRefreshAll) await onRefreshAll();
      setTimeout(() => setRatingToast(null), 4000);
    } catch (err) {
      console.error('Submit rating error:', err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const getNotifIcon = (item: NotificationItem) => {
    if (item.type === 'promo') return <Gift className="w-3.5 h-3.5 text-emerald-700" />;
    if (item.type === 'announcement' || item.type === 'broadcast') return <Megaphone className="w-3.5 h-3.5 text-emerald-800" />;
    if (item.title.includes('အတည်ပြု') || item.title.includes('Confirmed')) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    if (item.title.includes('ပယ်ဖျက်') || item.title.includes('Cancelled')) return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
    return <Bell className="w-3.5 h-3.5 text-emerald-700" />;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-16">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl p-3 px-4 flex items-center justify-between border border-emerald-100 shadow-2xs">
        <div className="flex items-center space-x-2">
          <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            {lang === 'my' ? 'သတိပေးချက်များ' : 'Alerts'}
          </h2>
          {unreadCount > 0 && (
            <span className="bg-emerald-700 text-white font-bold font-mono text-[9px] px-2 py-0.5 rounded-full">
              {unreadCount} {lang === 'my' ? 'သစ်' : 'New'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {role === 'admin' && (
            <button
              onClick={() => setIsBroadcastModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
            >
              <Megaphone className="w-3 h-3 text-emerald-200" />
              <span>{lang === 'my' ? 'ကြေညာချက်' : 'Broadcast'}</span>
            </button>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center cursor-pointer transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Segmented Filter Pills */}
      {relevantNotifs.length > 0 && (
        <div className="bg-emerald-50/70 p-1 rounded-xl flex items-center space-x-1 border border-emerald-100/60">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              filterType === 'all'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-emerald-900'
            }`}
          >
            {lang === 'my' ? 'အားလုံး' : 'All'} ({relevantNotifs.length})
          </button>

          <button
            onClick={() => setFilterType('bookings')}
            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              filterType === 'bookings'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-emerald-900'
            }`}
          >
            {lang === 'my' ? 'ရက်ချိန်း' : 'Bookings'} ({bookingsNotifCount})
          </button>

          <button
            onClick={() => setFilterType('broadcasts')}
            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              filterType === 'broadcasts'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-emerald-900'
            }`}
          >
            {lang === 'my' ? 'ကြေညာချက်' : 'Promos'} ({broadcastsNotifCount})
          </button>

          <button
            onClick={() => setFilterType('unread')}
            className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              filterType === 'unread'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-emerald-900'
            }`}
          >
            {lang === 'my' ? 'မဖတ်ရသေး' : 'Unread'} ({unreadCount})
          </button>
        </div>
      )}

      {/* Empty State */}
      {relevantNotifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-emerald-100 p-8 text-center space-y-2 shadow-2xs">
          <Bell className="w-6 h-6 text-stone-300 mx-auto" />
          <p className="text-xs font-bold text-stone-700">
            {lang === 'my' ? 'သတိပေးချက် မရှိသေးပါ' : 'No notifications'}
          </p>
        </div>
      ) : displayedNotifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 text-center space-y-1">
          <p className="text-xs font-bold text-stone-600">
            {lang === 'my' ? 'ဤကဏ္ဍတွင် သတိပေးချက် မရှိပါ' : 'No items in this filter'}
          </p>
          <button
            onClick={() => setFilterType('all')}
            className="text-xs text-emerald-700 font-bold underline cursor-pointer"
          >
            {lang === 'my' ? 'အားလုံးကြည့်မည်' : 'View all'}
          </button>
        </div>
      ) : (
        /* Compact Notification Cards List with Swipe-to-Dismiss */
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {displayedNotifs.map((item) => {
              const relatedBooking = findRelatedBooking(item.bookingId);
              const isSelected = selectedIds.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: -200,
                    height: 0,
                    marginBottom: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    transition: { duration: 0.22, ease: 'easeOut' }
                  }}
                  drag={!isSelectionMode ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  whileDrag={{ scale: 0.98, opacity: 0.75 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 75 || Math.abs(info.velocity.x) > 350) {
                      handleDeleteSingleNotification(null, item.id);
                    }
                  }}
                  onMouseDown={() => handleTouchStart(item.id)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onTouchStart={() => handleTouchStart(item.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-colors cursor-pointer select-none relative flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-100 border-emerald-500 shadow-xs'
                      : !item.read
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs hover:border-emerald-400'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  {/* Selection Checkbox (Active in Selection Mode) */}
                  {isSelectionMode && (
                    <div
                      onClick={(e) => toggleSelectId(item.id, e)}
                      className="shrink-0 mt-0.5 cursor-pointer"
                    >
                      {isSelected ? (
                        <div className="w-5 h-5 rounded bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-stone-300 bg-white" />
                      )}
                    </div>
                  )}

                  {/* Compact Icon */}
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getNotifIcon(item)}
                  </div>

                  {/* Info & Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <h4 className={`text-xs truncate ${!item.read ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                          {item.title}
                        </h4>
                        {!item.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-snug">
                      {item.message}
                    </p>

                    {/* Rating trigger for completed booking */}
                    {relatedBooking && (relatedBooking.status === 'completed' || item.title.includes('ပြီးစီး')) && !relatedBooking.rating && (
                      <div className="pt-1">
                        <button
                          onClick={(e) => handleOpenRatingFromNotif(relatedBooking, 5, e)}
                          className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded-md flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
                        >
                          <Star className="w-2.5 h-2.5 fill-white" />
                          <span>Rating</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Floating Selection Action Bar (Long-Press Activated - Safely Positioned Above Bottom Navigation) */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-24 sm:bottom-8 left-4 right-4 max-w-md mx-auto z-60 bg-emerald-950 text-white rounded-2xl p-3 px-4 shadow-2xl border-2 border-emerald-600/80 flex items-center justify-between gap-2"
          >
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs bg-emerald-800 px-2.5 py-1 rounded-lg font-mono">
                {selectedIds.size}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-emerald-200 hover:text-white underline font-semibold cursor-pointer"
              >
                {selectedIds.size === displayedNotifs.length ? 'Deselect' : 'Select All'}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleMarkSelectedAsRead}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ဖတ်ပြီး' : 'Read'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ဖျက်မည်' : 'Delete'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Notification Detailed Modal */}
      <AnimatePresence>
        {selectedNotif && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-emerald-100 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    {getNotifIcon(selectedNotif)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-stone-900">{selectedNotif.title}</h3>
                    <p className="text-[10px] text-stone-400 font-mono">
                      {new Date(selectedNotif.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-stone-800 leading-relaxed break-words">
                {selectedNotif.message}
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => handleDeleteSingleNotification(null, selectedNotif.id)}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{lang === 'my' ? 'ဖျက်မည်' : 'Delete'}</span>
                </button>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
                >
                  {lang === 'my' ? 'ပိတ်မည်' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Broadcast Modal */}
      {isBroadcastModalOpen && (
        <AdminBroadcastModal
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
          lang={lang}
          onSuccess={() => {
            if (onRefreshAll) onRefreshAll();
          }}
        />
      )}
    </div>
  );
};
