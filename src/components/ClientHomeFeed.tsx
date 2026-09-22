import React, { useState } from 'react';
import { Service, Designer, UserRole, Booking, PaymentSettings } from '../types';
import { Language, translations } from '../data/i18n';
import { formatPrice, calculateBarberRating, sortServicesForClient } from '../utils/formatters';
import { getClientBookings } from '../utils/notifications';
import {
  Scissors,
  Sparkles,
  Palette,
  Droplets,
  Clock,
  Zap,
  Edit2,
  Calendar,
  Check,
  ChevronRight,
  ArrowRight,
  UserCheck,
  Star,
  Phone,
  PhoneCall,
  MessageSquare,
  AlertTriangle,
  MapPin,
  X,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientHomeFeedProps {
  services: Service[];
  designers: Designer[];
  bookings?: Booking[];
  shopSettings?: PaymentSettings | null;
  lang: Language;
  role: UserRole;
  onSelectService: (service: Service) => void;
  onSelectDesigner: (designer: Designer) => void;
  onOpenNewBooking: () => void;
  onOpenProfile: () => void;
  onEditService?: (service: Service) => void;
  onNavigateToBookings?: () => void;
}

export const ClientHomeFeed: React.FC<ClientHomeFeedProps> = ({
  services,
  designers,
  bookings,
  shopSettings,
  lang,
  role,
  onSelectService,
  onSelectDesigner,
  onOpenNewBooking,
  onEditService,
  onNavigateToBookings,
}) => {
  const [activeTab, setActiveTab] = useState<'Hair Cut' | 'Shampoo' | 'Colour' | 'Perming' | 'Dreadlock' | 'all'>('all');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [isLatestBookingDismissed, setIsLatestBookingDismissed] = useState(false);

  const t = translations[lang];

  // Retrieve client profile details
  let clientPhone = '';
  let clientName = '';
  try {
    const profileRaw = localStorage.getItem('baba_user_profile_v1');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      clientPhone = p.phone || '';
      clientName = p.name || '';
    }
  } catch {}

  // Filter client's bookings
  const clientBookings = getClientBookings(bookings || [], clientPhone);

  // Find the latest active booking
  const latestBooking = clientBookings && clientBookings.length > 0
    ? [...clientBookings].sort((a, b) => {
        const aActive = a.status !== 'completed' && a.status !== 'cancelled';
        const bActive = b.status !== 'completed' && b.status !== 'cancelled';
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
      })[0]
    : null;

  // Find barber object for latest booking
  const bookedBarber = latestBooking
    ? designers.find((d) => d.id === latestBooking.designerId || d.name.toLowerCase() === latestBooking.designerName.toLowerCase())
    : null;

  const barberPhone = bookedBarber?.phone || shopSettings?.shopPhone || '09263188228';
  const barberAvatar = bookedBarber?.avatarUrl || latestBooking?.designerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';

  const handleActionClick = (id: string, callback: () => void) => {
    setLoadingActionId(id);
    setTimeout(() => {
      setLoadingActionId(null);
      callback();
    }, 180);
  };

  // Filter only active barbers for customer selection
  const activeDesigners = designers.filter((d) => d.active !== false);

  // 5 Main Categories
  const categoryBlocks = [
    { id: 'all' as const, label: 'All Services', labelMy: 'ဝန်ဆောင်မှု အားလုံး', icon: Sparkles },
    { id: 'Hair Cut' as const, label: 'Hair Cut', labelMy: 'ဆံပင်ညှပ်', icon: Scissors },
    { id: 'Shampoo' as const, label: 'Shampoo', labelMy: 'ခေါင်းလျှော်', icon: Droplets },
    { id: 'Colour' as const, label: 'Colour', labelMy: 'ဆံပင်ဆိုး', icon: Palette },
    { id: 'Perming' as const, label: 'Perming', labelMy: 'ကောက် / ဖြောင့်', icon: Zap },
    { id: 'Dreadlock' as const, label: 'Dreadlock', labelMy: 'ဒရက်လော့', icon: Sparkles },
  ];

  // Filtered Services based on Category Block (Strictly sorted by custom admin order or default Hair Cut first)
  const filteredServices = sortServicesForClient(
    services.filter((s) => {
      if (!s.active) return false;
      if (activeTab !== 'all' && s.category !== activeTab) return false;
      return true;
    })
  );

  // Any Professional object
  const anyProfessional: Designer = {
    id: 'any',
    name: lang === 'my' ? 'ရနိုင်သည့် မည်သည့် ပညာရှင်မဆို' : 'Any Stylist (Fastest Slot)',
    title: lang === 'my' ? 'အချိန်အမြန်ဆုံး အလိုအလျောက် ရွေးချယ်မှု' : 'Auto-assign next available',
    experienceYears: 10,
    specialties: ['All Services'],
    avatarUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=400',
    bio: 'Fastest confirmation with any certified master barber.',
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    workingHours: { start: '09:00 AM', end: '08:00 PM' },
    featured: true,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8 font-sans">
      
      {/* 1. LATEST / ACTIVE BOOKING CARD WITH BARBER PHONE & CLICK-TO-CALL */}
      {latestBooking && !isLatestBookingDismissed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#FFFFFF] text-[#18181B] rounded-3xl p-5 sm:p-6 border border-[#E4E4E7] shadow-sm relative overflow-hidden space-y-4"
        >
          {/* Subtle green glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar: Title & Status */}
          <div className="flex items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-sans font-black uppercase tracking-wider text-[#18181B]">
                {lang === 'my' ? '💈 သင်၏ နောက်ဆုံး ဘိုကင် (Active Booking)' : '💈 Your Latest Booking'}
              </span>
              <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-[#F4F4F6] text-[#18181B] border border-[#E4E4E7] font-bold">
                #{latestBooking.bookingCode}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Status Badge */}
              <span className={`text-[10px] font-sans font-black px-2.5 py-1 rounded-full border ${
                latestBooking.status === 'confirmed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : latestBooking.status === 'in-progress'
                  ? 'bg-emerald-50 text-emerald-900 border-[#10B981]'
                  : latestBooking.status === 'completed'
                  ? 'bg-stone-100 text-stone-800 border-stone-300'
                  : latestBooking.status === 'cancelled'
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : 'bg-emerald-50 text-emerald-900 border-[#10B981]/60'
              }`}>
                {latestBooking.status === 'confirmed' ? (lang === 'my' ? '🟢 အတည်ပြုပြီး' : 'Confirmed') :
                 latestBooking.status === 'in-progress' ? (lang === 'my' ? '💈 ညှပ်နေဆဲ' : 'In Progress') :
                 latestBooking.status === 'completed' ? (lang === 'my' ? '✅ ပြီးစီး' : 'Completed') :
                 latestBooking.status === 'cancelled' ? (lang === 'my' ? '🔴 ပယ်ဖျက်ပြီး' : 'Cancelled') :
                 (lang === 'my' ? '🟢 အတည်ပြုရန် စောင့်ဆိုင်းဆဲ' : 'Pending Approval')}
              </span>

              <button
                onClick={() => setIsLatestBookingDismissed(true)}
                className="w-6 h-6 rounded-full bg-[#F4F4F6] hover:bg-[#E4E4E7] text-[#71717A] hover:text-[#18181B] flex items-center justify-center transition-all cursor-pointer"
                title="Hide Banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Barber Info & Appointment Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Barber Profile & Phone */}
            <div className="flex items-center space-x-3.5">
              <img
                src={barberAvatar}
                alt={latestBooking.designerName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-[#E4E4E7] shrink-0 shadow-xs"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm sm:text-base text-[#18181B]">
                    {latestBooking.designerName}
                  </h3>
                  {bookedBarber?.title && (
                    <span className="text-[10px] font-sans font-bold text-[#18181B] bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-[#10B981]/50">
                      {bookedBarber.title}
                    </span>
                  )}
                </div>

                {/* Barber Phone Number */}
                <div className="flex items-center space-x-1.5 text-xs text-[#18181B] font-sans">
                  <Phone className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                  <span className="font-black text-[#18181B] tracking-wider">
                    {barberPhone}
                  </span>
                  {bookedBarber?.experienceYears && (
                    <span className="text-[10px] text-[#71717A] font-medium">
                      • {bookedBarber.experienceYears} yrs exp
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#71717A] font-sans pt-0.5">
                  <span className="flex items-center space-x-1 text-[#18181B]">
                    <Calendar className="w-3 h-3 text-[#059669]" />
                    <span className="text-[#18181B] font-bold">{latestBooking.date} ({latestBooking.timeSlot})</span>
                  </span>
                  <span className="text-[#D4D4D8]">•</span>
                  <span className="text-[#18181B] font-bold">{latestBooking.serviceName}</span>
                  <span className="text-[#71717A]">({formatPrice(latestBooking.servicePrice)})</span>
                </div>
              </div>
            </div>

            {/* Direct Action Buttons: CLICK-TO-CALL + Viber + View Bookings */}
            <div className="flex items-center space-x-2 shrink-0 pt-1 md:pt-0">
              <a
                href={`tel:${barberPhone.replace(/[^0-9+]/g, '')}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white font-sans font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer select-none"
              >
                <PhoneCall className="w-4 h-4 text-white animate-bounce" />
                <span>{lang === 'my' ? 'ဖုန်းခေါ်မည် (Call Barber)' : 'Call Barber'}</span>
              </a>

              {shopSettings?.viberLink && (
                <a
                  href={shopSettings.viberLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center space-x-1.5 bg-[#18181B] hover:bg-[#27272A] active:scale-95 text-white font-sans font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all border border-[#18181B] shadow-xs cursor-pointer select-none"
                  title="Viber Message"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Viber</span>
                </a>
              )}

              {onNavigateToBookings && (
                <button
                  onClick={onNavigateToBookings}
                  className="inline-flex items-center justify-center space-x-1 bg-[#F4F4F6] hover:bg-[#E4E4E7] text-[#18181B] font-sans font-bold text-xs px-3 py-2.5 rounded-xl transition-all border border-[#E4E4E7] cursor-pointer"
                >
                  <span>{lang === 'my' ? 'အသေးစိတ်' : 'Details'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          {/* Admin reply note if available */}
          {latestBooking.adminReply && (
            <div className="bg-[#F4F4F6] border border-[#E4E4E7] rounded-xl p-2.5 text-xs text-[#18181B] font-sans flex items-start space-x-2">
              <span className="text-[#059669] font-bold shrink-0">💬 Shop Note:</span>
              <span>{latestBooking.adminReply}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* 2. TOP APPOINTMENT BOOKING SECTION */}
      <div className="bg-[#FFFFFF] text-[#18181B] rounded-3xl p-5 sm:p-6 border border-[#E4E4E7] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-lg">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-sans font-bold tracking-wider uppercase">
            <Calendar className="w-3 h-3 text-emerald-700" />
            <span>{lang === 'my' ? 'ရက်ချိန်း ရယူရန်' : 'Appointment Booking'}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#18181B] font-sans">
            {lang === 'my' ? 'ရက်ချိန်း ဘိုကင်တင်ပါ' : 'Book an Appointment'}
          </h2>
        </div>

        <button
          onClick={() => handleActionClick('quick-book-hero', onOpenNewBooking)}
          disabled={loadingActionId === 'quick-book-hero'}
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-3 rounded-2xl font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 shrink-0 active:scale-95 shadow-sm"
        >
          {loadingActionId === 'quick-book-hero' ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Calendar className="w-4 h-4 text-white" />
              <span>{lang === 'my' ? 'ဘိုကင်တင်မည်' : 'Book Now'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </>
          )}
        </button>
      </div>

      {/* 3. DESIGNERS LIST (PROMINENT BARBER CARDS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#71717A]">
            {lang === 'my' ? 'ကျွမ်းကျင် ပညာရှင်များ' : 'SELECT BARBER / STYLIST'}
          </h3>
          <span className="text-[11px] font-sans font-medium text-[#71717A]">
            {activeDesigners.length} {lang === 'my' ? 'ဦး ရရှိနိုင်' : 'Stylists Available'}
          </span>
        </div>

        {/* Prominent Barber Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {activeDesigners.map((designer) => {
            const { ratingDisplay, reviewsCount } = calculateBarberRating(designer, bookings);
            return (
              <div
                key={designer.id}
                onClick={() => handleActionClick(`designer-${designer.id}`, () => onSelectDesigner(designer))}
                className="bg-white border border-emerald-100 hover:border-emerald-500 rounded-3xl p-4 cursor-pointer flex flex-col items-center text-center transition-all duration-200 active:scale-98 hover:shadow-md shadow-xs select-none group"
              >
                <div className="relative mb-3">
                  <img
                    src={designer.avatarUrl}
                    alt={designer.name}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-emerald-100 group-hover:border-emerald-500 transition-colors shadow-xs"
                  />
                  {designer.featured && (
                    <span className="absolute -top-1.5 -right-1.5 bg-emerald-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      ★ Top
                    </span>
                  )}
                </div>

                <div className="w-full min-w-0 space-y-1">
                  <h4 className="font-bold text-sm text-stone-900 truncate group-hover:text-emerald-700 transition-colors">
                    {designer.name}
                  </h4>

                  {/* Phone Number Display */}
                  {designer.phone && (
                    <div className="flex items-center justify-center space-x-1 text-xs text-emerald-800 font-mono font-bold pt-0.5">
                      <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{designer.phone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center space-x-1 pt-1">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                      <span>{ratingDisplay}</span>
                      {reviewsCount > 0 && <span className="text-stone-400 text-[10px]">({reviewsCount})</span>}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="w-full mt-3 py-2 px-3 rounded-xl bg-emerald-50 group-hover:bg-emerald-700 text-emerald-800 group-hover:text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>{lang === 'my' ? 'ရွေးချယ်မည်' : 'Select'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Less Noticeable Discreet Any Stylist Button */}
        <div
          onClick={() => handleActionClick('designer-any', () => onSelectDesigner(anyProfessional))}
          className="bg-stone-50 hover:bg-stone-100 border border-dashed border-stone-300 hover:border-emerald-500 rounded-2xl px-4 py-2.5 cursor-pointer flex items-center justify-between transition-all select-none text-stone-600 hover:text-stone-900 active:scale-99"
        >
          <div className="flex items-center space-x-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-emerald-700" />
            <span className="font-medium">{lang === 'my' ? 'မည်သူမဆို (အမြန်ဆုံး အချိန်ရနိုင်သူဖြင့် ဘိုကင်တင်ရန်)' : 'Any available stylist (Fastest open slot)'}</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            {lang === 'my' ? 'အမြန်ရွေးရန်' : 'Auto-match'}
          </span>
        </div>
      </div>

      {/* 4. CATEGORY HEADER BLOCKS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#71717A]">
            {lang === 'my' ? 'ဝန်ဆောင်မှု အမျိုးအစားများ' : 'SERVICE CATEGORIES'}
          </h3>
          <span className="text-[11px] font-sans font-medium text-[#71717A]">
            {filteredServices.length} {lang === 'my' ? 'ခု' : 'items'}
          </span>
        </div>

        {/* Category Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {categoryBlocks.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`py-3 px-3 rounded-2xl text-xs font-sans font-bold transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5 border select-none ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm font-bold'
                    : 'bg-[#FFFFFF] text-[#18181B] border-[#E4E4E7] hover:border-emerald-400 hover:bg-[#F4F4F6]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#71717A]'}`} />
                <span className="truncate">{lang === 'my' ? cat.labelMy : cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. SUB SERVICES */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs text-[#71717A] font-sans font-bold">
          <span className="uppercase">
            {activeTab === 'all' ? (lang === 'my' ? 'ဝန်ဆောင်မှု အားလုံး' : 'ALL SERVICES') : activeTab}
          </span>
        </div>

        {filteredServices.length === 0 ? (
          <div className="p-8 text-center bg-[#FFFFFF] border border-[#E4E4E7] rounded-2xl shadow-xs">
            <p className="text-xs text-[#71717A] font-medium">No services found in this category.</p>
            <button
              onClick={() => setActiveTab('all')}
              className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Show All
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-[#FFFFFF] border border-[#E4E4E7] hover:border-emerald-400 rounded-2xl p-3.5 transition-all flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md"
              >
                <div className="flex space-x-3">
                  <img
                    src={service.imageUrl}
                    alt={service.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border border-[#E4E4E7] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm text-[#18181B] truncate leading-snug">
                      {service.name}
                    </h3>
                    <p className="text-[11px] text-[#71717A] line-clamp-1 mt-0.5">
                      {service.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1.5 text-xs font-sans font-bold text-[#18181B]">
                      <span className="text-sm font-black text-[#18181B]">{formatPrice(service.price)}</span>
                      <span className="text-[#D4D4D8]">•</span>
                      <span className="text-[#71717A] flex items-center space-x-1 font-normal text-[11px]">
                        <Clock className="w-3 h-3 text-emerald-700" />
                        <span>{service.durationMinutes}m</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 pt-1">
                  <button
                    onClick={() => handleActionClick(`book-srv-${service.id}`, () => onSelectService(service))}
                    disabled={loadingActionId === `book-srv-${service.id}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-sans font-bold text-xs transition-all cursor-pointer text-center active:scale-98 flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    {loadingActionId === `book-srv-${service.id}` ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Scissors className="w-3.5 h-3.5 transform -rotate-45 text-white" />
                        <span>{lang === 'my' ? 'ဘိုကင်တင်မည်' : 'Book'}</span>
                      </>
                    )}
                  </button>

                  {role === 'admin' && onEditService && (
                    <button
                      onClick={() => onEditService(service)}
                      className="p-2.5 rounded-xl bg-[#F4F4F6] hover:bg-[#E4E4E7] text-[#18181B] text-xs border border-[#E4E4E7] cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-emerald-700" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};


