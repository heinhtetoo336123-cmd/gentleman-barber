import React, { useState, useEffect } from 'react';
import { PromoCode, NotificationItem, NotificationType, ClientProfile } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import {
  Tag,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Copy,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Send,
  Users,
  UserCheck,
  Bell,
  RefreshCw,
  Percent,
  Coins,
  ShieldCheck,
  Sliders,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PromoManagerProps {
  lang?: 'en' | 'my';
}

export const PromoManager: React.FC<PromoManagerProps> = ({ lang = 'my' }) => {
  // Main Tab Switcher
  const [activeTab, setActiveTab] = useState<'promos' | 'broadcast'>('promos');

  // --- PROMOS STATE ---
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Search & Filter for Promos
  const [promoSearch, setPromoSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Promo Form State
  const [formCode, setFormCode] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percent' | 'amount'>('percent');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(10);
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formTierReq, setFormTierReq] = useState<'All' | 'Bronze' | 'Silver' | 'Gold' | 'VIP'>('All');
  const [formMaxUses, setFormMaxUses] = useState<number>(100);
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPointsCost, setFormPointsCost] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Simulator Amount
  const [simAmount, setSimAmount] = useState<number>(20000);

  // --- BROADCAST / NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifFilterType, setNotifFilterType] = useState<string>('all');

  // Broadcast Compose Form State
  const [targetAudience, setTargetAudience] = useState<'all' | 'specific' | 'tier'>('all');
  const [targetPhone, setTargetPhone] = useState('');
  const [targetName, setTargetName] = useState('');
  const [targetTier, setTargetTier] = useState<string>('VIP');
  const [broadcastType, setBroadcastType] = useState<NotificationType>('broadcast');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Feedback State
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubPromos = api.subscribeToPromos((data) => {
      setPromos(data || []);
    });

    const unsubNotifs = api.subscribeToNotifications('all', (data) => {
      setNotifications(data || []);
    });

    api.getClients().then(setClients).catch(() => {});

    return () => {
      unsubPromos();
      unsubNotifs();
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Helper for computing future expiry date
  const getFutureDateStr = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Generate clean random code
  const generateRandomCode = (prefix = 'GTM') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'GTM';
    setFormCode(`${cleanPrefix}-${rand}`);
  };

  // Open Create Promo Modal
  const handleOpenNewPromo = () => {
    setEditingPromo(null);
    generateRandomCode('GTM');
    setFormDiscountType('percent');
    setFormDiscountValue(10);
    setFormMinOrder(0);
    setFormTierReq('All');
    setFormMaxUses(100);
    setFormPointsCost(0);
    setFormExpiryDate(getFutureDateStr(30));
    setFormDescription('');
    setFormIsActive(true);
    setIsPromoModalOpen(true);
  };

  // Open Edit Promo Modal
  const handleOpenEditPromo = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormCode(promo.code);
    setFormDiscountType(promo.discountType);
    setFormDiscountValue(promo.discountValue);
    setFormMinOrder(promo.minOrderAmount || 0);
    setFormTierReq((promo.memberTierRequired as any) || 'All');
    setFormMaxUses(promo.maxUses || 100);
    setFormExpiryDate(promo.expiryDate || '');
    setFormDescription(promo.description || '');
    setFormPointsCost(promo.pointsCost || 0);
    setFormIsActive(promo.active !== false);
    setIsPromoModalOpen(true);
  };

  // Save Promo Code
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      showToast(lang === 'my' ? 'ကူပွန်ကုဒ် ထည့်သွင်းပေးပါ' : 'Please enter promo code', 'error');
      return;
    }

    if (!editingPromo) {
      const isDuplicate = promos.some((p) => p.code.toUpperCase() === cleanCode);
      if (isDuplicate) {
        showToast(
          lang === 'my'
            ? `Promo Code "${cleanCode}" သည် ရှိနှင့်ပြီးသား ဖြစ်နေပါသည်`
            : `Promo Code "${cleanCode}" already exists`,
          'error'
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Partial<PromoCode> = {
        code: cleanCode,
        discountType: formDiscountType,
        discountValue: Number(formDiscountValue),
        minOrderAmount: Number(formMinOrder),
        memberTierRequired: formTierReq,
        maxUses: Number(formMaxUses),
        expiryDate: formExpiryDate,
        description: formDescription.trim(),
        pointsCost: Number(formPointsCost),
        active: formIsActive,
      };

      if (editingPromo) {
        await api.updatePromo(editingPromo.id, payload);
        await api.addAuditLog('Admin', 'Promo Code Updated', `Updated promo ${cleanCode}`);
        showToast(lang === 'my' ? `Promo Code "${cleanCode}" ပြင်ဆင်ပြီးပါပြီ` : `Promo "${cleanCode}" updated`);
      } else {
        await api.addPromo({
          ...payload,
          usedCount: 0,
        });
        await api.addAuditLog('Admin', 'Promo Code Created', `Created promo ${cleanCode}`);
        showToast(lang === 'my' ? `Promo Code "${cleanCode}" ဖန်တီးပြီးပါပြီ` : `Promo "${cleanCode}" created`);
      }

      setIsPromoModalOpen(false);
      setEditingPromo(null);
    } catch (err) {
      showToast(lang === 'my' ? 'သိမ်းဆည်းရာတွင် အမှားဖြစ်သွားပါသည်' : 'Failed to save promo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Promo Active
  const handleTogglePromoActive = async (promo: PromoCode) => {
    try {
      const nextState = !promo.active;
      await api.updatePromo(promo.id, { active: nextState });
      showToast(
        nextState
          ? `"${promo.code}" Active`
          : `"${promo.code}" Inactive`
      );
    } catch {
      showToast(lang === 'my' ? 'Status ပြောင်းလဲရာတွင် အမှားဖြစ်သွားပါသည်' : 'Failed to toggle status', 'error');
    }
  };

  // Delete Promo
  const handleDeletePromo = async (promo: PromoCode) => {
    if (confirm(lang === 'my' ? `Promo Code "${promo.code}" အား ဖျက်ပစ်ရန် သေချာပါသလား?` : `Delete promo code "${promo.code}"?`)) {
      try {
        await api.deletePromo(promo.id);
        await api.addAuditLog('Admin', 'Promo Deleted', `Deleted promo ${promo.code}`);
        showToast(lang === 'my' ? `Promo Code "${promo.code}" ဖျက်ပြီးပါပြီ` : `Promo "${promo.code}" deleted`);
      } catch {
        showToast(lang === 'my' ? 'ဖျက်ရာတွင် အမှားဖြစ်သွားပါသည်' : 'Failed to delete promo', 'error');
      }
    }
  };

  // Copy Promo Code
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // --- SEND BROADCAST NOTIFICATION ---
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast(
        lang === 'my' ? 'ခေါင်းစဉ်နှင့် အကြောင်းအရာ ဖြည့်သွင်းပေးပါ' : 'Please enter title and message',
        'error'
      );
      return;
    }

    setIsSendingBroadcast(true);
    try {
      await api.sendBroadcastNotification({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: broadcastType,
        target: targetAudience,
        targetPhone: targetAudience === 'specific' ? targetPhone.trim() : undefined,
        targetName: targetAudience === 'specific' ? targetName.trim() : undefined,
        targetTier: targetAudience === 'tier' ? targetTier : undefined,
      });

      showToast(
        lang === 'my'
          ? 'ကြေညာချက်/သတင်းလွှာ အောင်မြင်စွာ ပေးပို့လိုက်ပါပြီ'
          : 'Broadcast sent successfully'
      );

      // Reset Compose form
      setBroadcastTitle('');
      setBroadcastMessage('');
      setTargetPhone('');
      setTargetName('');
    } catch (err) {
      showToast(lang === 'my' ? 'ပေးပို့ရာတွင် အမှားဖြစ်သွားပါသည်' : 'Failed to send broadcast', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Delete Notification Record
  const handleDeleteNotification = async (id: string) => {
    if (confirm(lang === 'my' ? 'ဤ အသိပေးချက် မှတ်တမ်းအား ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Delete this notification record?')) {
      try {
        await api.deleteNotification(id);
        showToast(lang === 'my' ? 'မှတ်တမ်း ဖျက်ပြီးပါပြီ' : 'Notification deleted');
      } catch {
        showToast(lang === 'my' ? 'ဖျက်ရာတွင် အမှားဖြစ်သွားပါသည်' : 'Failed to delete', 'error');
      }
    }
  };

  // Select Client shortcut
  const handleSelectClient = (clientId: string) => {
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setTargetPhone(found.phone || '');
      setTargetName(found.name || '');
    }
  };

  // Promo Filter Logic
  const filteredPromos = promos.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(promoSearch.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(promoSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStatus === 'active' && !p.active) return false;
    if (filterStatus === 'inactive' && p.active) return false;
    if (filterTier !== 'all' && p.memberTierRequired !== filterTier) return false;
    return true;
  });

  // Notification Filter Logic
  const filteredNotifs = notifications.filter((n) => {
    const matchesSearch =
      (n.title && n.title.toLowerCase().includes(notifSearch.toLowerCase())) ||
      (n.message && n.message.toLowerCase().includes(notifSearch.toLowerCase())) ||
      (n.customerName && n.customerName.toLowerCase().includes(notifSearch.toLowerCase())) ||
      (n.customerPhone && n.customerPhone.includes(notifSearch));
    if (!matchesSearch) return false;
    if (notifFilterType !== 'all' && n.type !== notifFilterType) return false;
    return true;
  });

  // Calculation Simulation Math
  const simDiscountAmt =
    formDiscountType === 'percent'
      ? Math.round((simAmount * formDiscountValue) / 100)
      : Math.min(simAmount, formDiscountValue);
  const simFinalAmount = Math.max(0, simAmount - simDiscountAmt);

  return (
    <div className="space-y-4 font-sans">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-2 text-xs font-bold font-mono backdrop-blur-md ${
              toastMsg.type === 'success'
                ? 'bg-black text-white border-stone-700'
                : 'bg-rose-950 text-rose-200 border-rose-800'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header & Sub-tab Selector */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center font-bold">
              {activeTab === 'promos' ? <Tag className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my'
                  ? 'ပရိုမိုးရှင်း ကူပွန်နှင့် အသိပေးကြေညာချက်များ'
                  : 'Promo Codes & Broadcast Alerts'}
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                {lang === 'my'
                  ? 'Discount Vouchers ဖန်တီးခြင်းနှင့် ဖောက်သည်များထံ သတင်းလွှာ ပေးပို့ခြင်း'
                  : 'Configure discount codes and dispatch broadcast announcements.'}
              </p>
            </div>
          </div>

          {/* Sub Tab Switcher Buttons */}
          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-2xl text-xs font-mono font-bold">
            <button
              onClick={() => setActiveTab('promos')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'promos'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-stone-600 hover:text-black hover:bg-stone-200/60'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? 'ပရိုမိုးရှင်း ကူပွန်များ' : 'Promo Codes'}</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-stone-800 text-white text-[10px]">
                {promos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('broadcast')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'broadcast'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-stone-600 hover:text-black hover:bg-stone-200/60'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? 'အသိပေးကြေညာချက်များ' : 'Broadcast Alerts'}</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-stone-800 text-white text-[10px]">
                {notifications.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: PROMO CODES & DISCOUNTS */}
        {activeTab === 'promos' && (
          <div className="space-y-4">
            {/* Action Bar: Search, Filters & Create Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={lang === 'my' ? 'ကူပွန်ကုဒ် သို့မဟုတ် အကြောင်းအရာ ရှာဖွေရန်...' : 'Search promo code or description...'}
                    value={promoSearch}
                    onChange={(e) => setPromoSearch(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-900 font-mono"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 font-mono font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>

                {/* Tier Filter */}
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 font-mono font-bold focus:outline-hidden cursor-pointer hidden sm:block"
                >
                  <option value="all">All Tiers</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <button
                onClick={handleOpenNewPromo}
                className="px-4 py-2 rounded-xl bg-black hover:bg-stone-800 text-white font-mono font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? '+ ကူပွန်အသစ် ဖန်တီးမည်' : '+ Create Promo Code'}</span>
              </button>
            </div>

            {/* Promo Codes Table */}
            {filteredPromos.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-xs font-mono">
                {lang === 'my'
                  ? 'ပရိုမိုးရှင်း ကူပွန် မရှိသေးပါ။ "+ ကူပွန်အသစ် ဖန်တီးမည်" ကို နှိပ်၍ အသစ်ထည့်သွင်းနိုင်ပါသည်။'
                  : 'No promo codes found. Click "+ Create Promo Code" to add a new voucher.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Promo Code</th>
                      <th className="py-2.5 px-3">Discount</th>
                      <th className="py-2.5 px-3">Min Spend</th>
                      <th className="py-2.5 px-3">Target Tier</th>
                      <th className="py-2.5 px-3">Expiry</th>
                      <th className="py-2.5 px-3 text-center">Uses</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono">
                    {filteredPromos.map((p) => {
                      const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date();
                      const isPct = p.discountType === 'percent';

                      return (
                        <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                          {/* Code */}
                          <td className="py-2.5 px-3 font-bold text-stone-950">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold tracking-wider">{p.code}</span>
                              <button
                                onClick={() => copyCode(p.code)}
                                className="text-stone-400 hover:text-black p-0.5 rounded cursor-pointer"
                                title="Copy Code"
                              >
                                {copiedCode === p.code ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {p.description && (
                              <span className="text-[10px] text-stone-500 font-sans block max-w-xs truncate">
                                {p.description}
                              </span>
                            )}
                          </td>

                          {/* Discount Value */}
                          <td className="py-2.5 px-3 font-bold text-stone-900">
                            {isPct ? `${p.discountValue}% OFF` : `${formatPrice(p.discountValue)} OFF`}
                          </td>

                          {/* Min Spend */}
                          <td className="py-2.5 px-3 text-stone-700">
                            {p.minOrderAmount ? formatPrice(p.minOrderAmount) : 'None'}
                          </td>

                          {/* Target Tier */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                              {p.memberTierRequired || 'All'}
                            </span>
                          </td>

                          {/* Expiry */}
                          <td className="py-2.5 px-3 text-stone-600 text-[11px]">
                            {p.expiryDate ? (
                              <span className={isExpired ? 'text-rose-600 font-bold' : ''}>
                                {p.expiryDate} {isExpired ? '(Expired)' : ''}
                              </span>
                            ) : (
                              'No Expiry'
                            )}
                          </td>

                          {/* Usage Count */}
                          <td className="py-2.5 px-3 text-center text-stone-800 font-bold">
                            {p.usedCount || 0} / {p.maxUses || '∞'}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleTogglePromoActive(p)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                                p.active && !isExpired
                                  ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                              }`}
                            >
                              {p.active && !isExpired ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleOpenEditPromo(p)}
                                className="p-1 rounded-lg text-stone-600 hover:text-black hover:bg-stone-100 cursor-pointer"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePromo(p)}
                                className="p-1 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BROADCAST ANNOUNCEMENTS & DIRECT ALERTS */}
        {activeTab === 'broadcast' && (
          <div className="space-y-6">
            {/* Compose & Dispatch Form */}
            <form onSubmit={handleSendBroadcast} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-stone-200 pb-2">
                <Send className="w-4 h-4 text-stone-800" />
                <h4 className="text-xs font-mono font-black text-stone-900 uppercase tracking-wider">
                  {lang === 'my' ? 'ကြေညာချက် / သတင်းလွှာ အသစ် ပေးပို့ရန်' : 'Compose & Dispatch Broadcast'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                {/* Target Audience */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">
                    {lang === 'my' ? 'လက်ခံမည့်သူ (Target Audience) *' : 'Target Audience *'}
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer"
                  >
                    <option value="all">All Clients (ဖောက်သည် အားလုံး)</option>
                    <option value="tier">Specific Member Tier (အသင်းဝင် အဆင့်လိုက်)</option>
                    <option value="specific">Direct Single Client (ဖောက်သည် တစ်ဦးချင်း)</option>
                  </select>
                </div>

                {/* Tier Selector if target is tier */}
                {targetAudience === 'tier' && (
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 block">
                      {lang === 'my' ? 'အသင်းဝင် အဆင့် (Member Tier) *' : 'Select Member Tier *'}
                    </label>
                    <select
                      value={targetTier}
                      onChange={(e) => setTargetTier(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl p-2 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer"
                    >
                      <option value="Bronze">Bronze Members</option>
                      <option value="Silver">Silver Members</option>
                      <option value="Gold">Gold Members</option>
                      <option value="VIP">VIP Members</option>
                    </select>
                  </div>
                )}

                {/* Client Picker / Phone if target is specific */}
                {targetAudience === 'specific' && (
                  <>
                    <div className="space-y-1">
                      <label className="font-bold text-stone-700 block">
                        {lang === 'my' ? 'ဖောက်သည် ရွေးချယ်ရန် (Client Picker)' : 'Select Client'}
                      </label>
                      <select
                        onChange={(e) => handleSelectClient(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-xl p-2 text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer font-sans text-xs"
                      >
                        <option value="">-- ဖောက်သည် စာရင်းမှ ရွေးရန် --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) - {c.memberTier || 'Bronze'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700 block">
                        {lang === 'my' ? 'ဖုန်းနံပါတ် (Direct Phone) *' : 'Target Phone *'}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="09..."
                        value={targetPhone}
                        onChange={(e) => setTargetPhone(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-xl p-2 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900"
                      />
                    </div>
                  </>
                )}

                {/* Category Type */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">
                    {lang === 'my' ? 'အမျိုးအစား (Notification Type) *' : 'Notification Type *'}
                  </label>
                  <select
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value as any)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer"
                  >
                    <option value="broadcast">Announcement (အထွေထွေ ကြေညာချက်)</option>
                    <option value="promo">Promo Alert (ပရိုမိုးရှင်း သတင်းလွှာ)</option>
                    <option value="notice">Shop Notice (ဆိုင် အသိပေးချက်)</option>
                    <option value="booking">Direct Alert (တိုက်ရိုက် သတိပေးချက်)</option>
                  </select>
                </div>
              </div>

              {/* Title & Message */}
              <div className="space-y-3 pt-1 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 font-mono uppercase block text-[11px]">
                    {lang === 'my' ? 'ခေါင်းစဉ် (Title) *' : 'Notification Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'my' ? 'အသိပေး ကြေညာချက် ခေါင်းစဉ် ရေးပါ...' : 'Enter notification title...'}
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-700 font-mono uppercase block text-[11px]">
                    {lang === 'my' ? 'စာသား အသေးစိတ် (Message Content) *' : 'Message Content *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={lang === 'my' ? 'ဖောက်သည်များထံသို့ ပေးပို့လိုသော စာသားအပြည့်အစုံ ရေးသားပါ...' : 'Enter full message content to dispatch...'}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-stone-900 focus:outline-hidden focus:border-stone-900 text-xs leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-stone-800 text-white font-mono font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingBroadcast
                      ? (lang === 'my' ? 'ပေးပို့နေပါသည်...' : 'Sending...')
                      : (lang === 'my' ? 'ကြေညာချက် ပေးပို့မည် (Dispatch Broadcast)' : 'Send Broadcast Notification')}
                  </span>
                </button>
              </div>
            </form>

            {/* Broadcast History & Audit Ledger */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-stone-700" />
                  <h4 className="text-xs font-mono font-black text-stone-900 uppercase tracking-wider">
                    {lang === 'my'
                      ? `ပေးပို့ပြီးသော ကြေညာချက်များ (${filteredNotifs.length})`
                      : `Sent Broadcasts History (${filteredNotifs.length})`}
                  </h4>
                </div>

                {/* Filter & Search */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl pl-7 pr-2.5 py-1 text-xs text-stone-900 font-mono focus:outline-hidden"
                    />
                  </div>

                  <select
                    value={notifFilterType}
                    onChange={(e) => setNotifFilterType(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-2 py-1 text-xs text-stone-800 font-mono font-bold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="broadcast">Announcements</option>
                    <option value="promo">Promo Alerts</option>
                    <option value="notice">Shop Notices</option>
                    <option value="booking">Direct Alerts</option>
                  </select>
                </div>
              </div>

              {filteredNotifs.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-xs font-mono">
                  {lang === 'my' ? 'ပေးပို့ထားသော ကြေညာချက် မှတ်တမ်း မရှိသေးပါ။' : 'No broadcast history found.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifs.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-stone-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-stone-400 transition-colors shadow-2xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 border border-stone-200 text-[10px] font-mono font-bold uppercase">
                            {item.type || 'broadcast'}
                          </span>
                          {item.targetMemberTier && (
                            <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-mono font-bold">
                              Tier: {item.targetMemberTier}
                            </span>
                          )}
                          {item.customerPhone && (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-mono">
                              To: {item.customerName || item.customerPhone}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400 font-mono">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                          </span>
                        </div>

                        <h5 className="font-bold text-stone-950 text-xs font-mono">{item.title}</h5>
                        <p className="text-xs text-stone-600 leading-relaxed font-sans">{item.message}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteNotification(item.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer self-end sm:self-start"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PROMO CREATION & EDIT MODAL */}
      <AnimatePresence>
        {isPromoModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto"
            >
              <div className="px-5 py-4 bg-stone-950 text-white flex items-center justify-between border-b border-stone-800">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-black font-mono uppercase tracking-wider">
                    {editingPromo
                      ? (lang === 'my' ? 'ကူပွန် ပြင်ဆင်ခြင်း' : 'Edit Promo Code')
                      : (lang === 'my' ? 'ကူပွန်အသစ် ဖန်တီးခြင်း' : 'Create Promo Code')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="p-1 rounded-xl text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePromo} className="p-5 space-y-4 text-xs font-mono">
                {/* Code Field & Random Generator */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'ကူပွန်ကုဒ် (Promo Code) *' : 'Promo Code *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => generateRandomCode('GTM')}
                      className="text-[10px] text-stone-600 hover:text-black font-bold hover:underline cursor-pointer"
                    >
                      Generate Code
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GTM-20OFF"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-black text-stone-900 tracking-wider text-sm focus:outline-hidden focus:border-stone-900 uppercase"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'လျှော့ဈေး အမျိုးအစား *' : 'Discount Type *'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('percent')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formDiscountType === 'percent'
                            ? 'bg-black text-white shadow-2xs'
                            : 'text-stone-600 hover:text-black'
                        }`}
                      >
                        % Percent
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('amount')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formDiscountType === 'amount'
                            ? 'bg-black text-white shadow-2xs'
                            : 'text-stone-600 hover:text-black'
                        }`}
                      >
                        MMK Fixed
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {formDiscountType === 'percent' ? 'Discount % *' : 'Discount Amount (MMK) *'}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formDiscountValue}
                      onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900"
                    />
                  </div>
                </div>

                {/* Min Order & Target Member Tier */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'အနည်းဆုံး သုံးစွဲရန် (Min Spend)' : 'Min Spend (MMK)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formMinOrder}
                      onChange={(e) => setFormMinOrder(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'အသင်းဝင် အဆင့် သတ်မှတ်ချက်' : 'Member Tier'}
                    </label>
                    <select
                      value={formTierReq}
                      onChange={(e) => setFormTierReq(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer"
                    >
                      <option value="All">All Clients (အားလုံး)</option>
                      <option value="Bronze">Bronze & Above</option>
                      <option value="Silver">Silver & Above</option>
                      <option value="Gold">Gold & Above</option>
                      <option value="VIP">VIP Only</option>
                    </select>
                  </div>
                </div>

                {/* Expiry Date & Max Uses */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'သက်တမ်းကုန်ဆုံးရက် (Expiry Date)' : 'Expiry Date'}
                    </label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-stone-700 uppercase text-[11px]">
                      {lang === 'my' ? 'အများဆုံး အကြိမ်ရေ (Max Uses)' : 'Max Total Uses'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formMaxUses}
                      onChange={(e) => setFormMaxUses(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 font-bold text-stone-900 focus:outline-hidden focus:border-stone-900"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 uppercase text-[11px]">
                    {lang === 'my' ? 'ရှင်းလင်းချက် စာသား (Description)' : 'Description'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Special weekend promotion"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 text-stone-900 focus:outline-hidden focus:border-stone-900"
                  />
                </div>

                {/* Live Simulation preview */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">
                    Calculation Test Preview ({formatPrice(simAmount)} Bill)
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Discount Amount:</span>
                    <span className="font-bold text-stone-900">-{formatPrice(simDiscountAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200 font-black">
                    <span className="text-stone-900">Final Bill:</span>
                    <span className="text-stone-950">{formatPrice(simFinalAmount)}</span>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-stone-800">
                    {lang === 'my' ? 'ကူပွန် အသက်ဝင်စေရန် (Active)' : 'Enable Promo (Active)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      formIsActive ? 'bg-black' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        formIsActive ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setIsPromoModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition-colors cursor-pointer"
                  >
                    {lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-black hover:bg-stone-800 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSaving
                      ? (lang === 'my' ? 'သိမ်းနေပါသည်...' : 'Saving...')
                      : (lang === 'my' ? 'သိမ်းဆည်းမည် (Save)' : 'Save Promo')}
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
