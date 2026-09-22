import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  Bell,
  Sparkles,
  Users,
  UserCheck,
  Megaphone,
  Gift,
  AlertCircle,
  Scissors,
  CheckCircle2,
  Phone,
  Clock,
  Crown
} from 'lucide-react';
import { Language, translations } from '../data/i18n';
import { api } from '../api/client';
import { NotificationType, ClientProfile } from '../types';
import { playSuccessChime } from '../utils/audio';
import { motion, AnimatePresence } from 'motion/react';

interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSuccess?: () => void;
}

const TEMPLATES: { label: string; title: string; message: string; type: NotificationType }[] = [
  {
    label: '🎉 ပရိုမိုးရှင်း (20% Off)',
    title: '🎉 အထူးပရိုမိုးရှင်း: ဝန်ဆောင်မှုအားလုံး ၂၀% လျှော့စျေး!',
    message: 'ယခုလကုန်အထိ မည်သည့် Haircut & Styling ဝန်ဆောင်မှုကိုမဆို ၂၀% အထူးလျှော့စျေးဖြင့် ရယူနိုင်ပါပြီ။ အမြန်ဆုံး Booking တင်လိုက်ပါ။',
    type: 'promo',
  },
  {
    label: '💈 ဆိုင်ဖွင့်ချိန် ပြောင်းလဲမှု',
    title: '💈 BABA BARBER SHOP ဆိုင်ဖွင့်ချိန် အသိပေးချက်',
    message: 'မင်္ဂလာပါ လူကြီးမင်းတို့ခင်ဗျာ၊ ယနေ့ဆိုင်ဖွင့်ချိန်အား မနက် ၉:၀၀ မှ ည ၉:၀၀ အထိ တိုးမြှင့် ဖွင့်လှစ်ပေးထားပါသည်။',
    type: 'notice',
  },
  {
    label: '✂️ ဆံသဆရာအသစ် မိတ်ဆက်',
    title: '✂️ Master Barber အသစ်နှင့် မိတ်ဆက်ပေးခြင်း',
    message: 'ကျွန်ုပ်တို့ BABA Lounge တွင် အတွေ့အကြုံရင့် ဆံသပညာရှင်အသစ် ရောက်ရှိလာပါပြီ။ စိတ်ကြိုက်ပုံစံများ ရွေးချယ်ချိန်းဆိုနိုင်ပါပြီ။',
    type: 'announcement',
  },
  {
    label: '⭐ VIP အထူးလက်ဆောင်',
    title: '⭐ VIP Member များအတွက် သီးသန့် အထူးလက်ဆောင်',
    message: 'လူကြီးမင်း၏ Member Points များကို VIP Package များဖြင့် လဲလှယ်အသုံးပြုနိုင်ပါပြီ။ လာရောက်အားပေးဖို့ ဖိတ်ခေါ်အပ်ပါသည်။',
    type: 'promo',
  },
];

export const AdminBroadcastModal: React.FC<AdminBroadcastModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSuccess,
}) => {
  const t = translations[lang];

  const [targetAudience, setTargetAudience] = useState<'all' | 'specific' | 'tier'>('all');
  const [targetPhone, setTargetPhone] = useState('');
  const [targetName, setTargetName] = useState('');
  const [targetTier, setTargetTier] = useState('VIP');
  const [notifType, setNotifType] = useState<NotificationType>('broadcast');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [sending, setSending] = useState(false);
  const [successStatus, setSuccessStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getClients().then(setClients).catch(() => {});
      setSuccessStatus(false);
    }
  }, [isOpen]);

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setNotifType(tpl.type);
  };

  const handleSelectClient = (clientId: string) => {
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setTargetPhone(found.phone || '');
      setTargetName(found.name || '');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (targetAudience === 'specific' && !targetPhone.trim()) {
      alert(lang === 'my' ? 'ဖောက်သည် ဖုန်းနံပါတ် ထည့်သွင်းပါ' : 'Please provide target client phone number');
      return;
    }

    setSending(true);
    try {
      // 1-second spring loading feedback
      await new Promise((r) => setTimeout(r, 950));
      await api.sendBroadcastNotification({
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        target: targetAudience,
        targetPhone: targetAudience === 'specific' ? targetPhone.trim() : undefined,
        targetName: targetAudience === 'specific' ? targetName.trim() : undefined,
        targetTier: targetAudience === 'tier' ? targetTier : undefined,
      });

      playSuccessChime();
      setSuccessStatus(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setSuccessStatus(false);
        setTitle('');
        setMessage('');
        setTargetPhone('');
        setTargetName('');
        setTargetAudience('all');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      alert('Notification broadcast failed');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-950 font-mono uppercase tracking-wider">
                {lang === 'my' ? 'ဖောက်သည်များထံ အသိပေးချက် ပို့မည်' : 'Send Notification to Clients'}
              </h3>
              <p className="text-xs text-stone-500">
                {lang === 'my' ? 'Admin ထံမှ ဖောက်သည်အားလုံး သို့မဟုတ် တစ်ဦးချင်းဆီ သတင်းစကား ပေးပို့ရန်' : 'Broadcast announcements, promos, or direct alerts'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successStatus ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 text-center space-y-3 bg-emerald-50 border border-emerald-200 rounded-2xl"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-base font-bold text-emerald-950">
              {lang === 'my' ? 'အသိပေးချက် အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ!' : 'Notification Sent Successfully!'}
            </h4>
            <p className="text-xs text-emerald-800">
              {targetAudience === 'all'
                ? (lang === 'my' ? 'ဖောက်သည် အားလုံးဆီသို့ အချိန်နှင့်တပြေးညီ ရောက်ရှိသွားပါပြီ။' : 'Broadcasted live to all client devices.')
                : (lang === 'my' ? `ဖောက်သည် (${targetPhone}) ဆီသို့ ပေးပို့လိုက်ပါပြီ။` : `Sent to client (${targetPhone}).`)}
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Quick Templates */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1.5 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>{lang === 'my' ? 'အမြန်သုံး စာသားပုံစံများ (Quick Templates)' : 'Quick Templates'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="p-2 rounded-xl text-left bg-stone-50 hover:bg-emerald-50 hover:border-emerald-300 border border-stone-200 text-[11px] font-semibold text-stone-800 transition-all cursor-pointer truncate"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                {lang === 'my' ? 'ပေးပို့မည့်သူ (Audience)' : 'Target Audience'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTargetAudience('all')}
                  className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                    targetAudience === 'all'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{lang === 'my' ? 'အားလုံး' : 'All Clients'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAudience('specific')}
                  className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                    targetAudience === 'specific'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{lang === 'my' ? 'ဖုန်း သီးသန့်' : 'Direct Phone'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAudience('tier')}
                  className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                    targetAudience === 'tier'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  <span>{lang === 'my' ? 'Member Tier' : 'By Tier'}</span>
                </button>
              </div>
            </div>

            {/* Member Tier Selector */}
            {targetAudience === 'tier' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl"
              >
                <label className="text-[11px] font-bold text-stone-800 block mb-1">
                  {lang === 'my' ? 'ရွေးချယ်မည့် Member အဆင့်:' : 'Select Target Member Tier:'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['VIP', 'Gold', 'Silver', 'Bronze'].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTargetTier(tier)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        targetTier === tier
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Specific Client Selector & Phone Field */}
            {targetAudience === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl"
              >
                {clients.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      {lang === 'my' ? 'ဖောက်သည် စာရင်းမှ ရွေးချယ်ရန်:' : 'Select from Client Directory:'}
                    </label>
                    <select
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl bg-white border border-stone-200 text-stone-900 focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="">-- ဖောက်သည် ရွေးပါ --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || 'No phone'}) - {c.memberTier || 'Standard'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      {lang === 'my' ? 'ဖောက်သည် ဖုန်းနံပါတ်:' : 'Client Phone:'}
                    </label>
                    <input
                      type="text"
                      required
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="ဥပမာ: 09123456789"
                      className="w-full text-xs p-2 rounded-xl bg-white border border-stone-200 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      {lang === 'my' ? 'ဖောက်သည် အမည်:' : 'Client Name:'}
                    </label>
                    <input
                      type="text"
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      placeholder="Optional"
                      className="w-full text-xs p-2 rounded-xl bg-white border border-stone-200 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notification Type Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                {lang === 'my' ? 'အမျိုးအစား (Notification Type)' : 'Category'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'broadcast' as NotificationType, label: '📢 ကြေညာချက်', icon: Megaphone },
                  { id: 'promo' as NotificationType, label: '🎁 ပရိုမိုးရှင်း', icon: Gift },
                  { id: 'notice' as NotificationType, label: '🔔 အသိပေးချက်', icon: Bell },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNotifType(item.id)}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      notifType === item.id
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                {lang === 'my' ? 'ခေါင်းစဉ် (Title):' : 'Title:'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ဥပမာ: 🎉 အထူး ပရိုမိုးရှင်း 20% Off"
                className="w-full text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:outline-hidden focus:border-emerald-600 font-bold text-stone-900"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                {lang === 'my' ? 'အကြောင်းကြားစာ (Message Body):' : 'Message:'}
              </label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="ဖောက်သည်များထံ အသိပေးလိုသော အကြောင်းအရာကို ရေးသားပါ..."
                className="w-full text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:outline-hidden focus:border-emerald-600 text-stone-900 leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={sending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {sending
                    ? (lang === 'my' ? 'ပေးပို့နေပါသည်...' : 'Sending...')
                    : (lang === 'my' ? '🚀 ချက်ချင်း ပေးပို့မည်' : 'Send Notification Now')}
                </span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
