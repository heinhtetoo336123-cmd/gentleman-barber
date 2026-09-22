import React, { useState, useEffect, useMemo } from 'react';
import { ShopExpense } from '../types';
import { api } from '../api/client';
import { getLocalTodayStr } from '../utils/timeSlots';
import { formatPrice } from '../utils/formatters';
import { playSuccessChime } from '../utils/audio';
import {
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailyExpensesSectionProps {
  selectedDate?: string;
  reportRangeMode?: 'single' | 'month' | 'all';
  lang?: 'en' | 'my';
  onExpensesUpdated?: (totalAmount: number) => void;
}

const EXPENSE_CATEGORIES = [
  'General (အထွေထွေ)',
  'Utilities (ရေ / မီး / အင်တာနက်)',
  'Supplies (ဆိုင်သုံး ပစ္စည်းဝယ်ယူမှု)',
  'Staff Meals & Welfare (ဝန်ထမ်း နေ့လယ်စာ/မုန့်ဖိုး)',
  'Maintenance & Repairs (ပြုပြင်ထိန်းသိမ်းစရိတ်)',
  'Rent & Taxes (ဆိုင်ခန်းငှားရမ်းခ/အခွန်)'
];

export const DailyExpensesSection: React.FC<DailyExpensesSectionProps> = ({
  selectedDate: propSelectedDate,
  reportRangeMode: _propReportRangeMode,
  lang = 'en',
  onExpensesUpdated
}) => {
  const todayStr = getLocalTodayStr();
  const [startDate, setStartDate] = useState<string>(propSelectedDate || todayStr);
  const [endDate, setEndDate] = useState<string>(propSelectedDate || todayStr);

  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State for Adding / Editing Expense
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState<string>(startDate || todayStr);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setLoading(true);
    const unsubExp = api.subscribeToExpenses((list) => {
      setExpenses(list || []);
      setLoading(false);
    });

    return () => {
      unsubExp();
    };
  }, []);

  // Filter expenses according to current date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const eDate = e.date || '';
      if (startDate && eDate < startDate) return false;
      if (endDate && eDate > endDate) return false;
      return true;
    });
  }, [expenses, startDate, endDate]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [filteredExpenses]);

  useEffect(() => {
    if (onExpensesUpdated) {
      onExpensesUpdated(totalExpenseAmount);
    }
  }, [totalExpenseAmount, onExpensesUpdated]);

  const handleOpenAddModal = () => {
    setEditingExpenseId(null);
    setExpenseDate(startDate || todayStr);
    setTitle('');
    setAmount('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (exp: ShopExpense) => {
    setEditingExpenseId(exp.id);
    setExpenseDate(exp.date || startDate || todayStr);
    setTitle(exp.title);
    setAmount(exp.amount);
    setCategory(exp.category || EXPENSE_CATEGORIES[0]);
    setNotes(exp.notes || '');
    setShowAddModal(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0 || !expenseDate) return;

    setIsSubmitting(true);
    try {
      if (editingExpenseId) {
        await api.updateExpense(editingExpenseId, {
          date: expenseDate,
          title: title.trim(),
          amount: Number(amount),
          category,
          notes: notes.trim()
        });
        showToast('✅ အသုံးစရိတ် ပြင်ဆင်ပြီးပါပြီ');
      } else {
        await api.addExpense({
          date: expenseDate,
          title: title.trim(),
          amount: Number(amount),
          category,
          notes: notes.trim(),
          recordedBy: 'Admin'
        });
        showToast('✅ အသုံးစရိတ် အသစ် စာရင်းသွင်းပြီးပါပြီ');
      }
      playSuccessChime();
      setShowAddModal(false);
      setTitle('');
      setAmount('');
      setNotes('');
      setEditingExpenseId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, expTitle: string) => {
    if (window.confirm(`အသုံးစရိတ် "${expTitle}" ကို စာရင်းမှ ဖျက်ရန် သေချာပါသလား?`)) {
      await api.deleteExpense(id);
      playSuccessChime();
      showToast('🗑️ အသုံးစရိတ် ဖျက်ပြီးပါပြီ');
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4 font-sans">
      
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-stone-950 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-mono font-bold flex items-center space-x-2 border border-stone-800"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Date Filtering Toolbar */}
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-950 text-rose-400 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'ဆိုင် အသုံးစရိတ် စာရင်း (Shop Expenses)' : 'Shop Daily Expenses'}
              </h4>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-2xl font-mono text-xs font-bold text-rose-700">
              Total: {formatPrice(totalExpenseAmount)}
            </div>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-3 py-1.5 bg-stone-950 hover:bg-stone-800 text-white text-xs font-mono font-bold rounded-2xl flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors border border-stone-900"
            >
              <Plus className="w-3.5 h-3.5 text-rose-400" />
              <span>{lang === 'my' ? '+ အသုံးစရိတ် ထည့်မည်' : '+ Add Expense'}</span>
            </button>
          </div>
        </div>

        {/* Compact Date Range Picker (From -> To with Today button) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-stone-100 border border-stone-200 px-2 py-1 rounded-lg font-mono text-xs text-stone-800 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'မှ:' : 'From:'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (endDate && val > endDate) {
                    setEndDate(val);
                  }
                }}
                className="w-[105px] sm:w-[115px] bg-white border border-stone-200/80 rounded px-1 py-0.5 text-[11px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
              />
              <span className="text-stone-300 font-bold text-[10px] shrink-0">~</span>
              <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'ထိ:' : 'To:'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  if (startDate && val < startDate) {
                    setStartDate(val);
                  }
                }}
                className="w-[105px] sm:w-[115px] bg-white border border-stone-200/80 rounded px-1 py-0.5 text-[11px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setStartDate(todayStr);
                setEndDate(todayStr);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors border shrink-0 ${
                startDate === todayStr && endDate === todayStr
                  ? 'bg-stone-950 text-rose-400 border-stone-950 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title="Reset to Today"
            >
              {lang === 'my' ? 'ယနေ့' : 'Today'}
            </button>
          </div>

          <div className="text-stone-500 text-[11px] font-mono">
            {filteredExpenses.length} {lang === 'my' ? 'အသုံးစရိတ်စာရင်း' : 'expenses recorded'}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="p-8 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs font-mono space-y-1">
          <p>{lang === 'my' ? 'ဤရက်စွဲအတွက် အသုံးစရိတ် စာရင်း မရှိသေးပါ။' : 'No expenses recorded for this period.'}</p>
          <p className="text-[11px] text-stone-400">
            {lang === 'my' ? '"+ အသုံးစရိတ် ထည့်မည်" ကို နှိပ်၍ စိတ်ကြိုက်ရက်စွဲဖြင့် စာရင်းစတင်သွင်းပါ' : 'Click "+ Add Expense" to record shop expenses with custom date.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Expense Title (ခေါင်းစဉ်)</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Notes</th>
                <th className="py-2.5 px-3 text-right font-bold text-rose-700">Amount (ကျသင့်ငွေ)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono">
              {filteredExpenses.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                  <td className="py-3 px-3 text-stone-700 font-bold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md text-stone-800 text-[11px]">
                      <Calendar className="w-3 h-3 text-stone-500" />
                      {item.date}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-stone-900">{item.title}</span>
                  </td>
                  <td className="py-3 px-3 text-stone-600">
                    <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md text-[10px]">
                      {item.category || 'General'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-stone-500 max-w-xs truncate">
                    {item.notes || '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-rose-700">
                    {formatPrice(item.amount)}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Edit Expense & Date"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id, item.title)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                      {editingExpenseId ? 'အသုံးစရိတ် ပြင်ဆင်ရန် (Edit Expense)' : 'အသုံးစရိတ် အသစ် ထည့်သွင်းရန်'}
                    </h3>
                    <span className="text-[10px] font-mono text-stone-500">Adjustable Date & Details</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
                
                {/* Adjustable Date Input */}
                <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-stone-800 font-mono uppercase text-[11px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-600" />
                      <span>အသုံးစရိတ် ရက်စွဲ (Expense Date) *</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-rose-500"
                  />
                  {/* Quick Date Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpenseDate(todayStr)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        expenseDate === todayStr
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      ယနေ့ (Today)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseDate(getYesterdayDateStr())}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        expenseDate === getYesterdayDateStr()
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      မနေ့က (Yesterday)
                    </button>
                    {startDate && startDate !== todayStr && startDate !== getYesterdayDateStr() && (
                      <button
                        type="button"
                        onClick={() => setExpenseDate(startDate)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          expenseDate === startDate
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        ရွေးထားသောရက် ({startDate})
                      </button>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    အသုံးစရိတ် ခေါင်းစဉ် (Title) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ဥပမာ - ရေ/မီးဖိုး၊ သန့်ရှင်းရေးသုံးပစ္စည်း၊ နေ့လယ်စာ"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-rose-500"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    ကျသင့်ငွေပမာဏ (Amount in MMK) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-mono font-bold text-stone-900 focus:outline-hidden focus:border-rose-500"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    အမျိုးအစား (Category)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block font-bold text-stone-700 font-mono uppercase text-[11px]">
                    မှတ်ချက် (Optional Notes)
                  </label>
                  <input
                    type="text"
                    placeholder="အသေးစိတ် မှတ်ချက် ထည့်ရန်"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-2.5 text-stone-900 focus:outline-hidden focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-2xl border border-stone-200 text-stone-700 font-mono font-bold hover:bg-stone-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingExpenseId ? 'Update Expense' : 'Save Expense'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};


