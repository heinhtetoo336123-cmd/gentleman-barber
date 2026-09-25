import React, { useState, useEffect } from 'react';
import { UserRole, Service, Designer, Booking, NotificationItem, AppStats, PaymentSettings, UserProfile } from './types';
import { Language, translations } from './data/i18n';
import { decryptSessionData } from './lib/authCrypto';
import { api } from './api/client';
import { getAudioContext, requestNotificationPermission, isNotificationForClient, isNotificationForBarber, getClearedNotificationIds } from './utils/notifications';

import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { BookingModal } from './components/BookingModal';
import { UserBookingHistory } from './components/UserBookingHistory';
import { NotificationsModal } from './components/NotificationsModal';
import { NotificationsFeed } from './components/NotificationsFeed';
import { UserProfileModal } from './components/UserProfileModal';
import { ClientHomeFeed } from './components/ClientHomeFeed';
import { UserProfileView, UserProfileData } from './components/UserProfileView';
import { DesignerCard } from './components/DesignerCard';
import { AdminControlHub, AdminSection } from './components/AdminControlHub';
import { BarberStaffPortal } from './components/BarberStaffPortal';
import { AppUpdateNotifier } from './components/AppUpdateNotifier';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RepairDatabaseModal } from './components/RepairDatabaseModal';
import { motion, AnimatePresence } from 'motion/react';

import {
  Scissors,
  Sparkles,
  Users,
  Calendar,
  Shield,
  Zap,
  Bell,
  Plus,
  User,
  ArrowRight,
  LogOut
} from 'lucide-react';

export default function App() {
  // Gate screen state: user chooses between admin, barber and user before app start
  const [hasSelectedPortal, setHasSelectedPortal] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>('user');
  const [activeBarber, setActiveBarber] = useState<Designer | null>(null);
  
  // Default English as requested
  const [lang, setLang] = useState<Language>('en');

  const [activeTab, setActiveTab] = useState<string>('explore'); // 'explore' | 'designers' | 'my-bookings' | 'admin-dashboard' | 'barber-portal'
  const [adminSubTab, setAdminSubTab] = useState<AdminSection>('hub');

  // App Data (Loaded synchronously from local cache so Frame 0 renders instant data with 0ms delay and zero 0-flashes)
  const [services, setServices] = useState<Service[]>(() => api.getCachedServices());
  const [designers, setDesigners] = useState<Designer[]>(() => api.getCachedDesigners());
  const [bookings, setBookings] = useState<Booking[]>(() => api.getCachedBookings());
  const [clients, setClients] = useState<UserProfile[]>(() => api.getCachedClients());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<AppStats | null>(() => api.getCachedStats());
  const [shopSettings, setShopSettings] = useState<PaymentSettings | null>(() => api.getCachedSettings());

  // Selected category filter on user side
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [preSelectedService, setPreSelectedService] = useState<Service | null>(null);
  const [preSelectedDesigner, setPreSelectedDesigner] = useState<Designer | null>(null);
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);

  // Check saved session & language on load and setup subscriptions
  useEffect(() => {
    // Language preference (Default to 'en')
    const savedLang = localStorage.getItem('baba_lang') as Language;
    if (savedLang === 'en' || savedLang === 'my') {
      setLang(savedLang);
    } else {
      setLang('en'); // Default English
    }

    // Encrypted Admin, SuperAdmin or Barber Session check
    const savedSession = localStorage.getItem('baba_admin_session');
    if (savedSession) {
      const decrypted = decryptSessionData(savedSession);
      if (decrypted && (decrypted.role === 'admin' || decrypted.role === 'superadmin')) {
        setRole(decrypted.role as UserRole);
        setHasSelectedPortal(true);
        setActiveTab('admin-dashboard');
      }
    } else {
      const savedBarberSession = localStorage.getItem('baba_barber_session');
      if (savedBarberSession) {
        let barberId = '';
        let barberPhone = localStorage.getItem('baba_active_barber_phone') || '';
        let barberName = localStorage.getItem('baba_active_barber_name') || '';

        const decrypted = decryptSessionData(savedBarberSession);
        if (decrypted && decrypted.role === 'barber') {
          barberId = decrypted.barberId || '';
          barberPhone = decrypted.phone || barberPhone;
          barberName = decrypted.barberName || barberName;
        } else {
          try {
            const parsed = JSON.parse(savedBarberSession);
            if (parsed && (parsed.barberId || parsed.id)) {
              barberId = parsed.barberId || parsed.id;
              barberPhone = parsed.phone || barberPhone;
              barberName = parsed.barberName || barberName;
            }
          } catch {}
        }

        const storedBarberId = barberId || localStorage.getItem('baba_active_barber_id');
        if (storedBarberId) {
          setRole('barber');
          setHasSelectedPortal(true);
          setActiveTab('timeline');
          localStorage.setItem('baba_active_barber_id', storedBarberId);

          try {
            const cachedObj = localStorage.getItem('baba_active_barber_obj');
            if (cachedObj) {
              const parsedObj = JSON.parse(cachedObj);
              if (parsedObj && (parsedObj.id === storedBarberId || parsedObj.phone === barberPhone)) {
                setActiveBarber(parsedObj);
              }
            }
          } catch {}
        }
      }
    }

    loadAllData();

    // Unlock Web Audio context on first user interaction
    const handleUserInteraction = () => {
      getAudioContext();
      requestNotificationPermission().catch(() => {});
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);

    // Purge stale local cache from installed apps to guarantee immediate 267 bookings full sync
    try {
      const storedVersion = localStorage.getItem('baba_app_version');
      if (storedVersion !== 'v3.5.0') {
        localStorage.removeItem('baba_bookings');
        localStorage.setItem('baba_app_version', 'v3.5.0');
      }
    } catch {}

    // Subscribe to real-time updates for Bookings, Notifications, Designers, Services, Clients, and Settings
    const unsubServices = api.subscribeToServices((updatedServices) => {
      setServices(updatedServices);
    });

    const unsubDesigners = api.subscribeToDesigners((updatedDesigners) => {
      setDesigners(updatedDesigners);
    });

    const unsubSettings = api.subscribeToSettings((updatedSettings) => {
      setShopSettings(updatedSettings);
    });

    const unsubClients = api.subscribeToClients((updatedClients) => {
      setClients(updatedClients);
    });

    const unsubBookings = api.subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
      api.getStats().then(setStats).catch(() => {});
    });

    // Targeted real-time notifications
    const unsubNotifs = api.subscribeToNotifications(role, (updatedNotifs) => {
      setNotifications(updatedNotifs);
    });

    // Immediate initial fetch to ensure zero blank screen on mobile / cold starts
    loadAllData().catch(() => {});

    // Periodic maintenance for expired read notifications (only when active tab is visible)
    const purgeInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        api.purgeExpiredReadNotifications().catch(() => {});
      }
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      clearInterval(purgeInterval);
      unsubServices();
      unsubDesigners();
      unsubSettings();
      unsubClients();
      unsubBookings();
      unsubNotifs();
    };
  }, [role]);

  // Keep activeBarber synced with designers list and stored active barber ID
  useEffect(() => {
    if (role === 'barber') {
      const storedBarberId = localStorage.getItem('baba_active_barber_id');
      const storedPhone = (localStorage.getItem('baba_active_barber_phone') || '').replace(/[^0-9]/g, '');
      const storedName = (localStorage.getItem('baba_active_barber_name') || '').trim().toLowerCase();

      if (designers.length > 0) {
        let found: Designer | undefined;
        // Priority 1: Match activeBarber's exact ID if already loaded
        if (activeBarber?.id) {
          found = designers.find((d) => d.id === activeBarber.id || (d as any).firestoreDocId === activeBarber.id);
        }
        // Priority 2: Match storedBarberId
        if (!found && storedBarberId) {
          found = designers.find((d) => d.id === storedBarberId || (d as any).firestoreDocId === storedBarberId);
        }
        // Priority 3: Match stored phone
        if (!found && storedPhone) {
          found = designers.find((d) => {
            const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
            return dPhone && dPhone === storedPhone;
          });
        }
        // Priority 4: Match stored name
        if (!found && storedName) {
          found = designers.find((d) => d.name && d.name.trim().toLowerCase() === storedName);
        }

        if (found) {
          setActiveBarber(found);
          localStorage.setItem('baba_active_barber_id', found.id);
          localStorage.setItem('baba_active_barber_phone', found.phone || '');
          localStorage.setItem('baba_active_barber_name', found.name || '');
          localStorage.setItem('baba_active_barber_obj', JSON.stringify(found));
        }
      }
    }
  }, [role, designers]);

  const loadAllData = async () => {
    try {
      const storedBarberId = role === 'barber' ? (activeBarber?.id || localStorage.getItem('baba_active_barber_id') || undefined) : undefined;
      const bookingsPromise = role === 'barber' && storedBarberId
        ? api.getBookings({ designerId: storedBarberId })
        : api.getBookings();

      const [sList, dList, bList, nList, st, setts, cList] = await Promise.all([
        api.getServices(),
        api.getDesigners(),
        bookingsPromise,
        api.getNotifications(role),
        api.getStats(),
        api.getSettings(),
        api.getClients(),
      ]);
      setServices(sList);
      setDesigners(dList);
      setBookings(bList);
      setNotifications(nList);
      setStats(st);
      setShopSettings(setts);
      if (cList && cList.length > 0) {
        setClients(cList);
      }
    } catch (err) {
      console.error('Data load error:', err);
    }
  };

  const handleSelectLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('baba_lang', newLang);
  };

  const handleEnterAsUser = () => {
    setRole('user');
    setActiveBarber(null);
    setHasSelectedPortal(true);
    setActiveTab('explore');
  };

  const handleEnterAsAdmin = () => {
    setRole('admin');
    setActiveBarber(null);
    setHasSelectedPortal(true);
    setActiveTab('hub');
    setAdminSubTab('hub');
    loadAllData();
  };

  const handleEnterAsSuperAdmin = () => {
    setRole('superadmin');
    setActiveBarber(null);
    setHasSelectedPortal(true);
    setActiveTab('hub');
    setAdminSubTab('hub');
    loadAllData();
  };

  const handleEnterAsBarber = (barber: Designer) => {
    setRole('barber');
    setActiveBarber(barber);
    localStorage.setItem('baba_active_barber_id', barber.id);
    localStorage.setItem('baba_active_barber_phone', barber.phone || '');
    localStorage.setItem('baba_active_barber_name', barber.name || '');
    localStorage.setItem('baba_active_barber_obj', JSON.stringify(barber));
    setHasSelectedPortal(true);
    setActiveTab('timeline');
    loadAllData();
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (role === 'admin' || role === 'superadmin') {
      if (tabId === 'admin-dashboard' || tabId === 'hub') {
        setAdminSubTab('hub');
      } else if (tabId === 'walkins') {
        setAdminSubTab('walkins');
      } else if (tabId === 'services') {
        setAdminSubTab('services');
      } else if (tabId === 'bookings' || tabId === 'my-bookings') {
        setAdminSubTab('bookings');
      } else if (tabId === 'accounts') {
        setAdminSubTab('accounts');
      } else if (tabId === 'designers') {
        setAdminSubTab('designers');
      } else if (tabId === 'stats') {
        setAdminSubTab('stats');
      } else if (tabId === 'clients') {
        setAdminSubTab('clients');
      } else if (tabId === 'promos') {
        setAdminSubTab('promos');
      } else if (tabId === 'database') {
        setAdminSubTab('database');
      } else if (tabId === 'settings') {
        setAdminSubTab('settings');
      } else if (tabId === 'reports') {
        setAdminSubTab('reports');
      }
    }
  };

  const handleSwitchPortal = () => {
    if (role === 'admin' || role === 'superadmin') {
      localStorage.removeItem('baba_admin_session');
    }
    if (role === 'barber') {
      localStorage.removeItem('baba_barber_session');
      localStorage.removeItem('baba_active_barber_id');
      localStorage.removeItem('baba_active_barber_phone');
      localStorage.removeItem('baba_active_barber_name');
      localStorage.removeItem('baba_active_barber_obj');
      setActiveBarber(null);
    }
    setHasSelectedPortal(false);
  };

  const handleOpenBookingForService = (service: Service) => {
    setPreSelectedService(service);
    setPreSelectedDesigner(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingForDesigner = (designer: Designer) => {
    setPreSelectedDesigner(designer);
    setPreSelectedService(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenNewBooking = () => {
    setPreSelectedService(null);
    setPreSelectedDesigner(null);
    setIsBookingModalOpen(true);
  };

  const handleAdminEditService = (service: Service) => {
    setServiceToEdit(service);
    setActiveTab('services');
    setAdminSubTab('services');
  };

  const handleBookingSuccess = (_newBooking: Booking) => {
    loadAllData();
  };

  const handleMarkAllNotifsRead = async () => {
    await api.markNotificationsRead(role);
    loadAllData();
  };

  const t = translations[lang];

  const unreadNotifsCount = notifications.filter((n) => {
    if (n.read) return false;
    const clearedIds = getClearedNotificationIds();
    if (clearedIds.has(n.id)) return false;
    if (role === 'admin' || role === 'superadmin') {
      return true;
    }
    if (role === 'barber') {
      return isNotificationForBarber(n, activeBarber?.id, activeBarber?.phone, activeBarber?.name, clearedIds);
    }
    let clientPhone = '';
    try {
      const stored = localStorage.getItem('baba_user_profile_v1');
      if (stored) {
        clientPhone = JSON.parse(stored).phone || '';
      }
    } catch {}
    return isNotificationForClient(n, clientPhone, bookings, clearedIds);
  }).length;

  const pendingRequestsCount = bookings.filter((b) => b.status === 'pending').length;

  const userTabs = ['explore', 'designers', 'my-bookings', 'notifications', 'profile'];
  const adminTabs = ['admin-dashboard', 'explore', 'designers', 'my-bookings', 'notifications', 'profile'];
  const currentTabs = role === 'admin' ? adminTabs : userTabs;

  const handleSwipeNext = () => {
    const currentIndex = currentTabs.indexOf(activeTab);
    if (currentIndex !== -1 && currentIndex < currentTabs.length - 1) {
      setActiveTab(currentTabs[currentIndex + 1]);
    }
  };

  const handleSwipePrev = () => {
    const currentIndex = currentTabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(currentTabs[currentIndex - 1]);
    }
  };

  // Render Gate / Selection Screen before app starts if not selected yet
  if (!hasSelectedPortal) {
    return (
      <div className={lang === 'my' ? 'burmese-font' : ''}>
        <AppUpdateNotifier lang={lang} />
        <RoleSelectionScreen
          lang={lang}
          onSelectLang={handleSelectLang}
          onEnterUser={handleEnterAsUser}
          onEnterAdmin={handleEnterAsAdmin}
          onEnterSuperAdmin={handleEnterAsSuperAdmin}
          onEnterBarber={handleEnterAsBarber}
          designers={designers}
          shopSettings={shopSettings}
          shopName={shopSettings?.shopName || 'GENTLEMAN'}
          tagline={shopSettings?.tagline || 'Barber & Grooming Lounge'}
          logoUrl={shopSettings?.logoUrl}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#FAFAFA] text-[#18181B] font-sans pb-20 sm:pb-8 flex flex-col ${lang === 'my' ? 'burmese-font' : ''}`}>
      <AppUpdateNotifier lang={lang} />
      
      {/* Top Navigation Header (Only shown for customer and admin; hidden for barber who has dedicated bottom dock) */}
      {role !== 'barber' && (
        <Header
          role={role}
          lang={lang}
          shopName={shopSettings?.shopName || 'GENTLEMAN'}
          tagline={shopSettings?.tagline || 'Barber & Grooming Lounge'}
          logoUrl={shopSettings?.logoUrl}
          onSelectLang={handleSelectLang}
          unreadCount={unreadNotifsCount}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenBookingModal={handleOpenNewBooking}
          onShowPwaPrompt={() => alert(`${shopSettings?.shopName || 'GENTLEMAN'} PWA installer ready! In browser environment, tap "Share" -> "Add to Home Screen" to install as a native app.`)}
          onSwitchRoleScreen={handleSwitchPortal}
          onLogout={handleSwitchPortal}
          onRepair={() => setIsRepairModalOpen(true)}
        />
      )}

      {/* Main Container with safe area and header offset */}
      <main
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 flex-1 w-full space-y-6 ${
          role !== 'barber' ? 'main-content-top-offset' : 'pt-safe'
        }`}
      >
        
        {/* Navigation Tabs Bar for Desktop - Stylish Compact Dock (Only for User role) */}
        {role === 'user' && (
          <div className="hidden sm:flex items-center justify-between bg-[#FFFFFF] p-1.5 rounded-2xl border border-[#E4E4E7] shadow-sm gap-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('explore')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'explore'
                    ? 'bg-emerald-700 text-white shadow-sm font-bold border border-emerald-700'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F6]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5 transform -rotate-45" />
                <span>{t.serviceMenu}</span>
              </button>

              <button
                onClick={() => setActiveTab('designers')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'designers'
                    ? 'bg-emerald-700 text-white shadow-sm font-bold border border-emerald-700'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F6]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t.ourDesigners}</span>
              </button>

              <button
                onClick={() => setActiveTab('my-bookings')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'my-bookings'
                    ? 'bg-emerald-700 text-white shadow-sm font-bold border border-emerald-700'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F6]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.myAppointments}</span>
              </button>

              {/* Desktop Notifications Tab */}
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 relative ${
                  activeTab === 'notifications'
                    ? 'bg-emerald-700 text-white shadow-sm font-bold border border-emerald-700'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F6]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'သတိပေးချက်' : 'Alerts'}</span>
                {unreadNotifsCount > 0 && (
                  <span className="bg-emerald-500 text-white font-sans font-bold text-[10px] px-1.5 py-0.2 rounded-full shadow-xs">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {/* Desktop Profile Tab */}
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-emerald-700 text-white shadow-sm font-bold border border-emerald-700'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F6]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ပရိုဖိုင်' : 'Profile'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab views with clean fade transitions without touch wobble */}
        <ErrorBoundary lang={lang} onReset={loadAllData}>
          <motion.div
            key={role === 'barber' ? 'barber-portal' : role === 'admin' ? 'admin-dashboard' : activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >

        {/* ROLE 1: CUSTOMER VIEWS */}
        {role === 'user' && (
          <>
            {/* VIEW 1: EXPLORE / HOME FEED */}
            {activeTab === 'explore' && (
              <ClientHomeFeed
                services={services}
                designers={designers}
                bookings={bookings}
                lang={lang}
                role={role}
                onSelectService={handleOpenBookingForService}
                onSelectDesigner={handleOpenBookingForDesigner}
                onOpenNewBooking={handleOpenNewBooking}
                onOpenProfile={() => setActiveTab('profile')}
                onEditService={handleAdminEditService}
              />
            )}

            {/* VIEW 2: DESIGNERS */}
            {activeTab === 'designers' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-stone-950 uppercase tracking-wider font-mono">
                    {t.designersTitle}
                  </h2>
                  <p className="text-xs text-stone-500">{t.designersDesc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {designers
                    .filter((d) => d.active !== false)
                    .map((designer) => (
                      <DesignerCard
                        key={designer.id}
                        designer={designer}
                        bookings={bookings}
                        onSelectDesigner={handleOpenBookingForDesigner}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* VIEW 3: MY BOOKINGS (USER) */}
            {activeTab === 'my-bookings' && (
              <UserBookingHistory
                bookings={bookings}
                onRefresh={loadAllData}
                onOpenNewBooking={handleOpenNewBooking}
              />
            )}

            {/* VIEW 4: NOTIFICATIONS FEED */}
            {activeTab === 'notifications' && (
              <NotificationsFeed
                notifications={notifications}
                bookings={bookings}
                role={role}
                lang={lang}
                onMarkAllRead={handleMarkAllNotifsRead}
                onRefreshAll={loadAllData}
                onSwitchTab={setActiveTab}
              />
            )}

            {/* VIEW 5: USER PROFILE VIEW (MINIMALIST) */}
            {activeTab === 'profile' && (
              <UserProfileView
                lang={lang}
                role={role}
                designers={designers}
                services={services}
                unreadNotifsCount={unreadNotifsCount}
                onSelectLang={handleSelectLang}
                onOpenNotifications={() => setActiveTab('notifications')}
                onSwitchPortal={handleSwitchPortal}
                onViewBookings={() => setActiveTab('my-bookings')}
              />
            )}
          </>
        )}

        {/* ROLE 2: ADMIN & SUPERADMIN DASHBOARD */}
        {(role === 'admin' || role === 'superadmin') && (
          <>
            {activeTab === 'notifications' ? (
              <NotificationsFeed
                notifications={notifications}
                bookings={bookings}
                role={role}
                lang={lang}
                onMarkAllRead={handleMarkAllNotifsRead}
                onRefreshAll={loadAllData}
                onSwitchTab={handleTabChange}
              />
            ) : (
              <AdminControlHub
                services={services}
                designers={designers}
                bookings={bookings}
                clients={clients}
                stats={stats}
                pendingRequestsCount={pendingRequestsCount}
                unreadNotifsCount={unreadNotifsCount}
                lang={lang}
                activeSection={adminSubTab}
                onSelectSection={(sec) => {
                  setAdminSubTab(sec);
                  setActiveTab(sec);
                }}
                onRefresh={loadAllData}
                onOpenNotifications={() => setActiveTab('notifications')}
                onLogout={handleSwitchPortal}
                serviceToEdit={serviceToEdit}
                onClearServiceToEdit={() => setServiceToEdit(null)}
                role={role}
              />
            )}
          </>
        )}

        {/* ROLE 3: BARBER STAFF PORTAL */}
        {role === 'barber' && (
          <BarberStaffPortal
            designers={designers}
            bookings={bookings}
            notifications={notifications}
            onRefresh={loadAllData}
            currentBarberId={activeBarber?.id}
            isDirectBarberRole={true}
            onLogout={handleSwitchPortal}
            lang={lang}
            activeTab={
              ['timeline', 'bookings', 'notifications', 'profile'].includes(activeTab)
                ? (activeTab as any)
                : 'timeline'
            }
            onSelectTab={(tab) => setActiveTab(tab)}
          />
        )}

        </motion.div>
        </ErrorBoundary>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E4E7] bg-[#FFFFFF] py-6 text-center text-xs text-[#71717A] mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-black text-[#18181B] font-sans uppercase tracking-wider">{shopSettings?.shopName || 'GENTLEMAN'}</span>
            <span className="text-[#059669] font-semibold">— {shopSettings?.tagline || 'Barber & Grooming Lounge'}</span>
          </div>
          <p className="font-sans text-[#71717A]">© {new Date().getFullYear()} {shopSettings?.shopName || 'GENTLEMAN'}.</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        role={role}
        lang={lang}
        pendingBookingsCount={pendingRequestsCount}
        unreadNotifsCount={unreadNotifsCount}
        onOpenNotifications={() => setIsNotifOpen(true)}
        onOpenProfile={() => setIsUserProfileOpen(true)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        lang={lang}
        designers={designers}
        services={services}
        unreadNotifsCount={unreadNotifsCount}
        onSelectLang={handleSelectLang}
        onOpenNotifications={() => {
          setIsUserProfileOpen(false);
          setIsNotifOpen(true);
        }}
        onSwitchPortal={handleSwitchPortal}
      />

      {/* Booking Drawer / Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        lang={lang}
        initialService={preSelectedService}
        initialDesigner={preSelectedDesigner}
        availableServices={services}
        availableDesigners={designers}
        shopSettings={shopSettings}
        onBookingSuccess={handleBookingSuccess}
        onGoHome={() => {
          setIsBookingModalOpen(false);
          setActiveTab('explore');
        }}
        onViewMyBookings={() => {
          setIsBookingModalOpen(false);
          setActiveTab('my-bookings');
        }}
      />

      {/* Notifications Drawer */}
      <NotificationsModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        bookings={bookings}
        role={role}
        currentBarberId={activeBarber?.id}
        lang={lang}
        onMarkAllRead={handleMarkAllNotifsRead}
        onRefreshAll={loadAllData}
      />

      {/* Cloud Database Repair & Sync Modal */}
      <RepairDatabaseModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        lang={lang}
        onRepaired={loadAllData}
      />

    </div>
  );
}
