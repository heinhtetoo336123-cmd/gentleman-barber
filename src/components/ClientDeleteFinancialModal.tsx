import React, { useState } from 'react';
import { UserProfile, Booking } from '../types';
import { formatPrice } from '../utils/formatters';
import { phonesMatch } from '../utils/notifications';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  DollarSign,
  Calendar,
  Award,
  ShieldAlert,
  X,
  FileSpreadsheet,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type FinancialResolutionOption =
  | 'preserve_revenue'
  | 'cancel_pending_preserve_completed'
  | 'purge_all';

interface ClientDeleteFinancialModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: UserProfile | null;
  bookings: Booking[];
  onConfirmDelete: (
    clientId: string,
    financialAction: FinancialResolutionOption
  ) => Promise<void>;
}

export const ClientDeleteFinancialModal: React.FC<ClientDeleteFinancialModalProps> = ({
  isOpen,
  onClose,
  client,
  bookings = [],
  onConfirmDelete,
}) => {
  const [selectedOption, setSelectedOption] = useState<FinancialResolutionOption>('preserve_revenue');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !client) return null;

  // Find all bookings associated with this client
  const clientBookings = bookings.filter((b) => {
    if (client.phone && b.customerPhone && phonesMatch(b.customerPhone, client.phone)) {
      return true;
    }
    if (client.name && b.customerName && b.customerName.trim().toLowerCase() === client.name.trim().toLowerCase()) {
      return true;
    }
    return false;
  });

  const completedBookings = clientBookings.filter(
    (b) => b.status === 'completed'
  );

  const pendingBookings = clientBookings.filter(
    (b) => b.status === 'pending' || b.status === 'in-progress' || b.status === 'held'
  );

  const totalPaidRevenue = completedBookings.reduce(
    (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
    0
  );

  const hasFinancialRecords = clientBookings.length > 0;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(client.id, selectedOption);
      onClose();
    } catch (err) {
      console.error('Delete client error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900 font-mono uppercase tracking-tight">
                  Client အကောင့် ဖျက်သိမ်းခြင်း
                </h3>
                <p className="text-xs text-stone-500 font-sans">
                  {client.name} ({client.phone})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Client Snapshot & Financial Metrics */}
          <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-600 font-medium">အဖွဲ့ဝင် အဆင့် &amp; Point:</span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                👑 {client.memberTier || 'Bronze'} • {client.points || 0} pts
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 bg-white rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block font-mono">ပြီးမြောက်ခေါက်ရေ</span>
                <span className="text-xs font-black text-stone-900 font-mono">
                  {completedBookings.length} ကြိမ်
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block font-mono">ငွေစာရင်း ဝင်ငွေ</span>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  {formatPrice(totalPaidRevenue)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block font-mono">ဆိုင်းငံ့/ရက်ချိန်း</span>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  {pendingBookings.length} ခု
                </span>
              </div>
            </div>
          </div>

          {/* Financial Resolution Options if records exist */}
          {hasFinancialRecords ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-900 uppercase tracking-wide font-mono mb-1 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>ငွေစာရင်း နှင့် ဝင်ငွေမှတ်တမ်း ကိုင်တွယ်မှု ရွေးချယ်ပါ:</span>
                </label>
                <p className="text-[11px] text-stone-500">
                  ဤ Client တွင် ယခင် ဝင်ငွေစာရင်း မှတ်တမ်းများ ရှိနေပါသည်။ ဆိုင်၏ စာရင်းချုပ် မပျက်ပြယ်စေရန် သင့်လျော်သော စနစ်ကို ရွေးချယ်ပါ:
                </p>
              </div>

              <div className="space-y-2">
                {/* Option 1: Preserve Revenue (Recommended) */}
                <label
                  onClick={() => setSelectedOption('preserve_revenue')}
                  className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedOption === 'preserve_revenue'
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-amber-500/20'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="financialOption"
                      checked={selectedOption === 'preserve_revenue'}
                      onChange={() => setSelectedOption('preserve_revenue')}
                      className="mt-1 text-emerald-600 focus:ring-amber-500"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">
                          ငွေစာရင်းနှင့် ဝင်ငွေမှတ်တမ်းများကို ဆက်လက်ထိန်းသိမ်းမည်
                        </span>
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          အကြံပြုထားသည် (Recommended)
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        ဆိုင်၏ စုစုပေါင်းဝင်ငွေ ({formatPrice(totalPaidRevenue)})၊ နေ့စဉ်/လစဉ် စာရင်းချုပ်နှင့် Stylist ကော်မရှင်များ မလျော့ကျစေရန် ယခင်ငွေရှင်းပြီး မှတ်တမ်းများကို သမိုင်းမှတ်တမ်းအဖြစ် ဆက်လက်ထားရှိမည်။ (Client Account သာ ဖျက်မည်)
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option 2: Cancel pending, keep completed */}
                <label
                  onClick={() => setSelectedOption('cancel_pending_preserve_completed')}
                  className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedOption === 'cancel_pending_preserve_completed'
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-amber-500/20'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="financialOption"
                      checked={selectedOption === 'cancel_pending_preserve_completed'}
                      onChange={() => setSelectedOption('cancel_pending_preserve_completed')}
                      className="mt-1 text-emerald-600 focus:ring-amber-500"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-stone-900 block">
                        ပြီးစီး/ငွေရှင်းပြီးသား ဝင်ငွေများကို သိမ်းဆည်းပြီး မပြီးသေးသော ဘိုကင်များကို ပယ်ဖျက်မည်
                      </span>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        ယခင် ပြီးစီးခဲ့သော ဝင်ငွေများကို ငွေစာရင်းထဲတွင် ဆက်လက်ထားရှိမည်ဖြစ်ပြီး ရှေ့လာမည့်/ဆိုင်းငံ့ဆဲ ဘိုကင် ({pendingBookings.length} ခု) ကို အလိုအလျောက် ပယ်ဖျက် (Cancel) ပေးမည်။
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option 3: Purge all records */}
                <label
                  onClick={() => setSelectedOption('purge_all')}
                  className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedOption === 'purge_all'
                      ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="financialOption"
                      checked={selectedOption === 'purge_all'}
                      onChange={() => setSelectedOption('purge_all')}
                      className="mt-1 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-900">
                          ငွေစာရင်း အပါအဝင် ဘိုကင်မှတ်တမ်း အားလုံးကိုပါ စနစ်ထဲမှ အပြီးတိုင် ဖျက်ပစ်မည်
                        </span>
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          သတိပေးချက်
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        ဤ Client ၏ ဘိုကင်နှင့် ငွေစာရင်း မှတ်တမ်းအားလုံးကို ရှင်းလင်းဖျက်ပစ်မည်။ (ဆိုင်၏ စုစုပေါင်း ဝင်ငွေစာရင်းမှလည်း {formatPrice(totalPaidRevenue)} နုတ်ထွက်သွားပါမည်)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 leading-relaxed">
              ဤ Client တွင် ယခင် ဘိုကင် သို့မဟုတ် ငွေစာရင်း သွင်းယူထားသော မှတ်တမ်း မရှိပါ။ အကောင့်အား စနစ်ထဲမှ တိုက်ရိုက် အပြီးသတ် ဖျက်သိမ်းပါမည်။
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer border border-stone-300 disabled:opacity-50"
            >
              မလုပ်တော့ပါ (Cancel)
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50 active:scale-98 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'ဖျက်သိမ်းနေသည်...' : 'ဖျက်သိမ်းခြင်း အတည်ပြုမည်'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
