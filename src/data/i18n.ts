export type Language = 'en' | 'my';

export interface Translations {
  // Brand & Nav
  brandName: string;
  brandTagline: string;
  pwaBadge: string;
  bookAppointment: string;
  installApp: string;
  notifications: string;
  myAppointments: string;
  serviceMenu: string;
  ourDesigners: string;
  adminDashboard: string;
  
  // Role Selection Gate
  welcomeTitle: string;
  welcomeSubtitle: string;
  chooseRoleTitle: string;
  userRoleTitle: string;
  userRoleDesc: string;
  enterAsUser: string;
  adminRoleTitle: string;
  adminRoleDesc: string;
  usernameLabel: string;
  passwordLabel: string;
  adminLoginBtn: string;
  adminLoginError: string;
  switchRole: string;
  logoutAdmin: string;
  guestSkipNotice: string;
  
  // Hero & Services
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  applyBooking: string;
  reviewsCount: string;
  serviceCatalog: string;
  serviceCatalogDesc: string;
  allCategories: string;
  
  // Designers
  designersTitle: string;
  designersDesc: string;
  experience: string;
  workingHours: string;
  bookWithDesigner: string;
  specialties: string;
  
  // Booking Modal
  bookingHeader: string;
  stepService: string;
  stepDesigner: string;
  stepTime: string;
  stepDetails: string;
  stepConfirmed: string;
  chooseService: string;
  chooseDesigner: string;
  selectDateTime: string;
  clientDetails: string;
  fullName: string;
  mobilePhone: string;
  emailAddress: string;
  specialNotes: string;
  fastBookBtn: string;
  fastBookDesc: string;
  submitRequest: string;
  continueBtn: string;
  backBtn: string;
  totalAmount: string;
  bookingRef: string;
  addToCalendar: string;
  doneBtn: string;
  
  // Statuses
  statusPending: string;
  statusConfirmed: string;
  statusInProgress: string;
  statusCompleted: string;
  statusCancelled: string;
  
  // Admin & Designer Management
  designerRoster: string;
  designerNotifications: string;
  pendingRequests: string;
  addDesigner: string;
  editDesigner: string;
  deleteDesigner: string;
  approveBooking: string;
  cancelBooking: string;
  markAllRead: string;
  designerManagementOnly: string;
  
  // Database Store & Stats
  databaseStore: string;
  statisticsTab: string;
  dataExportImport: string;
  totalRevenue: string;
  totalBookingsCount: string;
  activeDesignersCount: string;
  completionRate: string;
  
  // Common
  loading: string;
  close: string;
  copy: string;
  copied: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    brandName: 'GENTLEMAN',
    brandTagline: 'Barber & Grooming Lounge',
    pwaBadge: 'PWA',
    bookAppointment: 'Book Appointment',
    installApp: 'Install App',
    notifications: 'Notifications',
    myAppointments: 'My Appointments',
    serviceMenu: 'Service Menu',
    ourDesigners: 'Our Stylists',
    adminDashboard: 'Admin Dashboard',
    
    welcomeTitle: 'WELCOME TO GENTLEMAN',
    welcomeSubtitle: 'Bespoke Hair Sculpting & Designer Barber Lounge',
    chooseRoleTitle: 'SELECT YOUR PORTAL ACCESS',
    userRoleTitle: 'Client Portal',
    userRoleDesc: 'Browse haircuts, choose designers & book instantly. Fast & skippable details for quick bookings.',
    enterAsUser: 'Enter Application',
    adminRoleTitle: 'Admin Portal Login',
    adminRoleDesc: 'Manage master designers, shift hours, and designer booking notifications.',
    usernameLabel: 'Admin Username',
    passwordLabel: 'Admin Password',
    adminLoginBtn: 'Login',
    adminLoginError: 'Invalid Username or Password. Please try again.',
    switchRole: 'Portal Access',
    logoutAdmin: 'Lock Admin / Logout',
    guestSkipNotice: 'Fast Mode Enabled: You can skip filling long details with 1-click Fast Book.',
    
    heroBadge: 'Bespoke Barber & Hair Artistry',
    heroTitle: 'ELEVATE YOUR STYLE AT GENTLEMAN',
    heroSubtitle: 'Select your favorite master designer, choose your time slot, and experience mobile-first seamless booking.',
    applyBooking: 'Apply for Booking',
    reviewsCount: '4.9/5 (400+ reviews)',
    serviceCatalog: 'SERVICE CATALOG',
    serviceCatalogDesc: 'Choose from master barber cuts, hair art, beard grooming, and therapies',
    allCategories: 'All Services',
    
    designersTitle: 'GENTLEMAN STYLISTS & BARBERS',
    designersDesc: 'Meet our team of lead barbers, color specialists, and hair sculptors',
    experience: 'years exp',
    workingHours: 'Hours',
    bookWithDesigner: 'Book with Designer',
    specialties: 'Specialties',
    
    bookingHeader: 'GENTLEMAN BOOKING',
    stepService: 'Choose Service',
    stepDesigner: 'Choose Designer',
    stepTime: 'Select Time & Date',
    stepDetails: 'Client Contact',
    stepConfirmed: 'Confirmed!',
    chooseService: '1. Choose Hair Cut or Styling Service',
    chooseDesigner: '2. Choose Your Designer',
    selectDateTime: '3. Select Booking Date & Time',
    clientDetails: '4. Your Details for Booking',
    fullName: 'Full Name',
    mobilePhone: 'Mobile Phone',
    emailAddress: 'Email Address',
    specialNotes: 'Special Notes or Style Requests',
    fastBookBtn: '1-Click Fast Book (Skip Details)',
    fastBookDesc: 'Automatically books as Guest Client without typing long contact info',
    submitRequest: 'Submit Request',
    continueBtn: 'Continue',
    backBtn: 'Back',
    totalAmount: 'Total Amount',
    bookingRef: 'Your Booking Reference',
    addToCalendar: 'Add to Calendar (.ics)',
    doneBtn: 'Done',
    
    statusPending: 'Pending Approval',
    statusConfirmed: 'Confirmed',
    statusInProgress: 'In Chair',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    
    designerRoster: 'Designer Roster',
    designerNotifications: 'Designer Notifications',
    pendingRequests: 'Pending Requests',
    addDesigner: 'Add New Designer',
    editDesigner: 'Edit Designer',
    deleteDesigner: 'Delete Designer',
    approveBooking: 'Approve Appointment',
    cancelBooking: 'Cancel Appointment',
    markAllRead: 'Mark All Read',
    designerManagementOnly: 'Admin Portal: Specialized Designer Roster & Notification Control',
    
    databaseStore: 'Database Store',
    statisticsTab: 'Analytics & Stats',
    dataExportImport: 'Data Backup & JSON Management',
    totalRevenue: 'Total Revenue',
    totalBookingsCount: 'Total Bookings',
    activeDesignersCount: 'Active Designers',
    completionRate: 'Completion Rate',
    
    loading: 'Loading...',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied!',
  },
  
  my: {
    brandName: 'GENTLEMAN',
    brandTagline: 'ဆံပင်ဒီဇိုင်နာနှင့် ဆံသစတူဒီယို',
    pwaBadge: 'PWA',
    bookAppointment: 'ဘိုကင်ရယူရန်',
    installApp: 'အက်ပ်သွင်းရန်',
    notifications: 'အကြောင်းကြားစာများ',
    myAppointments: 'ကျွန်ုပ်၏ ဘိုကင်များ',
    serviceMenu: 'ဝန်ဆောင်မှုစာရင်း',
    ourDesigners: 'ကျွန်ုပ်တို့၏ ဒီဇိုင်နာများ',
    adminDashboard: 'အက်ဒမင် ဒက်ရှ်ဘုတ်',
    
    welcomeTitle: 'GENTLEMAN သို့ ကြိုဆိုပါသည်',
    welcomeSubtitle: 'အဆင့်မြင့် ဆံပင်ပုံဖော်ရေးနှင့် ဒီဇိုင်နာ ဆံသစတူဒီယို',
    chooseRoleTitle: 'ဝန်ဆောင်မှု စတင်ရယူရန်',
    userRoleTitle: 'အသုံးပြုသူ',
    userRoleDesc: 'ဆံပင်ညှပ်ဝန်ဆောင်မှုနှင့် ဒီဇိုင်နာများကို ကြည့်ရှုပြီး အလွယ်တကူ ဘိုကင်တင်ပါ။ အချက်အလက်များ မဖြည့်ဘဲ အမြန်ဘိုကင် ပြုလုပ်နိုင်ပါသည်။',
    enterAsUser: 'အက်ပ်ထဲသို့ ဝင်ရောက်မည်',
    adminRoleTitle: 'အက်ဒမင် လော့ဂ်အင်',
    adminRoleDesc: 'ဒီဇိုင်နာများ၏ အချက်အလက်၊ အချိန်ဇယားနှင့် ဘိုကင် အကြောင်းကြားစာများကို စီမံခန့်ခွဲရန်။',
    usernameLabel: 'အက်ဒမင် အသုံးပြုသူအမည်',
    passwordLabel: 'အက်ဒမင် စကားဝှက်',
    adminLoginBtn: 'ဝင်ရောက်မည်',
    adminLoginError: 'အသုံးပြုသူအမည် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။ ပြန်လည်ကြိုးစားပါ။',
    switchRole: 'ဝင်ရောက်မှု စနစ်',
    logoutAdmin: 'အက်ဒမင်မှ ထွက်ရန်',
    guestSkipNotice: 'အမြန်စနစ်- အချက်အလက်များ ဖြည့်စရာမလိုဘဲ 1-Click Fast Book ဖြင့် တိုက်ရိုက် ဘိုကင်လုပ်နိုင်ပါသည်။',
    
    heroBadge: 'အဆင့်မြင့် ဆံပင်နှင့် မုတ်ဆိတ် ဒီဇိုင်းစတူဒီယို',
    heroTitle: 'GENTLEMAN တွင် သင်၏ စတိုင်ကို မြှင့်တင်ပါ',
    heroSubtitle: 'သင်ကြိုက်နှစ်သက်သော ဒီဇိုင်နာကို ရွေးချယ်ပါ၊ အချိန်ဇယား ရွေးပြီး လွယ်ကူစွာ ဘိုကင်တင်ပါ။',
    applyBooking: 'ဘိုကင်စတင် တင်မည်',
    reviewsCount: '၄.၉/၅ (သုံးသပ်ချက် ၄၀၀ ကျော်)',
    serviceCatalog: 'ဝန်ဆောင်မှု စာရင်းများ',
    serviceCatalogDesc: 'ဆံပင်ညှပ်၊ မုတ်ဆိတ်ရိတ်၊ ဆံပင်ဆေးရောင်စုံနှင့် အထူးပေါင်းတင်နည်းများကို ရွေးချယ်ပါ',
    allCategories: 'ဝန်ဆောင်မှုအားလုံး',
    
    designersTitle: 'GENTLEMAN ဒီဇိုင်နာများ',
    designersDesc: 'ကျွန်ုပ်တို့၏ ကျွမ်းကျင် ဆံပင်ဒီဇိုင်နာများနှင့် မုတ်ဆိတ်အလှဖန်တီးရှင်များ',
    experience: 'နှစ် အတွေ့အကြုံ',
    workingHours: 'ဆိုင်ဖွင့်ချိန်',
    bookWithDesigner: 'ဒီဇိုင်နာနှင့် ဘိုကင်လုပ်မည်',
    specialties: 'ကျွမ်းကျင်မှုများ',
    
    bookingHeader: 'GENTLEMAN ဘိုကင်ယူခြင်း',
    stepService: 'ဝန်ဆောင်မှု ရွေးရန်',
    stepDesigner: 'ဒီဇိုင်နာ ရွေးရန်',
    stepTime: 'ရက်စွဲနှင့် အချိန်ရွေးရန်',
    stepDetails: 'အချက်အလက် ဖြည့်ရန်',
    stepConfirmed: 'အောင်မြင်ပါသည်!',
    chooseService: '၁။ ဝန်ဆောင်မှုအမျိုးအစား ရွေးချယ်ပါ',
    chooseDesigner: '၂။ ဒီဇိုင်နာ ရွေးချယ်ပါ',
    selectDateTime: '၃။ ရက်စွဲနှင့် အချိန် ရွေးချယ်ပါ',
    clientDetails: '၄။ သင်၏ အချက်အလက်များ',
    fullName: 'အမည်',
    mobilePhone: 'ဖုန်းနံပါတ်',
    emailAddress: 'အီးမေးလ်',
    specialNotes: 'အထူးမှာကြားလိုသည်များ',
    fastBookBtn: '1-Click အမြန် ဘိုကင်တင်မည် (အသေးစိတ်ကျော်ရန်)',
    fastBookDesc: 'စာရိုက်စရာမလိုဘဲ ဧည့်သည်အဖြစ် တိုက်ရိုက် ဘိုကင်တင်ပေးပါမည်',
    submitRequest: 'ဘိုကင်တင်မည်',
    continueBtn: 'ရှေ့သို့',
    backBtn: 'နောက်သို့',
    totalAmount: 'ကျသင့်ငွေ',
    bookingRef: 'သင်၏ ဘိုကင်နံပါတ်',
    addToCalendar: 'ပြက္ခဒိန်တွင် မှတ်မည် (.ics)',
    doneBtn: 'ပြီးပါပြီ',
    
    statusPending: 'စောင့်ဆိုင်းဆဲ',
    statusConfirmed: 'အတည်ပြုပြီး',
    statusInProgress: 'ဝန်ဆောင်မှုပေးနေဆဲ',
    statusCompleted: 'ပြီးစီးပါပြီ',
    statusCancelled: 'ပယ်ဖျက်လိုက်သည်',
    
    designerRoster: 'ဒီဇိုင်နာ စာရင်းများ',
    designerNotifications: 'ဒီဇိုင်နာ အကြောင်းကြားစာများ',
    pendingRequests: 'စောင့်ဆိုင်းဆဲ ဘိုကင်များ',
    addDesigner: 'ဒီဇိုင်နာသစ် ထည့်ရန်',
    editDesigner: 'ဒီဇိုင်နာ ပြင်ဆင်ရန်',
    deleteDesigner: 'ဒီဇိုင်နာ ဖျက်ရန်',
    approveBooking: 'ဘိုကင် လက်ခံမည်',
    cancelBooking: 'ဘိုကင် ပယ်ဖျက်မည်',
    markAllRead: 'ဖတ်ပြီးကြောင်း မှတ်မည်',
    designerManagementOnly: 'အက်ဒမင် စီမံခန့်ခွဲမှု- ဒီဇိုင်နာများနှင့် အကြောင်းကြားစာများ စီမံရန်',
    
    databaseStore: 'ဒေတာဘေ့စ် သိမ်းဆည်းခန်း',
    statisticsTab: 'စာရင်းအင်းနှင့် အချက်အလက်များ',
    dataExportImport: 'ဒေတာ ထုတ်ယူ/သွင်းယူခြင်း',
    totalRevenue: 'စုစုပေါင်း ဝင်ငွေ',
    totalBookingsCount: 'စုစုပေါင်း ဘိုကင် အရေအတွက်',
    activeDesignersCount: 'လက်ရှိ ဒီဇိုင်နာများ',
    completionRate: 'ပြီးစီးမှု ရာခိုင်နှုန်း',
    
    loading: 'ခဏစောင့်ပါ...',
    close: 'ပိတ်မည်',
    copy: 'ကူးယူမည်',
    copied: 'ကူးယူပြီးပါပြီ!',
  },
};
