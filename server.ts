import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit } from "firebase/firestore";
import { Service, Designer, Booking, NotificationItem, BookingStatus, AppStats, PaymentSettings, UserProfile, PromoCode } from "./src/types.js";

const STORE_FILE = path.join(process.cwd(), 'data', 'store.json');

const INITIAL_SETTINGS: PaymentSettings = {
  kpayAccountName: "BABA BARBER SHOP",
  kpayNumber: "09263188228",
  waveAccountName: "BABA BARBER SHOP",
  waveNumber: "09263188228",
  viberLink: "https://viber.click/959263188228",
  viberPhone: "09263188228",
  shopPhone: "09263188228",
  shopAddress: "No. 123, Pyay Road, Kamayut Township, Yangon",
};

const INITIAL_PROMOS: PromoCode[] = [];
const INITIAL_CLIENTS: UserProfile[] = [];

function loadStoreFromFile() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return {
        services: Array.isArray(data.services) ? data.services : [],
        designers: Array.isArray(data.designers) ? data.designers : [],
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        settings: data.settings ? { ...INITIAL_SETTINGS, ...data.settings } : { ...INITIAL_SETTINGS },
        clients: Array.isArray(data.clients) ? data.clients : [],
        promos: Array.isArray(data.promos) ? data.promos : [],
      };
    }
  } catch (e) {
    console.warn("Could not read store.json, using empty store.", e);
  }
  return {
    services: [],
    designers: [],
    bookings: [],
    notifications: [],
    settings: { ...INITIAL_SETTINGS },
    clients: [],
    promos: [],
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Domain Redirection: Forward babashop-booking-sys.ai.studio to official custom domain
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (host.includes('babashop-booking-sys.ai.studio')) {
      return res.redirect(301, `https://gentlemanbarbershopmyeikbooking.com${req.originalUrl}`);
    }
    next();
  });

  app.use(express.json());

  // In-memory data store synchronized with disk storage
  const initialStore = loadStoreFromFile();
  let services: Service[] = initialStore.services;
  let designers: Designer[] = initialStore.designers;
  let bookings: Booking[] = initialStore.bookings;
  let notifications: NotificationItem[] = initialStore.notifications;
  let settings: PaymentSettings = initialStore.settings;
  let clients: UserProfile[] = initialStore.clients;
  let promos: PromoCode[] = initialStore.promos;

  function saveStoreToFile() {
    try {
      const dir = path.dirname(STORE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        STORE_FILE,
        JSON.stringify(
          {
            services,
            designers,
            bookings,
            notifications,
            settings,
            clients,
            promos,
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (e) {
      console.error("Error writing data to store.json:", e);
    }
  }

  // Helper to trigger notification
  function addNotification(
    title: string,
    message: string,
    type: NotificationItem['type'],
    forRole: 'admin' | 'user' | 'all',
    bookingId?: string,
    customerName?: string,
    customerPhone?: string
  ) {
    const notif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      bookingId,
      forRole,
      customerName,
      customerPhone,
    };
    notifications.unshift(notif);
    return notif;
  }

  // API ROUTES
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", appName: "BABASHOP Booking Engine" });
  });

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
    const zay = designersList.find(d => (d.name || '').toLowerCase().includes('zay'));
    return zay || designersList[0];
  }

  // Helper for dynamic Burmese intent responses & booking action cards
  function getSmartIntentResponse(message: string, servicesList: Service[], designersList: Designer[], context?: any) {
    const lower = (message || '').toLowerCase();
    const now = new Date();
    
    // Date Parsing
    let targetDateStr = now.toISOString().split('T')[0];
    let dateLabel = 'ဒီနေ့';
    if (lower.includes('မနက်ဖြန်') || lower.includes('tomorrow')) {
      const tmr = new Date(now);
      tmr.setDate(now.getDate() + 1);
      targetDateStr = tmr.toISOString().split('T')[0];
      dateLabel = 'မနက်ဖြန်';
    } else if (lower.includes('သဖန်းနေ့') || lower.includes('သဘက်ခါ')) {
      const aft = new Date(now);
      aft.setDate(now.getDate() + 2);
      targetDateStr = aft.toISOString().split('T')[0];
      dateLabel = 'သဘက်ခါ';
    }

    // Time Slot Parsing
    let targetSlot = '04:00 PM';
    if (lower.includes('၉') || lower.includes('9')) targetSlot = '09:00 AM';
    else if (lower.includes('၁၀') || lower.includes('10')) targetSlot = '10:00 AM';
    else if (lower.includes('၁၁') || lower.includes('11')) targetSlot = '11:00 AM';
    else if (lower.includes('၁၂') || lower.includes('12')) targetSlot = '12:00 PM';
    else if (lower.includes('၁ နာရီ') || lower.includes('1 နာရီ') || lower.includes('01:00')) targetSlot = '01:00 PM';
    else if (lower.includes('၂ နာရီ') || lower.includes('2 နာရီ') || lower.includes('02:00')) targetSlot = '02:00 PM';
    else if (lower.includes('၃ နာရီ') || lower.includes('3 နာရီ') || lower.includes('03:00')) targetSlot = '03:00 PM';
    else if (lower.includes('၄ နာရီ') || lower.includes('4 နာရီ') || lower.includes('04:00')) targetSlot = '04:00 PM';
    else if (lower.includes('၅ နာရီ') || lower.includes('5 နာရီ') || lower.includes('05:00')) targetSlot = '05:00 PM';
    else if (lower.includes('၆ နာရီ') || lower.includes('6 နာရီ') || lower.includes('06:00')) targetSlot = '06:00 PM';

    const rawClientName = context?.customerName || '';
    const clientName = (rawClientName && !rawClientName.includes('မောင်မောင်')) ? rawClientName : 'Your Name';
    const clientPhone = context?.customerPhone || '09********';

    // STRICT PURE FIRESTORE DATA: Never fallback to fake/sample items
    const activeServices = (context?.services && Array.isArray(context.services) && context.services.length > 0)
      ? context.services
      : ((servicesList && servicesList.length > 0) ? servicesList : services);

    const activeDesigners = (context?.designers && Array.isArray(context.designers) && context.designers.length > 0)
      ? context.designers
      : ((designersList && designersList.length > 0) ? designersList : designers);

    const matchedService = findBestMatchingService(message, activeServices);
    const matchedDesigner = findBestMatchingDesigner(message, activeDesigners);

    // 1. Booking / Availability Query Intent ("မနက်ဖြန် ၉ နာရီ ရလား", "တင်လို့ရလား", "ဘိုကင်")
    if (
      lower.includes('တင်လို့ရ') ||
      lower.includes('ရမလား') ||
      lower.includes('ဘိုကင်') ||
      lower.includes('book') ||
      lower.includes('တင်မယ်') ||
      lower.includes('တင်ပေး') ||
      lower.includes('ယူမယ်') ||
      lower.includes('ရပါသလား') ||
      lower.includes('မနက်ဖြန်') ||
      lower.includes('ဒီနေ့') ||
      lower.includes('နာရီ')
    ) {
      if (!matchedService || !matchedDesigner) {
        return {
          reply: `မင်္ဂလာပါ ${clientName} ခင်ဗျာ! 💈 လက်ရှိတွင် Firestore Database ထဲတွင် ဝန်ဆောင်မှု သို့မဟုတ် Barber စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါသဖြင့် ဘိုကင် တင်၍ မရသေးပါခင်ဗျာ။ ဆိုင်ရှင်မှ ဝန်ဆောင်မှုနှင့် Barber အချက်အလက်များ ထည့်သွင်းပြီးပါက ဘိုကင် တင်နိုင်ပါပြီခင်ဗျာ။`,
          interactiveButtons: [
            { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ]
        };
      }

      return {
        reply: `ဟုတ်ကဲ့ ရပါတယ်ခင်ဗျာ! **${dateLabel} (${targetDateStr}) ${targetSlot}** တွင် **${matchedService.name}** ဝန်ဆောင်မှုကို **${matchedDesigner.name}** ဖြင့် ဘိုကင်တင်ပေးရမလားခင်ဗျာ။\n\nအောက်ပါ အနှစ်ချုပ် ကတ်တွင် အချက်အလက်များ စစ်ဆေးပြီး **'အတည်ပြုပြီး ဘိုကင်တင်မည်'** ကို နှိပ်နိုင်ပါတယ်ခင်ဗျာ:`,
        suggestedAction: {
          type: 'booking_confirm',
          data: {
            customerName: clientName,
            customerPhone: clientPhone,
            serviceName: matchedService.name,
            serviceId: matchedService.id,
            designerName: matchedDesigner.name,
            designerId: matchedDesigner.id,
            date: targetDateStr,
            timeSlot: targetSlot,
            price: matchedService.price || 0,
          }
        },
        interactiveButtons: [
          { label: '✏️ ဝန်ဆောင်မှု ပြောင်းမည်', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
          { label: '✂️ Barber ပြောင်းမည်', actionText: 'အခြား barber ရှိလား' },
          { label: '⏰ မနက်ဖြန် အချိန်ပြောင်းမည်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        ]
      };
    }

    // 2. Barbers Query Intent ("အခြား barber ရှိလား", "zay", "ko zay", "barber", "stylist")
    if (
      lower.includes('barber') ||
      lower.includes('stylist') ||
      lower.includes('ဒီဇိုင်နာ') ||
      lower.includes('အခြား') ||
      lower.includes('ဆရာ')
    ) {
      if (!activeDesigners || activeDesigners.length === 0) {
        return {
          reply: `💈 **GENTLEMAN BARBERSHOP လက်ရှိ Barber စာရင်း:**\n\nလက်ရှိတွင် Firestore Database ထဲ၌ Barber/Stylist စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါခင်ဗျာ။`,
          interactiveButtons: [
            { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ]
        };
      }

      const stylistsStr = activeDesigners.map((d: any) => `• **${d.name}** (${d.title || 'Barber'}) - Rating: ${d.rating || 4.8}⭐️`).join('\n');
      const barberButtons = activeDesigners.map((d: any) => ({
        label: `💈 ${d.name} နှင့် ဘိုကင်ယူမည်`,
        actionText: `${d.name} ဆရာနဲ့ ဘိုကင် တင်ပေးပါ`,
      }));

      return {
        reply: `💈 **GENTLEMAN BARBERSHOP လက်ရှိ Barber စာရင်း (Firestore Live Data):**\n\n${stylistsStr}\n\nမိမိနှစ်သက်ရာ Barber ခလုတ်ကို နှိပ်၍ သို့မဟုတ် အောက်ပါ ရက်စွဲ/အချိန် ပြောကြားပြီး ဘိုကင် တင်နိုင်ပါသည်ခင်ဗျာ။`,
        interactiveButtons: [
          ...barberButtons,
          { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
          { label: '📅 မနက်ဖြန် ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        ]
      };
    }

    // 3. Services & Pricing Intent ("စျေး", "price", "ဝန်ဆောင်မှု", "ခေါင်းလျှော်", "ညှပ်")
    if (
      lower.includes('စျေး') ||
      lower.includes('price') ||
      lower.includes('ဝန်ဆောင်မှု') ||
      lower.includes('ခေါင်းလျှော်') ||
      lower.includes('ညှပ်') ||
      lower.includes('service')
    ) {
      if (!activeServices || activeServices.length === 0) {
        return {
          reply: `💈 **GENTLEMAN BARBERSHOP ဝန်ဆောင်မှု မာတိကာ:**\n\nလက်ရှိတွင် Firestore Database ထဲ၌ ဝန်ဆောင်မှု စာရင်း ထည့်သွင်းထားခြင်း မရှိသေးပါခင်ဗျာ။`,
          interactiveButtons: [
            { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
            { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
          ]
        };
      }

      const catalogStr = activeServices.map((s: any) => `• **${s.name}**: ${(s.price || 0).toLocaleString()} MMK (${s.durationMinutes || 45} min)`).join('\n');
      const serviceButtons = activeServices.map((s: any) => ({
        label: `✂️ ${s.name} ဘိုကင်ယူမည်`,
        actionText: `${s.name} ဝန်ဆောင်မှုအတွက် ဘိုကင် တင်ပေးပါ`,
      }));

      return {
        reply: `💈 **GENTLEMAN BARBERSHOP ဝန်ဆောင်မှု ဈေးနှုန်းများ (Firestore Live Data):**\n\n${catalogStr}\n\nလိုလားသော ဝန်ဆောင်မှု ခလုတ်ကို နှိပ်ပါ သို့မဟုတ် ဘိုကင်တင်လိုသည့် အချိန်ကို ပြောပြပေးပါခင်ဗျာ။`,
        interactiveButtons: [
          ...serviceButtons,
          { label: '✂️ Barber စာရင်း ကြည့်မည်', actionText: 'အခြား barber ရှိလား' },
          { label: '📅 မနက်ဖြန် ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        ]
      };
    }

    const shopPhoneNum = context?.shopPhone || settings?.shopPhone || "09263188228";

    // 4. Location & Contact Intent ("လိပ်စာ", "ဖုန်း", "location", "address", "phone")
    if (
      lower.includes('လိပ်စာ') ||
      lower.includes('ဖုန်း') ||
      lower.includes('location') ||
      lower.includes('address') ||
      lower.includes('phone')
    ) {
      return {
        reply: `📍 **GENTLEMAN BARBERSHOP လိပ်စာ:**\nမြိတ်မြို့၊ Market Garden (Room No. K7)\n\n📞 **Hotline:** ${shopPhoneNum}\n⏰ **ဆိုင်ဖွင့်ချိန်:** နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀ ထိ`,
        interactiveButtons: [
          { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
          { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
          { label: '📅 ဘိုကင် တင်မည်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        ]
      };
    }

    // Default Response
    return {
      reply: `မင်္ဂလာပါ ${clientName} ခင်ဗျာ! 💈 GTM AGENT မှ ကြိုဆိုပါတယ်။ ဆံပင်ညှပ် ဝန်ဆောင်မှု စေျးနှုန်းများ မေးမြန်းရန် သို့မဟုတ် ရက်စွဲ/အချိန် ပြောကြားပြီး တိုက်ရိုက် ဘိုကင် တင်နိုင်ပါတယ်ခင်ဗျာ။`,
      interactiveButtons: [
        { label: '💈 ဝန်ဆောင်မှု ဈေးနှုန်းများ', actionText: 'ဝန်ဆောင်မှု ဈေးနှုန်းများ' },
        { label: '✂️ Barber စာရင်း', actionText: 'အခြား barber ရှိလား' },
        { label: '📅 မနက်ဖြန် ၉ နာရီ ဘိုကင်', actionText: 'မနက်ဖြန် ၉ နာရီ ဘိုကင်' },
        { label: '📍 ဆိုင်လိပ်စာနှင့် Hotline', actionText: 'ဆိုင်လိပ်စာနဲ့ ဖုန်းနံပါတ်' },
      ]
    };
  }

  // Gemini AI Booking Concierge Route
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const isKeyValid = apiKey && apiKey.length > 15 && !apiKey.includes('YOUR_KEY') && apiKey !== 'undefined';

      if (!isKeyValid) {
        const smartRes = getSmartIntentResponse(message, services, designers, context);
        return res.json(smartRes);
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const activeServices = (context?.services && Array.isArray(context.services) && context.services.length > 0)
        ? context.services
        : services;

      const activeDesigners = (context?.designers && Array.isArray(context.designers) && context.designers.length > 0)
        ? context.designers
        : designers;

      const shopPhoneNum = context?.shopPhone || settings?.shopPhone || "09263188228";

      const catalogSummary = (activeServices && activeServices.length > 0)
        ? activeServices.map((s: any) => `• ${s.name}: ${s.price} MMK (${s.durationMinutes} min)`).join('\n')
        : 'No services listed in Firestore database yet.';

      const stylistsSummary = (activeDesigners && activeDesigners.length > 0)
        ? activeDesigners.map((d: any) => `• ${d.name} (${d.title || 'Barber'}) - Rating: ${d.rating || 4.8}`).join('\n')
        : 'No barbers listed in Firestore database yet.';

      const systemInstruction = `You are GTM AGENT, the smart, polite, and helpful AI Concierge for GENTLEMAN BARBERSHOP in Myeik (Market Garden, Room No. K7).
Your goal is to converse warmly with customers, answer questions about haircuts, services, and pricing strictly using the live Firestore catalog below.

CRITICAL DIRECTIVES:
1. NEVER INVENT, FABRICATE, OR FALLBACK TO SAMPLE/MOCK SERVICES OR BARBERS. Only use services and barbers explicitly provided in the live catalog below.
2. If the catalog or barbers list is empty, state clearly that no services/barbers are currently listed in Firestore.
3. Reply exclusively in polite, clear Burmese (with standard English barbershop terms like Fade Cut, Booking Code where appropriate).
4. Provide structured, clean replies with bullet points.
5. Encourage the user to tap interactive action buttons or specify date/time for booking.

LIVE SHOP CATALOG:
${catalogSummary}

LIVE STYLISTS ROSTER:
${stylistsSummary}

HOTLINE: ${shopPhoneNum}
OPENING HOURS: နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀ ထိ (09:00 AM - 07:00 PM)
ADDRESS: Market Garden (Room No. K7), Myeik.
`;

      const promptContents = [
        ...(Array.isArray(history) ? history : []),
        { role: 'user', parts: [{ text: message }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptContents as any,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || "💈 GENTLEMAN BARBERSHOP မှ ကြိုဆိုပါတယ်ခင်ဗျာ။ ဆံပင်ညှပ် ဝန်ဆောင်မှုများနှင့် ဘိုကင်အတွက် ကူညီပေးပါရစေ။";

      // Check if message triggers booking action card or interactive buttons
      const smartRes = getSmartIntentResponse(message, services, designers, context);
      res.json({
        reply: replyText,
        suggestedAction: smartRes.suggestedAction,
        interactiveButtons: smartRes.interactiveButtons,
      });
    } catch (_err) {
      const smartRes = getSmartIntentResponse(req.body?.message || '', services, designers, req.body?.context);
      res.json(smartRes);
    }
  });

  // Services CRUD
  app.get("/api/services", (_req, res) => {
    res.json(services);
  });

  app.post("/api/services", (req, res) => {
    const { name, category, price, durationMinutes, description, imageUrl, popular } = req.body;
    if (!name || !price || !durationMinutes) {
      return res.status(400).json({ error: "Missing required fields: name, price, durationMinutes" });
    }
    const newService: Service = {
      id: `srv-${Date.now()}`,
      name,
      category: category || 'Haircut',
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      description: description || '',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600',
      popular: Boolean(popular),
      active: true,
    };
    services.push(newService);
    
    // Notify admin
    addNotification(
      'Service Catalog Updated',
      `New service "${newService.name}" ($${newService.price}) added to catalog.`,
      'status_change',
      'admin'
    );

    saveStoreToFile();
    res.status(201).json(newService);
  });

  app.put("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const index = services.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Service not found" });
    }
    services[index] = { ...services[index], ...req.body };
    saveStoreToFile();
    res.json(services[index]);
  });

  app.delete("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const initialLen = services.length;
    services = services.filter(s => s.id !== id);
    if (services.length === initialLen) {
      return res.status(404).json({ error: "Service not found" });
    }
    saveStoreToFile();
    res.json({ success: true, message: "Service deleted successfully" });
  });

  // Designers CRUD
  app.get("/api/designers", (_req, res) => {
    res.json(designers);
  });

  app.post("/api/designers", (req, res) => {
    const { name, title, experienceYears, specialties, avatarUrl, bio, availableDays, workingHours } = req.body;
    if (!name || !title) {
      return res.status(400).json({ error: "Name and title are required" });
    }
    const newDesigner: Designer = {
      id: `des-${Date.now()}`,
      name,
      title,
      rating: 5.0,
      reviewsCount: 1,
      experienceYears: Number(experienceYears) || 3,
      specialties: Array.isArray(specialties) ? specialties : ['Fades', 'Styling'],
      avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
      bio: bio || 'Professional BABASHOP Stylist & Hair Artist.',
      availableDays: availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      workingHours: workingHours || { start: '09:00', end: '19:00' },
      featured: true,
    };
    designers.push(newDesigner);
    saveStoreToFile();
    res.status(201).json(newDesigner);
  });

  app.put("/api/designers/:id", (req, res) => {
    const { id } = req.params;
    const index = designers.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Designer not found" });
    }
    designers[index] = { ...designers[index], ...req.body };
    
    addNotification(
      `ဒီဇိုင်နာ အချက်အလက် ပြင်ဆင်ပြီး (${designers[index].name})`,
      `Designer profile "${designers[index].name}" was updated in the system.`,
      'status_change',
      'admin'
    );

    saveStoreToFile();
    res.json(designers[index]);
  });

  app.delete("/api/designers/:id", (req, res) => {
    const { id } = req.params;
    const initialLen = designers.length;
    const removedDesigner = designers.find(d => d.id === id);
    designers = designers.filter(d => d.id !== id);
    if (designers.length === initialLen) {
      return res.status(404).json({ error: "Designer not found" });
    }

    if (removedDesigner) {
      addNotification(
        `ဒီဇိုင်နာ စာရင်းမှ ပယ်ဖျက်ပြီး (${removedDesigner.name})`,
        `Designer "${removedDesigner.name}" has been removed from BABASHOP roster.`,
        'status_change',
        'admin'
      );
    }

    saveStoreToFile();
    res.json({ success: true, message: "Designer removed successfully" });
  });

  // Bookings CRUD
  app.get("/api/bookings", (_req, res) => {
    res.json(bookings);
  });

  // Direct Firestore Historical & Targeted Bookings Proxy (Fast, Quota-Safe, Strips Bloated Images)
  app.get("/api/firestore/bookings", async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query as {
        date?: string;
        startDate?: string;
        endDate?: string;
      };

      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        return res.status(404).json({ error: "Firebase configuration not found" });
      }

      const firestoreConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appInst = getApps().length === 0 ? initializeApp(firestoreConfig) : getApps()[0];
      const firestoreDb = getFirestore(appInst, firestoreConfig.firestoreDatabaseId);

      const bookingsCol = collection(firestoreDb, 'bookings');
      let q;

      if (date && date.trim()) {
        q = query(bookingsCol, where('date', '==', date.trim()));
      } else if (startDate && endDate) {
        q = query(bookingsCol, where('date', '>=', startDate.trim()), where('date', '<=', endDate.trim()));
      } else {
        q = query(bookingsCol, limit(50));
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => {
        const data = d.data();
        const cleaned: any = Object.assign({}, data, { id: d.id });
        // Strip huge base64 strings so client receives light payload in milliseconds
        if (typeof cleaned.designerAvatar === 'string' && cleaned.designerAvatar.startsWith('data:image')) {
          cleaned.designerAvatar = '';
        }
        if (typeof cleaned.paymentSlipUrl === 'string' && cleaned.paymentSlipUrl.startsWith('data:image')) {
          cleaned.paymentSlipUrl = '';
        }
        return cleaned;
      });

      res.json(docs);
    } catch (err: any) {
      console.warn("Firestore bookings proxy error:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch bookings from Firestore" });
    }
  });

  app.post("/api/bookings", (req, res) => {
    const {
      serviceId,
      designerId,
      customerName,
      customerPhone,
      customerEmail,
      date,
      timeSlot,
      notes,
      paymentMethod,
      paymentTxnId,
      discountAmount,
      pointsUsed
    } = req.body;

    if (!serviceId || !designerId || !customerName || !date || !timeSlot) {
      return res.status(400).json({ error: "Missing required booking details." });
    }

    const service = services.find(s => s.id === serviceId);
    const designer = designers.find(d => d.id === designerId);

    if (!service || !designer) {
      return res.status(404).json({ error: "Invalid service or designer selection." });
    }

    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `BABA-${codeNumber}`;
    const now = new Date().toISOString();

    const finalPrice = Math.max(0, service.price - (Number(discountAmount) || 0));
    // 30% Barber Commission
    const commissionAmount = Math.round(finalPrice * 0.30);

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      bookingCode,
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.durationMinutes,
      designerId: designer.id,
      designerName: designer.name,
      designerAvatar: designer.avatarUrl,
      customerName,
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      date,
      timeSlot,
      notes: notes || '',
      status: 'pending',
      paymentMethod: paymentMethod || 'pay_at_shop',
      paymentTxnId: paymentTxnId || '',
      paymentStatus: paymentMethod === 'kpay_wave' ? 'paid_advance' : 'unpaid',
      discountAmount: Number(discountAmount) || 0,
      pointsUsed: Number(pointsUsed) || 0,
      commissionAmount,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          note: 'Appointment requested by client'
        }
      ]
    };

    bookings.unshift(newBooking);

    // Trigger Admin Notification
    addNotification(
      `ဘိုကင်တင်သွင်းချက်အသစ် (${customerName})`,
      `${customerName} မှ ${service.name} ဝန်ဆောင်မှုကို ${designer.name} နှင့် ${date} ရက်နေ့ ${timeSlot} အချိန်အတွက် ဘိုကင်တင်သွင်းထားပါသည်။`,
      'new_booking',
      'admin',
      newBooking.id,
      customerName
    );

    // Trigger User Confirmation Notification
    addNotification(
      `ဘိုကင်တင်ပြီးပါပြီ (${bookingCode})`,
      `${service.name} ဝန်ဆောင်မှုကို ${date} ရက်နေ့ ${timeSlot} အတွက် ဘိုကင်တင်သွင်းပြီးပါပြီ။ ဒီဇိုင်နာ အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။`,
      'new_booking',
      'user',
      newBooking.id
    );

    saveStoreToFile();
    res.status(201).json(newBooking);
  });

  // Update Booking Status or Reschedule & Reply
  app.put("/api/bookings/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, note, newDate, newTimeSlot, adminReply } = req.body as {
      status: BookingStatus;
      note?: string;
      newDate?: string;
      newTimeSlot?: string;
      adminReply?: string;
    };

    const booking = bookings.find(b => b.id === id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const now = new Date().toISOString();
    booking.status = status;
    booking.updatedAt = now;

    if (newDate) booking.date = newDate;
    if (newTimeSlot) booking.timeSlot = newTimeSlot;
    if (adminReply) booking.adminReply = adminReply;

    let logNote = note || `Status updated to ${status.toUpperCase()}`;
    if (newDate && newTimeSlot) {
      logNote = `Rescheduled by Admin to ${newDate} @ ${newTimeSlot}`;
    }
    if (adminReply) {
      logNote = `Admin Reply: "${adminReply}" (${logNote})`;
    }

    booking.statusHistory.push({
      status,
      timestamp: now,
      note: logNote
    });

    const statusBurmese: Record<BookingStatus, string> = {
      pending: 'စောင့်ဆိုင်းဆဲ ⏳',
      confirmed: 'အတည်ပြုပြီး ✅',
      'in-progress': 'ညှပ်ယူနေဆဲ ✂️',
      completed: 'ပြီးစီးခဲ့ပြီး 🎉',
      cancelled: 'ပယ်ဖျက်ခဲ့ပြီး ❌',
      held: 'ခေတ္တထိန်းထားဆဲ 🔒',
      pending_sync: 'လိုင်းစောင့်ဆိုင်းဆဲ 📡',
      PENDING_SYNC: 'လိုင်းစောင့်ဆိုင်းဆဲ 📡',
      QUEUED: 'လိုင်းစောင့်ဆိုင်းဆဲ 📡',
      conflict_slot_taken: 'အချိန်စလော့ တိုက်ဆိုင်နေပါသည် ⚠️',
      CONFLICT_SLOT_TAKEN: 'အချိန်စလော့ တိုက်ဆိုင်နေပါသည် ⚠️',
    };

    let notifTitle = `ဘိုကင်အခြေအနေ အကြောင်းပြန်ချက် (${booking.bookingCode})`;
    let notifMsg = `${booking.serviceName} ဝန်ဆောင်မှုအတွက် သင်၏ ဘိုကင်မှာ "${statusBurmese[status] || status}" ဖြစ်ပါသည်။`;
    if (newDate && newTimeSlot) {
      notifTitle = `အချိန်ရွှေ့ဆိုင်းမှု အကြောင်းကြားစာ (${booking.bookingCode})`;
      notifMsg = `အက်ဒမင်မှ ရက်စွဲ/အချိန် ပြောင်းလဲလိုက်ပါသည်: ${newDate} ရက်နေ့ ${newTimeSlot} အချိန်။`;
    }
    if (adminReply) {
      notifMsg += ` အက်ဒမင် တုံ့ပြန်စာ: "${adminReply}"`;
    }

    // Trigger User Status Notification
    addNotification(
      notifTitle,
      notifMsg,
      newDate ? 'reschedule' : 'status_change',
      'user',
      booking.id,
      booking.customerName,
      booking.customerPhone
    );

    // Trigger Admin Log Notification
    addNotification(
      `အခြေအနေ ပြောင်းလဲပြီး: ${booking.customerName} (${booking.bookingCode})`,
      `ဘိုကင်အခြေအနေကို "${statusBurmese[status] || status}" သို့ ပြောင်းလဲလိုက်ပါသည်။${adminReply ? ` (တုံ့ပြန်စာ: ${adminReply})` : ''}`,
      'status_change',
      'admin',
      booking.id,
      booking.customerName
    );

    saveStoreToFile();
    res.json(booking);
  });

  // Notifications API
  app.get("/api/notifications", (req, res) => {
    const role = (req.query.role as string) || 'all';
    if (role === 'admin') {
      return res.json(notifications.filter(n => n.forRole === 'admin' || n.forRole === 'all'));
    }
    if (role === 'user') {
      return res.json(notifications.filter(n => n.forRole === 'user' || n.forRole === 'all'));
    }
    res.json(notifications);
  });

  app.put("/api/notifications/read", (req, res) => {
    const { role } = req.body;
    notifications = notifications.map(n => {
      if (!role || n.forRole === role || n.forRole === 'all') {
        return { ...n, read: true };
      }
      return n;
    });
    saveStoreToFile();
    res.json({ success: true, count: notifications.filter(n => !n.read).length });
  });

  // Settings API (KPay/WavePay/Viber)
  app.get("/api/settings", (_req, res) => {
    res.json(settings);
  });

  app.put("/api/settings", (req, res) => {
    settings = { ...settings, ...req.body };
    saveStoreToFile();
    res.json(settings);
  });

  // Clients / Users Accounts API
  app.get("/api/clients", (_req, res) => {
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { name, phone, email, preferredBarberName, memberTier, points, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Client name and phone are required" });
    }
    const newClient: UserProfile = {
      id: `client-${Date.now()}`,
      name,
      phone,
      email: email || '',
      preferredBarberName: preferredBarberName || '',
      memberTier: memberTier || 'Bronze',
      points: Number(points) || 0,
      joinedDate: new Date().toISOString().split('T')[0],
      notes: notes || '',
    };
    clients.unshift(newClient);
    saveStoreToFile();
    res.status(201).json(newClient);
  });

  app.put("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    const clientIndex = clients.findIndex(c => c.id === id);
    if (clientIndex === -1) {
      return res.status(404).json({ error: "Client not found" });
    }
    clients[clientIndex] = { ...clients[clientIndex], ...req.body };
    saveStoreToFile();
    res.json(clients[clientIndex]);
  });

  app.delete("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    clients = clients.filter(c => c.id !== id);
    saveStoreToFile();
    res.json({ success: true });
  });

  // Promos & Promotion Engine API
  app.get("/api/promos", (_req, res) => {
    res.json(promos);
  });

  app.post("/api/promos", (req, res) => {
    const { code, discountType, discountValue, minOrderAmount, memberTierRequired, maxUses, expiryDate, description } = req.body;
    if (!code || !discountValue) {
      return res.status(400).json({ error: "Code and discount value are required" });
    }
    const newPromo: PromoCode = {
      id: `promo-${Date.now()}`,
      code: String(code).toUpperCase().trim(),
      discountType: discountType || 'percent',
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      memberTierRequired: memberTierRequired || 'All',
      maxUses: Number(maxUses) || 100,
      usedCount: 0,
      expiryDate: expiryDate || '',
      active: true,
      description: description || '',
    };
    promos.unshift(newPromo);
    saveStoreToFile();
    res.status(201).json(newPromo);
  });

  app.put("/api/promos/:id", (req, res) => {
    const { id } = req.params;
    const promoIndex = promos.findIndex(p => p.id === id);
    if (promoIndex === -1) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    promos[promoIndex] = { ...promos[promoIndex], ...req.body };
    saveStoreToFile();
    res.json(promos[promoIndex]);
  });

  app.delete("/api/promos/:id", (req, res) => {
    const { id } = req.params;
    promos = promos.filter(p => p.id !== id);
    saveStoreToFile();
    res.json({ success: true });
  });

  app.post("/api/promos/validate", (req, res) => {
    const { code, orderAmount, userTier } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, message: "ကူပွန် ကုဒ် ဖြည့်သွင်းပေးပါ" });
    }

    const promo = promos.find(p => p.code.toUpperCase() === String(code).toUpperCase().trim() && p.active);
    if (!promo) {
      return res.status(404).json({ valid: false, message: "မှားယွင်းနေသော သို့မဟုတ် သက်တမ်းကုန်သွားသော ကူပွန်ဖြစ်ပါသည်" });
    }

    if (promo.minOrderAmount && Number(orderAmount) < promo.minOrderAmount) {
      return res.status(400).json({
        valid: false,
        message: `အနည်းဆုံး ${promo.minOrderAmount.toLocaleString()} MMK ကျသင့်မှ သုံးစွဲနိုင်ပါမည်`
      });
    }

    if (promo.memberTierRequired && promo.memberTierRequired !== 'All') {
      const tierHierarchy = ['Bronze', 'Silver', 'Gold', 'VIP'];
      const userLevel = tierHierarchy.indexOf(userTier || 'Bronze');
      const reqLevel = tierHierarchy.indexOf(promo.memberTierRequired);
      if (userLevel < reqLevel) {
        return res.status(400).json({
          valid: false,
          message: `ဤကူပွန်မှာ ${promo.memberTierRequired} Level နှင့် အထက် အသင်းဝင်များသာ အသုံးပြုနိုင်ပါသည်`
        });
      }
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ valid: false, message: "ဤကူပွန် အသုံးပြုခွင့် အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ" });
    }

    // Calculate discount amount
    let calculatedDiscount = 0;
    if (promo.discountType === 'percent') {
      calculatedDiscount = Math.round((Number(orderAmount) * promo.discountValue) / 100);
    } else {
      calculatedDiscount = promo.discountValue;
    }

    res.json({
      valid: true,
      promo,
      calculatedDiscount,
      message: `ကူပွန် လက်ခံရရှိပါသည်။ လျှော့ဈေး: ${calculatedDiscount.toLocaleString()} MMK`
    });
  });

  // App Stats Overview for Admin
  app.get("/api/stats", (_req, res) => {
    const totalBookings = bookings.length;
    const pendingRequests = bookings.filter(b => b.status === 'pending').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.date === todayStr).length;
    const estimatedRevenue = bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'in-progress')
      .reduce((sum, b) => sum + b.servicePrice, 0);

    const stats: AppStats = {
      totalBookings,
      pendingRequests,
      todayBookings,
      estimatedRevenue,
      activeServicesCount: services.filter(s => s.active).length,
      activeDesignersCount: designers.length
    };

    res.json(stats);
  });

  // Database Store Management (Export, Import, Reset)
  app.get("/api/database/export", (_req, res) => {
    res.json({
      services,
      designers,
      bookings,
      notifications,
      exportedAt: new Date().toISOString()
    });
  });

  app.post("/api/database/import", (req, res) => {
    const { services: impServices, designers: impDesigners, bookings: impBookings, notifications: impNotifs } = req.body;
    if (Array.isArray(impServices)) services = impServices;
    if (Array.isArray(impDesigners)) designers = impDesigners;
    if (Array.isArray(impBookings)) bookings = impBookings;
    if (Array.isArray(impNotifs)) notifications = impNotifs;

    saveStoreToFile();
    res.json({ success: true, message: "Database imported successfully." });
  });

  app.post("/api/database/reset-zero", (req, res) => {
    const { password, wipeServices, wipeDesigners = true } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const isValid = Buffer.from(password.trim()).toString('base64') === 'SGVpbkh0ZXRAMzYxMg==';
    if (!isValid) {
      return res.status(401).json({ error: "မှားယွင်းသော အက်ဒမင် လျှို့ဝှက်နံပါတ် (Invalid Password)" });
    }

    // Reset history, bookings, notifications, designers, and services to zero
    bookings = [];
    notifications = [];
    designers = [];
    services = [];

    addNotification(
      'ဒေတာများ 0 မှ ပြန်စလိုက်ပါပြီ',
      'ဝန်ဆောင်မှုများ၊ ဒီဇိုင်နာများ၊ ဘိုကင်များနှင့် အသိပေးချက်များ အားလုံးကို 0 သို့ အောင်မြင်စွာ Reset လုပ်လိုက်ပါသည်။',
      'status_change',
      'admin'
    );

    saveStoreToFile();
    res.json({ success: true, message: "Services, designers, history bookings and notifications reset to zero." });
  });

  app.post("/api/database/reset", (req, res) => {
    const { password } = req.body;
    if (password) {
      const isValid = Buffer.from(password.trim()).toString('base64') === 'SGVpbkh0ZXRAMzYxMg==';
      if (!isValid) {
        return res.status(401).json({ error: "မှားယွင်းသော အက်ဒမင် လျှို့ဝှက်နံပါတ် (Invalid Password)" });
      }
    }
    services = [];
    designers = [];
    bookings = [];
    notifications = [];
    saveStoreToFile();
    res.json({ success: true, message: "Database reset to initial store seed." });
  });

  // Vite Middleware in Development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BABASHOP Server listening on http://localhost:${PORT}`);
  });
}

startServer();
