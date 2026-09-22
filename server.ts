import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
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
      workingHours: workingHours || { start: '09:00', end: '18:00' },
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
      held: 'ခေတ္တထိန်းထားဆဲ 🔒'
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
