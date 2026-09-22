import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Service,
  Designer,
  BookingStatus,
  BookingServiceItem,
  RetailProduct,
  BookingRetailItem
} from '../../types';
import { api } from '../../api/client';
import {
  TIME_SLOTS_12H,
  getLocalTodayStr,
  getCurrentTime12H,
  getCurrentTime24H,
  formatTime24to12,
  formatTime12to24
} from '../../utils/timeSlots';
import { formatPrice } from '../../utils/formatters';
import { ClientCombobox, KnownClient } from './ClientCombobox';
import {
  Calendar,
  Clock,
  Scissors,
  Users,
  CreditCard,
  Banknote,
  DollarSign,
  Save,
  RotateCcw,
  Sparkles,
  Percent,
  FileText,
  CheckCircle2,
  AlertCircle,
  History,
  ChevronDown,
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  ShoppingBag,
  Package,
  Search,
  Check,
  Receipt,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SelectedServiceEntry {
  uid: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  category?: string;
}

export interface SelectedRetailEntry {
  uid: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  category?: string;
  stockCount?: number;
  inStock?: boolean;
  barberCommissionPercent?: number;
  barberCommissionAmount?: number;
}

interface WalkinBackfillFormProps {
  services: Service[];
  designers: Designer[];
  knownClients: KnownClient[];
  pastNotes?: string[];
  retailProducts?: RetailProduct[];
  onSubmit: (formData: {
    date: string;
    timeSlot: string;
    designerId: string;
    serviceId: string;
    servicesList?: BookingServiceItem[];
    retailItems?: BookingRetailItem[];
    customPrice?: number;
    discountAmount: number;
    customerName: string;
    customerPhone: string;
    paymentMethod: 'cash' | 'kpay' | 'wave' | 'pay_at_shop';
    paymentStatus: 'verified' | 'unpaid' | 'paid_advance';
    status: BookingStatus;
    notes: string;
  }) => Promise<void>;
  loading: boolean;
  onCancel?: () => void;
  lang?: 'en' | 'my';
}

const COMMON_NOTE_PRESETS = [
  'VIP Regular (အမြဲလာနေကျ)',
  'Skin Fade / Beard Trim (မုတ်ဆိတ်ရိတ်+Fade)',
  'Hot Towel & Shampoo (ခေါင်းလျှော်+သန့်စင်)',
  'In a rush / Quick Service (အလျင်လိုနေသည်)',
  'Hair Coloring & Treatment (ဆံပင်ဆေးဆိုး)',
  'Requested specific haircut (ပုံစံသီးသန့်ညှပ်)',
  'Hair Wash Only (ခေါင်းလျှော်သီးသန့်)',
  'Walk-in Special (ဆိုင်ရောက် အထူး)'
];

export const WalkinBackfillForm: React.FC<WalkinBackfillFormProps> = ({
  services,
  designers,
  knownClients,
  pastNotes = [],
  retailProducts: initialRetailProducts,
  onSubmit,
  loading,
  onCancel,
  lang = 'en'
}) => {
  const todayStr = getLocalTodayStr();
  const initialTime = getCurrentTime12H();

  const defaultService = services.find(s => s.active !== false) || services[0];

  // Form States - autoselected to current date and current time
  const [date, setDate] = useState<string>(todayStr);
  const [timeSlot, setTimeSlot] = useState<string>(initialTime);
  const [designerId, setDesignerId] = useState<string>(designers.find(d => d.active !== false)?.id || designers[0]?.id || '');
  
  // Multiple Services state
  const [selectedServices, setSelectedServices] = useState<SelectedServiceEntry[]>(() => {
    if (defaultService) {
      return [{
        uid: `init-${Date.now()}`,
        serviceId: defaultService.id,
        serviceName: defaultService.name,
        servicePrice: defaultService.price,
        serviceDuration: defaultService.durationMinutes,
        category: defaultService.category
      }];
    }
    return [];
  });

  // POS / Retail Products state
  const [availableProducts, setAvailableProducts] = useState<RetailProduct[]>(initialRetailProducts || []);
  const [selectedRetailItems, setSelectedRetailItems] = useState<SelectedRetailEntry[]>([]);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all');

  // Load / subscribe to retail products from Firestore
  useEffect(() => {
    if (initialRetailProducts && initialRetailProducts.length > 0) {
      setAvailableProducts(initialRetailProducts);
      return;
    }
    const unsub = api.subscribeToRetailProducts((products) => {
      setAvailableProducts(products);
    });
    return () => unsub();
  }, [initialRetailProducts]);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('Walk-in Guest');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'kpay' | 'wave' | 'pay_at_shop'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<'verified' | 'unpaid' | 'paid_advance'>('verified');
  const [status, setStatus] = useState<BookingStatus>('completed');
  
  // Promo Code state
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; desc?: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string>('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);

  useEffect(() => {
    api.getPromos().then(list => {
      setAvailablePromos(list.filter(p => p.active));
    }).catch(() => {});
  }, []);

  const handleApplyPromo = async (codeToTry?: string) => {
    const code = (codeToTry || promoCodeInput).trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const grossTotal = totalServicesPrice + totalRetailPrice;
      const res = await api.validatePromo(code, grossTotal);
      if (res.valid && typeof res.calculatedDiscount === 'number') {
        setAppliedPromo({
          code: res.promo?.code || code,
          discount: res.calculatedDiscount,
          desc: res.promo?.description
        });
        setDiscountAmount(res.calculatedDiscount);
        setPromoCodeInput('');
      } else {
        setPromoError(res.message || (lang === 'my' ? 'ပရိုမိုကုဒ် မမှန်ကန်ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပါပြီ' : 'Invalid or expired Promo Code'));
      }
    } catch (err: any) {
      setPromoError(err.message || 'Error validating promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setDiscountAmount(0);
    setPromoError('');
    setPromoCodeInput('');
  };
  
  // Default blank Additional Note
  const [notes, setNotes] = useState<string>('');
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  const noteContainerRef = useRef<HTMLDivElement>(null);
  const productContainerRef = useRef<HTMLDivElement>(null);

  // Close note dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (noteContainerRef.current && !noteContainerRef.current.contains(event.target as Node)) {
        setIsNoteDropdownOpen(false);
      }
      if (productContainerRef.current && !productContainerRef.current.contains(event.target as Node)) {
        setIsProductPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDesigner = designers.find((d) => d.id === designerId) || designers[0];

  // Multiple services helper functions
  const handleAddService = (serviceToAdd: Service) => {
    setSelectedServices(prev => [
      ...prev,
      {
        uid: `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        serviceId: serviceToAdd.id,
        serviceName: serviceToAdd.name,
        servicePrice: serviceToAdd.price,
        serviceDuration: serviceToAdd.durationMinutes,
        category: serviceToAdd.category
      }
    ]);
    setIsServicePickerOpen(false);
  };

  const handleRemoveService = (uid: string) => {
    if (selectedServices.length <= 1) {
      return; // Keep at least one
    }
    setSelectedServices(prev => prev.filter(s => s.uid !== uid));
  };

  const handleUpdateServiceItem = (uid: string, srvId: string) => {
    const srv = services.find(s => s.id === srvId);
    if (!srv) return;
    setSelectedServices(prev => prev.map(item => {
      if (item.uid === uid) {
        return {
          ...item,
          serviceId: srv.id,
          serviceName: srv.name,
          servicePrice: srv.price,
          serviceDuration: srv.durationMinutes,
          category: srv.category
        };
      }
      return item;
    }));
  };

  const handleUpdateServicePrice = (uid: string, newPrice: number) => {
    setSelectedServices(prev => prev.map(item => {
      if (item.uid === uid) {
        return {
          ...item,
          servicePrice: Math.max(0, newPrice)
        };
      }
      return item;
    }));
  };

  // =========================================================================
  // POS / RETAIL PRODUCTS HELPER FUNCTIONS
  // =========================================================================
  const handleAddRetailProduct = (product: RetailProduct, qty = 1) => {
    const existingIndex = selectedRetailItems.findIndex(i => i.productId === product.id);
    const commPct = product.barberCommissionPercent || 0;
    
    if (existingIndex >= 0) {
      // Increment quantity
      setSelectedRetailItems(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + qty;
          const newTotal = item.unitPrice * newQty;
          const commAmt = Math.round((newTotal * (item.barberCommissionPercent || 0)) / 100);
          return {
            ...item,
            quantity: newQty,
            totalPrice: newTotal,
            barberCommissionAmount: commAmt
          };
        }
        return item;
      }));
    } else {
      // Add new item
      const unitPrice = product.price || 0;
      const totalPrice = unitPrice * qty;
      const commAmt = Math.round((totalPrice * commPct) / 100);
      setSelectedRetailItems(prev => [
        ...prev,
        {
          uid: `retail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId: product.id,
          productName: product.name,
          unitPrice,
          quantity: qty,
          totalPrice,
          category: product.category,
          stockCount: product.stockCount,
          inStock: product.inStock,
          barberCommissionPercent: commPct,
          barberCommissionAmount: commAmt
        }
      ]);
    }
    setIsProductPickerOpen(false);
  };

  const handleRemoveRetailItem = (uid: string) => {
    setSelectedRetailItems(prev => prev.filter(item => item.uid !== uid));
  };

  const handleUpdateRetailQty = (uid: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveRetailItem(uid);
      return;
    }
    setSelectedRetailItems(prev => prev.map(item => {
      if (item.uid === uid) {
        const totalPrice = item.unitPrice * newQty;
        const commAmt = Math.round((totalPrice * (item.barberCommissionPercent || 0)) / 100);
        return {
          ...item,
          quantity: newQty,
          totalPrice,
          barberCommissionAmount: commAmt
        };
      }
      return item;
    }));
  };

  const handleUpdateRetailUnitPrice = (uid: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setSelectedRetailItems(prev => prev.map(item => {
      if (item.uid === uid) {
        const totalPrice = validPrice * item.quantity;
        const commAmt = Math.round((totalPrice * (item.barberCommissionPercent || 0)) / 100);
        return {
          ...item,
          unitPrice: validPrice,
          totalPrice,
          barberCommissionAmount: commAmt
        };
      }
      return item;
    }));
  };

  // Product categories
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    availableProducts.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [availableProducts]);

  // Filtered available products
  const filteredAvailableProducts = useMemo(() => {
    return availableProducts.filter(p => {
      const matchesCat = selectedProductCategory === 'all' || p.category === selectedProductCategory;
      const q = productSearchQuery.trim().toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [availableProducts, selectedProductCategory, productSearchQuery]);

  // =========================================================================
  // CALCULATED TOTALS & FINANCIAL SUMMARY
  // =========================================================================
  const totalServicesPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.servicePrice || 0), 0);
  }, [selectedServices]);

  const totalRetailPrice = useMemo(() => {
    return selectedRetailItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }, [selectedRetailItems]);

  const totalCombinedGross = totalServicesPrice + totalRetailPrice;

  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.serviceDuration || 30), 0);
  }, [selectedServices]);

  const netTotal = Math.max(0, totalCombinedGross - discountAmount);
  
  // Barber Commissions
  const commissionPercent = selectedDesigner?.commissionPercent ?? 50;
  const netServicePriceAfterDiscount = Math.max(0, totalServicesPrice - discountAmount);
  const estimatedServiceCommission = Math.round((netServicePriceAfterDiscount * commissionPercent) / 100);
  
  const estimatedRetailCommission = useMemo(() => {
    return selectedRetailItems.reduce((sum, item) => sum + (item.barberCommissionAmount || 0), 0);
  }, [selectedRetailItems]);

  const totalStylistEarnings = estimatedServiceCommission + estimatedRetailCommission;

  // Combined Unique Past Notes + Common Presets for History selection
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

  // Filtered Notes for Combobox
  const filteredNotes = useMemo(() => {
    const q = (noteSearchQuery || '').trim().toLowerCase();
    if (!q) return allUniqueNotes;
    return allUniqueNotes.filter(n => n.toLowerCase().includes(q));
  }, [allUniqueNotes, noteSearchQuery]);

  // Trigger Session Net Statement Modal on form submit
  const handleOpenStatementModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      alert(lang === 'my' ? 'အနည်းဆုံး Service တစ်ခု ရွေးချယ်ပေးပါ' : 'Please select at least one service');
      return;
    }
    setIsStatementModalOpen(true);
  };

  // Execute Confirmed Submission to Database
  const handleConfirmedSubmit = async () => {
    const primaryServiceId = selectedServices[0]?.serviceId || 'srv-1';
    
    const servicesList: BookingServiceItem[] = selectedServices.map(s => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      servicePrice: s.servicePrice,
      serviceDuration: s.serviceDuration,
      category: s.category
    }));

    const retailItems: BookingRetailItem[] = selectedRetailItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      barberCommissionAmount: item.barberCommissionAmount
    }));

    try {
      await onSubmit({
        date,
        timeSlot: timeSlot.trim() || getCurrentTime12H(),
        designerId,
        serviceId: primaryServiceId,
        servicesList,
        retailItems: retailItems.length > 0 ? retailItems : undefined,
        customPrice: totalCombinedGross,
        discountAmount,
        customerName: customerName.trim() || 'Walk-in Guest',
        customerPhone: customerPhone.trim(),
        paymentMethod,
        paymentStatus,
        status,
        notes: notes.trim()
      });
      setIsStatementModalOpen(false);
      
      // Reset form state cleanly
      setDate(todayStr);
      setTimeSlot(getCurrentTime12H());
      setCustomerName('Walk-in Guest');
      setCustomerPhone('');
      if (defaultService) {
        setSelectedServices([{
          uid: `init-${Date.now()}`,
          serviceId: defaultService.id,
          serviceName: defaultService.name,
          servicePrice: defaultService.price,
          serviceDuration: defaultService.durationMinutes,
          category: defaultService.category
        }]);
      }
      setSelectedRetailItems([]);
      setDiscountAmount(0);
      setNotes('');
    } catch (err) {
      console.error('Error during walk-in submission:', err);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-4 font-sans">
      
      {/* Compact Minimal Header Action */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center space-x-2">
          {date !== todayStr && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-100 text-stone-900 border border-stone-300">
              PAST DATE
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setDate(todayStr);
            setTimeSlot(getCurrentTime12H());
            setCustomerName('Walk-in Guest');
            setCustomerPhone('');
            if (defaultService) {
              setSelectedServices([{
                uid: `init-${Date.now()}`,
                serviceId: defaultService.id,
                serviceName: defaultService.name,
                servicePrice: defaultService.price,
                serviceDuration: defaultService.durationMinutes,
                category: defaultService.category
              }]);
            }
            setSelectedRetailItems([]);
            setDiscountAmount(0);
            setNotes('');
          }}
          className="text-xs font-mono font-bold text-stone-500 hover:text-black flex items-center space-x-1 cursor-pointer ml-auto transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      <form onSubmit={handleOpenStatementModal} className="space-y-6">
        
        {/* ========================================================================= */}
        {/* COMPACT DATE & TIME STRIP (AUTO-SELECTED TO TODAY & CURRENT TIME)        */}
        {/* ========================================================================= */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2 text-stone-700 font-bold">
            <Calendar className="w-4 h-4 text-stone-900" />
            <span className="text-stone-900">{lang === 'my' ? 'ရက်စွဲ :' : 'Date:'}</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer shadow-2xs"
            />
          </div>

          <div className="flex items-center space-x-2 text-stone-700 font-bold">
            <Clock className="w-4 h-4 text-stone-900" />
            <span className="text-stone-900">{lang === 'my' ? 'အချိန် :' : 'Time:'}</span>
            <input
              type="time"
              value={formatTime12to24(timeSlot) || getCurrentTime24H()}
              onChange={(e) => {
                const formatted12 = formatTime24to12(e.target.value);
                if (formatted12) setTimeSlot(formatted12);
              }}
              className="bg-white border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-stone-900 cursor-pointer shadow-2xs"
            />
            <span className="px-2 py-0.5 rounded-lg bg-stone-900 text-white font-bold text-[11px]">
              {timeSlot || getCurrentTime12H()}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 2: STYLIST / BARBER ATTRIBUTION                                      */}
        {/* ========================================================================= */}
        <div className="space-y-2.5">
          <label className="block text-xs font-black font-mono uppercase tracking-wider text-stone-900 flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">2</span>
            <span>{lang === 'my' ? 'ဝန်ဆောင်မှုပေးခဲ့သော ဆံသဆရာ / Barber' : 'Assigned Stylist / Barber'}</span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {designers.filter(d => d.active !== false).map((des) => {
              const isSelected = designerId === des.id;
              return (
                <button
                  type="button"
                  key={des.id}
                  onClick={() => setDesignerId(des.id)}
                  className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs scale-[1.02]'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-white hover:border-emerald-300'
                  }`}
                >
                  <img
                    src={des.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
                    alt={des.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl object-cover shrink-0 border border-black/10"
                  />
                  <div className="truncate text-xs">
                    <span className="block truncate font-bold">{des.name}</span>
                    <span className="text-[10px] opacity-80 block font-mono">
                      {des.commissionPercent || 50}% Comm
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 3: MULTIPLE SERVICES SELECTION & CUSTOM PRICING                      */}
        {/* ========================================================================= */}
        <div className="bg-stone-50 border border-stone-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black font-mono uppercase tracking-wider text-stone-900 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">3</span>
              <span>
                {lang === 'my'
                  ? `ရယူခဲ့သော ဝန်ဆောင်မှုများ (${selectedServices.length} မျိုး)`
                  : `Selected Haircut Services (${selectedServices.length} items)`}
              </span>
            </span>

            {/* Quick Aggregate Badge */}
            <div className="flex items-center space-x-2 text-[11px] font-mono">
              <span className="bg-emerald-700 text-white px-3 py-1 rounded-full font-bold shadow-2xs">
                Services: {formatPrice(totalServicesPrice)}
              </span>
            </div>
          </div>

          {/* List of currently selected services */}
          <div className="space-y-2.5">
            {selectedServices.map((item, idx) => (
              <div
                key={item.uid}
                className="bg-white border border-stone-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all hover:border-emerald-400"
              >
                <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    #{idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <select
                      value={item.serviceId}
                      onChange={(e) => handleUpdateServiceItem(item.uid, e.target.value)}
                      className="w-full bg-stone-50 hover:bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                    >
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} — {formatPrice(srv.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-2.5 shrink-0">
                  {/* Editable Item Price */}
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-mono text-stone-400">Ks:</span>
                    <input
                      type="number"
                      value={item.servicePrice}
                      onChange={(e) => handleUpdateServicePrice(item.uid, Number(e.target.value) || 0)}
                      className="w-24 bg-white border border-stone-300 rounded-xl px-2 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  {/* Remove Service Button */}
                  {selectedServices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveService(item.uid)}
                      className="p-1.5 rounded-xl bg-stone-100 hover:bg-rose-100 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove this service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Another Service Button & Dropdown Picker */}
          <div className="pt-1 flex items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsServicePickerOpen(!isServicePickerOpen)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? '+ ဝန်ဆောင်မှု ထပ်ထည့်မည် (Add Service)' : '+ Add Another Service'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isServicePickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Service Selection Popover */}
              {isServicePickerOpen && (
                <div className="absolute left-0 top-full mt-2 z-40 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto">
                  <div className="text-[10px] font-mono font-bold text-stone-400 px-2 py-1 uppercase">
                    Select service to add:
                  </div>
                  {services
                    .filter((s) => s.active !== false)
                    .map((srv) => (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleAddService(srv)}
                        className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <span className="font-bold text-stone-900 truncate">{srv.name}</span>
                        <span className="font-mono text-emerald-800 text-[11px] shrink-0 ml-2 font-bold">
                          +{formatPrice(srv.price)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 4: POS / RETAIL PRODUCTS ATTACHMENT */}
        <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-3xl p-5 space-y-4" ref={productContainerRef}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black font-mono uppercase tracking-wider text-emerald-950 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[11px] font-bold">4</span>
              <span className="flex items-center space-x-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                <span>{lang === 'my' ? 'POS ပစ္စည်း ရောင်းချမှု (Retail)' : 'POS Retail Products'}</span>
              </span>
            </span>

            {/* Aggregate Retail Badge */}
            <div className="flex items-center space-x-2 text-[11px] font-mono">
              <span className={`px-3 py-1 rounded-full font-bold shadow-2xs ${
                selectedRetailItems.length > 0
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'bg-stone-200/70 text-stone-600'
              }`}>
                {selectedRetailItems.length > 0
                  ? `POS: +${formatPrice(totalRetailPrice)} (${selectedRetailItems.reduce((s, i) => s + i.quantity, 0)} pcs)`
                  : 'None'}
              </span>
            </div>
          </div>

          {/* List of currently attached retail items */}
          {selectedRetailItems.length > 0 ? (
            <div className="space-y-2.5">
              {selectedRetailItems.map((item) => (
                <div
                  key={item.uid}
                  className="bg-white border border-emerald-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all hover:border-emerald-400"
                >
                  <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      <Package className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-stone-950 truncate">{item.productName}</span>
                        {item.category && (
                          <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded font-bold">
                            {item.category}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3 text-[11px] font-mono text-stone-500 mt-0.5">
                        <span>Unit: {formatPrice(item.unitPrice)}</span>
                        {item.barberCommissionPercent ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 rounded border border-emerald-200 text-[10px]">
                            Comm ({item.barberCommissionPercent}%): +{formatPrice(item.barberCommissionAmount || 0)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
                    {/* Quantity Stepper */}
                    <div className="flex items-center bg-stone-100 rounded-xl p-0.5 border border-stone-200">
                      <button
                        type="button"
                        onClick={() => handleUpdateRetailQty(item.uid, item.quantity - 1)}
                        className="p-1 rounded-lg hover:bg-white text-stone-600 hover:text-stone-950 cursor-pointer transition-colors"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateRetailQty(item.uid, Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-10 text-center bg-transparent text-xs font-mono font-black text-stone-900 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateRetailQty(item.uid, item.quantity + 1)}
                        className="p-1 rounded-lg hover:bg-white text-stone-600 hover:text-stone-950 cursor-pointer transition-colors"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Item Total Price */}
                    <div className="text-right font-mono min-w-[70px]">
                      <span className="text-xs font-bold text-emerald-950 block">{formatPrice(item.totalPrice)}</span>
                    </div>

                    {/* Remove Item Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRetailItem(item.uid)}
                      className="p-1.5 rounded-xl bg-stone-100 hover:bg-rose-100 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-white/70 border border-dashed border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-stone-500">
              <span className="flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'my' ? 'ပစ္စည်း မထည့်ရသေးပါ' : 'No retail items added.'}</span>
              </span>
            </div>
          )}

          {/* Add Product Controls & Dropdown */}
          <div className="pt-1 flex items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProductPickerOpen(!isProductPickerOpen)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? '+ POS ပစ္စည်းထည့်မည်' : '+ Add POS Product'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isProductPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Product Picker Modal / Popover */}
              {isProductPickerOpen && (
                <div className="absolute left-0 top-full mt-2 z-40 w-80 sm:w-96 bg-white border border-stone-200 rounded-2xl shadow-2xl p-3 space-y-2 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-[11px] font-mono font-bold text-stone-900 uppercase">
                      Select POS Retail Product
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsProductPickerOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder={lang === 'my' ? 'ပစ္စည်းအမည် ရှာပါ...' : 'Search product name...'}
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-600 font-mono"
                      autoFocus
                    />
                  </div>

                  {/* Category Pills */}
                  {productCategories.length > 0 && (
                    <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setSelectedProductCategory('all')}
                        className={`px-2 py-0.5 rounded-lg border font-bold shrink-0 ${
                          selectedProductCategory === 'all'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        All
                      </button>
                      {productCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedProductCategory(cat)}
                          className={`px-2 py-0.5 rounded-lg border font-bold shrink-0 ${
                            selectedProductCategory === cat
                              ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                              : 'bg-stone-50 text-stone-600 border-stone-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Product List */}
                  <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                    {filteredAvailableProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-stone-400 font-mono">
                        {availableProducts.length === 0
                          ? (lang === 'my' ? 'POS Product မရှိသေးပါ (POS Menu မှ သွင်းနိုင်ပါသည်)' : 'No retail products registered yet in POS inventory')
                          : 'No matching products found'}
                      </div>
                    ) : (
                      filteredAvailableProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleAddRetailProduct(prod)}
                          className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-bold text-stone-900 block truncate group-hover:text-emerald-950">{prod.name}</span>
                            <div className="flex items-center space-x-2 text-[10px] font-mono text-stone-400">
                              {prod.category && <span>{prod.category}</span>}
                              {typeof prod.stockCount === 'number' && (
                                <span className={prod.stockCount > 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                  • Stock: {prod.stockCount}
                                </span>
                              )}
                              {prod.barberCommissionPercent ? (
                                <span className="text-emerald-700 font-bold">• {prod.barberCommissionPercent}% Comm</span>
                              ) : null}
                            </div>
                          </div>

                          <span className="font-mono text-emerald-800 font-bold text-xs shrink-0 bg-emerald-100/60 px-2 py-1 rounded-lg">
                            +{formatPrice(prod.price)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Discount & Promo Code Integration */}
          <div className="pt-3.5 border-t border-emerald-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-xs font-bold text-stone-900 font-mono uppercase">
                  {lang === 'my' ? 'ပရိုမိုကုဒ် / လျှော့စျေး (Promo Code & Discount):' : 'Promo Code & Discount:'}
                </span>
              </div>

              {/* Direct discount amount input in Ks */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono text-stone-500 font-bold">
                  {lang === 'my' ? 'ငွေပမာဏ (Ks):' : 'Amount (Ks):'}
                </span>
                <input
                  type="number"
                  placeholder="0"
                  value={discountAmount === 0 ? '' : discountAmount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0);
                    setDiscountAmount(val);
                    if (appliedPromo && val !== appliedPromo.discount) {
                      setAppliedPromo(null);
                    }
                  }}
                  className="w-28 bg-white border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-600 shadow-2xs"
                />
              </div>
            </div>

            {/* Promo Code Input Bar or Applied Badge */}
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-emerald-100/90 border border-emerald-300 rounded-2xl px-3 py-2 text-xs shadow-2xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-800 text-white font-mono font-bold text-[11px] shrink-0">
                    {appliedPromo.code}
                  </span>
                  <span className="font-mono font-bold text-emerald-900 text-xs">
                    -{formatPrice(appliedPromo.discount)} {lang === 'my' ? 'လျှော့စျေး' : 'discount'}
                  </span>
                  {appliedPromo.desc && (
                    <span className="text-stone-600 text-[11px] truncate hidden sm:inline">
                      • {appliedPromo.desc}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="p-1 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                  title="Remove Promo Code"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder={lang === 'my' ? 'Promo Code ရိုက်ထည့်ပါ (ဥပမာ GTM15)...' : 'Enter Promo Code (e.g. GTM15)...'}
                      value={promoCodeInput}
                      onChange={(e) => {
                        setPromoCodeInput(e.target.value.toUpperCase());
                        if (promoError) setPromoError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPromo();
                        }
                      }}
                      className="w-full bg-white border border-stone-300 rounded-xl py-1.5 pl-8 pr-3 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-emerald-600 uppercase placeholder:normal-case placeholder:font-normal"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyPromo()}
                    disabled={promoLoading || !promoCodeInput.trim()}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                  >
                    {promoLoading ? (
                      <span className="animate-spin text-xs">⌛</span>
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{lang === 'my' ? 'အသုံးပြုမည်' : 'Apply'}</span>
                  </button>
                </div>

                {promoError && (
                  <div className="flex items-center space-x-1.5 text-rose-600 text-[11px] font-mono pl-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{promoError}</span>
                  </div>
                )}

                {/* Available Active Promo Badges */}
                {availablePromos.length > 0 && (
                  <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-0.5 text-[10px] font-mono">
                    <span className="text-stone-400 font-bold shrink-0">{lang === 'my' ? 'ရရှိနိုင်သော ကူပွန်များ:' : 'Available:'}</span>
                    {availablePromos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPromoCodeInput(p.code);
                          handleApplyPromo(p.code);
                        }}
                        className="px-2 py-0.5 bg-emerald-100/80 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center space-x-1"
                        title={p.description || p.code}
                      >
                        <span>{p.code}</span>
                        <span className="text-emerald-800">
                          ({p.discountType === 'percent' ? `${p.discountValue}%` : `-${formatPrice(p.discountValue)}`})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 5: CLIENT IDENTIFICATION                                             */}
        {/* ========================================================================= */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5">
          <span className="text-xs font-black font-mono uppercase tracking-wider text-stone-900 flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">5</span>
            <span>{lang === 'my' ? 'ဧည့်သည် အချက်အလက်' : 'Customer Info'}</span>
          </span>

          <ClientCombobox
            nameValue={customerName}
            phoneValue={customerPhone}
            onChangeName={setCustomerName}
            onChangePhone={setCustomerPhone}
            knownClients={knownClients}
            lang={lang}
            idPrefix="backfill"
          />
        </div>

        {/* ========================================================================= */}
        {/* STEP 6: PAYMENT METHOD & STATUS                                           */}
        {/* ========================================================================= */}
        <div className="bg-stone-50 border border-stone-200 rounded-3xl p-5 space-y-3">
          <span className="text-xs font-black font-mono uppercase tracking-wider text-stone-900 flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">6</span>
            <span>{lang === 'my' ? 'ငွေပေးချေမှု ပုံစံ' : 'Payment Method'}</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'cash', label: lang === 'my' ? 'ငွေသား (Cash/Shop)' : 'Cash / Pay at Shop', icon: Banknote, color: 'text-emerald-700' },
              { id: 'kpay', label: 'KBZPay (KPay)', icon: CreditCard, color: 'text-blue-700' },
              { id: 'wave', label: 'WavePay (Wave)', icon: CreditCard, color: 'text-emerald-700' },
            ].map((p) => {
              const isSelected = paymentMethod === p.id || (p.id === 'cash' && paymentMethod === 'pay_at_shop');
              const IconComp = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentMethod(p.id as any)}
                  className={`p-2.5 rounded-2xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : p.color}`} />
                  <span className="text-xs font-bold truncate">{p.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full bg-white border border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-800 focus:outline-hidden"
              >
                <option value="verified">✅ Verified (ပေးပြီး)</option>
                <option value="unpaid">⏳ Unpaid (မပေးရသေး)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase mb-1">Session Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-white border border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-800 focus:outline-hidden"
              >
                <option value="completed">✅ Completed</option>
                <option value="confirmed">📅 Confirmed</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 7: ADDITIONAL NOTES (OPTIONAL)                                       */}
        {/* ========================================================================= */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2" ref={noteContainerRef}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black font-mono uppercase tracking-wider text-stone-900 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">7</span>
              <span>{lang === 'my' ? 'မှတ်ချက်' : 'Additional Note'}</span>
            </span>

            {notes && (
              <button
                type="button"
                onClick={() => setNotes('')}
                className="text-[11px] font-mono text-stone-400 hover:text-stone-700 flex items-center space-x-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Typable Input Field with History Dropdown trigger */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={lang === 'my' ? 'မှတ်ချက် (ရိုက်ထည့်ရန် သို့မဟုတ် မှတ်တမ်းမှ ရွေးရန်)...' : 'Note (optional)...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={() => setIsNoteDropdownOpen(true)}
              className="w-full bg-white border border-stone-300 rounded-xl py-2 pl-3 pr-12 text-xs text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 shadow-2xs"
            />

            <div className="absolute right-2 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
                className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 cursor-pointer transition-colors"
                title="Past notes"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isNoteDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Autocomplete / History Dropdown */}
          <AnimatePresence>
            {isNoteDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="absolute left-6 right-6 z-40 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-56 flex flex-col font-sans"
              >
                <div className="p-2 bg-stone-50 border-b border-stone-100 flex items-center space-x-2">
                  <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={lang === 'my' ? 'မှတ်ချက်များကို ရှာဖွေပါ...' : 'Search past notes...'}
                    value={noteSearchQuery}
                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-stone-800 focus:outline-hidden font-mono"
                    autoFocus
                  />
                  {noteSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setNoteSearchQuery('')}
                      className="text-[10px] text-stone-400 hover:text-stone-700"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto divide-y divide-stone-50 flex-1 p-1">
                  {filteredNotes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-stone-400 font-mono">
                      No matching notes in history
                    </div>
                  ) : (
                    filteredNotes.map((noteItem) => {
                      const isSelected = notes.trim().toLowerCase() === noteItem.trim().toLowerCase();
                      return (
                        <button
                          key={noteItem}
                          type="button"
                          onClick={() => {
                            setNotes(noteItem);
                            setIsNoteDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-950 font-bold'
                              : 'hover:bg-stone-50 text-stone-800'
                          }`}
                        >
                          <span className="truncate">{noteItem}</span>
                          {isSelected && <span className="text-emerald-700 font-bold ml-2">✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-200 gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                setSelectedServices(services.length > 0 ? [{
                  uid: `srv-${Date.now()}`,
                  serviceId: services[0].id,
                  serviceName: services[0].name,
                  servicePrice: services[0].price,
                  serviceDuration: services[0].durationMinutes,
                  category: services[0].category
                }] : []);
                setSelectedRetailItems([]);
                setCustomerName('');
                setCustomerPhone('');
                setDiscountAmount(0);
                setNotes('');
              }
            }}
            className="px-4 py-2.5 rounded-2xl text-xs font-mono font-bold text-stone-600 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'my' ? 'ပြန်လည်ရှင်းလင်းရန်' : 'Reset Inputs'}</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shadow-xs transition-transform active:scale-95 disabled:opacity-50 flex items-center space-x-2"
          >
            <Receipt className="w-4 h-4 text-emerald-200" />
            <span>{loading ? (lang === 'my' ? 'စစ်ဆေးနေပါသည်...' : 'Processing...') : (lang === 'my' ? 'ငွေစာရင်း စစ်ဆေး/သိမ်းမည် (Review & Save Statement)' : 'Review & Save Statement')}</span>
          </button>
        </div>

      </form>

      {/* ========================================================================= */}
      {/* SESSION NET STATEMENT CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isStatementModalOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto font-sans"
            >
              {/* Modal Top Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-stone-950 uppercase font-mono tracking-wider">
                      {lang === 'my' ? 'SESSION NET STATEMENT (ငွေစာရင်း အကျဉ်း)' : 'SESSION NET STATEMENT'}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] font-mono text-stone-500">
                      <span>{date} • {timeSlot}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        status === 'completed' ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-900'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(false)}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer & Stylist Header Badge */}
              <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200/80 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">Customer / ဧည့်သည်</span>
                  <span className="font-bold text-stone-900 block truncate">{customerName || 'Walk-in Guest'}</span>
                  <span className="text-[10px] font-mono text-stone-500 block">{customerPhone || 'Walk-in Guest'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">Stylist / Barber</span>
                  <span className="font-bold text-stone-900 block truncate">{selectedDesigner?.name}</span>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold block">{commissionPercent}% Comm Rate</span>
                </div>
              </div>

              {/* Statement Receipt Card */}
              <div className="bg-emerald-950 text-white rounded-2xl p-4 space-y-3 font-mono text-xs">
                
                {/* Services Section */}
                <div className="space-y-1.5 pb-2 border-b border-emerald-800">
                  <div className="flex justify-between text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                    <span>Haircut Services ({selectedServices.length})</span>
                    <span>{formatPrice(totalServicesPrice)}</span>
                  </div>
                  {selectedServices.map((srv, idx) => (
                    <div key={srv.uid || idx} className="flex justify-between text-[11px] text-emerald-100 pl-2">
                      <span className="truncate">#{idx + 1} {srv.serviceName}</span>
                      <span className="shrink-0 ml-2 text-white">{formatPrice(srv.servicePrice)}</span>
                    </div>
                  ))}
                </div>

                {/* Retail Products Section */}
                {selectedRetailItems.length > 0 && (
                  <div className="space-y-1.5 pb-2 border-b border-emerald-800 text-emerald-200">
                    <div className="flex justify-between text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                      <span>POS Products ({selectedRetailItems.reduce((s, i) => s + i.quantity, 0)} pcs)</span>
                      <span>+{formatPrice(totalRetailPrice)}</span>
                    </div>
                    {selectedRetailItems.map((prod, idx) => (
                      <div key={prod.uid || idx} className="flex justify-between text-[11px] text-emerald-100 pl-2">
                        <span className="truncate">🛍️ {prod.quantity}x {prod.productName}</span>
                        <span className="shrink-0 ml-2 font-bold">{formatPrice(prod.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal & Discount breakdown */}
                <div className="space-y-1 text-[11px] text-emerald-200">
                  <div className="flex justify-between text-emerald-300/80">
                    <span>Total Service Duration:</span>
                    <span>{totalDurationMinutes} mins</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-300 font-bold">
                      <span>Discount / Promo Deduction:</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Customer Net Payable */}
                <div className="pt-2 border-t border-emerald-800 flex justify-between items-center">
                  <span className="text-xs text-emerald-200 font-black uppercase">Customer Net Payable:</span>
                  <span className="text-base font-black text-white">{formatPrice(netTotal)}</span>
                </div>

                {/* Payment & Stylist Commission Split Details */}
                <div className="bg-emerald-900/90 rounded-xl p-2.5 space-y-1 text-[11px] border border-emerald-800">
                  <div className="flex justify-between text-emerald-100">
                    <span className="text-emerald-300">Payment:</span>
                    <span className="font-bold capitalize text-white">
                      {paymentMethod.toUpperCase()} ({paymentStatus})
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-300">
                    <span>Stylist Commission:</span>
                    <span className="font-bold">+{formatPrice(totalStylistEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-200">
                    <span>Shop Net Take:</span>
                    <span className="font-bold text-white">{formatPrice(Math.max(0, netTotal - totalStylistEarnings))}</span>
                  </div>
                </div>

                {notes.trim() && (
                  <div className="text-[10px] text-emerald-300 pt-1">
                    <span className="font-bold text-white">Note:</span> {notes}
                  </div>
                )}
              </div>

              {/* Action Buttons: Cancel vs Confirm & Save */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-mono font-bold cursor-pointer transition-colors"
                >
                  {lang === 'my' ? 'ပြန်လည်ပြင်ဆင်မည် (Edit)' : 'Back / Edit'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmedSubmit}
                  disabled={loading}
                  className="flex-1 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin text-xs">⌛</span>
                      <span>{lang === 'my' ? 'သိမ်းဆည်းနေပါသည်...' : 'Saving to Database...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-200" />
                      <span>{lang === 'my' ? 'အတည်ပြု သိမ်းဆည်းမည် (Confirm Save)' : 'Confirm & Save Record'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
