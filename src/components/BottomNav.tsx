import React from 'react';
import { UserRole } from '../types';
import { Language, translations } from '../data/i18n';
import {
  Home,
  Bell,
  Calendar,
  LayoutDashboard,
  User,
  Scissors,
  Clock,
  Star,
  Users,
  KeyRound,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  lang: Language;
  pendingBookingsCount: number;
  unreadNotifsCount?: number;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  role,
  lang,
  pendingBookingsCount,
  unreadNotifsCount = 0,
}) => {
  const t = translations[lang];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  // 1. Role: Barber Navigation Items (Timeline, Bookings, Alerts, Profile & Ratings)
  if (role === 'barber') {
    const barberNavItems = [
      {
        id: 'timeline',
        label: lang === 'my' ? 'အချိန်ဇယား' : 'Timeline',
        icon: Clock,
        badge: 0,
      },
      {
        id: 'bookings',
        label: lang === 'my' ? 'ဘိုကင်စာရင်း' : 'Bookings',
        icon: Scissors,
        badge: pendingBookingsCount,
        badgeColor: 'bg-emerald-600 text-white font-sans',
      },
      {
        id: 'notifications',
        label: lang === 'my' ? 'သတိပေးချက်' : 'Alerts',
        icon: Bell,
        badge: unreadNotifsCount,
        badgeColor: 'bg-emerald-600 text-white font-sans',
      },
      {
        id: 'profile',
        label: lang === 'my' ? 'ပရိုဖိုင်' : 'Profile',
        icon: Star,
        badge: 0,
      },
    ];

    return (
      <nav className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto bg-[#FFFFFF]/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-xl border border-[#E4E4E7] flex items-center justify-between relative overflow-hidden">
          {barberNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'timeline' && activeTab === 'barber-portal');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all cursor-pointer flex-1 select-none touch-manipulation ${
                  isActive ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-[#71717A] hover:text-stone-900'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'text-white scale-105' : 'text-[#71717A]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center shadow-xs font-sans font-bold ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors font-sans truncate max-w-[70px] ${
                    isActive ? 'text-white font-bold' : 'text-[#71717A]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // 2. Role: SuperAdmin Dedicated Navigation Items (Home/Audit Log, Services, Bookings, Staff, Reports)
  if (role === 'superadmin') {
    const superAdminNavItems = [
      {
        id: 'hub',
        label: lang === 'my' ? 'ပင်မ (Home)' : 'Home',
        icon: Home,
        badge: 0,
      },
      {
        id: 'services',
        label: lang === 'my' ? 'ဝန်ဆောင်မှု' : 'Services',
        icon: Scissors,
        badge: 0,
      },
      {
        id: 'bookings',
        label: lang === 'my' ? 'ဘိုကင်များ' : 'Bookings',
        icon: Calendar,
        badge: pendingBookingsCount,
        badgeColor: 'bg-emerald-600 text-white font-sans',
      },
      {
        id: 'accounts',
        label: lang === 'my' ? 'ဝန်ထမ်း' : 'Staff',
        icon: KeyRound,
        badge: 0,
      },
      {
        id: 'reports',
        label: lang === 'my' ? 'အစီရင်ခံစာ' : 'Reports',
        icon: FileSpreadsheet,
        badge: 0,
      },
    ];

    return (
      <nav className="fixed bottom-3 inset-x-3 sm:hidden z-40 max-w-md mx-auto pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto bg-[#FFFFFF]/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-xl border border-[#E4E4E7] flex items-center justify-between relative overflow-hidden">
          {superAdminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'hub' && (activeTab === 'admin-dashboard' || activeTab === 'hub' || activeTab === 'stats' || activeTab === 'clients' || activeTab === 'promos' || activeTab === 'database' || activeTab === 'settings')) ||
              (item.id === 'accounts' && (activeTab === 'designers' || activeTab === 'staff-portal')) ||
              (item.id === 'reports' && (activeTab === 'reports' || activeTab === 'notifications'));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1.5 rounded-xl transition-all cursor-pointer flex-1 select-none touch-manipulation ${
                  isActive ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-[#71717A] hover:text-stone-900'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'text-white scale-105' : 'text-[#71717A]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center shadow-xs font-sans font-bold ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors font-sans truncate max-w-[70px] ${
                    isActive ? 'text-white font-bold' : 'text-[#71717A]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // 3. Role: Admin Navigation Items
  if (role === 'admin') {
    const adminNavItems = [
      {
        id: 'hub',
        label: lang === 'my' ? 'စီမံခန့်ခွဲ' : 'Admin Hub',
        icon: LayoutDashboard,
        badge: 0,
      },
      {
        id: 'services',
        label: lang === 'my' ? 'ဝန်ဆောင်မှု' : 'Services',
        icon: Scissors,
        badge: 0,
      },
      {
        id: 'bookings',
        label: lang === 'my' ? 'ဘိုကင်များ' : 'Bookings',
        icon: Calendar,
        badge: pendingBookingsCount,
        badgeColor: 'bg-emerald-600 text-white font-sans',
      },
      {
        id: 'accounts',
        label: lang === 'my' ? 'Barber PIN' : 'Staff PINs',
        icon: KeyRound,
        badge: 0,
      },
      {
        id: 'notifications',
        label: lang === 'my' ? 'သတိပေးချက်' : 'Alerts',
        icon: Bell,
        badge: unreadNotifsCount,
        badgeColor: 'bg-emerald-600 text-white font-sans',
      },
    ];

    return (
      <nav className="fixed bottom-3 inset-x-3 sm:hidden z-40 max-w-md mx-auto pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto bg-[#FFFFFF]/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-xl border border-[#E4E4E7] flex items-center justify-between relative overflow-hidden">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'hub' && (activeTab === 'admin-dashboard' || activeTab === 'hub' || activeTab === 'stats' || activeTab === 'clients' || activeTab === 'promos' || activeTab === 'database' || activeTab === 'settings')) ||
              (item.id === 'accounts' && (activeTab === 'designers' || activeTab === 'staff-portal'));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1.5 rounded-xl transition-all cursor-pointer flex-1 select-none touch-manipulation ${
                  isActive ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-[#71717A] hover:text-stone-900'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'text-white scale-105' : 'text-[#71717A]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center shadow-xs font-sans font-bold ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors font-sans truncate max-w-[65px] ${
                    isActive ? 'text-white font-bold' : 'text-[#71717A]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // 3. Role: User / Customer Navigation Items
  const userNavItems = [
    {
      id: 'explore',
      label: lang === 'my' ? 'ပင်မ' : 'Home',
      icon: Home,
      badge: 0,
    },
    {
      id: 'designers',
      label: lang === 'my' ? 'ဒီဇိုင်နာ' : 'Stylists',
      icon: Users,
      badge: 0,
    },
    {
      id: 'my-bookings',
      label: lang === 'my' ? 'ဘိုကင်များ' : 'Activity',
      icon: Calendar,
      badge: 0,
    },
    {
      id: 'notifications',
      label: lang === 'my' ? 'သတိပေးချက်' : 'Alerts',
      icon: Bell,
      badge: unreadNotifsCount,
      badgeColor: 'bg-emerald-600 text-white font-sans',
    },
    {
      id: 'profile',
      label: lang === 'my' ? 'အကောင့်' : 'Profile',
      icon: User,
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-3 inset-x-3 sm:hidden z-40 max-w-md mx-auto pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto bg-[#FFFFFF]/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-xl border border-[#E4E4E7] flex items-center justify-between relative overflow-hidden">
        {userNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1.5 rounded-xl transition-all cursor-pointer flex-1 select-none touch-manipulation ${
                isActive ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-[#71717A] hover:text-stone-900'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'text-white scale-105' : 'text-[#71717A]'
                  }`}
                />
                {item.badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center shadow-xs font-sans font-bold ${
                      item.badgeColor || 'bg-emerald-600 text-white'
                    }`}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-colors font-sans truncate max-w-[65px] ${
                  isActive ? 'text-white font-bold' : 'text-[#71717A]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
