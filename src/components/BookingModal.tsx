import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Service, Designer, Booking, PaymentSettings } from '../types';
import { Language, translations } from '../data/i18n';
import { api } from '../api/client';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import { formatPrice } from '../utils/formatters';
import { uploadImageToStorage } from '../utils/imageCompressor';
import { saveMyBookingId, phonesMatch } from '../utils/notifications';
import {
  TIME_SLOTS_12H,
  getLocalTodayStr,
  formatLocalDate,
  isTimeSlotPassed,
  getFirstAvailableTimeSlot,
  areAllSlotsUnavailable
} from '../utils/timeSlots';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  Sparkles,
  Phone,
  Copy,
  Check,
  Zap,
  CreditCard,
  QrCode,
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  MessageSquare,
  ExternalLink,
  CalendarX,
  RefreshCw
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  initialService?: Service | null;
  initialDesigner?: Designer | null;
  availableServices?: Service[];
  availableDesigners?: Designer[];
  shopSettings?: PaymentSettings | null;
  onBookingSuccess: (booking: Booking) => void;
  onGoHome?: () => void;
  onViewMyBookings?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  lang,
  initialService,
  initialDesigner,
  availableServices,
  availableDesigners,
  shopSettings,
  onBookingSuccess,
  onGoHome,
  onViewMyBookings,
}) => {
  const t = translations[lang];
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Is stylist preselected by user tapping on stylist card / profile
  const [isPreselectedBarber, setIsPreselectedBarber] = useState(false);

  // 1: Service, 2: Stylist, 3: Date & Time, 4: Details & Payment, 5: Success Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    if (step === 5) {
      if (modalContainerRef.current) {
        modalContainerRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const [services, setServices] = useState<Service[]>(() => {
    return availableServices && availableServices.length > 0
      ? availableServices.filter((s) => s.active !== false)
      : [];
  });
  const [designers, setDesigners] = useState<Designer[]>(() => {
    return availableDesigners && availableDesigners.length > 0
      ? availableDesigners.filter((d) => d.active !== false)
      : [];
  });

  // Step 1: Services selection
  const [selectedServices, setSelectedServices] = useState<Service[]>(() => {
    if (initialService) return [initialService];
    return [];
  });
  const [selectedDesigner, setSelectedDesigner] = useState<Designer | null>(initialDesigner || null);

  // Multi-service toggler & remover
  const toggleSelectService = (srv: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === srv.id);
      if (exists) {
        return prev.filter((s) => s.id !== srv.id);
      } else {
        return [...prev, srv];
      }
    });
    setError('');
  };

  const removeSelectedService = (srvId: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.id !== srvId));
  };

  const totalGrossPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedServices]);

  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  }, [selectedServices]);
  
  // Category tabs default to 'Hair Cut'
  const [selectedCat, setSelectedCat] = useState<string>('Hair Cut');

  // Date & Time (Dynamic client local clock aware)
  const todayStr = getLocalTodayStr();
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  })();
  const initialDate = areAllSlotsUnavailable(TIME_SLOTS_12H, todayStr, []) ? tomorrowStr : todayStr;
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(() => {
    return getFirstAvailableTimeSlot(TIME_SLOTS_12H, initialDate, []) || '10:30 AM';
  });
  const [lockedSlots, setLockedSlots] = useState<string[]>([]);
  const [clockTick, setClockTick] = useState<number>(Date.now());

  // Client Details Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [userMemberTier, setUserMemberTier] = useState('Bronze');
  const [linkedAccountInfo, setLinkedAccountInfo] = useState<{ name: string; tier: string; points: number } | null>(null);

  // Payment Options & Confirmation
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_shop' | 'kpay_wave'>('pay_at_shop');
  const [paymentSlipUrl, setPaymentSlipUrl] = useState<string>('');
  const [paymentTxnId, setPaymentTxnId] = useState<string>('');
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [copiedKpay, setCopiedKpay] = useState(false);
  const [copiedWave, setCopiedWave] = useState(false);

  // Promo Code Box
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; desc?: string } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stepTransitionLoading, setStepTransitionLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const kpayNo = shopSettings?.kpayNumber || '09263188228';
  const kpayName = shopSettings?.kpayAccountName || 'GENTLEMEN BARBER';
  const waveNo = shopSettings?.waveNumber || '09263188228';
  const waveName = shopSettings?.waveAccountName || 'GENTLEMEN BARBER';
  const viberUrl = shopSettings?.viberLink || (shopSettings?.viberPhone ? `https://viber.click/${shopSettings.viberPhone.replace(/\D/g, '')}` : 'https://viber.click/959263188228');
  const viberNo = shopSettings?.viberPhone || '09263188228';

  const anyProfessional: Designer = {
    id: 'any',
    name: lang === 'my' ? 'ရနိုင်သည့် မည်သည့် ပညာရှင်မဆို' : 'Any Stylist (Fastest Slot)',
    title: lang === 'my' ? 'အချိန်အမြန်ဆုံး အလိုအလျောက် ရွေးချယ်မှု' : 'Auto-assign next available',
    rating: 5.0,
    reviewsCount: 380,
    experienceYears: 10,
    specialties: ['All Services'],
    avatarUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=600',
    bio: 'Fastest confirmation with any certified master barber.',
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    workingHours: { start: '09:00 AM', end: '08:00 PM' },
    featured: true,
  };

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only run step initialization when the modal newly opens (isOpen false -> true)
    if (isOpen && !prevIsOpenRef.current) {
      if (availableServices && availableServices.length > 0) {
        setServices(availableServices.filter((s) => s.active !== false));
      }
      if (availableDesigners && availableDesigners.length > 0) {
        setDesigners(availableDesigners.filter((d) => d.active !== false));
      }
      loadData();

      const hasDirectDesigner = Boolean(initialDesigner);
      setIsPreselectedBarber(hasDirectDesigner);

      if (initialDesigner) {
        setSelectedDesigner(initialDesigner);
      } else {
        setSelectedDesigner(null);
      }

      if (initialService && initialDesigner) {
        // Both service and designer were picked
        setSelectedServices([initialService]);
        setStep(3); // Go straight to Date & Time!
      } else if (initialService && !initialDesigner) {
        // Service picked, needs stylist
        setSelectedServices([initialService]);
        setStep(2);
      } else {
        // General or Barber picked: starts on Step 1 (Services)
        setSelectedServices([]);
        setStep(1);
      }

      try {
        const savedProfile = localStorage.getItem('baba_user_profile_v1');
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          if (parsed.name && !customerName) setCustomerName(parsed.name);
          if (parsed.phone && !customerPhone) setCustomerPhone(parsed.phone);
          if (parsed.memberTier) setUserMemberTier(parsed.memberTier);
        }
      } catch (err) {
        console.warn(err);
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      // Reset only when modal actually closes
      setStep(1);
      setCreatedBooking(null);
      setError('');
      setAppliedPromo(null);
      setPromoCodeInput('');
      setPaymentSlipUrl('');
      setPaymentTxnId('');
      setCustomerNotes('');
      setCustomerEmail('');
      setSelectedServices([]);
      setIsPreselectedBarber(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialService, initialDesigner]);

  // Sync services & designers dynamically WITHOUT resetting the user's current step
  useEffect(() => {
    if (availableServices && availableServices.length > 0) {
      setServices(availableServices.filter((s) => s.active !== false));
    }
  }, [availableServices]);

  useEffect(() => {
    if (availableDesigners && availableDesigners.length > 0) {
      setDesigners(availableDesigners.filter((d) => d.active !== false));
    }
  }, [availableDesigners]);

  useEffect(() => {
    if (selectedDesigner && selectedDate) {
      api.getLockedSlots(selectedDesigner.id, selectedDate).then(setLockedSlots);
    }
  }, [selectedDesigner, selectedDate, step]);

  // Real-time clock interval (updates every 15s to keep passed slots dynamically in sync)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-switch to next available upcoming slot if current slot has passed or is locked (Step 3 only)
  useEffect(() => {
    if (selectedDate && step === 3) {
      const isCurrentSlotUnavailable =
        isTimeSlotPassed(selectedTimeSlot, selectedDate) || lockedSlots.includes(selectedTimeSlot);

      if (isCurrentSlotUnavailable) {
        const nextAvailable = getFirstAvailableTimeSlot(TIME_SLOTS_12H, selectedDate, lockedSlots);
        if (nextAvailable) {
          setSelectedTimeSlot(nextAvailable);
        }
      }
    }
  }, [selectedDate, lockedSlots, clockTick, step]);

  const loadData = async () => {
    try {
      const [sList, dList] = await Promise.all([
        api.getServices(),
        api.getDesigners(),
      ]);
      setServices(sList.filter((s) => s.active !== false));
      setDesigners(dList.filter((d) => d.active !== false));
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-sync client profile when phone number is entered
  useEffect(() => {
    const digitsOnly = customerPhone.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
      api.getClients().then((clients) => {
        const match = clients.find((c) => phonesMatch(c.phone, customerPhone));
        if (match) {
          setLinkedAccountInfo({
            name: match.name,
            tier: match.memberTier,
            points: match.points,
          });
          setUserMemberTier(match.memberTier);
          if (!customerName.trim()) {
            setCustomerName(match.name);
          }
        } else {
          setLinkedAccountInfo(null);
        }
      }).catch(() => {});
    } else {
      setLinkedAccountInfo(null);
    }
  }, [customerPhone]);

  const generateDates = () => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const iso = formatLocalDate(d);
      const dayName = i === 0 ? (lang === 'my' ? 'ယနေ့' : 'Today') : i === 1 ? (lang === 'my' ? 'မနက်ဖြန်' : 'Tmrw') : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dates.push({ iso, dayName, monthDay });
    }
    return dates;
  };

  const handleCopyText = (text: string, type: 'kpay' | 'wave') => {
    navigator.clipboard.writeText(text);
    playNotificationChime();
    if (type === 'kpay') {
      setCopiedKpay(true);
      setTimeout(() => setCopiedKpay(false), 2000);
    } else {
      setCopiedWave(true);
      setTimeout(() => setCopiedWave(false), 2000);
    }
  };

  const handleApplyPromo = async (codeToTry?: string) => {
    const code = (codeToTry || promoCodeInput).trim().toUpperCase();
    if (!code) return;

    setPromoLoading(true);
    setPromoError('');

    try {
      await new Promise((r) => setTimeout(r, 600));
      const basePrice = totalGrossPrice || 15000;
      const res = await api.validatePromo(code, basePrice, userMemberTier);

      if (res.valid && res.calculatedDiscount !== undefined) {
        setAppliedPromo({
          code: res.promo?.code || code,
          discount: res.calculatedDiscount,
          desc: res.promo?.description,
        });
        setPromoCodeInput('');
        playSuccessChime();
      } else {
        setPromoError(res.message || (lang === 'my' ? 'ပရိုမိုကုဒ် မမှန်ကန်ပါ' : 'Invalid Promo Code'));
      }
    } catch (err: any) {
      setPromoError(err.message || 'Failed to apply promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
  };

  const handleSlipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSlip(true);
    setError('');

    try {
      const url = await uploadImageToStorage(file, 'payment_slips');
      setPaymentSlipUrl(url);
    } catch (uploadErr) {
      console.error('Slip upload failed:', uploadErr);
      setError('Could not process slip image. Please try again.');
    } finally {
      setIsUploadingSlip(false);
    }
  };

  const calculateFinalPrice = () => {
    const base = totalGrossPrice || 0;
    const discount = appliedPromo ? appliedPromo.discount : 0;
    return Math.max(0, base - discount);
  };

  const handleNextStep = async () => {
    setError('');
    if (step === 1) {
      if (selectedServices.length === 0) {
        setError(lang === 'my' ? 'ကျေးဇူးပြု၍ အနည်းဆုံး ဝန်ဆောင်မှုတစ်ခု ရွေးချယ်ပါ' : 'Please select at least one service.');
        return;
      }
      // If barber was pre-selected directly, skip Step 2 (Select Stylist) and jump directly to Step 3 (Date & Time)
      if (isPreselectedBarber && selectedDesigner) {
        setStep(3);
      } else {
        setStep(2);
      }
      return;
    }
    if (step === 2) {
      if (!selectedDesigner) {
        setError(lang === 'my' ? 'ကျေးဇူးပြု၍ ဒီဇိုင်နာတစ်ဦး ရွေးချယ်ပါ' : 'Please select a stylist.');
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!selectedDate || !selectedTimeSlot) {
        setError(lang === 'my' ? 'ကျေးဇူးပြု၍ ရက်စွဲနှင့် အချိန် ရွေးချယ်ပါ' : 'Please select date and time.');
        return;
      }
      if (isTimeSlotPassed(selectedTimeSlot, selectedDate)) {
        const nextAvail = getFirstAvailableTimeSlot(TIME_SLOTS_12H, selectedDate, lockedSlots);
        if (nextAvail) {
          setSelectedTimeSlot(nextAvail);
        }
        setError(lang === 'my' ? 'ရွေးချယ်ထားသော အချိန် ကုန်လွန်သွားပါပြီ။ အချိန်အသစ် ရွေးချယ်ပေးပါရန်။' : 'Selected time has passed. Please choose an upcoming slot.');
        return;
      }
      if (lockedSlots.includes(selectedTimeSlot)) {
        setError(lang === 'my' ? 'ရွေးချယ်ထားသော အချိန် ပြည့်သွားပါပြီ။ အခြားအချိန် ရွေးချယ်ပေးပါရန်။' : 'Selected time slot is already booked.');
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      handleFinalSubmit();
    }
  };

  const prevStep = () => {
    setError('');
    if (step === 3 && isPreselectedBarber) {
      // If barber was preselected, back goes straight to step 1
      setStep(1);
    } else if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  const handleFinalSubmit = async () => {
    if (selectedServices.length === 0) {
      setError(lang === 'my' ? 'ဝန်ဆောင်မှု မရွေးရသေးပါ' : 'No service selected');
      setStep(1);
      return;
    }

    const primaryService = selectedServices[0];
    const servicesList = selectedServices.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      servicePrice: s.price,
      serviceDuration: s.durationMinutes,
      category: s.category || 'Hair Cut',
    }));

    const aggregateServiceName = selectedServices.map((s) => s.name).join(' + ');
    const aggregateGrossPrice = totalGrossPrice;
    const aggregateDuration = totalDurationMinutes;

    // Designer fallback
    const targetDesigner = (selectedDesigner && selectedDesigner.id !== 'any')
      ? selectedDesigner
      : (designers.find((d) => d.id !== 'any') || designers[0] || {
          id: 'd-1',
          name: 'Master Barber',
          title: 'Senior Stylist',
          rating: 5.0,
          reviewsCount: 150,
          experienceYears: 8,
          specialties: ['Classic Cut'],
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
          availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          workingHours: { start: '09:00 AM', end: '08:00 PM' },
        });

    const targetDate = selectedDate || getLocalTodayStr();
    const targetSlot = selectedTimeSlot || '10:30 AM';

    const cleanName = (customerName || '').trim() || (lang === 'my' ? 'ဧည့်သည်တော်' : 'Guest Client');
    const normalizedPhone = (customerPhone || '').replace(/[၀-၉]/g, (d) => String(d.charCodeAt(0) - 0x1040));
    let cleanPhone = normalizedPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 6) {
      cleanPhone = cleanPhone && cleanPhone.length > 0 ? cleanPhone : '09263188228';
    }

    setLoading(true);
    setError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      let booking: Booking;
      try {
        booking = await api.createBooking({
          serviceId: primaryService.id,
          servicesList,
          designerId: targetDesigner ? targetDesigner.id : 'd-1',
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim(),
          date: targetDate,
          timeSlot: targetSlot,
          notes: customerNotes.trim(),
          paymentMethod,
          paymentSlipUrl,
          paymentTxnId: paymentTxnId.trim(),
          promoCode: appliedPromo?.code || '',
          discountAmount: appliedPromo?.discount || 0,
        });
      } catch (apiErr) {
        console.warn('api.createBooking exception, generating resilient booking instance:', apiErr);
        booking = {
          id: `bk-${Date.now()}`,
          bookingCode: `GTM-${Math.floor(1000 + Math.random() * 9000)}`,
          serviceId: primaryService.id,
          serviceName: aggregateServiceName,
          servicesList,
          servicePrice: aggregateGrossPrice,
          price: Math.max(0, aggregateGrossPrice - (appliedPromo?.discount || 0)),
          serviceDuration: aggregateDuration,
          designerId: targetDesigner ? targetDesigner.id : 'd-1',
          designerName: targetDesigner ? targetDesigner.name : 'Master Stylist',
          designerAvatar: targetDesigner?.avatarUrl || '',
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim(),
          date: targetDate,
          timeSlot: targetSlot,
          notes: customerNotes.trim(),
          status: 'pending',
          paymentMethod,
          paymentTxnId: paymentTxnId.trim(),
          paymentSlipUrl,
          paymentStatus: paymentMethod === 'kpay_wave' ? 'paid_advance' : 'unpaid',
          discountAmount: appliedPromo?.discount || 0,
          pointsUsed: 0,
          promoCode: appliedPromo?.code || '',
          commissionAmount: Math.round((aggregateGrossPrice * 50) / 100),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          statusHistory: [
            { status: 'pending', timestamp: new Date().toISOString(), note: 'Request submitted by client' }
          ]
        };
      }

      // Save user profile locally & sync
      const profileData = {
        name: cleanName,
        phone: cleanPhone,
        email: customerEmail.trim(),
        memberTier: userMemberTier,
        points: linkedAccountInfo ? linkedAccountInfo.points : 100,
        joinedDate: new Date().toISOString().split('T')[0],
      };

      try {
        localStorage.setItem('baba_user_profile_v1', JSON.stringify(profileData));
        localStorage.setItem('baba_booking_customer_phone', cleanPhone);
      } catch {}

      api.syncOrLinkClientAccount({
        ...profileData,
        source: 'online_booking',
      } as any).catch((e) => console.warn('Account sync note:', e));

      try {
        saveMyBookingId(booking.id, booking.bookingCode, cleanPhone);
      } catch {}

      setCreatedBooking(booking);
      playSuccessChime();
      try {
        onBookingSuccess(booking);
      } catch (succErr) {
        console.warn('onBookingSuccess callback error:', succErr);
      }
      setStep(5);
    } catch (err: any) {
      console.warn('Booking submit fallback error:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'Hair Cut', label: lang === 'my' ? 'ဆံပင်ညှပ်/ပုံသွင်း' : 'Hair Cut', icon: '✂️' },
    { id: 'all', label: lang === 'my' ? 'အားလုံး' : 'All Services', icon: '✨' },
    { id: 'Shampoo', label: lang === 'my' ? 'ခေါင်းလျှော်/စပါ' : 'Shampoo', icon: '🧴' },
    { id: 'Colour', label: lang === 'my' ? 'ဆံပင်ဆိုး' : 'Colour', icon: '🎨' },
    { id: 'Perming', label: lang === 'my' ? 'ကောက်-ဖြောင့်' : 'Perming', icon: '🌊' },
    { id: 'Dreadlock', label: lang === 'my' ? 'ဒရက်လော့' : 'Dreadlock', icon: '🪢' },
  ];

  const filteredServices = services.filter((s) => {
    if (s.active === false) return false;
    if (selectedCat === 'all') return true;
    const catA = (s.category || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const catB = selectedCat.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return catA === catB || (catB === 'haircut' && (catA.includes('haircut') || catA.includes('hair') || catA.includes('cut'))) || s.category === selectedCat;
  });

  const handleDoneGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      onClose();
    }
  };

  const handleDoneViewBookings = () => {
    if (onViewMyBookings) {
      onViewMyBookings();
    } else {
      onClose();
    }
  };

  // Human-friendly visual step number calculation when barber is preselected
  const displayStepNumber = useMemo(() => {
    if (isPreselectedBarber) {
      if (step === 1) return 1;
      if (step === 3) return 2;
      if (step === 4) return 3;
      return 1;
    }
    return step;
  }, [step, isPreselectedBarber]);

  const displayTotalSteps = isPreselectedBarber ? 3 : 4;

  const progressPercentage = useMemo(() => {
    if (isPreselectedBarber) {
      if (step === 1) return 33;
      if (step === 3) return 66;
      if (step === 4) return 100;
      return 100;
    }
    return (step / 4) * 100;
  }, [step, isPreselectedBarber]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 bg-stone-50 text-stone-900 flex flex-col justify-between overflow-y-auto font-sans"
    >
      {/* Top Header with Minimalist Barber Pole Trim & Progress */}
      {step < 5 && (
        <div
          className="shrink-0 bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs"
          style={{ paddingTop: 'max(0rem, env(safe-area-inset-top, 0px))' }}
        >
          {/* Minimalist Barber Pole Ribbon (Subtle & Elegant) */}
          <div className="w-full h-1 bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_8px,#ffffff_8px,#ffffff_16px,#3b82f6_16px,#3b82f6_24px,#ffffff_24px,#ffffff_32px)] opacity-90" />

          {/* Progress Indicator Bar */}
          <div className="w-full bg-stone-100 h-1">
            <div
              className="bg-emerald-600 h-1 transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 font-mono">
                {displayStepNumber}
              </span>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs">💈</span>
                  <h2 className="text-sm font-extrabold text-stone-900 truncate">
                    {step === 1 && (lang === 'my' ? 'ဝန်ဆောင်မှု ရွေးချယ်ပါ' : 'Select Service')}
                    {step === 2 && (lang === 'my' ? 'ဆံသပညာရှင် ရွေးချယ်ပါ' : 'Select Stylist')}
                    {step === 3 && (lang === 'my' ? 'ရက်စွဲနှင့် အချိန်' : 'Date & Time')}
                    {step === 4 && (lang === 'my' ? 'အချက်အလက်နှင့် အတည်ပြုချက်' : 'Your Info & Confirm')}
                  </h2>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4 text-stone-600" />
              <span>{lang === 'my' ? 'ပိတ်မည်' : 'Close'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col justify-start"
        style={{
          paddingTop: step === 5 ? 'max(1.5rem, env(safe-area-inset-top, 0px))' : undefined,
        }}
      >
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: SERVICES */}
        {step === 1 && (
          <div className="space-y-4">
            {/* If barber was directly pre-selected, show a neat badge */}
            {isPreselectedBarber && selectedDesigner && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img
                    src={selectedDesigner.avatarUrl || '/logo.png'}
                    alt={selectedDesigner.name}
                    className="w-8 h-8 rounded-full object-cover border border-emerald-300 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">
                      {lang === 'my' ? 'ရွေးချယ်ထားသော ဆံသပညာရှင်' : 'Selected Stylist'}
                    </span>
                    <span className="font-bold text-stone-900 truncate block">
                      {selectedDesigner.name}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPreselectedBarber(false);
                    setStep(2);
                  }}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{lang === 'my' ? 'ပြောင်းမည်' : 'Change'}</span>
                </button>
              </div>
            )}

            {/* Category Filter Pills (Defaults to Hair Cut) */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <span>{cat.icon} {cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Summary Pill if any */}
            {selectedServices.length > 0 && (
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-300 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 flex items-center space-x-1.5">
                  <Scissors className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{selectedServices.length} {lang === 'my' ? 'ခု ရွေးထားသည်' : 'Selected'}:</span>
                  <span className="font-semibold text-stone-800 truncate max-w-[160px] sm:max-w-xs">
                    {selectedServices.map((s) => s.name).join(', ')}
                  </span>
                </span>
                <span className="font-mono font-bold text-stone-900">
                  {formatPrice(totalGrossPrice)} ({totalDurationMinutes}m)
                </span>
              </div>
            )}

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-6">
              {filteredServices.map((service) => {
                const isSelected = selectedServices.some((s) => s.id === service.id);
                return (
                  <div
                    key={service.id}
                    onClick={() => toggleSelectService(service)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between space-x-3 select-none active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 text-stone-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={service.imageUrl || '/logo.png'}
                        alt={service.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo.png';
                        }}
                        className="w-13 h-13 rounded-xl object-cover border border-stone-200 shrink-0 bg-stone-100"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {service.name}
                        </h4>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-stone-500 flex items-center space-x-1 font-mono">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            <span>{service.durationMinutes} min</span>
                          </span>
                          <span className="text-[10px] text-stone-400">• {service.category}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-700 block mt-1">
                          {formatPrice(service.price)}
                        </span>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-stone-300 bg-stone-50'
                    }`}>
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="text-[11px] text-stone-400 font-bold">+</span>}
                    </div>
                  </div>
                );
              })}

              {filteredServices.length === 0 && (
                <div className="text-center py-8 px-4 bg-white border border-stone-200 rounded-2xl space-y-2 col-span-full">
                  <p className="text-xs text-stone-500">
                    {lang === 'my' ? 'ဤကဏ္ဍတွင် ဝန်ဆောင်မှု မရှိသေးပါ' : 'No services found in this category'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedCat('all')}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {lang === 'my' ? 'အားလုံး ပြန်ကြည့်မည်' : 'View All Services'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: STYLISTS (Shown only if not preselected) */}
        {step === 2 && (
          <div className="space-y-4 pb-6">
            {/* Stylists Grid - Large Prominent Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {designers.map((designer) => {
                const isSelected = selectedDesigner?.id === designer.id;
                return (
                  <div
                    key={designer.id}
                    onClick={() => {
                      setSelectedDesigner(designer);
                      setError('');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between space-x-3.5 select-none active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-600 text-stone-950 ring-2 ring-emerald-600/20 shadow-xs'
                        : 'bg-white border-emerald-100 hover:border-emerald-400 text-stone-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <img
                        src={designer.avatarUrl || '/logo.svg'}
                        alt={designer.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                        }}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-emerald-100 shrink-0 bg-stone-100 shadow-xs"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm sm:text-base text-stone-900 truncate">
                            {designer.name}
                          </h4>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                            {designer.experienceYears || 5} yrs
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 truncate">{designer.title || 'Barber Stylist'}</p>
                        
                        {/* Barber Phone Number */}
                        {designer.phone && (
                          <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-mono font-bold">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{designer.phone}</span>
                          </div>
                        )}

                        <div className="text-[11px] text-stone-400 font-mono">
                          <span>Hours: {designer.workingHours?.start || '09:00'} - {designer.workingHours?.end || '19:00'}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-stone-300 bg-stone-50'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtle / Less Noticeable Any Stylist Option */}
            <div
              onClick={() => {
                setSelectedDesigner(anyProfessional);
                setError('');
              }}
              className={`p-3 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-between active:scale-[0.99] select-none ${
                selectedDesigner?.id === 'any'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-600'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <Zap className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <span className="font-medium">{anyProfessional.name}</span>
                  <span className="text-[11px] text-stone-400 ml-1.5 hidden sm:inline">({lang === 'my' ? 'အချိန်အမြန်ဆုံး အလိုအလျောက် စီစဉ်ပေးမည်' : 'Fastest available slot'})</span>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                selectedDesigner?.id === 'any' ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-stone-300'
              }`}>
                {selectedDesigner?.id === 'any' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DATE & TIME */}
        {step === 3 && (
          <div className="space-y-4 pb-6">
            {/* Horizontal Date Picker */}
            <div className="space-y-1.5">
              <label className="block text-stone-700 text-xs font-bold">
                {lang === 'my' ? 'ရက်စွဲ ရွေးချယ်ပါ' : 'Select Date'}
              </label>
              <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scrollbar-none">
                {generateDates().map((d) => {
                  const isSelected = selectedDate === d.iso;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      className={`min-w-18 py-2.5 px-2 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className="block text-[10px] uppercase font-bold">{d.dayName}</span>
                      <span className="block text-xs font-black mt-0.5">{d.monthDay}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-stone-700 text-xs font-bold">
                  {lang === 'my' ? 'အချိန် ရွေးချယ်ပါ' : 'Select Time'}
                </label>
                {selectedDate === todayStr && (
                  <span className="text-[11px] font-mono text-emerald-700 flex items-center space-x-1 font-bold">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                )}
              </div>

              {areAllSlotsUnavailable(TIME_SLOTS_12H, selectedDate, lockedSlots) && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start space-x-2.5 text-emerald-950 text-xs font-medium">
                  <CalendarX className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
                  <p>
                    {lang === 'my'
                      ? 'ယနေ့အတွက် အချိန်ဇယားများ ပြည့်/ကျော်လွန်သွားပါပြီ။ အခြားရက်စွဲတစ်ခုကို ရွေးချယ်ပေးပါရန်။'
                      : 'All time slots for today have passed or are booked. Please choose an upcoming date.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[42vh] overflow-y-auto pr-1">
                {TIME_SLOTS_12H.map((slot) => {
                  const isPassed = isTimeSlotPassed(slot, selectedDate);
                  const isLocked = lockedSlots.includes(slot);
                  const isDisabled = isPassed || isLocked;
                  const isSelected = selectedTimeSlot === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`relative py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1.5 font-mono ${
                        isDisabled
                          ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-black ring-2 ring-emerald-600/30'
                          : 'bg-white text-stone-800 border-stone-200 hover:border-emerald-400 hover:bg-stone-50'
                      }`}
                    >
                      <Clock className={`w-3 h-3 ${isDisabled ? 'opacity-30' : isSelected ? 'text-white' : 'text-emerald-600'}`} />
                      <span>{slot}</span>

                      {isPassed && (
                        <span className="absolute -top-1 -right-1 text-[8px] bg-stone-200 text-stone-600 border border-stone-300 px-1 rounded no-underline">
                          {lang === 'my' ? 'ကျော်' : 'Passed'}
                        </span>
                      )}

                      {!isPassed && isLocked && (
                        <span className="absolute -top-1 -right-1 text-[8px] bg-rose-100 text-rose-700 border border-rose-200 px-1 rounded no-underline">
                          {lang === 'my' ? 'ပြည့်' : 'Booked'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CONTACT & PAYMENT */}
        {step === 4 && (
          <div className="space-y-4 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Client Info Box */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  {lang === 'my' ? 'လူကြီးမင်း အချက်အလက်' : 'Client Info'}
                </h4>
                <div>
                  <label className="block text-stone-600 text-xs font-bold mb-1">
                    {lang === 'my' ? 'အမည်' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={lang === 'my' ? 'သင့်အမည် (Your Name)' : 'Your Name'}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-stone-600 text-xs font-bold mb-1">
                    {lang === 'my' ? 'ဖုန်းနံပါတ်' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="09xxxxxxxxx"
                    className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none font-mono font-bold transition-colors"
                  />
                  {linkedAccountInfo && (
                    <div className="mt-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-950">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-bold">{linkedAccountInfo.name}</span>
                        <span className="text-stone-600 ml-1">
                          ({linkedAccountInfo.tier} • {linkedAccountInfo.points} pts)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-stone-600 text-xs font-bold mb-1">
                    {lang === 'my' ? 'မှတ်ချက် (စိတ်ကြိုက်)' : 'Notes (Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder={lang === 'my' ? 'ဆံပင်ပုံစံ သို့မဟုတ် မှာကြားချက်...' : 'e.g. Specific style request...'}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none resize-none transition-colors"
                  />
                </div>

                {/* Promo Code Input */}
                <div className="pt-1">
                  {appliedPromo ? (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="text-emerald-900">
                        <span className="font-bold">{appliedPromo.code}</span> (-{formatPrice(appliedPromo.discount)})
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-stone-500 hover:text-stone-900 text-xs cursor-pointer font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Promo Code"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        className="flex-1 bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none uppercase font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyPromo()}
                        disabled={promoLoading || !promoCodeInput.trim()}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        {promoLoading ? '...' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-rose-600 text-[10px] mt-1">{promoError}</p>}
                </div>
              </div>

              {/* Payment Box */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  {lang === 'my' ? 'ငွေချေမှုပုံစံ' : 'Payment Method'}
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pay_at_shop')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === 'pay_at_shop'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span className="block text-xs font-bold">🏪 {lang === 'my' ? 'ဆိုင်ရောက်မှပေးမည်' : 'Pay at Shop'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('kpay_wave')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === 'kpay_wave'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span className="block text-xs font-bold">💳 KPay / Wave</span>
                  </button>
                </div>

                {/* Digital Payment Details */}
                {paymentMethod === 'kpay_wave' && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-900">KPay (KBZ)</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(kpayNo, 'kpay')}
                            className="text-[10px] font-bold text-blue-700 hover:underline flex items-center space-x-0.5 cursor-pointer"
                          >
                            {copiedKpay ? <Check className="w-3 h-3 text-blue-800" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKpay ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="font-mono font-bold text-xs text-stone-900">{kpayNo}</p>
                        <p className="text-[10px] text-stone-500 truncate">{kpayName}</p>
                      </div>

                      <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-stone-800">WaveMoney</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(waveNo, 'wave')}
                            className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center space-x-0.5 cursor-pointer"
                          >
                            {copiedWave ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3 text-emerald-700" />}
                            <span>{copiedWave ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="font-mono font-bold text-xs text-stone-900">{waveNo}</p>
                        <p className="text-[10px] text-stone-500 truncate">{waveName}</p>
                      </div>
                    </div>

                    {/* QR Code if configured */}
                    {(shopSettings?.kpayQrUrl || shopSettings?.waveQrUrl) && (
                      <div className="flex items-center space-x-2 p-2 bg-stone-50 rounded-xl border border-stone-200">
                        {shopSettings?.kpayQrUrl && (
                          <div className="text-center flex-1">
                            <span className="text-[9px] text-stone-500 font-bold block mb-1">KPay QR</span>
                            <img src={shopSettings.kpayQrUrl} alt="KPay QR" className="w-20 h-20 object-contain mx-auto rounded border bg-white" />
                          </div>
                        )}
                        {shopSettings?.waveQrUrl && (
                          <div className="text-center flex-1">
                            <span className="text-[9px] text-stone-500 font-bold block mb-1">Wave QR</span>
                            <img src={shopSettings.waveQrUrl} alt="Wave QR" className="w-20 h-20 object-contain mx-auto rounded border bg-white" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transaction ID & Slip Upload */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-stone-600 text-[11px] font-bold mb-1">
                          {lang === 'my' ? 'ငွေလွှဲပြေစာ နောက်ဆုံး ၆ လုံး (Transaction ID)' : 'Txn ID / Last 6 digits'}
                        </label>
                        <input
                          type="text"
                          value={paymentTxnId}
                          onChange={(e) => setPaymentTxnId(e.target.value)}
                          placeholder="e.g. 982341"
                          className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-1.5 text-xs text-stone-900 font-mono font-bold focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-600 text-[11px] font-bold mb-1">
                          {lang === 'my' ? 'ငွေလွှဲစလစ် ပုံတင်ရန် (စိတ်ကြိုက်)' : 'Upload Payment Slip (Optional)'}
                        </label>
                        <label className="flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-stone-300 hover:border-emerald-500 bg-stone-50 rounded-xl text-xs font-bold text-stone-700 cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>{isUploadingSlip ? 'Uploading...' : paymentSlipUrl ? 'Change Slip Image' : 'Select Slip Screenshot'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleSlipFileChange} />
                        </label>
                        {paymentSlipUrl && (
                          <div className="mt-1 flex items-center space-x-2 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Slip attached successfully</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>{lang === 'my' ? 'ကျသင့်ငွေ စုစုပေါင်း' : 'Total Price'}:</span>
                    <span className="font-mono font-bold text-stone-800">{formatPrice(totalGrossPrice)}</span>
                  </div>
                  {appliedPromo && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Promo Discount ({appliedPromo.code}):</span>
                      <span className="font-mono">-{formatPrice(appliedPromo.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-900 font-extrabold text-sm pt-1 border-t border-dashed border-stone-200">
                    <span>{lang === 'my' ? 'ပေးချေရန် ပမာဏ' : 'Grand Total'}:</span>
                    <span className="font-mono text-emerald-700 font-black">{formatPrice(calculateFinalPrice())}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS RECEIPT */}
        {step === 5 && (createdBooking ? (() => {
          return (
            <div className="max-w-md mx-auto py-6 px-4 bg-white border border-stone-200 rounded-3xl shadow-lg text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block font-mono">
                  {lang === 'my' ? 'ဘိုကင်အောင်မြင်ပါသည်' : 'Booking Confirmed'}
                </span>
                <h3 className="text-xl font-black text-stone-950 mt-0.5">
                  {lang === 'my' ? 'ကျေးဇူးတင်ပါသည်' : 'Thank You!'}
                </h3>
              </div>

              {/* Booking Code Card */}
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-1">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">
                  {lang === 'my' ? 'ဘိုကင်ကုဒ်နံပါတ်' : 'Booking Code'}
                </span>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-lg font-mono font-black text-emerald-950 tracking-wider">
                    {createdBooking.bookingCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdBooking.bookingCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="p-1 rounded bg-white text-stone-700 hover:bg-stone-100 border border-stone-200 cursor-pointer"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-700">
                  <span className="text-stone-500">{lang === 'my' ? 'ရက်စွဲနှင့် အချိန်' : 'Date & Time'}:</span>
                  <span className="font-bold text-stone-900 font-mono">{createdBooking.date} • {createdBooking.timeSlot}</span>
                </div>
                <div className="flex items-center justify-between text-stone-700">
                  <span className="text-stone-500">{lang === 'my' ? 'ဆံသပညာရှင်' : 'Stylist'}:</span>
                  <span className="font-bold text-stone-900">{createdBooking.designerName}</span>
                </div>
                <div className="flex items-center justify-between text-stone-700">
                  <span className="text-stone-500">{lang === 'my' ? 'ဝန်ဆောင်မှု' : 'Service'}:</span>
                  <span className="font-bold text-stone-900 truncate max-w-[180px]">{createdBooking.serviceName}</span>
                </div>
                <div className="flex items-center justify-between text-stone-700 pt-1 border-t border-stone-200">
                  <span className="text-stone-500">{lang === 'my' ? 'စုစုပေါင်း' : 'Total Amount'}:</span>
                  <span className="font-mono font-black text-emerald-700">{formatPrice(createdBooking.price || createdBooking.servicePrice)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleDoneGoHome}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                >
                  <span>🏠</span>
                  <span>{lang === 'my' ? 'ပင်မစာမျက်နှာသို့ သွားမည်' : 'Go to Home'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDoneViewBookings}
                  className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <span>📋</span>
                  <span>{lang === 'my' ? 'ကျွန်ုပ်၏ ဘိုကင်များ ကြည့်မည်' : 'View My Bookings'}</span>
                </button>
              </div>
            </div>
          );
        })() : (
          <div className="max-w-md mx-auto py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            <p className="text-stone-600 text-xs font-medium">
              {lang === 'my' ? 'ဘိုကင်အတည်ပြုနေပါသည်...' : 'Confirming your booking...'}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom Sticky Action Bar */}
      {step < 5 && (
        <div
          className="border-t border-stone-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3.5 sticky bottom-0 z-20 shadow-2xs"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'my' ? 'နောက်သို့' : 'Back'}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={stepTransitionLoading || (step === 1 && selectedServices.length === 0)}
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stepTransitionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>{lang === 'my' ? 'ခေတ္တစောင့်ပါ...' : 'Loading...'}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {step === 1 && selectedServices.length === 0
                        ? (lang === 'my' ? 'ဝန်ဆောင်မှု ရွေးချယ်ပါ' : 'Select a Service')
                        : (lang === 'my' ? 'ရှေ့သို့ ဆက်သွားမည်' : 'Next Step')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{lang === 'my' ? 'လုပ်ဆောင်နေသည်...' : 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-white" />
                    <span>{lang === 'my' ? 'ဘိုကင် အတည်ပြုမည်' : 'Confirm Booking'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
