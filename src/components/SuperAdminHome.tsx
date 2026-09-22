import React, { useState, useEffect, useMemo } from 'react';
import { Booking, Designer, Service, UserProfile, AuditLog } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { exportAuditLogsToCsv, exportClientsToCsv } from '../utils/exportHelpers';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import {
  ShieldAlert,
  ShieldCheck,
  Crown,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Users,
  Building,
  Key,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Trash2,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  Activity,
  Scissors,
  Sparkles,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ChevronRight,
  Printer,
  UserX,
  UserCheck,
  Phone,
  Mail,
  Eye,
  Settings,
  Receipt,
  Zap,
  ShoppingBag,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClientDeleteFinancialModal, FinancialResolutionOption } from './ClientDeleteFinancialModal';

interface SuperAdminHomeProps {
  bookings: Booking[];
  designers: Designer[];
  services: Service[];
  clients: UserProfile[];
  onNavigateSection?: (sectionId: string) => void;
  onRefresh?: () => void;
  lang?: 'en' | 'my';
}

export const SuperAdminHome: React.FC<SuperAdminHomeProps> = ({
  bookings,
  designers,
  services,
  clients,
  onNavigateSection,
  onRefresh,
  lang = 'en',
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'audit' | 'users' | 'quick-manage'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'admin' | 'barber' | 'user' | 'system'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'booking' | 'auth' | 'settings' | 'staff' | 'financial' | 'service' | 'promo' | 'system'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');

  // User Moderation Tab states
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userTierFilter, setUserTierFilter] = useState<string>('All');
  const [modifyingUserId, setModifyingUserId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<UserProfile | null>(null);

  // Manual note modal
  const [showAddLogModal, setShowAddLogModal] = useState<boolean>(false);
  const [manualAction, setManualAction] = useState<string>('Supervisor Inspection');
  const [manualDetails, setManualDetails] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<'system' | 'financial' | 'staff' | 'settings'>('system');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Clear confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch audit logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Error loading audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return auditLogs.filter((log) => {
      // Role filter
      if (roleFilter !== 'all') {
        const actorRole = (log.actorRole || 'admin').toLowerCase();
        if (actorRole !== roleFilter) return false;
      }

      // Action type filter
      if (actionFilter !== 'all') {
        const aType = (log.actionType || 'system').toLowerCase();
        if (aType !== actionFilter) return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const logDateStr = (log.timestamp || '').split('T')[0];
        if (dateFilter === 'today' && logDateStr !== todayStr) return false;
        if (dateFilter === '7days') {
          const logTime = new Date(log.timestamp).getTime();
          if (now.getTime() - logTime > 7 * 86400000) return false;
        }
        if (dateFilter === 'month') {
          const thisMonth = todayStr.substring(0, 7);
          if (!logDateStr.startsWith(thisMonth)) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actor = (log.adminName || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const target = (log.targetId || '').toLowerCase();
        if (!actor.includes(q) && !action.includes(q) && !details.includes(q) && !target.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, roleFilter, actionFilter, dateFilter, searchQuery]);

  // Executive Top Stats (Strictly completed bookings count toward revenue)
  const executiveStats = useMemo(() => {
    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const totalGrossRevenue = completedBookings.reduce(
      (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
      0
    );

    const now = new Date();
    const thisMonthStr = now.toISOString().substring(0, 7);
    const monthBookings = completedBookings.filter((b) => (b.date || '').startsWith(thisMonthStr));
    const monthRevenue = monthBookings.reduce(
      (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
      0
    );

    const activeStaff = designers.filter((d) => d.active !== false).length;
    const pendingCount = bookings.filter((b) => b.status === 'pending').length;

    return {
      totalGrossRevenue,
      monthRevenue,
      totalCompleted: completedBookings.length,
      activeStaff,
      pendingCount,
      totalLogsCount: auditLogs.length,
    };
  }, [bookings, designers, auditLogs]);

  // Handle Manual Log Submission
  const handleAddManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDetails.trim()) return;

    setIsSubmitting(true);
    try {
      await api.addAuditLog(
        'SuperAdmin Master',
        manualAction,
        manualDetails.trim(),
        'superadmin',
        manualCategory
      );
      playSuccessChime();
      showToast('✅ Audit မှတ်တမ်းအသစ် ထည့်သွင်းသိမ်းဆည်းပြီးပါပြီ');
      setShowAddLogModal(false);
      setManualDetails('');
      loadLogs();
    } catch (err) {
      showToast('❌ အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Clear Logs
  const handleClearLogs = async () => {
    try {
      await api.clearAuditLogs();
      playSuccessChime();
      showToast('🧹 Audit Logs များ အားလုံးကို ရှင်းလင်းပြီးပါပြီ');
      setShowClearConfirm(false);
      loadLogs();
    } catch (err) {
      showToast('❌ Clear လုပ်ရာတွင် အမှားဖြစ်ခဲ့ပါသည်');
    }
  };

  // User Moderation handlers
  const handleConfirmDeleteUser = async (
    clientId: string,
    financialAction: FinancialResolutionOption
  ) => {
    setModifyingUserId(clientId);
    try {
      await api.deleteClient(clientId, financialAction);
      playSuccessChime();
      showToast('🗑️ သုံးစွဲသူ အကောင့်အား အပြီးသတ် ဖျက်ပြီး ငွေစာရင်းရှင်းလင်းပြီးပါပြီ');
      setClientToDelete(null);
      onRefresh?.();
      loadLogs();
    } catch (err) {
      console.error(err);
      showToast('❌ အကောင့်ဖျက်ရာတွင် အမှားဖြစ်ခဲ့ပါသည်');
    } finally {
      setModifyingUserId(null);
    }
  };

  // Filtered clients list for user moderation
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        !userSearchQuery.trim() ||
        c.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        c.phone.includes(userSearchQuery) ||
        (c.email && c.email.toLowerCase().includes(userSearchQuery.toLowerCase()));
      const matchesTier = userTierFilter === 'All' || c.memberTier === userTierFilter;
      return matchesSearch && matchesTier;
    });
  }, [clients, userSearchQuery, userTierFilter]);

  const activeClientsCount = clients.length;

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
            <Crown className="w-3 h-3 text-emerald-300" /> SuperAdmin
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> Admin
          </span>
        );
      case 'barber':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Scissors className="w-3 h-3 text-emerald-400" /> Barber
          </span>
        );
      case 'user':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <User className="w-3 h-3 text-purple-400" /> Client
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
            <Activity className="w-3 h-3 text-neutral-400" /> System
          </span>
        );
    }
  };

  const getActionTypeIcon = (type?: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="w-4 h-4 text-emerald-300" />;
      case 'auth':
        return <Key className="w-4 h-4 text-emerald-400" />;
      case 'financial':
        return <DollarSign className="w-4 h-4 text-cyan-400" />;
      case 'staff':
        return <Users className="w-4 h-4 text-blue-400" />;
      case 'service':
        return <Scissors className="w-4 h-4 text-pink-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-emerald-300" />;
    }
  };

  const formatLogTime = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `${dateStr} • ${timeStr}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 bg-neutral-900 border border-emerald-500/50 text-amber-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Executive Welcome & Mode Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-emerald-500/30 p-3.5 sm:p-4 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                <Crown className="w-3 h-3" />
                SuperAdmin
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Audit Logs &amp; လှုပ်ရှားမှု မှတ်တမ်း
              </h1>
            </div>
            <p className="text-xs text-neutral-400 leading-tight">
              Audit Trail မှတ်တမ်းများ၊ ဝန်ထမ်းအကောင့် PIN များနှင့် အစီရင်ခံစာများ
            </p>
          </div>

          {/* Primary Quick Actions: Walk-in, POS, Expenses in High-Visibility Material Style */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateSection && onNavigateSection('walkins')}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-white hover:bg-neutral-100 text-black font-extrabold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer shadow-md border-2 border-white ring-2 ring-white/10"
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span>Walk-in</span>
            </button>
            <button
              onClick={() => onNavigateSection && onNavigateSection('pos')}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer border-2 border-neutral-700 shadow-md"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span>POS</span>
            </button>
            <button
              onClick={() => onNavigateSection && onNavigateSection('expenses')}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer border-2 border-neutral-700 shadow-md"
            >
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
              <span>Expenses</span>
            </button>
          </div>
        </div>

        {/* Metric Highlights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3 pt-3 border-t border-neutral-800/80">
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">စုစုပေါင်း ဝင်ငွေ (Gross)</span>
            <span className="text-base font-extrabold text-emerald-300 mt-1 block">
              {formatPrice(executiveStats.totalGrossRevenue)}
            </span>
          </div>
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">ဒီလ ဝင်ငွေ (This Month)</span>
            <span className="text-base font-extrabold text-emerald-400 mt-1 block">
              {formatPrice(executiveStats.monthRevenue)}
            </span>
          </div>
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">ပြီးမြောက် ဘိုကင် (Completed)</span>
            <span className="text-base font-extrabold text-white mt-1 block">
              {executiveStats.totalCompleted} <span className="text-xs font-normal text-neutral-400">ခု</span>
            </span>
          </div>
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">Stylist အဖွဲ့ဝင် (Barbers)</span>
            <span className="text-base font-extrabold text-cyan-400 mt-1 block">
              {executiveStats.activeStaff} <span className="text-xs font-normal text-neutral-400">ဦး</span>
            </span>
          </div>
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">အတည်ပြုရန် ကျန် (Pending)</span>
            <span className="text-base font-extrabold text-orange-400 mt-1 block">
              {executiveStats.pendingCount} <span className="text-xs font-normal text-neutral-400">ခု</span>
            </span>
          </div>
          <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 font-medium block">Audit မှတ်တမ်းများ (Logs)</span>
            <span className="text-base font-extrabold text-emerald-200 mt-1 block">
              {executiveStats.totalLogsCount} <span className="text-xs font-normal text-neutral-400">ခု</span>
            </span>
          </div>
        </div>
      </div>

      {/* SuperAdmin View Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('audit')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeMainTab === 'audit'
              ? 'bg-emerald-500 text-neutral-950 shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Trail Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('users')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeMainTab === 'users'
              ? 'bg-emerald-500 text-neutral-950 shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Users &amp; Moderation ({clients.length})</span>
        </button>

        <button
          onClick={() => onNavigateSection && onNavigateSection('settlement')}
          className="px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
        >
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>💵 ငွေရှင်းတမ်း၊ အသုံးစရိတ် & POS</span>
        </button>

        <button
          onClick={() => setActiveMainTab('quick-manage')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeMainTab === 'quick-manage'
              ? 'bg-emerald-500 text-neutral-950 shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Quick Services, Barbers &amp; History</span>
        </button>
      </div>

      {/* VIEW 1: AUDIT LOG WORKSTATION */}
      {activeMainTab === 'audit' && (
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Workstation Header & Controls */}
        <div className="p-5 border-b border-neutral-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                Security &amp; Action Audit Trail Log
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                စနစ်အတွင်း လုပ်ဆောင်သမျှ အတည်ပြုချက်များ၊ အကောင့်ဝင်ရောက်မှုများ၊ စာရင်းပြင်ဆင်မှုများ
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportAuditLogsToCsv(filteredLogs)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
                title="Excel/CSV ဒေါင်းလုဒ်ရယူရန်"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                Excel Export
              </button>

              <button
                onClick={() => setShowAddLogModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold border border-emerald-500/40 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-300" />
                Audit Note ရေးသားရန်
              </button>

              <button
                onClick={loadLogs}
                disabled={loading}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh Logs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-300' : ''}`} />
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                title="Audit Logs ရှင်းလင်းရန်"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="အမည်၊ ဖုန်း၊ Booking Code၊ Action ရှာဖွေရန်..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div className="md:col-span-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">Role အားလုံး (All Roles)</option>
                <option value="superadmin">👑 SuperAdmin</option>
                <option value="admin">🛡️ Admin Manager</option>
                <option value="barber">💈 Barber Staff</option>
                <option value="user">👤 Client</option>
                <option value="system">🤖 System</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <div className="md:col-span-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">Action အမျိုးအစား အားလုံး</option>
                <option value="booking">📅 Bookings</option>
                <option value="auth">🔑 Staff &amp; PINs</option>
                <option value="financial">💵 Settlement / Payments</option>
                <option value="service">✂️ Services</option>
                <option value="settings">⚙️ Settings</option>
                <option value="system">🤖 System Core</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="md:col-span-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">ကာလ အားလုံး (All Time)</option>
                <option value="today">ဒီနေ့ (Today)</option>
                <option value="7days">လွန်ခဲ့သော ၇ ရက် (7 Days)</option>
                <option value="month">ဒီလ (This Month)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-neutral-400">Audit Logs မှတ်တမ်းများ ရယူနေပါသည်...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Info className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-semibold text-neutral-300">သတ်မှတ်ချက်နှင့် ကိုက်ညီသော Audit Log မတွေ့ရှိပါ</p>
              <p className="text-xs text-neutral-500">Filter ပြောင်းလဲကြည့်ပါ သို့မဟုတ် ရှာဖွေမှုစကားလုံးကို စစ်ဆေးပါ</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">အချိန် (Timestamp)</th>
                  <th className="py-3 px-4">လုပ်ဆောင်သူ (Actor)</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">လုပ်ဆောင်ချက် (Action)</th>
                  <th className="py-3 px-4">အသေးစိတ် အချက်အလက် (Details)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors group">
                    {/* Timestamp */}
                    <td className="py-3 px-4 text-neutral-400 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span>{formatLogTime(log.timestamp)}</span>
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {log.adminName || 'System'}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getRoleBadge(log.actorRole)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700/80 text-neutral-200 font-medium">
                        {getActionTypeIcon(log.actionType)}
                        <span>{log.action}</span>
                      </div>
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-neutral-300 leading-relaxed max-w-md">
                      <span>{log.details}</span>
                      {log.targetId && (
                        <span className="ml-2 font-mono text-[10px] text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {log.targetId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span>
            စုစုပေါင်း မှတ်တမ်း: <strong className="text-white">{filteredLogs.length}</strong> ခု ပြသထားပါသည်
          </span>
          <span className="text-[11px] text-neutral-500">
            Real-time Immutable Security Audit Trail
          </span>
        </div>
      </div>
      )}

      {/* VIEW 2: ACTIVE USERS & MODERATION */}
      {activeMainTab === 'users' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
          {/* Header */}
          <div className="p-5 border-b border-neutral-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-300" />
                  Active Users &amp; Moderation
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  App အသုံးပြုသူ (Clients) များ စာရင်း၊ အကောင့်ရပ်ဆိုင်းခြင်း (Kick/Suspend) နှင့် ပယ်ဖျက်ခြင်း (Delete)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    let clientList = clients;
                    try {
                      const fresh = await api.getClients();
                      if (fresh && fresh.length > 0) clientList = fresh;
                    } catch {}
                    exportClientsToCsv(clientList, bookings);
                    playSuccessChime();
                    setToastMsg('✅ Clients Directory Excel အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ');
                    setTimeout(() => setToastMsg(null), 3500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/40 transition-colors cursor-pointer"
                  title="Download Clients Directory as Excel (.csv)"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  Excel Export
                </button>

                <button
                  onClick={() => onNavigateSection && onNavigateSection('clients')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold border border-emerald-500/40 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-300" />
                  Client Manager သို့ သွားရန်
                </button>

                <button
                  onClick={() => onRefresh && onRefresh()}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
                  title="Refresh Users"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-300" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">စုစုပေါင်း သုံးစွဲသူ (Total)</span>
                <span className="text-base font-extrabold text-white mt-1 block">
                  {clients.length} <span className="text-xs font-normal text-neutral-400">ယောက်</span>
                </span>
              </div>

              <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Active အသုံးပြုသူများ</span>
                <span className="text-base font-extrabold text-emerald-400 mt-1 block">
                  {clients.length} <span className="text-xs font-normal text-neutral-400">ယောက်</span>
                </span>
              </div>

              <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Silver အဆင့်ဝင်</span>
                <span className="text-base font-extrabold text-stone-300 mt-1 block">
                  {clients.filter((c) => c.memberTier === 'Silver').length}{' '}
                  <span className="text-xs font-normal text-neutral-400">ယောက်</span>
                </span>
              </div>

              <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">VIP &amp; Gold အဆင့်ဝင်</span>
                <span className="text-base font-extrabold text-emerald-300 mt-1 block">
                  {clients.filter((c) => c.memberTier === 'VIP' || c.memberTier === 'Gold').length}{' '}
                  <span className="text-xs font-normal text-neutral-400">ယောက်</span>
                </span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="သုံးစွဲသူ အမည်၊ ဖုန်းနံပါတ်၊ Email ရှာဖွေရန်..."
                  className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Tier Filter */}
              <div className="md:col-span-7 flex items-center gap-1 overflow-x-auto">
                {['All', 'Bronze', 'Silver', 'Gold', 'VIP'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setUserTierFilter(tier)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                      userTierFilter === tier
                        ? 'bg-emerald-500 text-neutral-950'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {tier === 'All' ? 'All Tiers' : tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            {filteredClients.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Users className="w-10 h-10 text-neutral-700 mx-auto" />
                <p className="text-sm font-medium text-neutral-400">ရှာဖွေမှုနှင့် ကိုက်ညီသော သုံးစွဲသူ မရှိပါ</p>
                <p className="text-xs text-neutral-600">Filter သို့မဟုတ် Search စာလုံးကို ပြန်လည်စစ်ဆေးပါ</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/70 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">သုံးစွဲသူ Profile</th>
                    <th className="py-3 px-4">ဆက်သွယ်ရန်</th>
                    <th className="py-3 px-4">Member Tier &amp; Points</th>
                    <th className="py-3 px-4">အခြေအနေ (Status)</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-xs">
                  {filteredClients.map((client) => {
                    const isModifying = modifyingUserId === client.id;
                    return (
                      <tr key={client.id} className="hover:bg-neutral-800/30 transition-colors">
                        {/* Profile */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {client.avatarUrl ? (
                              <img
                                src={client.avatarUrl}
                                alt={client.name}
                                className="w-9 h-9 rounded-xl object-cover border border-emerald-500/40"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-200 font-bold flex items-center justify-center border border-emerald-500/30 text-sm">
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-white block">{client.name}</span>
                              <span className="text-[10px] text-neutral-500 font-mono">ID: {client.id.slice(0, 10)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 text-neutral-300">
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <div className="flex items-center gap-1.5 text-neutral-200">
                              <Phone className="w-3 h-3 text-emerald-300" />
                              <span>{client.phone}</span>
                            </div>
                            {client.email && (
                              <div className="flex items-center gap-1.5 text-neutral-400">
                                <Mail className="w-3 h-3 text-neutral-500" />
                                <span>{client.email}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Tier & Points */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                client.memberTier === 'VIP'
                                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                                  : client.memberTier === 'Gold'
                                  ? 'bg-emerald-500/20 text-yellow-300 border-yellow-500/40'
                                  : client.memberTier === 'Silver'
                                  ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                                  : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              }`}
                            >
                              👑 {client.memberTier || 'Bronze'}
                            </span>
                            <span className="block text-[11px] font-mono text-emerald-300 font-semibold">
                              {client.points || 0} pts
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Active User</span>
                          </span>
                        </td>

                        {/* Moderation Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Delete Client */}
                            <button
                              onClick={() => setClientToDelete(client)}
                              disabled={isModifying}
                              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-neutral-700 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
                              title="အကောင့် အပြီးသတ် ဖျက်ပစ်ပြီး ငွေစာရင်းစီမံရန်"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Summary */}
          <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span>
              စုစုပေါင်း သုံးစွဲသူ: <strong className="text-white">{filteredClients.length}</strong> ယောက် ပြသထားပါသည်
            </span>
            <span className="text-[11px] text-neutral-500">
              Active User Real-Time Moderation Console
            </span>
          </div>
        </div>
      )}

      {/* VIEW 3: QUICK MASTER DATA & BOOKING HISTORY CONTROL */}
      {activeMainTab === 'quick-manage' && (
        <div className="space-y-5">
          {/* Privilege Notice Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <Crown className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">SuperAdmin စီမံခန့်ခွဲရေး အထူးအခွင့်အာဏာ</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Superadmin အနေဖြင့် ဆံသဆိုင်၏ ဝန်ဆောင်မှုနှင့် ဈေးနှုန်းများ (Services &amp; Pricing)၊ Stylist ဝန်ထမ်းများ၊ ယခင် ဘိုကင်မှတ်တမ်းဟောင်းများ (Old Booking History) အား စိတ်ကြိုက် ပြင်ဆင်ခြင်း၊ မလိုအပ်သော မှတ်တမ်းများ ဖျက်ပစ်ခြင်း နှင့် အစီရင်ခံစာများ ထုတ်ယူခြင်းတို့ကို တိုက်ရိုက် စီမံနိုင်ပါသည်။
                </p>
              </div>
            </div>
          </div>

          {/* 4 Core Control Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Services & Pricing */}
            <div className="bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-all space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Services &amp; Pricing စီမံခန့်ခွဲမှု</h4>
                    <span className="text-xs text-neutral-400">ဝန်ဆောင်မှု အမျိုးအစား၊ ဈေးနှုန်း၊ ကြာချိန်များ</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-300 text-xs font-mono font-bold border border-pink-500/30">
                  {services.length} Services
                </span>
              </div>

              <div className="space-y-2 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/80 text-xs">
                {services.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-neutral-300">
                    <span className="truncate max-w-[200px]">{s.name}</span>
                    <span className="font-mono text-emerald-300 font-bold">{formatPrice(s.price)}</span>
                  </div>
                ))}
                {services.length > 3 && (
                  <span className="text-[11px] text-neutral-500 block pt-1">
                    + အခြား {services.length - 3} ခု ကျန်ရှိပါသေးသည်
                  </span>
                )}
              </div>

              <button
                onClick={() => onNavigateSection && onNavigateSection('services')}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <span>Services &amp; ဈေးနှုန်းများ စိတ်ကြိုက် ပြင်ဆင်ရန်</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Card 2: Stylists / Barbers Team */}
            <div className="bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-all space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Barbers &amp; Stylists အဖွဲ့ဝင်များ</h4>
                    <span className="text-xs text-neutral-400">ဆံသပညာရှင်များ၊ ရာထူး၊ Commission နှုန်းထားများ</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30">
                  {designers.length} Stylists
                </span>
              </div>

              <div className="space-y-2 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/80 text-xs">
                {designers.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-neutral-300">
                    <span className="truncate max-w-[200px]">{d.name}</span>
                    <span className="text-neutral-400 font-mono text-[11px]">{d.specialty || 'General Haircut'}</span>
                  </div>
                ))}
                {designers.length > 3 && (
                  <span className="text-[11px] text-neutral-500 block pt-1">
                    + အခြား {designers.length - 3} ဦး ကျန်ရှိပါသေးသည်
                  </span>
                )}
              </div>

              <button
                onClick={() => onNavigateSection && onNavigateSection('designers')}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <span>Barber ဝန်ထမ်းများ စီမံပြင်ဆင်ရန်</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Card 3: Old Booking History Management */}
            <div className="bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-all space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Booking History စီမံပြင်ဆင်မှု</h4>
                    <span className="text-xs text-neutral-400">ယခင် ဘိုကင်ဟောင်းများ ပြင်ဆင်ခြင်း၊ ဖျက်ပစ်ခြင်း</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-200 text-xs font-mono font-bold border border-emerald-500/30">
                  {bookings.length} Bookings
                </span>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/80">
                Superadmin အနေဖြင့် Booking တစ်ခုချင်းစီ၏ Barber၊ ဝန်ဆောင်မှု၊ ကျသင့်ငွေ၊ Status နှင့် ရက်စွဲများကို ပြန်လည်ပြင်ဆင်နိုင်သလို မလိုအပ်သော Old Bookings များကိုလည်း Confirm ဖြင့် အပြီးသတ် ဖျက်နိုင်ပါသည်။
              </p>

              <button
                onClick={() => onNavigateSection && onNavigateSection('bookings')}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 border border-neutral-700"
              >
                <span>ဘိုကင် မှတ်တမ်းဟောင်းများ ပြင်ဆင် / ဖျက်ရန်</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Card 4: Reports & Excel Export / Print Summary */}
            <div className="bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-all space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">အစီရင်ခံစာ &amp; Excel ဒေတာ ထုတ်ယူခြင်း</h4>
                    <span className="text-xs text-neutral-400">လချုပ်/နှစ်ချုပ် Report၊ ပရင့်ထုတ်ခြင်း၊ Excel Export</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                  Export &amp; Print
                </span>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/80">
                Application ဒေတာတစ်ခုလုံး (Bookings, Clients, Barbers, Services, Financials) အား Excel ဖြင့် ထုတ်ယူခြင်းနှင့် Superadmin အတွက် Report format ဖြင့် လုပ်ငန်းမှတ်တမ်း အကျဉ်းချုပ်ကို Printable format ဖြင့် ထုတ်ပေးနိုင်ပါသည်။
              </p>

              <button
                onClick={() => onNavigateSection && onNavigateSection('reports')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>Reports &amp; Printable Summary သို့ သွားရန်</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Log Modal */}
      <AnimatePresence>
        {showAddLogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-300" />
                  Supervisor / Executive Audit မှတ်တမ်း ရေးသွင်းခြင်း
                </h3>
                <button
                  onClick={() => setShowAddLogModal(false)}
                  className="text-neutral-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddManualLog} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Action Title (လုပ်ဆောင်ချက် ခေါင်းစဉ်)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAction}
                    onChange={(e) => setManualAction(e.target.value)}
                    placeholder="ဥပမာ: Daily Cash Audit & Handover, Security Inspection..."
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Category (အမျိုးအစား)
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="system">🛡️ စနစ် စစ်ဆေးခြင်း (System / Security)</option>
                    <option value="financial">💵 ငွေစာရင်း စစ်ဆေးခြင်း (Financial &amp; Cash)</option>
                    <option value="staff">💈 ဝန်ထမ်း စီမံခန့်ခွဲမှု (Staff &amp; Performance)</option>
                    <option value="settings">⚙️ ဆိုင် Setting ပြင်ဆင်မှု (Settings)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    အသေးစိတ် မှတ်ချက် (Audit Details &amp; Findings)
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={manualDetails}
                    onChange={(e) => setManualDetails(e.target.value)}
                    placeholder="စစ်ဆေးတွေ့ရှိချက်၊ ငွေလွှဲပြေစာ စစ်ဆေးပြီးကြောင်း သို့မဟုတ် ညွှန်ကြားချက်များကို အသေးစိတ် ရေးသားပါ..."
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddLogModal(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium hover:bg-neutral-700"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? 'သိမ်းဆည်းနေသည်...' : 'မှတ်တမ်း သိမ်းဆည်းရန်'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Logs Confirm Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-red-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Audit Logs အားလုံး ရှင်းလင်းမည်လား?</h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                ယခင် လုပ်ဆောင်ချက် မှတ်တမ်းများ အားလုံးကို ဖျက်ဆီးပါမည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍ မရနိုင်ပါ။
              </p>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium hover:bg-neutral-700"
                >
                  မဖျက်ပါ
                </button>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg"
                >
                  သေချာသည်၊ ရှင်းလင်းမည်
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Deletion & Financial Resolution Modal */}
      <ClientDeleteFinancialModal
        isOpen={Boolean(clientToDelete)}
        onClose={() => setClientToDelete(null)}
        client={clientToDelete}
        bookings={bookings}
        onConfirmDelete={handleConfirmDeleteUser}
      />
    </div>
  );
};
