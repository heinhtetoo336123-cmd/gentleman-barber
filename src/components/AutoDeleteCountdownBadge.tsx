import React, { useState, useEffect } from 'react';
import { Clock, Timer } from 'lucide-react';
import { NotificationItem } from '../types';
import { getNotificationRemainingSeconds, formatRemainingTime } from '../utils/notifications';

interface AutoDeleteCountdownBadgeProps {
  notification: NotificationItem;
  lang?: 'en' | 'my';
  onExpire?: (id: string) => void;
  className?: string;
}

export const AutoDeleteCountdownBadge: React.FC<AutoDeleteCountdownBadgeProps> = ({
  notification,
  lang = 'my',
  onExpire,
  className = '',
}) => {
  const [remainingSecs, setRemainingSecs] = useState<number | null>(() =>
    getNotificationRemainingSeconds(notification)
  );

  useEffect(() => {
    if (!notification.read) {
      setRemainingSecs(null);
      return;
    }

    const update = () => {
      const remaining = getNotificationRemainingSeconds(notification);
      setRemainingSecs(remaining);
      if (remaining !== null && remaining <= 0) {
        if (onExpire) {
          onExpire(notification.id);
        }
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [notification.id, notification.read, notification.readAt, notification.timestamp, onExpire]);

  if (remainingSecs === null) return null;

  const isUrgent = remainingSecs < 60;

  return (
    <span
      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all ${
        isUrgent
          ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
          : 'bg-stone-100 text-stone-600 border border-stone-200/80'
      } ${className}`}
      title={
        lang === 'my'
          ? 'ဖတ်ပြီးသောကြောင့် ၅ မိနစ်အတွင်း အလိုအလျောက် ပျက်သွားပါမည်'
          : 'Auto-deletes 5 minutes after being read'
      }
    >
      <Timer className={`w-3 h-3 ${isUrgent ? 'text-rose-600' : 'text-stone-500'}`} />
      <span>{formatRemainingTime(remainingSecs, lang)}</span>
    </span>
  );
};
