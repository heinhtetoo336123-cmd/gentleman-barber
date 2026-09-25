import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Users,
  UserCheck,
  Tag,
  Database,
  Calendar,
  CreditCard,
  BarChart3,
  Shield,
  KeyRound,
  Bell,
  ArrowLeft,
  Plus,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  DollarSign,
  Layers,
  ChevronRight,
  Megaphone,
  LogOut,
  Zap,
  Receipt,
  Banknote,
  Crown,
  FileSpreadsheet,
  RefreshCw,
  Wrench,
  ShieldCheck,
  Check,
  X,
  ShoppingBag,
  TrendingDown
} from 'lucide-react';
import { Service, Designer, Booking, AppStats, PaymentSettings, UserProfile } from '../types';
import { Language, translations } from '../data/i18n';
import { formatPrice } from '../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client';

// Management Subcomponents
import { ServiceCatalogManager } from './ServiceCatalogManager';
import { DesignerManager } from './DesignerManager';
import { StaffOperationsManager } from './StaffOperationsManager';
import { ClientManager } from './ClientManager';
import { PromoManager } from './PromoManager';
import { DatabaseStoreManager } from './DatabaseStoreManager';
import { BookingManager } from './BookingManager';
import { BarberStaffPortal } from './BarberStaffPortal';
import { PaymentSettingsManager } from './PaymentSettingsManager';
import { AccountControlManager } from './AccountControlManager';
import { AdminStatsTab } from './AdminStatsTab';
import { StatsOverview } from './StatsOverview';
import { ErrorBoundary } from './ErrorBoundary';
import { AdminQuickWalkinManager } from './AdminQuickWalkinManager';
import { DailySettlementReport } from './DailySettlementReport';
import { RetailSalesSection } from './RetailSalesSection';
import { DailyExpensesSection } from './DailyExpensesSection';
import { RepairDatabaseModal } from './RepairDatabaseModal';
import { SuperAdminHome } from './SuperAdminHome';
import { SuperAdminReportsManager } from './SuperAdminReportsManager';
import { AdminServiceBarberMatrixTable } from './AdminServiceBarberMatrixTable';

export type AdminSection =
  | 'hub'
  | 'walkins'
  | 'pos'
  | 'expenses'
  | 'settlement'
  | 'services'
  | 'designers'
  | 'accounts'
  | 'clients'
  | 'promos'
  | 'database'
  | 'bookings'
  | 'staff-portal'
  | 'settings'
  | 'stats'
  | 'reports';

interface AdminControlHubProps {
  services: Service[];
  designers: Designer[];
  bookings: Booking[];
  clients?: UserProfile[];
  stats: AppStats | null;
  pendingRequestsCount: number;
  unreadNotifsCount: number;
  lang: Language;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onRefresh: () => void;
  onOpenNotifications: () => void;
  onLogout?: () => void;
  serviceToEdit: Service | null;
  onClearServiceToEdit: () => void;
  role?: 'admin' | 'superadmin';
}

export const AdminControlHub: React.FC<AdminControlHubProps> = ({
  services,
  designers,
  bookings,
  clients = [],
  stats,
  pendingRequestsCount,
  unreadNotifsCount,
  lang,
  activeSection,
  onSelectSection,
  onRefresh,
  onOpenNotifications,
  onLogout,
  serviceToEdit,
  onClearServiceToEdit,
  role = 'admin',
}) => {
  const t = translations[lang];

  const [shopSettings, setShopSettings] = useState<PaymentSettings | null>(null);
  const [superadminHomeTab, setSuperadminHomeTab] = useState<'staff' | 'settlement' | 'modules'>('staff');

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);

  useEffect(() => {
    const unsub = api.subscribeToSettings((data) => {
      if (data) setShopSettings(data);
    });
    return () => unsub();
  }, []);

  // Quick statistics (Includes all completed and confirmed bookings revenue)
  const activeBookingsList = bookings.filter((b) => b.status !== 'cancelled');
  const totalRevenue = activeBookingsList.reduce((sum, b) => {
    const rawP = Number(
      b.price ??
      b.servicePrice ??
      (b.servicesList && b.servicesList.length > 0
        ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
        : 0)
    );
    const disc = Number(b.discountAmount || 0);
    return sum + Math.max(0, rawP - disc);
  }, 0);
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayBookingsCount = bookings.filter((b) => (b.date || '').split('T')[0] === todayDateStr).length;

  // Primary core pillars requested by user + essentials
  const controlModules = [
    {
      id: 'reports' as AdminSection,
      title: '📊 Reports & Excel Data Export',
      titleMy: '📊 အစီရင်ခံစာ & Excel Data ထုတ်ယူမှု',
      badge: 'Excel • Print • BI',
      badgeUrgent: true,
      desc: 'Export full application data to Excel/CSV, generate monthly/yearly financial statements, printable reports, and business analytics.',
      descMy: 'Application ဒေတာများအားလုံး Excel ဖြင့် ထုတ်ယူခြင်း၊ လချုပ်/နှစ်ချုပ်များ ပရင့်ထုတ်ခြင်းနှင့် စီးပွားရေးသုံးသပ်မှု အစီရင်ခံစာများ',
      icon: FileSpreadsheet,
      color: 'bg-emerald-500 text-stone-950',
      accentBorder: 'hover:border-emerald-500',
      actionLabel: 'Open Reports & Export',
      quickAction: {
        label: 'Reports Hub',
        action: () => onSelectSection('reports'),
      },
    },
    {
      id: 'walkins' as AdminSection,
      title: '⚡ Walk-in Lounge & Records',
      titleMy: '⚡ Walk-in မှတ်တမ်း & အချိန်ဇယား',
      badge: 'Live • Past Records • CRUD',
      badgeUrgent: true,
      desc: 'Complete Walk-in management: Instant slot assignments, log past working records, edit, delete, and view historic walk-in ledger.',
      descMy: 'ဆိုင်ရောက် Walk-in ဧည့်သည်များ စာရင်းသွင်းခြင်း၊ ယခင်မှတ်တမ်းများ ပြန်လည်သွင်းယူခြင်း၊ ပြင်ဆင်ခြင်းနှင့် ပယ်ဖျက်ခြင်း',
      icon: Zap,
      color: 'bg-emerald-500 text-stone-950',
      accentBorder: 'hover:border-emerald-500',
      actionLabel: 'Open Walk-in Suite',
      quickAction: {
        label: '+ Walk-in',
        action: () => onSelectSection('walkins'),
      },
    },
    {
      id: 'settlement' as AdminSection,
      title: '💵 Daily Settlement, Expenses & POS',
      titleMy: '💵 ငွေရှင်းတမ်း၊ အသုံးစရိတ် & ပစ္စည်းအရောင်း (POS)',
      badge: 'Expenses • POS • Commissions',
      desc: 'Daily cash collections, shop expenses ledger, retail product sales (POS), stylist commission splits, and 360° financial statements.',
      descMy: 'တစ်ရက်တာ ငွေသား/KPay/WavePay ဝင်ငွေ၊ ဆိုင်အသုံးစရိတ်များ (Expenses)၊ ခေါင်းလိမ်းဆီအရောင်း (POS) နှင့် ဆံသဆရာ ကော်မရှင်ရှင်းတမ်း စာရင်းချုပ်',
      icon: Receipt,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-emerald-600',
      actionLabel: 'Open Settlement & POS Hub',
      quickAction: {
        label: 'Settlement & POS',
        action: () => onSelectSection('settlement'),
      },
    },
    {
      id: 'services' as AdminSection,
      title: '1. Services & Catalog',
      titleMy: '၁။ ဝန်ဆောင်မှု စာရင်းများ',
      badge: `${services.length} Services`,
      desc: 'Create and update haircut services, VIP packages, prices, categories, and duration minutes.',
      descMy: 'ဆံပင်ညှပ်ဝန်ဆောင်မှုများ၊ ဈေးနှုန်း၊ အချိန်နှင့် အမျိုးအစားများ ပြင်ဆင်ရန်',
      icon: Scissors,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Manage Services',
      quickAction: {
        label: '+ Add Service',
        action: () => onSelectSection('services'),
      },
    },
    {
      id: 'designers' as AdminSection,
      title: '2. Staff & Admin Operations',
      titleMy: '၂။ ဝန်ထမ်းများနှင့် Admin စီမံခန့်ခွဲမှု',
      badge: `${designers.length + 2} Personnel`,
      desc: 'Live operational control of all lounge staff — Barber duty status, phone PIN authentication, commission calculations, and SuperAdmin privileges.',
      descMy: 'Barber များ၏ အလုပ်ချိန်၊ ဝင်ရောက်နိုင်သည့် PIN ကုဒ်၊ ကော်မရှင် % နှင့် Admin များ စီမံခန့်ခွဲရန်',
      icon: Users,
      color: 'bg-[#28282e] text-white',
      accentBorder: 'hover:border-[#D4AF37]',
      actionLabel: 'Staff Operations',
      quickAction: {
        label: '+ Add Staff',
        action: () => onSelectSection('designers'),
      },
    },
    {
      id: 'accounts' as AdminSection,
      title: 'Barber Account Control & PINs',
      titleMy: 'Barber အကောင့်များနှင့် Phone PIN စီမံမှု',
      badge: 'Staff Credentials & PINs',
      desc: 'Assign barber login phone numbers (e.g. 09000000000), set 4-digit PINs, commission %, and enable/disable accounts.',
      descMy: 'Barber များ ဝင်ရောက်နိုင်သည့် ဖုန်းနံပါတ်၊ PIN ကုဒ်၊ ကော်မရှင် % နှင့် အကောင့် ဖွင့်/ပိတ် သတ်မှတ်ရန်',
      icon: KeyRound,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-emerald-500',
      actionLabel: 'Manage Account PINs',
      quickAction: {
        label: 'Set Phone & PIN',
        action: () => onSelectSection('accounts'),
      },
    },
    {
      id: 'clients' as AdminSection,
      title: '3. Clients & Loyalty',
      titleMy: '၃။ ဖောက်သည်များနှင့် VIP စနစ်',
      badge: 'VIP Directory',
      desc: 'View registered clients, loyalty reward points, member tiers (Bronze, Silver, Gold, VIP), and visit histories.',
      descMy: 'ဖောက်သည် စာရင်း၊ အမှတ်များနှင့် VIP အဆင့်များ ကြည့်ရှု ပြင်ဆင်ရန်',
      icon: UserCheck,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Manage Clients',
    },
    {
      id: 'promos' as AdminSection,
      title: '4. Promo Codes & Broadcast Alerts',
      titleMy: '၄။ ပရိုမိုးရှင်းနှင့် အသိပေးကြေညာချက်များ',
      badge: 'Promos & Alerts',
      desc: 'Configure discount coupons, percentage/cash discounts, tier restrictions, and send broadcast announcements & client alerts.',
      descMy: 'ပရိုမိုးရှင်း ကူပွန်များ ဖန်တီးခြင်းနှင့် ဖောက်သည်များထံသို့ ကြေညာချက်၊ သတင်းလွှာများ တိုက်ရိုက် ပေးပို့ရန်',
      icon: Tag,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Manage Promos & Alerts',
    },
    {
      id: 'database' as AdminSection,
      title: '5. Database & Cloud Backup',
      titleMy: '၅။ ဒေတာဘေ့စ်နှင့် Backup',
      badge: 'Firestore & JSON',
      desc: 'Export complete JSON backups, restore database, monitor Firestore sync, and manage master records safely.',
      descMy: 'ဒေတာများကို JSON ဖြင့် သိမ်းဆည်းရန်၊ ပြန်လည် ထည့်သွင်းရန်',
      icon: Database,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Database Hub',
    },
    {
      id: 'bookings' as AdminSection,
      title: 'Live Bookings & Queue',
      titleMy: 'လက်ရှိ ဘိုကင်များနှင့် အချိန်ဇယား',
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} Pending Approval` : 'All Caught Up',
      badgeUrgent: pendingRequestsCount > 0,
      desc: 'Approve, reschedule, or cancel client appointments, view timeline schedule, and contact guests.',
      descMy: 'ဘိုကင် အတည်ပြုခြင်း၊ အချိန်ပြောင်းခြင်းနှင့် စာရင်းများ စစ်ဆေးရန်',
      icon: Calendar,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Manage Bookings',
    },
    {
      id: 'settings' as AdminSection,
      title: 'Payment & Shop Locations',
      titleMy: 'ငွေပေးချေမှုနှင့် ဆိုင်လိပ်စာများ',
      badge: 'KPay • Wave • Branches',
      desc: 'Set up KBZPay & WavePay mobile account numbers, shop hotline, Viber contact, and branch branches.',
      descMy: 'KPay, WavePay ဖုန်းနံပါတ်၊ ဆိုင်လိပ်စာနှင့် Viber ချိတ်ဆက်မှုများ',
      icon: CreditCard,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'Configure Payments',
    },
    {
      id: 'stats' as AdminSection,
      title: 'Analytics & Revenue',
      titleMy: 'ဝင်ငွေနှင့် လုပ်ငန်း အချက်အလက်များ',
      badge: `${formatPrice(totalRevenue)} Total`,
      desc: 'Review revenue reports, top performing stylists, appointment completion rates, and audit logs.',
      descMy: 'ဝင်ငွေစာရင်း၊ အကောင်းဆုံး ဒီဇိုင်နာများနှင့် လချုပ် အစီရင်ခံစာများ',
      icon: BarChart3,
      color: 'bg-stone-950 text-white',
      accentBorder: 'hover:border-stone-950',
      actionLabel: 'View Analytics',
    },
  ];

  // Helper info for active view title
  const getSectionTitle = (sec: AdminSection) => {
    switch (sec) {
      case 'walkins':
        return { name: 'Quick Walk-in & Timeline', desc: 'Real-time timeline slot schedule, vacant hour checks, and instant walk-in client assignment.' };
      case 'pos':
        return { name: 'Retail Products & POS Sales', desc: 'Product walk-in sales, inventory items, and stylist product commissions.' };
      case 'expenses':
        return { name: 'Daily Shop Expenses & Outflow', desc: 'Shop utility costs, barber supplies, rent, maintenance, and daily expenditures.' };
      case 'settlement':
        return { name: 'Daily Cash & Payment Settlement Ledger', desc: 'Audit daily cash takings, KPay/WavePay digital settlements, and stylist commission payouts.' };
      case 'services':
        return { name: 'Services & Catalog Management', desc: 'Add, update pricing, duration, and categories for all haircut & spa services.' };
      case 'designers':
        return { name: 'Staff & Admin Operations Roster', desc: 'Manage master barbers, active status, credentials, PIN codes, commission %, and SuperAdmin security.' };
      case 'accounts':
        return { name: 'Account Control & Barber PINs', desc: 'Manage barber login phone numbers, 4-digit PINs, commission %, and master credentials.' };
      case 'clients':
        return { name: 'Client Registry & Loyalty VIP', desc: 'Browse registered clients, member tier badges, and loyalty points.' };
      case 'promos':
        return { name: 'Promo Codes & Vouchers', desc: 'Create and activate discount vouchers for clients and VIP members.' };
      case 'database':
        return { name: 'Database Store & JSON Backup', desc: 'Cloud storage synchronization, 1-click JSON backup export and restore.' };
      case 'bookings':
        return { name: 'Appointments & Booking Queue', desc: 'Review, approve, and manage customer appointment schedules.' };
      case 'staff-portal':
        return { name: 'Barber Commission & Shift Schedule', desc: 'Track stylist commissions, completed cuts, and daily payout metrics.' };
      case 'settings':
        return { name: 'Payment Accounts & Shop Hotline', desc: 'Update KBZPay, WavePay transfer numbers, hotline, and branch addresses.' };
      case 'stats':
        return { name: 'Business Intelligence & Stats', desc: 'Financial performance, stylist ranking, and real-time operational metrics.' };
      default:
        return { name: role === 'superadmin' ? 'SuperAdmin Hub' : 'Admin Hub', desc: 'Select a control option below to manage GENTLEMEN Barber Lounge.' };
    }
  };

  const currentInfo = getSectionTitle(activeSection);

  return (
    <div className="space-y-4">
      
      {/* Prominent Admin Primary Command Bar: Walk-in, POS, Expenses */}
      <div className="bg-white border-2 border-stone-300/80 rounded-2xl p-2.5 sm:p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* 3 Primary Large Fixed Action Buttons: Walk-in, POS, Expenses */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:space-x-2.5 w-full sm:w-auto">
            {/* 1. Walk-in */}
            <button
              onClick={() => onSelectSection('walkins')}
              className={`min-h-[46px] sm:min-h-[50px] px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl font-mono text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                activeSection === 'walkins'
                  ? 'bg-black text-white shadow-md border-2 border-black ring-2 ring-black/20'
                  : 'bg-stone-100 text-stone-900 hover:text-black hover:bg-stone-200/90 border-2 border-stone-200'
              }`}
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <span className="tracking-wide">Walk-in</span>
            </button>

            {/* 2. POS */}
            <button
              onClick={() => onSelectSection('pos')}
              className={`min-h-[46px] sm:min-h-[50px] px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl font-mono text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                activeSection === 'pos'
                  ? 'bg-black text-white shadow-md border-2 border-black ring-2 ring-black/20'
                  : 'bg-stone-100 text-stone-900 hover:text-black hover:bg-stone-200/90 border-2 border-stone-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span className="tracking-wide">POS</span>
            </button>

            {/* 3. Expenses */}
            <button
              onClick={() => onSelectSection('expenses')}
              className={`min-h-[46px] sm:min-h-[50px] px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl font-mono text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                activeSection === 'expenses'
                  ? 'bg-black text-white shadow-md border-2 border-black ring-2 ring-black/20'
                  : 'bg-stone-100 text-stone-900 hover:text-black hover:bg-stone-200/90 border-2 border-stone-200'
              }`}
            >
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
              <span className="tracking-wide">Expenses</span>
            </button>
          </div>

          {/* Active module indicator if navigated into another section from Hub cards */}
          {activeSection !== 'hub' && (
            <div className="flex items-center justify-end sm:justify-start">
              <button
                onClick={() => onSelectSection('hub')}
                className="px-3 py-1.5 rounded-xl font-mono font-bold bg-stone-900 text-white text-xs flex items-center space-x-1.5 hover:bg-black transition-colors cursor-pointer border border-stone-800"
              >
                <span>🏠 Dashboard Hub</span>
                {activeSection !== 'walkins' && activeSection !== 'pos' && activeSection !== 'expenses' && (
                  <span className="text-emerald-400">• {currentInfo.name}</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW: 1. OVERVIEW DASHBOARD HUB */}
      {activeSection === 'hub' && (
        <div className="space-y-6">
          
          {/* SUPERADMIN DEDICATED HOME: AUDIT LOG, EXECUTIVE HIGHLIGHTS & REPORT SHORTCUTS */}
          {role === 'superadmin' ? (
            <SuperAdminHome
              bookings={bookings}
              designers={designers}
              services={services}
              clients={clients}
              onNavigateSection={(sec) => onSelectSection(sec as AdminSection)}
              onRefresh={onRefresh}
              lang={lang}
            />
          ) : (
            <>
              {/* Dynamic Service & Stylist Performance Matrix Table */}
              <AdminServiceBarberMatrixTable
                services={services}
                designers={designers}
                bookings={bookings}
                lang={lang}
              />

          {/* Core 5 Pillared Action Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-mono font-black uppercase tracking-wider text-stone-950">
                  Core Management Modules
                </h3>
                <p className="text-xs text-stone-500">
                  Click any module below for direct access and simplified controls.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {controlModules.map((module) => {
                const IconComponent = module.icon;
                return (
                  <div
                    key={module.id}
                    className="bg-white border border-stone-200 hover:border-stone-950 rounded-3xl p-5 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Card Header: Icon + Badge */}
                      <div className="flex items-center justify-between">
                        <div className={`w-10 h-10 rounded-2xl ${module.color} flex items-center justify-center shadow-xs`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                            module.badgeUrgent
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                              : 'bg-stone-100 text-stone-800 border border-stone-200'
                          }`}
                        >
                          {module.badge}
                        </span>
                      </div>

                      {/* Card Title & Desc */}
                      <div>
                        <h4 className="text-base font-black text-stone-950 font-mono tracking-tight group-hover:text-stone-950">
                          {lang === 'my' ? module.titleMy : module.title}
                        </h4>
                        <p className="text-xs text-stone-600 leading-relaxed mt-1.5">
                          {lang === 'my' ? module.descMy : module.desc}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-stone-100 flex items-center space-x-2">
                      <button
                        onClick={() => onSelectSection(module.id)}
                        className="flex-1 bg-stone-950 hover:bg-stone-800 text-white font-bold font-mono text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 shadow-xs"
                      >
                        <span>{module.actionLabel}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {module.quickAction && (
                        <button
                          onClick={module.quickAction.action}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-200 font-bold font-mono text-xs py-2.5 px-3 rounded-xl transition-all cursor-pointer"
                        >
                          {module.quickAction.label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

              {/* Quick Database & Health Indicator */}
              <div className="bg-stone-950 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-emerald-300" />
                    <h4 className="text-sm font-mono font-bold tracking-wide">
                      Real-time Cloud Database & Fast Backup
                    </h4>
                  </div>
                  <p className="text-xs text-stone-400 max-w-xl leading-relaxed">
                    All changes to services, stylists, bookings, and clients are automatically synchronized to Firestore cloud storage. You can download a standalone JSON backup anytime.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onSelectSection('database')}
                    className="px-4 py-2 rounded-xl bg-white text-stone-950 hover:bg-stone-100 font-bold font-mono text-xs transition-all cursor-pointer shadow-xs"
                  >
                    Open Database Hub
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* VIEW: 2. SPECIFIC SECTION CONTENT */}
      {activeSection !== 'hub' && (
        <div className="space-y-4">
          {/* Sub Tab Content with localized ErrorBoundary resilience */}
          <ErrorBoundary fallbackTitle="Admin Sub-Module Error" onReset={onRefresh}>
            {activeSection === 'reports' && (
              <SuperAdminReportsManager
                bookings={bookings}
                designers={designers}
                services={services}
                clients={clients}
                settings={shopSettings || undefined}
                lang={lang}
              />
            )}

            {activeSection === 'walkins' && (
              <AdminQuickWalkinManager
                designers={designers}
                services={services}
                bookings={bookings}
                clients={clients}
                onRefresh={onRefresh}
                lang={lang}
              />
            )}

            {activeSection === 'pos' && (
              <RetailSalesSection
                designers={designers}
                lang={lang}
              />
            )}

            {activeSection === 'expenses' && (
              <DailyExpensesSection
                lang={lang}
              />
            )}

            {activeSection === 'settlement' && (
              <DailySettlementReport
                bookings={bookings}
                designers={designers}
                services={services}
                onRefresh={onRefresh}
                role={role}
                initialTab="overview"
              />
            )}

            {activeSection === 'services' && (
              <ServiceCatalogManager
                services={services}
                onRefresh={onRefresh}
                initialEditService={serviceToEdit}
                onClearInitialEditService={onClearServiceToEdit}
              />
            )}

            {activeSection === 'designers' && (
              <StaffOperationsManager
                designers={designers}
                bookings={bookings}
                onRefresh={onRefresh}
                role={role}
              />
            )}

            {activeSection === 'accounts' && (
              <AccountControlManager designers={designers} onRefresh={onRefresh} role={role} />
            )}

            {activeSection === 'staff-portal' && (
              <BarberStaffPortal designers={designers} bookings={bookings} onRefresh={onRefresh} />
            )}

            {activeSection === 'clients' && (
              <ClientManager designers={designers} bookings={bookings} clients={clients} role={role} />
            )}

            {activeSection === 'promos' && (
              <PromoManager lang={lang} />
            )}

            {activeSection === 'database' && (
              <DatabaseStoreManager onRefreshAll={onRefresh} />
            )}

            {activeSection === 'bookings' && (
              <BookingManager
                bookings={bookings}
                designers={designers}
                services={services}
                onRefresh={onRefresh}
                role={role}
              />
            )}

            {activeSection === 'settings' && (
              <PaymentSettingsManager />
            )}

            {activeSection === 'stats' && (
              <AdminStatsTab
                stats={stats}
                bookings={bookings}
                designers={designers}
                services={services}
              />
            )}
          </ErrorBoundary>
        </div>
      )}

      {/* Safe PWA Cache Cleaner & Cloud Re-sync (Repair) Modal */}
      <RepairDatabaseModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        lang={lang}
        onRepaired={onRefresh}
      />
    </div>
  );
};
