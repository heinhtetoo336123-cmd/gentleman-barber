import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, X, Clock, AlertCircle, CheckCircle2, Megaphone, Gift, Sparkles } from 'lucide-react';
import { NotificationItem, UserRole } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { formatTimeAgo } from '../utils/formatters';

export interface NotificationDropdownProps {
  role?: UserRole | 'all';
  barberId?: string;
  barberPhone?: string;
  barberName?: string;
  clientPhone?: string;
  lang?: 'en' | 'my';
  onSelectNotification?: (item: NotificationItem) => void;
  className?: string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  role = 'all',
  barberId,
  barberPhone,
  barberName,
  clientPhone,
  lang = 'en',
  onSelectNotification,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Strictly scoped notifications with zero-read optimistic mutation guards
  const {
    notifications,
    unreadCount,
    deleteNotification,
    clearNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    role,
    barberId,
    barberPhone,
    barberName,
    clientPhone,
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (onSelectNotification) {
      onSelectNotification(item);
    }
    setIsOpen(false);
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  const getNotificationIcon = (item: NotificationItem) => {
    if (item.type === 'promo') {
      return <Gift className="w-4 h-4 text-emerald-600" />;
    }
    if (item.type === 'announcement' || item.type === 'broadcast') {
      return <Megaphone className="w-4 h-4 text-emerald-700" />;
    }
    if (item.title?.includes('အတည်ပြု') || item.title?.includes('Confirmed')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    if (item.title?.includes('ပယ်ဖျက်') || item.title?.includes('Cancelled')) {
      return <AlertCircle className="w-4 h-4 text-rose-600" />;
    }
    return <Bell className="w-4 h-4 text-stone-700" />;
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 shadow-xs text-stone-700 transition-all active:scale-95 cursor-pointer focus:outline-hidden"
        title={lang === 'my' ? 'အသိပေးချက်များ' : 'Notifications'}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-stone-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-stone-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-stone-900">
                {lang === 'my' ? 'အသိပေးချက်များ' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} {lang === 'my' ? 'အသစ်' : 'new'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors flex items-center space-x-1 cursor-pointer"
                  title={lang === 'my' ? 'အားလုံးဖတ်ပြီးမှတ်သားမည်' : 'Mark all read'}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{lang === 'my' ? 'ဖတ်ပြီး' : 'Mark all read'}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearNotifications()}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center space-x-1 cursor-pointer"
                  title={lang === 'my' ? 'အားလုံးရှင်းမည်' : 'Clear all'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-stone-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-stone-700">
                  {lang === 'my' ? 'အသိပေးချက် မရှိပါ' : 'No notifications'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {lang === 'my' ? 'အသစ်ရောက်ရှိလာပါက ဤနေရာတွင် ပြသပေးပါမည်' : 'New alerts will appear here'}
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group relative flex items-start space-x-3 p-3.5 hover:bg-stone-50 transition-colors cursor-pointer ${
                      !item.read ? 'bg-emerald-50/40 font-medium' : 'bg-white text-stone-600'
                    }`}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0 p-2 rounded-xl bg-stone-100 group-hover:bg-white transition-colors">
                      {getNotificationIcon(item)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${!item.read ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                          {item.title}
                        </p>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                      <div className="flex items-center space-x-1 mt-1 text-[10px] text-stone-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(item.timestamp, lang)}</span>
                      </div>
                    </div>

                    {/* Delete Action (Zero server re-fetch optimistic delete) */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title={lang === 'my' ? 'ဖျက်မည်' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-center">
              <span className="text-[11px] text-stone-400 flex items-center justify-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>{lang === 'my' ? 'အလိုအလျောက် Realtime စင့်ခ်လုပ်ထားပါသည်' : 'Optimistic Zero-Read Sync'}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
