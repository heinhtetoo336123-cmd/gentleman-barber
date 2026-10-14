# Firestore Quota Spike Root Cause Analysis & Superadmin Booking Management Optimization Plan

**အစီအစဉ် အကျဉ်းချုပ် (Executive Summary):**  
Firestore ရဲ့ Read Quota သုံးစွဲမှု အလွန်အမင်း မြင့်တက်သွားရသည့် အဓိက အကြောင်းရင်းများကို စနစ်အတွင်း စစ်ဆေးတွေ့ရှိရပြီး၊ ၎င်းကို အဆင့်လိုက် ထိန်းချုပ်လျှော့ချပေးမည့် နည်းပညာရပ်ဆိုင်ရာ ဖြေရှင်းချက်များနှင့် Superadmin Booking Audit Hub တည်ဆောက်မည့် ပလန်ကို မြန်မာဘာသာဖြင့် အသေးစိတ် ရေးဆွဲထားပါသည်။

---

## ၁။ Firestore Read Spike (25K Reads) ဖြစ်ပွားရသည့် အဓိက အကြောင်းရင်းများ (Root Causes)

Graph စာရင်းများနှင့် Codebase ၏ Firestore Query များကို စစ်ဆေးတွေ့ရှိချက်များအရ အောက်ပါအချက်များကြောင့် Read Spike ဖြစ်ပွားခဲ့ခြင်းဖြစ်သည်-

1. **စိစစ်မှုမရှိသော Listener အကြီးစားများ (High-Limit Unconstrained Listeners):**
   - `subscribeToBookings` တွင် `collection(db, 'bookings')` ကို `limit(1000)` ပြုလုပ်၍ Listening လုပ်ထားခြင်း။
   - မည်သည့် Customer သို့မဟုတ် Admin အက်ပ်ဖွင့်သည်ဖြစ်စေ တစ်ကြိမ်လျှင် Booking 1,000 အထိ တိုက်ရိုက် Read လုပ်ယူနေသဖြင့် အသုံးပြုသူ အနည်းငယ် အက်ပ်ဖွင့်လိုက်ရုံဖြင့် Read ကိန်းဂဏန်း ထောင်ပေါင်းများစွာ တက်သွားခြင်း။
   - `clients` collection တွင်လည်း `limit(500)` အထိ တိုက်ရိုက် Snapshot ယူနေခြင်း။

2. **နေ့စွဲနှင့် အပိုင်းအခြား မသတ်မှတ်ဘဲ client-side မှ Filter လုပ်ခြင်း (In-Memory Filtering):**
   - Firestore တွင် Query ဖြင့် စစ်ထုတ်ခြင်း (`where('date', '==', today)`) မလုပ်ဘဲ၊ တစ်ဆိုင်လုံး၏ Booking အဟောင်း/အသစ် အားလုံးကို Read လုပ်ပြီးမှ Frontend JS code ထဲတွင် ရက်စွဲ/Barber မဲစစ်ထုတ်ခြင်း။

3. **React Component ရွှေ့လျားမှုများတွင် Listener ပြန်လည် ချိတ်ဆက်ခြင်း (Re-subscription Cascades):**
   - Page / Modal များ အကူးအပြောင်းတွင် `useEffect` dependencies အရ `onSnapshot` listener များ မလိုအပ်ဘဲ ထပ်မံ ချိတ်ဆက်မိခြင်း။

4. **ပင်မ အချက်အလက်များ အားလုံးအတွက် Real-time Listener များဖွင့်ထားခြင်း:**
   - `services`, `designers`, `promos`, `products`, `expenses` Collection အားလုံးကို Background တွင် Real-time နားထောင်ထားခြင်း။

---

## ၂။ ဖြေရှင်းမည့် နည်းဗျူဟာများနှင့် ပြင်ဆင်မည့် ပလန် (Proposed Solutions)

### အဆင့် (၁) - Query Optimization & Pagination (Read လျှော့ချရေး)
- **Booking Query သတ်မှတ်ချက် ပြင်ဆင်ခြင်း:**
  - Default အနေဖြင့် **ယနေ့ (Today)** သို့မဟုတ် **နီးစပ်ရာ ၇ ရက်** အတွင်းရှိ Booking များကိုသာ Query (`limit(30)` သို့မဟုတ် `limit(50)`) ဖြင့် ဖတ်ယူမည်။
  - သမိုင်းကြောင်း (History) booking များကို ကြည့်ရှုလိုမှသာ Cursor-based Pagination (`startAfter`) သို့မဟုတ် `Load More` နှိပ်မှ ဖတ်ယူမည်။
- **Client & Other Collections Pagination:**
  - `clients` collection ကို တစ်ခါတည်း ၅၀၀ မဖတ်တော့ဘဲ စာမျက်နှာအလိုက် `limit(20)` ဖြင့် ဖတ်ရှုမည်။

### အဆင့် (၂) - Cache-First Local Hydration Strategy (Local Storage အသုံးချခြင်း)
- စက်ထဲတွင် သိမ်းဆည်းထားသော Cache ဒေတာကို ပထမဦးစွာ (0ms) ပြသမည်။
- Firestore မှ ဒေတာအသစ် ပြောင်းလဲမှု ရှိမရှိကို သီးသန့် Hash check သို့မဟုတ် လိုအပ်မှသာ Snapshot ချိတ်မည်။
- မလိုအပ်သော Collection များ၏ Real-time listening များကို ပိတ်ပြီး `getDoc` / Explicit Refetch ဖြင့် ပြောင်းလဲမည်။

### အဆင့် (၃) - Superadmin Real-Time Quota Monitor & Booking Hub တည်ဆောက်ခြင်း
- **Superadmin Dashboard** တွင် Firestore Quota အခြေအနေ၊ Active Listeners နှင့် Query Health များကို တိုက်ရိုက် ကြည့်ရှုနိုင်သည့် Audit Badge ထည့်သွင်းမည်။
- **Optimized Booking Management Drawer/Tab**:
  - Barber အလိုက်၊ Date အလိုက်၊ Status (Pending/Confirmed/Cancelled) အလိုက် စနစ်တကျ ကန့်သတ်ကြည့်ရှုနိုင်မည်။
  - Infinite loops မဖြစ်စေရန် ထိန်းချုပ်ထားသော Safe Data Fetching Architecture တည်ဆောက်မည်။

---

## ၃။ အကောင်အထည်ဖော်မည့် အဆင့်များ (Implementation Steps)

1. **`src/api/client.ts` တွင် Query Limits & Date Filters များပြင်ဆင်ခြင်း:**
   - `subscribeToBookings` တွင် `where('date', '>=', lowerBound)` သို့မဟုတ် `limit(50)` သို့ လျှော့ချခြင်း။
2. **`useBookings` & `useClients` Hooks များတွင် Pagination ထည့်သွင်းခြင်း:**
   - Page အလိုက် ဒေတာဆွဲယူသည့် စနစ်ပြောင်းလဲခြင်း။
3. **Superadmin UI တွင် Firestore Quota Efficiency Panel တည်ဆောက်ခြင်း:**
   - Admin များအနေဖြင့် Read အရေအတွက် သက်သာစွာဖြင့် Customer Booking များကို စီမံခန့်ခွဲနိုင်မည်။
4. **Build & Test Verification:**
   - Applet Compilation နှင့် Functional Testing ပြုလုပ်၍ Read Spikes မဖြစ်ပေါ်တော့ကြောင်း အတည်ပြုခြင်း။
