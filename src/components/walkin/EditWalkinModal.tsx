import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Service, Designer, Booking, BookingStatus } from '../../types';
import { formatPrice } from '../../utils/formatters';
import {
  formatTime24to12,
  formatTime12to24,
  getCurrentTime24H
} from '../../utils/timeSlots';
import { ClientCombobox, KnownClient } from './ClientCombobox';
import { Edit3, X, Save, Calendar, Clock, Tag, ChevronDown, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EditWalkinModalProps {
  record: Booking | null;
  onClose: () => void;
  services: Service[];
  designers: Designer[];
  knownClients: KnownClient[];
  pastNotes?: string[];
  onSubmit: (bookingId: string, updates: Partial<Booking>) => Promise<void>;
  loading: boolean;
  lang?: 'en' | 'my';
}

const COMMON_NOTE_PRESETS = [
  'VIP Regular (အမြဲလာနေကျ)',
  'Skin Fade / Beard Trim (မုတ်ဆိတ်ရိတ်+Fade)',
  'Hot Towel & Shampoo (ခေါင်းလျှော်+သန့်စင်)',
  'In a rush / Quick Service (အလျင်လိုနေသည်)',
  'Hair Coloring & Treatment (ဆံပင်ဆေးဆိုး)',
  'Requested specific haircut (ပုံစံသီးသန့်ညှပ်)'
];

export const EditWalkinModal: React.FC<EditWalkinModalProps> = ({
  record,
  onClose,
  services,
  designers,
  knownClients,
  pastNotes = [],
  onSubmit,
  loading,
  lang = 'en'
}) => {
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [designerId, setDesignerId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'kpay' | 'wave' | 'pay_at_shop'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<'verified' | 'unpaid' | 'paid_advance'>('verified');
  const [status, setStatus] = useState<BookingStatus>('completed');
  const [notes, setNotes] = useState<string>('');
  
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const noteContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (record) {
      setCustomerName(record.customerName || '');
      setCustomerPhone(record.customerPhone || '');
      setDate(record.date || '');
      setTimeSlot(record.timeSlot || '');
      setDesignerId(record.designerId || (designers[0]?.id || ''));
      setServiceId(record.serviceId || (services[0]?.id || ''));
      setPrice(record.servicePrice || 0);
      setDiscount(record.discountAmount || 0);
      setPaymentMethod((record.paymentMethod as any) || 'cash');
      setPaymentStatus(record.paymentStatus || 'verified');
      setStatus(record.status || 'completed');
      setNotes(record.notes || '');
    }
  }, [record, designers, services]);

  // Close note dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (noteContainerRef.current && !noteContainerRef.current.contains(event.target as Node)) {
        setIsNoteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allUniqueNotes = useMemo(() => {
    const set = new Set<string>();
    COMMON_NOTE_PRESETS.forEach(n => set.add(n));
    pastNotes.forEach(n => {
      if (n && n.trim().length > 1) {
        set.add(n.trim());
      }
    });
    return Array.from(set);
  }, [pastNotes]);

  const filteredNotes = useMemo(() => {
    const q = (noteSearchQuery || '').trim().toLowerCase();
    if (!q) return allUniqueNotes;
    return allUniqueNotes.filter(n => n.toLowerCase().includes(q));
  }, [allUniqueNotes, noteSearchQuery]);

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDes = designers.find((d) => d.id === designerId);
    const selectedSrv = services.find((s) => s.id === serviceId);
    const commPercent = selectedDes?.commissionPercent ?? 50;
    const netPrice = Math.max(0, price - discount);
    const commissionAmount = Math.round((netPrice * commPercent) / 100);

    await onSubmit(record.id, {
      customerName: customerName.trim() || 'Walk-in Guest',
      customerPhone: customerPhone.trim(),
      date,
      timeSlot,
      designerId,
      designerName: selectedDes?.name || record.designerName,
      serviceId,
      serviceName: selectedSrv?.name || record.serviceName,
      servicePrice: price,
      discountAmount: discount,
      commissionAmount,
      paymentMethod,
      paymentStatus,
      status,
      notes: notes.trim(),
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-xl bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                  {lang === 'my' ? 'Walk-in မှတ်တမ်း ပြင်ဆင်ရန်' : 'Edit Walk-in Record'}
                </h3>
                <span className="text-[11px] font-mono text-emerald-800 font-bold">
                  {record.bookingCode}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. Customer Info with Autofill combobox */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                {lang === 'my' ? 'ဧည့်သည် အချက်အလက် (Customer)' : 'Customer Info'}
              </label>
              <ClientCombobox
                nameValue={customerName}
                phoneValue={customerPhone}
                onChangeName={setCustomerName}
                onChangePhone={setCustomerPhone}
                knownClients={knownClients}
                lang={lang}
                idPrefix="edit-modal"
              />
            </div>

            {/* 2. Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  <span>Date (ရက်စွဲ)</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Time (အချိန်)</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={formatTime12to24(timeSlot) || getCurrentTime24H()}
                    onChange={(e) => {
                      const formatted = formatTime24to12(e.target.value);
                      if (formatted) setTimeSlot(formatted);
                    }}
                    className="w-32 bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Stylist & Service */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Stylist (ဆံသဆရာ)
                </label>
                <select
                  value={designerId}
                  onChange={(e) => setDesignerId(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  {designers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.commissionPercent || 50}% Comm)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Service (ဝန်ဆောင်မှု)
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    const s = services.find((srv) => srv.id === e.target.value);
                    if (s) setPrice(s.price);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({formatPrice(s.price)})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Price & Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Service Price (Ks)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={price === 0 ? '' : price}
                  onChange={(e) => setPrice(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Discount (Ks)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={discount === 0 ? '' : discount}
                  onChange={(e) => setDiscount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* 5. Payment & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod === 'pay_at_shop' ? 'cash' : paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="cash">💵 {lang === 'my' ? 'ငွေသား (Cash)' : 'Cash / Pay at Shop'}</option>
                  <option value="kpay">📱 KBZPay (KPay)</option>
                  <option value="wave">🌊 WavePay (Wave)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="verified">Verified / Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid_advance">Paid Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="completed">Completed</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* 6. Notes with History & Quick Preset Support */}
            <div className="space-y-1.5" ref={noteContainerRef}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                  Notes (မှတ်ချက်)
                </label>
                {notes && (
                  <button
                    type="button"
                    onClick={() => setNotes('')}
                    className="text-[10px] font-mono text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Type note or select from history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onFocus={() => setIsNoteDropdownOpen(true)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 pr-10 text-xs text-stone-900 font-bold focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
                  className="absolute right-2 top-2 p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* History Dropdown */}
              <AnimatePresence>
                {isNoteDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="bg-white border border-stone-200 rounded-2xl shadow-lg p-2 max-h-40 overflow-y-auto space-y-1 text-xs"
                  >
                    {filteredNotes.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setNotes(item);
                          setIsNoteDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-50 text-stone-700 font-medium truncate"
                      >
                        {item}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black text-xs font-mono uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {loading ? 'Saving...' : 'Update Record'}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
