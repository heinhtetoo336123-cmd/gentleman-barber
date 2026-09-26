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
  X,
  Bell,
  CheckCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Megaphone,
  Gift,
  Trash2,
  Star,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminBroadcastModal } from './AdminBroadcastModal';
import { AutoDeleteCountdownBadge } from './AutoDeleteCountdownBadge';
import { BarberRatingModal } from './BarberRatingModal';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  bookings?: Booking[];
  role: UserRole;
  currentBarberId?: string;
  lang: Language;
  onMarkAllRead: () => void;
  onRefreshAll?: () => void | Promise<void>;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  bookings = [],
  role,
  currentBarberId,
  lang,
  onMarkAllRead,
  onRefreshAll,
}) => {
  const t = translations[lang];

  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => getClearedNotificationIds());
  const [clientPhone, setClientPhone] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Rating Modal state
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [ratingToast, setRatingToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClearedIds(getClearedNotificationIds());
      try {
        const stored = localStorage.getItem('baba_user_profile_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.phone) setClientPhone(parsed.phone);
        }
      } catch {}
    }
  }, [isOpen]);

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

  const findRelatedBooking = (relatedId?: string, item?: NotificationItem): Booking | undefined => {
    if (relatedId) {
      const found = bookings?.find((b) => b.id === relatedId || b.bookingCode === relatedId);
      if (found) return found;
    }
    if (item) {
      // 1. Check if booking code like WLK-1234 or wlk-1234 exists in title, message or ID
      const fullText = `${item.title || ''} ${item.message || ''} ${item.id || ''}`;
      const codeMatch = fullText.match(/WLK-[A-Za-z0-9_-]+/i);
      if (codeMatch) {
        const matchedCode = codeMatch[0].toUpperCase();
        const found = bookings?.find((b) => b.bookingCode?.toUpperCase() === matchedCode || b.id.toLowerCase() === matchedCode.toLowerCase());
        if (found) return found;
      }

      // 2. Check by designer and customer name
      if (item.designerId && item.customerName) {
        const found = bookings?.find((b) => b.designerId === item.designerId && b.customerName === item.customerName);
        if (found) return found;
      }

      // 3. Resilient Fallback for Walk-in notifications: synthesize valid booking object so Rating button NEVER disappears
      const isWalkin = item.title.includes('Walk-in') || item.message.includes('Walk-in') || item.id.includes('wlk');
      if (isWalkin && (item.designerId || item.designerName)) {
        return {
          id: item.bookingId || item.id,
          bookingCode: codeMatch ? codeMatch[0].toUpperCase() : 'WLK',
          serviceId: 'srv-walkin',
          serviceName: item.message.includes('"') ? (item.message.split('"')[1] || 'Walk-in Service') : 'Walk-in Service',
          servicePrice: 0,
          price: 0,
          serviceDuration: 30,
          designerId: item.designerId || 'unknown',
          designerName: item.designerName || 'Stylist',
          designerAvatar: '',
          customerName: item.customerName || 'Walk-in Guest',
          customerPhone: item.customerPhone || '',
          customerEmail: '',
          date: item.timestamp ? item.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
          timeSlot: 'Walk-in',
          status: 'completed',
          paymentMethod: 'cash',
          paymentStatus: 'verified',
          isWalkin: true,
          createdAt: item.timestamp,
          updatedAt: item.timestamp
        } as Booking;
      }
    }
    return undefined;
  };

  if (!isOpen) return null;

  // Filter notifications based on role and client phone/booking scoping
  const relevantNotifs = notifications.filter((n) => {
    if (clearedIds.has(n.id)) return false;
    if (role === 'superadmin') {
      return false;
    }
    if (role === 'admin') {
      return n.forRole === 'admin' || n.forRole === 'all' || !n.forRole;
    }
    if (role === 'barber') {
      return isNotificationForBarber(n, currentBarberId, undefined, undefined, clearedIds);
    }
    return isNotificationForClient(n, clientPhone, bookings, clearedIds);
  });

  const unreadCount = relevantNotifs.filter((n) => !n.read).length;

  const handleOpenRating = (booking: Booking, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRatingBooking(booking);
    playNotificationChime();
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    playNotificationChime();
    if (!item.read) {
      try {
        await api.markNotificationsRead(role, [item.id]);
        item.read = true;
        item.readAt = new Date().toISOString();
      } catch {}
    }

    const related = findRelatedBooking(item.bookingId, item);

    // Helper to verify that the notification itself is strictly a service completion notification
    const isCompletionNotificationItem = (n: NotificationItem): boolean => {
      if (
        n.type === 'new_booking' ||
        n.type === 'cancellation' ||
        n.type === 'reschedule' ||
        n.title.includes('တင်ပြီးပါပြီ') ||
        n.title.includes('Booking အသစ်') ||
        n.title.includes('အတည်ပြု') ||
        n.title.includes('ပယ်ဖျက်') ||
        n.title.includes('စတင်နေပါပြီ')
      ) {
        return false;
      }
      return (
        n.type === 'completion' ||
        n.title.includes('ပြီးမြောက်') ||
        n.title.includes('Completed') ||
        n.message.includes('ပြီးဆုံးပါပြီ')
      );
    };

    // Case 1: CLIENT SIDE (Online Booking Completion Notification ONLY)
    // "BARBER RATING က BOOKING ဆိုရင် CLIENT SIDE ကို COMPLETE NOTIFICATION ချတော့မှ NOTIFICATION ကိုနှိပ်ပြီး လုပ်လို့ရအောင်လုပ်ပေးပါ"
    // "BOOKING တင်ပြီးပါပြီ NOTIFICATION မှာ RATING ပေးလို့မရဘူးနော် ပါနေသေးတယ်။ COMPLETED တစ်ခုထဲမှာပဲပေးလို့ရရမှာ"
    if (role === 'user' && related && isCompletionNotificationItem(item)) {
      handleOpenRating(related);
      return;
    }

    // Case 2: ADMIN SIDE (Walk-in Notification)
    const isWalkinNotif =
      (related && (related.isWalkin || (related.notes && related.notes.includes('Walk-in')))) ||
      item.title.includes('Walk-in') ||
      item.message.includes('Walk-in') ||
      item.id.includes('wlk');

    if ((role === 'admin' || role === 'superadmin') && related && isWalkinNotif) {
      handleOpenRating(related);
      return;
    }

    setSelectedNotif(item);
  };

  const handleDeleteSingle = async (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation();
    try {
      addClearedNotificationId(id);
      refreshClearedList();
      if (selectedNotif?.id === id) setSelectedNotif(null);
      await api.deleteNotification(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoExpire = (id: string) => {
    handleDeleteSingle(null, id);
  };

  const handleClearAll = async () => {
    if (confirm(lang === 'my' ? 'သတိပေးချက်များ အားလုံးကို ရှင်းလင်းရန် သေချာပါသလား?' : 'Clear all notifications?')) {
      try {
        const ids = relevantNotifs.map((n) => n.id);
        addMultipleClearedNotificationIds(ids);
        refreshClearedList();
        setSelectedNotif(null);
        playSuccessChime();

        if (role === 'admin') {
          await api.clearAllNotifications('admin');
        } else {
          await api.clearAllNotifications('user', ids);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getNotifIcon = (item: NotificationItem) => {
    if (item.type === 'promo') return <Gift className="w-4 h-4 text-emerald-600" />;
    if (item.type === 'announcement' || item.type === 'broadcast') return <Megaphone className="w-4 h-4 text-emerald-700" />;
    if (item.title.includes('အတည်ပြု') || item.title.includes('Confirmed')) return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (item.title.includes('ပယ်ဖျက်') || item.title.includes('Cancelled')) return <XCircle className="w-4 h-4 text-rose-600" />;
    return <Bell className="w-4 h-4 text-stone-700" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="bg-white rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-stone-200 overflow-hidden max-h-[88vh]"
      >
        {/* Clean Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <Bell className="w-4 h-4 text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-stone-950">
                  {lang === 'my' ? 'သတိပေးချက်များ' : 'Notifications'}
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-emerald-700 text-white font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {role === 'admin' && (
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                <Megaphone className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden sm:inline">{lang === 'my' ? 'ပို့မည်' : 'Broadcast'}</span>
              </button>
            )}

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ဖတ်ပြီး' : 'Read all'}</span>
              </button>
            )}

            {relevantNotifs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 cursor-pointer transition-colors"
                title="Clear All"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-stone-200 text-stone-500 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Notifications List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 bg-stone-50/40 divide-y-0">
          {relevantNotifs.length === 0 ? (
            <div className="text-center py-10 space-y-2 bg-white rounded-2xl border border-black/5 p-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-stone-800">
                {lang === 'my' ? 'သတိပေးချက် မရှိသေးပါ' : 'No notifications'}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {relevantNotifs.map((item) => {
                const relatedBooking = findRelatedBooking(item.bookingId, item);
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
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  whileDrag={{ scale: 0.98, opacity: 0.75 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 75 || Math.abs(info.velocity.x) > 350) {
                      handleDeleteSingle(null, item.id);
                    }
                  }}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-2xl border transition-colors cursor-pointer select-none relative flex items-start justify-between gap-2.5 ${
                    !item.read
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      {getNotifIcon(item)}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h4 className={`text-xs truncate ${!item.read ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                          {item.title}
                        </h4>
                        {!item.read && (
                          <span className="bg-emerald-700 text-white font-black text-[8px] px-1.5 py-0.2 rounded-full font-mono">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed break-words">
                        {item.message}
                      </p>
                      <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1 text-[10px] text-stone-400 font-mono">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {/* Auto-Delete 5min Countdown Badge for Read items */}
                        <AutoDeleteCountdownBadge
                          notification={item}
                          lang={lang}
                          onExpire={handleAutoExpire}
                        />
                      </div>

                      {/* Rating Buttons / Badges */}
                      {relatedBooking && (
                        <div className="pt-1.5 flex items-center space-x-2 flex-wrap gap-y-1">
                          {/* Client Side for Completed Booking ONLY */}
                          {role === 'user' &&
                            !item.type?.includes('new_booking') &&
                            !item.title.includes('တင်ပြီးပါပြီ') &&
                            !item.title.includes('Booking အသစ်') &&
                            !item.title.includes('အတည်ပြု') &&
                            !item.title.includes('ပယ်ဖျက်') &&
                            !item.title.includes('စတင်နေပါပြီ') &&
                            (item.type === 'completion' || item.title.includes('ပြီးမြောက်') || item.title.includes('Completed') || item.message.includes('ပြီးဆုံးပါပြီ')) && (
                            relatedBooking.rating ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md font-mono">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                <span>Rated {relatedBooking.rating}/5 (ပြီးပါပြီ)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleOpenRating(relatedBooking, e)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                              >
                                <Star className="w-2.5 h-2.5 fill-white text-white" />
                                <span>{lang === 'my' ? 'Barber Rating ပေးမည်' : 'Rate Barber'}</span>
                              </button>
                            )
                          )}

                          {/* Admin Side for Walk-in Booking */}
                          {(role === 'admin' || role === 'superadmin') && (relatedBooking.isWalkin || item.title.includes('Walk-in') || item.id.includes('wlk')) && (
                            relatedBooking.rating ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md font-mono">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                <span>Rated {relatedBooking.rating}/5 (ပြီးပါပြီ)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleOpenRating(relatedBooking, e)}
                                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[10px] font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                              >
                                <Star className="w-2.5 h-2.5 fill-white text-white" />
                                <span>{lang === 'my' ? 'Barber Rating ပေးမည် (Walk-in)' : 'Rate Walk-in Barber'}</span>
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(e, item.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-stone-100 bg-white flex items-center justify-between text-xs">
          <span className="text-stone-500 text-[11px] font-mono">
            {relevantNotifs.length} {lang === 'my' ? 'ခု' : 'items'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold rounded-xl cursor-pointer transition-colors"
          >
            {lang === 'my' ? 'ပိတ်မည်' : 'Close'}
          </button>
        </div>
      </motion.div>

      {/* Broadcast Modal for Admin */}
      <AdminBroadcastModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        lang={lang}
        onSuccess={handleManualRefresh}
      />

      {/* Barber Rating Modal (One-Time Rating Enforced) */}
      <BarberRatingModal
        isOpen={Boolean(ratingBooking)}
        booking={ratingBooking}
        role={role}
        lang={lang}
        onClose={() => setRatingBooking(null)}
        onSuccess={(_ratedBooking, rating) => {
          setRatingBooking(null);
          if (onRefreshAll) onRefreshAll();
        }}
      />
    </div>
  );
};
