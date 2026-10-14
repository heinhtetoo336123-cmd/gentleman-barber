import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, X, User, Calendar, Clock, Scissors, CheckCircle2, AlertCircle, RefreshCw, MessageSquare, ChevronRight, Phone, MapPin, Check, Loader2, Edit3 } from 'lucide-react';
import { triggerHapticFeedback } from '../utils/haptics';
import { formatPrice } from '../utils/formatters';
import { Service, Designer, Booking } from '../types';
import { api } from '../api/client';

interface AiBookingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  designers: Designer[];
  lang?: 'en' | 'my';
  initialPhone?: string;
  initialName?: string;
  shopPhone?: string;
  onBookingCreated?: (booking: Booking) => void;
}

export interface InteractiveButton {
  label: string;
  actionText: string;
  type?: 'quick_reply' | 'book_service' | 'select_barber';
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'booking_confirm';
    data: {
      customerName: string;
      customerPhone: string;
      serviceName: string;
      serviceId: string;
      designerName: string;
      designerId: string;
      date: string;
      timeSlot: string;
      price: number;
    };
  };
  interactiveButtons?: InteractiveButton[];
  bookingSubmitted?: boolean;
}

/**
 * Helper to parse relative Burmese date terms into YYYY-MM-DD
 */
function parseBurmeseDate(text: string): { targetDate: string; label: string } {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes('မနက်ဖြန်') || lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return { targetDate: `${yyyy}-${mm}-${dd}`, label: 'မနက်ဖြန်' };
  }

  if (lower.includes('သဖန်းနေ့') || lower.includes('သဘက်ခါ')) {
    const afterTomorrow = new Date(now);
    afterTomorrow.setDate(now.getDate() + 2);
    const yyyy = afterTomorrow.getFullYear();
    const mm = String(afterTomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(afterTomorrow.getDate()).padStart(2, '0');
    return { targetDate: `${yyyy}-${mm}-${dd}`, label: 'သဘက်ခါ' };
  }

  // Default to today
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return { targetDate: `${yyyy}-${mm}-${dd}`, label: 'ဒီနေ့' };
}

/**
 * Helper to parse Burmese hour phrases into formatted 12-hour slots
 */
function parseBurmeseTimeSlot(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('၉') || lower.includes('9')) return '09:00 AM';
  if (lower.includes('၁၀') || lower.includes('10')) return '10:00 AM';
  if (lower.includes('၁၁') || lower.includes('11')) return '11:00 AM';
  if (lower.includes('၁၂') || lower.includes('12')) return '12:00 PM';
  if (lower.includes('၁ နာရီ') || lower.includes('1 နာရီ') || lower.includes('01:00') || lower.includes('1:00')) return '01:00 PM';
  if (lower.includes('၂ နာရီ') || lower.includes('2 နာရီ') || lower.includes('02:00') || lower.includes('2:00')) return '02:00 PM';
  if (lower.includes('၃ နာရီ') || lower.includes('3 နာရီ') || lower.includes('03:00') || lower.includes('3:00')) return '03:00 PM';
  if (lower.includes('၄ နာရီ') || lower.includes('4 နာရီ') || lower.includes('04:00') || lower.includes('4:00')) return '04:00 PM';
  if (lower.includes('၅ နာရီ') || lower.includes('5 နာရီ') || lower.includes('05:00') || lower.includes('5:00')) return '05:00 PM';
  if (lower.includes('၆ နာရီ') || lower.includes('6 နာရီ') || lower.includes('06:00') || lower.includes('6:00')) return '06:00 PM';

  return '04:00 PM'; // Default
}

// Helpers to strictly match requested service & designer from user input
function findBestMatchingService(msg: string, servicesList: Service[]): Service | null {
  if (!servicesList || servicesList.length === 0) return null;
  const lower = (msg || '').toLowerCase().trim();

  let bestMatch: Service | null = null;
  let bestScore = 0;

  for (const s of servicesList) {
    const sNameLower = (s.name || '').toLowerCase();
    let score = 0;

    if (lower.includes(sNameLower)) {
      score += 100 + sNameLower.length;
    }

    const words = sNameLower.split(/[\s+\-/,&]+/);
    for (const word of words) {
      if (word.length >= 3 && lower.includes(word)) {
        score += 20;
      }
    }

    if ((lower.includes('ဆံပင်ညှပ်') || lower.includes('ညှပ်')) && (sNameLower.includes('haircut') || sNameLower.includes('cut'))) score += 30;
    if ((lower.includes('လျှော်') || lower.includes('ခေါင်းလျှော်')) && (sNameLower.includes('shampoo') || sNameLower.includes('wash'))) score += 30;
    if ((lower.includes('ဆေးဆိုး') || lower.includes('ဆေး')) && (sNameLower.includes('color') || sNameLower.includes('dye'))) score += 30;
    if ((lower.includes('ပါမ်') || lower.includes('ကောက်')) && (sNameLower.includes('perm') || sNameLower.includes('wave'))) score += 30;
    if ((lower.includes('မျက်နှာ') || lower.includes('ဖရှယ်')) && (sNameLower.includes('facial') || sNameLower.includes('treatment'))) score += 30;
    if ((lower.includes('မုတ်ဆိတ်') || lower.includes('ပါးသိုင်း')) && (sNameLower.includes('beard') || sNameLower.includes('shave'))) score += 30;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = s;
    }
  }

  return bestScore > 0 ? bestMatch : servicesList[0];
}

function findBestMatchingDesigner(msg: string, designersList: Designer[]): Designer | null {
  if (!designersList || designersList.length === 0) return null;
  const lower = (msg || '').toLowerCase().trim();

  let bestMatch: Designer | null = null;
  let bestScore = 0;

  for (const d of designersList) {
    const dNameLower = (d.name || '').toLowerCase();
    let score = 0;

    if (lower.includes(dNameLower)) {
      score += 100 + dNameLower.length;
    }

    const words = dNameLower.split(/\s+/);
    for (const word of words) {
      if (word.length >= 2 && lower.includes(word)) {
        score += 20;
      }
    }

    if ((lower.includes('zay') || lower.includes('ဇေ')) && (dNameLower.includes('zay') || dNameLower.includes('ဇေ'))) score += 50;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = d;
    }
  }

  if (bestScore > 0) return bestMatch;
  const zay = designersList.find((d) => (d.name || '').toLowerCase().includes('zay'));
  return zay || designersList[0];
}

export const AiBookingAssistantModal: React.FC<AiBookingAssistantModalProps> = ({
  isOpen,
  onClose,
  services,
  designers,
  lang = 'my',
  initialPhone = '',
  initialName = '',
  shopPhone = '09263188228',
  onBookingCreated,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittingBookingId, setSubmittingBookingId] = useState<string | null>(null);

  // Persistent localStorage memory for customer details with clean non-sample defaults
  const [cardName, setCardName] = useState(() => {
    try {
      const saved = localStorage.getItem('baba_booking_customer_name');
      if (saved && saved.trim() && !saved.includes('မောင်မောင်')) return saved.trim();
      if (initialName && initialName.trim() && !initialName.includes('မောင်မောင်')) return initialName.trim();
      const profile = localStorage.getItem('baba_user_profile_v1');
      if (profile) {
        const parsed = JSON.parse(profile);
        if (parsed.name && parsed.name.trim() && !parsed.name.includes('မောင်မောင်')) return parsed.name.trim();
      }
    } catch {}
    return 'Your Name';
  });

  const [cardPhone, setCardPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('baba_booking_customer_phone');
      if (saved && saved.trim()) return saved.trim();
      if (initialPhone && initialPhone.trim()) return initialPhone.trim();
      const profile = localStorage.getItem('baba_user_profile_v1');
      if (profile) {
        const parsed = JSON.parse(profile);
        if (parsed.phone && parsed.phone.trim()) return parsed.phone.trim();
      }
    } catch {}
    return '09********';
  });

  // Live Firestore fetched data
  const [liveServices, setLiveServices] = useState<Service[]>(services || []);
  const [liveDesigners, setLiveDesigners] = useState<Designer[]>(designers || []);

  useEffect(() => {
    if (initialName.trim() && !initialName.includes('မောင်မောင်')) setCardName(initialName.trim());
    if (initialPhone.trim()) setCardPhone(initialPhone.trim());
  }, [initialName, initialPhone]);

  // Save changes to localStorage automatically
  const handleNameChange = (val: string) => {
    setCardName(val);
    try {
      localStorage.setItem('baba_booking_customer_name', val);
    } catch {}
  };

  const handlePhoneChange = (val: string) => {
    setCardPhone(val);
    try {
      localStorage.setItem('baba_booking_customer_phone', val);
    } catch {}
  };

  // Fetch live Firestore services & designers on modal open if needed
  useEffect(() => {
    if (isOpen) {
      api.getServices().then((srvs) => {
        if (srvs && srvs.length > 0) setLiveServices(srvs);
      }).catch(console.error);

      api.getDesigners().then((des) => {
        if (des && des.length > 0) setLiveDesigners(des);
      }).catch(console.error);
    }
  }, [isOpen]);

  // STRICT PURE FIRESTORE DATA: Never fallback to fake/sample arrays
  const activeServices = useMemo(() => {
    const list = (liveServices && liveServices.length > 0) ? liveServices : (services || []);
    return list.filter((s) => s.active !== false);
  }, [liveServices, services]);

  const activeDesigners = useMemo(() => {
    return (liveDesigners && liveDesigners.length > 0) ? liveDesigners : (designers || []);
  }, [liveDesigners, designers]);

  const defaultButtons: InteractiveButton[] = useMemo(() => [
    { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
    { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
    { label: '📅 မနက်ဖြန် ၉ နာရီ ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
    { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
  ], []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: `မင်္ဂလာပါ ${cardName && cardName !== 'Your Name' ? cardName : 'ဧည့်သည်တော်'} ခင်ဗျာ! 💈 GTM AGENT မှ ကြိုဆိုပါတယ်။\n\n` +
            `ဆံပင်ညှပ် ဝန်ဆောင်မှု ဈေးနှုန်းများ မေးမြန်းရန် သို့မဟုတ် အောက်ပါ ခလုတ်များကို နှိပ်၍ တိုက်ရိုက် ဘိုကင် ရယူနိုင်ပါတယ်ခင်ဗျာ။`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      interactiveButtons: defaultButtons,
    },
  ]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading, submittingBookingId]);

  const quickPrompts = [
    '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ',
    '✂️ Barber များ စာရင်း',
    '📅 မနက်ဖြန် ၉ နာရီ ဘိုကင်',
    '📍 ဆိုင်လိပ်စာနှင့် Hotline',
  ];

  // Helper to dynamically update a message's booking card fields when user changes dropdowns
  const handleCardFieldChange = (msgId: string, updates: Partial<NonNullable<ChatMessage['suggestedAction']>['data']>) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.suggestedAction) {
          const currentData = m.suggestedAction.data;
          const updatedData = { ...currentData, ...updates };

          if (updates.serviceId) {
            const srv = activeServices.find((s) => s.id === updates.serviceId);
            if (srv) {
              updatedData.serviceName = srv.name;
              updatedData.price = srv.price;
            }
          }

          if (updates.designerId) {
            const des = activeDesigners.find((d) => d.id === updates.designerId);
            if (des) {
              updatedData.designerName = des.name;
            }
          }

          return {
            ...m,
            suggestedAction: {
              ...m.suggestedAction,
              data: updatedData,
            },
          };
        }
        return m;
      })
    );
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    triggerHapticFeedback('light');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: messages.slice(-8).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }],
          })),
          context: {
            customerName: cardName,
            customerPhone: cardPhone,
            shopPhone: shopPhone,
            services: activeServices.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.durationMinutes })),
            designers: activeDesigners.map((d) => ({ id: d.id, name: d.name, title: d.title, rating: d.rating })),
          },
        }),
      });

      const data = await response.json();

      if (data && data.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction: data.suggestedAction,
          interactiveButtons: data.interactiveButtons || defaultButtons,
        };
        setMessages((prev) => [...prev, aiMsg]);
        triggerHapticFeedback('medium');
      } else {
        throw new Error('Invalid response from AI server');
      }
    } catch (err) {
      console.warn('GTM AGENT chat error, dynamic intent fallback:', err);
      const lower = textToSend.toLowerCase();
      let fallbackText = '';
      let suggestedAction: ChatMessage['suggestedAction'] = undefined;
      let interactiveButtons: InteractiveButton[] = defaultButtons;

      const dateParsed = parseBurmeseDate(textToSend);
      const timeParsed = parseBurmeseTimeSlot(textToSend);

      // Check if user asks for specific booking, date, or time
      if (
        lower.includes('တင်လို့ရ') ||
        lower.includes('ရမလား') ||
        lower.includes('ဘိုကင်') ||
        lower.includes('book') ||
        lower.includes('တင်မယ်') ||
        lower.includes('တင်ပေး') ||
        lower.includes('မနက်ဖြန်') ||
        lower.includes('ဒီနေ့') ||
        lower.includes('နာရီ')
      ) {
        if (activeServices.length === 0 || activeDesigners.length === 0) {
          fallbackText = `မင်္ဂလာပါ ${cardName} ခင်ဗျာ! 💈 လက်ရှိတွင် Firestore Database ထဲတွင် ဝန်ဆောင်မှု သို့မဟုတ် Barber စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါသဖြင့် ဘိုကင် တင်၍ မရသေးပါခင်ဗျာ။`;
          interactiveButtons = [
            { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ];
        } else {
          const matchedService = findBestMatchingService(textToSend, activeServices) || activeServices[0];
          const matchedDesigner = findBestMatchingDesigner(textToSend, activeDesigners) || activeDesigners[0];

          fallbackText = `ဟုတ်ကဲ့ ရပါတယ်ခင်ဗျာ! **${dateParsed.label} (${dateParsed.targetDate}) ${timeParsed}** တွင် **${matchedService.name}** ဝန်ဆောင်မှုကို **${matchedDesigner.name}** ဖြင့် ဘိုကင်တင်ပေးရမလားခင်ဗျာ။\n\nအောက်ပါ အနှစ်ချုပ် ကတ်တွင် အချက်အလက်များ စစ်ဆေးပြီး **'အတည်ပြုပြီး ဘိုကင်တင်မည်'** ကို နှိပ်နိုင်ပါတယ်ခင်ဗျာ:`;

          suggestedAction = {
            type: 'booking_confirm',
            data: {
              customerName: cardName,
              customerPhone: cardPhone,
              serviceName: matchedService.name,
              serviceId: matchedService.id,
              designerName: matchedDesigner.name,
              designerId: matchedDesigner.id,
              date: dateParsed.targetDate,
              timeSlot: timeParsed,
              price: matchedService.price,
            },
          };

          interactiveButtons = [
            { label: '✏️ ဝန်ဆောင်မှု ပြောင်းမည်', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '✂️ Barber ပြောင်းမည်', actionText: 'အခြား barber ရှိလား' },
            { label: '⏰ မနက်ဖြန် အချိန်ပြောင်းမည်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
          ];
        }
      } else if (lower.includes('barber') || lower.includes('stylist') || lower.includes('ဒီဇိုင်နာ') || lower.includes('အခြား')) {
        if (activeDesigners.length === 0) {
          fallbackText = `💈 **GENTLEMAN BARBERSHOP လက်ရှိ Barber စာရင်း:**\n\nလက်ရှိတွင် Firestore Database ထဲ၌ Barber/Stylist စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါခင်ဗျာ။`;
          interactiveButtons = [
            { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ];
        } else {
          const barberListStr = activeDesigners.map((d) => `• **${d.name}** (${d.title || 'Barber'}) - Rating: ${(d.rating || 4.8).toFixed(1)}⭐️`).join('\n');
          fallbackText = `💈 **GENTLEMAN BARBERSHOP လက်ရှိ Barber စာရင်း (Firestore Live Data):**\n\n${barberListStr}\n\nမိမိနှစ်သက်ရာ Barber ခလုတ်ကို နှိပ်၍ သို့မဟုတ် ရက်စွဲ/အချိန် ပြောကြားပြီး ဘိုကင် တင်နိုင်ပါသည်ခင်ဗျာ။`;

          interactiveButtons = [
            ...activeDesigners.map((d) => ({
              label: `💈 ${d.name} နှင့် ဘိုကင်ယူမည်`,
              actionText: `${d.name} ဆရာနဲ့ ဘိုကင် တင်ပေးပါ`,
            })),
            { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '📅 မနက်ဖြန် ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
          ];
        }
      } else if (lower.includes('စျေး') || lower.includes('price') || lower.includes('ဝန်ဆောင်မှု') || lower.includes('ညှပ်')) {
        if (activeServices.length === 0) {
          fallbackText = `💈 **GENTLEMAN BARBERSHOP ဝန်ဆောင်မှု ဈေးနှုန်းများ:**\n\nလက်ရှိတွင် Firestore Database ထဲ၌ ဝန်ဆောင်မှု စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါခင်ဗျာ။`;
          interactiveButtons = [
            { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ];
        } else {
          const catalogStr = activeServices.map((s) => `• **${s.name}**: ${formatPrice(s.price)} (${s.durationMinutes} min)`).join('\n');
          fallbackText = `💈 **GENTLEMAN BARBERSHOP ဝန်ဆောင်မှု ဈေးနှုန်းများ (Firestore Live Data):**\n\n${catalogStr}\n\nဘိုကင်တင်လိုပါက ခလုတ်ကို နှိပ်ပါ သို့မဟုတ် အချိန်ကို ပြောကြားပေးပါခင်ဗျာ။`;

          interactiveButtons = [
            ...activeServices.map((s) => ({
              label: `✂️ ${s.name} ဘိုကင်ယူမည်`,
              actionText: `${s.name} ဝန်ဆောင်မှုအတွက် ဘိုကင် တင်ပေးပါ`,
            })),
            { label: '✂️ Barber စာရင်း ကြည့်မည်', actionText: 'အခြား barber ရှိလား' },
            { label: '📅 မနက်ဖြန် ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
          ];
        }
      } else if (lower.includes('လိပ်စာ') || lower.includes('location') || lower.includes('phone') || lower.includes('ဖုန်း')) {
        fallbackText = `📍 **GENTLEMAN BARBERSHOP လိပ်စာ:**\nမြိတ်မြို့၊ Market Garden (Room No. K7)\n📞 **Hotline:** ${shopPhone}\n⏰ **ဆိုင်ဖွင့်ချိန်:** နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀ ထိ`;
        interactiveButtons = [
          { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
          { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
          { label: '📅 ဘိုကင် တင်မည်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        ];
      } else {
        fallbackText = `မင်္ဂလာပါ ${cardName && cardName !== 'Your Name' ? cardName : 'ဧည့်သည်တော်'} ခင်ဗျာ! 💈 GTM AGENT မှ ကြိုဆိုပါတယ်။ ဆံပင်ညှပ် ဝန်ဆောင်မှု စေျးနှုန်းများ မေးမြန်းရန် သို့မဟုတ် ရက်စွဲ/အချိန် ပြောကြားပြီး တိုက်ရိုက် ဘိုကင် တင်နိုင်ပါတယ်ခင်ဗျာ။`;
        interactiveButtons = defaultButtons;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction,
          interactiveButtons,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmActionBooking = async (msgId: string, actionData: NonNullable<ChatMessage['suggestedAction']>['data']) => {
    triggerHapticFeedback('medium');
    setSubmittingBookingId(msgId);

    try {
      const matchService = activeServices.find((s) => s.id === actionData.serviceId || s.name.toLowerCase() === actionData.serviceName.toLowerCase()) || activeServices[0];
      const matchDesigner = activeDesigners.find((d) => d.id === actionData.designerId || d.name.toLowerCase() === actionData.designerName.toLowerCase()) || activeDesigners[0];

      const finalName = cardName.trim() && cardName.trim() !== 'Your Name' ? cardName.trim() : (actionData.customerName || 'Your Name');
      const finalPhone = cardPhone.trim() && cardPhone.trim() !== '09********' ? cardPhone.trim() : (actionData.customerPhone || '09********');

      const newBooking = await api.createBooking({
        serviceId: matchService?.id || 'srv-default',
        designerId: matchDesigner?.id || 'des-default',
        customerName: finalName,
        customerPhone: finalPhone,
        date: actionData.date || new Date().toISOString().split('T')[0],
        timeSlot: actionData.timeSlot || '04:00 PM',
        notes: 'Booked via GTM AGENT',
        paymentMethod: 'pay_at_shop',
      });

      triggerHapticFeedback('heavy');

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, bookingSubmitted: true } : m))
      );

      const successMsg: ChatMessage = {
        id: `ai-success-${Date.now()}`,
        sender: 'ai',
        text: lang === 'my'
          ? `🎉 **ဘိုကင် အောင်မြင်စွာ တင်ပြီးပါပြီခင်ဗျာ!**\n\n• ဘိုကင်ကုဒ်: **${newBooking.bookingCode}**\n• ဝန်ဆောင်မှု: ${newBooking.serviceName}\n• ဒီဇိုင်နာ: ${newBooking.designerName}\n• ရက်စွဲ/အချိန်: ${newBooking.date} (${newBooking.timeSlot})\n• ဧည့်သည်အမည်: ${newBooking.customerName}\n• ဖုန်းနံပါတ်: ${newBooking.customerPhone}\n\nဆိုင်တွင် ဝန်ဆောင်မှု ရယူချိန်တွင် ဘိုကင်ကုဒ် ပြသပေးပါခင်ဗျာ။ ကျေးဇူးတင်ပါတယ်ခင်ဗျာ!`
          : `🎉 **Booking Confirmed Successfully!**\n\n• Booking Code: **${newBooking.bookingCode}**\n• Service: ${newBooking.serviceName}\n• Stylist: ${newBooking.designerName}\n• Date & Time: ${newBooking.date} (${newBooking.timeSlot})\n• Customer: ${newBooking.customerName} (${newBooking.customerPhone})\n\nThank you for choosing GENTLEMAN Barber Lounge!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, successMsg]);

      if (onBookingCreated) {
        onBookingCreated(newBooking);
      }
    } catch (err: any) {
      console.error('GTM AGENT booking submission failed:', err);
      alert(err.message || 'ဘိုကင် တင်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။');
    } finally {
      setSubmittingBookingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col bg-stone-50 text-stone-900 font-sans pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-full overflow-hidden relative bg-stone-50"
        >
          {/* Full Screen Header */}
          <div className="px-4 py-3 bg-white border-b border-stone-200 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-2xs font-mono font-black text-sm">
                GTM
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-base uppercase tracking-wider text-stone-900 font-mono">
                    GTM AGENT
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-mono font-bold">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 font-sans font-medium">
                  {lang === 'my' ? 'GENTLEMAN AI Booking Concierge' : 'GENTLEMAN AI Booking Concierge'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHapticFeedback('light');
                onClose();
              }}
              className="p-2.5 rounded-2xl bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Full Screen Chat Stream */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start space-x-2.5 ${
                  m.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs font-mono font-bold text-xs mt-1">
                    GTM
                  </div>
                )}

                <div className="max-w-[88%] sm:max-w-[80%] space-y-2">
                  <div
                    className={`rounded-2xl p-4 text-xs sm:text-sm font-sans leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-emerald-700 text-white rounded-tr-xs shadow-2xs font-medium'
                        : 'bg-white border border-stone-200 text-stone-900 rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    <span
                      className={`text-[9px] font-mono block mt-2 ${
                        m.sender === 'user' ? 'text-emerald-200 text-right' : 'text-stone-400'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>

                  {/* Interactive Action Buttons attached to AI Message */}
                  {m.sender === 'ai' && m.interactiveButtons && m.interactiveButtons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.interactiveButtons.map((btn, btnIdx) => (
                        <button
                          key={btnIdx}
                          disabled={loading}
                          type="button"
                          onClick={() => handleSendMessage(btn.actionText)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 text-xs font-sans font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                        >
                          <span>{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Interactive Light Summary Card with Editable Dropdowns for Service, Barber, Date & Time */}
                  {m.suggestedAction && m.suggestedAction.type === 'booking_confirm' && (
                    <div className="bg-white border border-emerald-300 rounded-2xl p-4 shadow-sm space-y-3 text-stone-900 text-xs text-left">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                        <span className="font-mono font-black text-xs uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                          <Scissors className="w-4 h-4 text-emerald-700" />
                          <span>{lang === 'my' ? 'ဘိုကင် အချက်အလက်များ' : 'Booking Confirmation'}</span>
                        </span>
                        {m.suggestedAction.data.price && (
                          <span className="font-mono font-black text-sm text-emerald-800">
                            {formatPrice(m.suggestedAction.data.price)}
                          </span>
                        )}
                      </div>

                      {/* Customer Name & Phone Refill Inputs with localStorage Persistence */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <div>
                          <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block mb-1">
                            {lang === 'my' ? 'ဧည့်သည်အမည် (Name)' : 'Customer Name'}
                          </label>
                          <input
                            type="text"
                            placeholder="Your Name"
                            value={cardName}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block mb-1">
                            {lang === 'my' ? 'ဖုန်းနံပါတ် (Phone)' : 'Customer Phone'}
                          </label>
                          <input
                            type="tel"
                            placeholder="09********"
                            value={cardPhone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>

                      {/* Interactive Dropdowns for Service & Barber Selection */}
                      <div className="space-y-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/80">
                        <div>
                          <label className="text-[10px] font-mono font-bold text-emerald-900 uppercase block mb-1">
                            {lang === 'my' ? 'ဝန်ဆောင်မှု ရွေးချယ်ရန် (Service)' : 'Select Service'}
                          </label>
                          <select
                            value={m.suggestedAction.data.serviceId}
                            onChange={(e) => handleCardFieldChange(m.id, { serviceId: e.target.value })}
                            className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                          >
                            {activeServices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({formatPrice(s.price)})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-emerald-900 uppercase block mb-1">
                            {lang === 'my' ? 'ဒီဇိုင်နာ ရွေးချယ်ရန် (Barber)' : 'Select Barber'}
                          </label>
                          <select
                            value={m.suggestedAction.data.designerId}
                            onChange={(e) => handleCardFieldChange(m.id, { designerId: e.target.value })}
                            className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                          >
                            {activeDesigners.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.title || 'Barber'}) - {(d.rating || 4.8).toFixed(1)}⭐️
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-mono font-bold text-emerald-900 uppercase block mb-1">
                              {lang === 'my' ? 'ရက်စွဲ (Date)' : 'Date'}
                            </label>
                            <input
                              type="date"
                              value={m.suggestedAction.data.date}
                              onChange={(e) => handleCardFieldChange(m.id, { date: e.target.value })}
                              className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-emerald-600"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-mono font-bold text-emerald-900 uppercase block mb-1">
                              {lang === 'my' ? 'အချိန် (Time Slot)' : 'Time Slot'}
                            </label>
                            <select
                              value={m.suggestedAction.data.timeSlot}
                              onChange={(e) => handleCardFieldChange(m.id, { timeSlot: e.target.value })}
                              className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                            >
                              {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'].map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {m.bookingSubmitted ? (
                        <div className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold py-2.5 rounded-xl text-center flex items-center justify-center space-x-1.5 font-mono text-xs">
                          <Check className="w-4 h-4 text-emerald-700" />
                          <span>{lang === 'my' ? 'ဘိုကင် တင်ပြီးပါပြီ' : 'Confirmed'}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={submittingBookingId === m.id}
                          onClick={() => handleConfirmActionBooking(m.id, m.suggestedAction!.data)}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-70 font-mono text-xs mt-1"
                        >
                          {submittingBookingId === m.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>{lang === 'my' ? 'ဘိုကင် တင်နေပါသည်...' : 'Confirming...'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span>{lang === 'my' ? 'အတည်ပြုပြီး ဘိုကင်တင်မည်' : 'Confirm Booking'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {m.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center shrink-0 shadow-2xs text-xs font-bold mt-1">
                    <User className="w-4 h-4 text-stone-600" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  GTM
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-xs p-3.5 text-xs text-stone-500 flex items-center space-x-2 shadow-2xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  <span>{lang === 'my' ? 'GTM AGENT စာပြန်နေပါသည်...' : 'GTM AGENT is typing...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-3 bg-white border-t border-stone-200 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center space-x-2">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSendMessage(prompt)}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 text-xs font-sans font-medium transition-all shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3.5 bg-white border-t border-stone-200 flex items-center space-x-2 shrink-0"
          >
            <input
              type="text"
              placeholder={lang === 'my' ? 'GTM AGENT သို့ စာရိုက်မေးမြန်းပါ...' : 'Ask GTM AGENT or book an appointment...'}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600 font-sans"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="px-4 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold font-sans flex items-center justify-center space-x-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
