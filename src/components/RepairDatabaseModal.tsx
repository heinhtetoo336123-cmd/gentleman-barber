import React, { useState } from 'react';
import { api } from '../api/client';
import {
  Wrench,
  X,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Search,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RepairDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'my';
  onRepaired?: () => void;
}

export const RepairDatabaseModal: React.FC<RepairDatabaseModalProps> = ({
  isOpen,
  onClose,
  lang = 'en',
  onRepaired
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'ghost_purge'>('sync');
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    success: boolean;
    syncedCounts: {
      services: number;
      designers: number;
      bookings: number;
      clients: number;
      promos: number;
      settings: number;
    };
    message: string;
  } | null>(null);

  // 2-Step Ghost Record Audit & Purge State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    totalScanned: number;
    validClientBookingsCount: number;
    validWalkinsCount: number;
    ghostRecordsCount: number;
    sampleGhostRecords: { id: string; [key: string]: any }[];
    ghostDocIds: string[];
  } | null>(null);

  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{
    purgedCount: number;
    success: boolean;
  } | null>(null);

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setAuditResult(null);
    setPurgeResult(null);
    try {
      const res = await api.auditGhostBookings();
      setAuditResult(res);
    } catch (err: any) {
      alert(err.message || 'Audit failed');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRunPurge = async () => {
    if (!auditResult || auditResult.ghostDocIds.length === 0) return;
    const confirmMsg = lang === 'my'
      ? `အတည်ပြုပြီးသော အမှိုက်မှတ်တမ်း (${auditResult.ghostDocIds.length} ခု) ကို Batch ၄၀၀ နှုန်းဖြင့် အပြီးအပိုင် ဖျက်ထုတ်ရန် သေချာပါသလား?\n\nသတိပြုရန်: Walk-in မှတ်တမ်းများကို ၁၀၀% အပြည့်အဝ ကာကွယ်ထားပြီး ဖြစ်ပါသည်။`
      : `Are you sure you want to permanently delete ${auditResult.ghostDocIds.length} confirmed ghost records in batches of 400?\n\nNote: All Walk-in records are 100% protected and preserved.`;

    if (!window.confirm(confirmMsg)) return;

    setIsPurging(true);
    try {
      const res = await api.purgeGhostBookings(auditResult.ghostDocIds);
      setPurgeResult(res);
      // Re-run audit to verify
      handleRunAudit();
    } catch (err: any) {
      alert(err.message || 'Purge failed');
    } finally {
      setIsPurging(false);
    }
  };

  const handlePerformRepair = async () => {
    setIsRepairing(true);
    setRepairResult(null);
    try {
      const result = await api.repairAndResyncFromCloud();
      setRepairResult(result);
      if (onRepaired) {
        onRepaired();
      }
    } catch (err: any) {
      setRepairResult({
        success: false,
        syncedCounts: { services: 0, designers: 0, bookings: 0, clients: 0, promos: 0, settings: 0 },
        message: err.message || (lang === 'my' ? 'Cloud Re-sync ပြုလုပ်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ခဲ့ပါသည်' : 'Failed to re-sync from cloud')
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleClose = () => {
    if (!isRepairing && !isPurging && !isAuditing) {
      onClose();
      setRepairResult(null);
      setAuditResult(null);
      setPurgeResult(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white border border-stone-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto"
          >
            {/* Modal Top Header */}
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black font-mono text-stone-100 uppercase tracking-wide flex items-center space-x-2">
                    <span>{lang === 'my' ? 'Database Maintenance & Cloud Tools' : 'Database Maintenance & Cloud Tools'}</span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {lang === 'my'
                      ? 'Cache ရှင်းလင်းခြင်း၊ Cloud Sync နှင့် Ghost Records များ အန္တရာယ်ကင်းစွာ စစ်ဆေးဖျက်ထုတ်ခြင်း'
                      : 'Clear cache, re-sync data, or safely audit and purge ghost records'}
                  </p>
                </div>
              </div>

              {!isRepairing && !isPurging && !isAuditing && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-stone-200 bg-stone-100/60 px-5 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('sync')}
                className={`pb-2.5 px-3 text-xs font-bold font-mono transition-all border-b-2 flex items-center space-x-1.5 ${
                  activeTab === 'sync'
                    ? 'border-emerald-600 text-emerald-950 font-black'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'Cache Cleaner & Re-sync' : 'Cache Cleaner & Re-sync'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ghost_purge')}
                className={`pb-2.5 px-3 text-xs font-bold font-mono transition-all border-b-2 flex items-center space-x-1.5 ${
                  activeTab === 'ghost_purge'
                    ? 'border-rose-600 text-rose-950 font-black'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>{lang === 'my' ? 'Safe Ghost Records Purge' : 'Safe Ghost Records Purge'}</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {activeTab === 'ghost_purge' ? (
                /* Ghost Records Safe Audit & Purge Section */
                <div className="space-y-4">
                  {/* Warning / Protection Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-1.5">
                    <div className="flex items-center space-x-2 font-bold text-xs text-amber-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'my' ? 'Walk-in မှတ်တမ်းများကို ၁၀၀% အပြည့်အဝ ကာကွယ်ထားပါသည်' : 'Walk-in Records are 100% Protected'}</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {lang === 'my'
                        ? 'Walk-in စာရင်းများတွင် ဖုန်းနံပါတ် သို့မဟုတ် အမည် မပါသော်လည်း ဝန်ဆောင်မှုအမျိုးအစား၊ ဈေးနှုန်း သို့မဟုတ် Stylist အချက်အလက်များ ပါဝင်သောကြောင့် ၎င်းတို့ကို လုံးဝ မဖျက်ဘဲ အပြည့်အဝ ထိန်းသိမ်းထားပါသည်။ မည်သည့် အချက်အလက်မျှ မရှိသော Ghost Records များကိုသာ ဖျက်ထုတ်ပါမည်။'
                        : 'Walk-ins lack client names/phones but contain service and price details; they are strictly preserved. Only empty corrupted ghost records will be purged.'}
                    </p>
                  </div>

                  {/* Step 1: Dry-run Audit Button */}
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 uppercase font-mono flex items-center space-x-1.5">
                          <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px]">1</span>
                          <span>{lang === 'my' ? 'Step 1: စမ်းသပ်စစ်ဆေးခြင်း (Dry-run Audit)' : 'Step 1: Dry-run Audit'}</span>
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          {lang === 'my'
                            ? 'Bookings collection ထဲရှိ ဒေတာများကို Scan ဖတ်၍ Console နှင့် UI တွင် အစီရင်ခံပြသမည်။'
                            : 'Scan collection and classify documents into valid bookings, walk-ins, and ghost records.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isAuditing || isPurging}
                        onClick={handleRunAudit}
                        className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5 shadow cursor-pointer disabled:opacity-50"
                      >
                        {isAuditing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-3.5 h-3.5" />
                            <span>{lang === 'my' ? 'Scan စစ်ဆေးမည်' : 'Run Audit'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Audit Results */}
                    {auditResult && (
                      <div className="pt-2 border-t border-stone-200 space-y-2.5">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                            <span className="text-[10px] text-emerald-700 block font-bold">Valid Walk-ins</span>
                            <span className="font-mono font-black text-emerald-900 text-sm">
                              {auditResult.validWalkinsCount} (Protected)
                            </span>
                          </div>
                          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                            <span className="text-[10px] text-blue-700 block font-bold">Valid Bookings</span>
                            <span className="font-mono font-black text-blue-900 text-sm">
                              {auditResult.validClientBookingsCount}
                            </span>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${
                            auditResult.ghostRecordsCount > 0
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-stone-100 border-stone-200 text-stone-700'
                          }`}>
                            <span className="text-[10px] block font-bold">Ghost Records</span>
                            <span className="font-mono font-black text-sm">
                              {auditResult.ghostRecordsCount}
                            </span>
                          </div>
                        </div>

                        {auditResult.ghostRecordsCount === 0 ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Database ထဲတွင် Ghost Record မရှိပါ။ ဒေတာများ သန့်ရှင်းနေပါသည်!</span>
                          </div>
                        ) : (
                          /* Step 2: Confirmed Purge Button */
                          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="text-xs font-bold text-rose-900 uppercase font-mono flex items-center space-x-1.5">
                                  <span className="w-5 h-5 rounded-full bg-rose-700 text-white flex items-center justify-center text-[10px]">2</span>
                                  <span>{lang === 'my' ? 'Step 2: အတည်ပြု ဖျက်ထုတ်ခြင်း (Confirmed Purge)' : 'Step 2: Confirmed Purge'}</span>
                                </h5>
                                <p className="text-[11px] text-rose-700">
                                  {lang === 'my'
                                    ? `အတည်ပြုပြီးသော အမှိုက်မှတ်တမ်း (${auditResult.ghostRecordsCount} ခု) ကို Batch ၄၀၀ နှုန်းဖြင့် အပြီးအပိုင် ဖျက်ပါမည်။`
                                    : `Batch delete ${auditResult.ghostRecordsCount} confirmed ghost records in batches of 400.`}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={isPurging}
                                onClick={handleRunPurge}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5 shadow cursor-pointer disabled:opacity-50"
                              >
                                {isPurging ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Purging...</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{lang === 'my' ? 'အမှိုက်ဖျက်မည်' : 'Purge Ghost Records'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {purgeResult && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>အမှိုက်မှတ်တမ်း {purgeResult.purgedCount} ခုကို အောင်မြင်စွာ ဖျက်ထုတ်ပြီးပါပြီ။</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Original Cloud Re-sync & Cache Cleaner Section */
                <>
                  {/* 1. Safety Guarantee Banner */}
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 text-emerald-950 space-y-1.5">
                    <div className="flex items-center space-x-2 font-bold text-xs text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'my' ? 'ဒေတာ လုံခြုံစိတ်ချရမှု အာမခံချက် (100% Safe Data Guarantee) :' : '100% Safe Cloud Data Guarantee:'}</span>
                    </div>
                    <ul className="text-[11px] text-emerald-800 space-y-1 pl-6 list-disc leading-relaxed">
                      <li>
                        <strong>Services History & Booking ဒေတာများ</strong> လုံးဝ ဆုံးရှုံးမှု မရှိစေရန် စနစ်မှ သေချာစွာ ထိန်းသိမ်းပေးထားပါသည်။
                      </li>
                      <li>
                        Cloud Database (Firestore) ထဲရှိ တကယ့် အစစ်အမှန် အချက်အလက်များကို တိုက်ရိုက် ပြန်လည်ဆွဲယူပြီး စက်ထဲရှိ Cache အဟောင်းများနှင့် လွဲမှားနေသော local state များကို ပြင်ဆင်ပေးပါမည်။
                      </li>
                      <li>
                        Admin Login / Session မပျက်ပြယ်စေဘဲ ဆက်လက်အသုံးပြုနိုင်ပါသည်။
                      </li>
                    </ul>
                  </div>

                  {/* 2. Processing State */}
                  {isRepairing && (
                    <div className="p-6 text-center space-y-3 bg-stone-50 rounded-2xl border border-stone-200">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase font-mono">
                        {lang === 'my' ? 'Cloud မှ Data များအား စစ်ဆေးပြီး Cache များ ရှင်းလင်းနေပါသည်...' : 'Re-syncing with Cloud Firestore & clearing cache...'}
                      </h4>
                      <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                        {lang === 'my'
                          ? 'PWA Service Worker၊ Browser Storage နှင့် Firestore Bookings, Services, History များကို ချိန်ညှိနေပါသည် ခေတ္တစောင့်ဆိုင်းပေးပါ...'
                          : 'Please wait while records and client caches are being re-synchronized...'}
                      </p>
                    </div>
                  )}

                  {/* 3. Result Display after Successful Repair */}
                  {repairResult && !isRepairing && (
                    <div className="space-y-3">
                      <div
                        className={`p-3.5 rounded-2xl border flex items-center space-x-2.5 ${
                          repairResult.success
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-rose-50 text-rose-900 border-rose-300'
                        }`}
                      >
                        {repairResult.success ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <div className="text-xs font-bold leading-snug">
                          {repairResult.message}
                        </div>
                      </div>

                      {/* Breakdown of synced records */}
                      {repairResult.success && (
                        <div className="space-y-2 pt-1">
                          <p className="text-[11px] font-bold text-stone-700 font-mono uppercase tracking-wider">
                            {lang === 'my' ? 'Cloud Database မှ အောင်မြင်စွာ ပြန်လည်ရယူနိုင်ခဲ့သော အချက်အလက်များ-' : 'Successfully Synchronized Firestore Records:'}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Bookings & History</span>
                              <span className="font-mono font-black text-stone-900 text-sm">
                                {repairResult.syncedCounts.bookings} ခု
                              </span>
                            </div>
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Services Catalog</span>
                              <span className="font-mono font-black text-stone-900 text-sm">
                                {repairResult.syncedCounts.services} ခု
                              </span>
                            </div>
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Stylists & Staff</span>
                              <span className="font-mono font-black text-stone-900 text-sm">
                                {repairResult.syncedCounts.designers} ဦး
                              </span>
                            </div>
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Client Profiles</span>
                              <span className="font-mono font-black text-stone-900 text-sm">
                                {repairResult.syncedCounts.clients} ယောက်
                              </span>
                            </div>
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Promo Vouchers</span>
                              <span className="font-mono font-black text-stone-900 text-sm">
                                {repairResult.syncedCounts.promos} ခု
                              </span>
                            </div>
                            <div className="p-2.5 bg-stone-100 rounded-xl border border-stone-200">
                              <span className="text-[10px] text-stone-500 block">Shop Settings</span>
                              <span className="font-mono font-bold text-emerald-600 text-sm">
                                ✓ Synchronized
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Pre-repair Overview info when not started yet */}
                  {!repairResult && !isRepairing && (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs text-stone-600">
                      <p className="font-bold text-stone-900">
                        {lang === 'my' ? 'ဤလုပ်ဆောင်ချက်က မည်သည့်အရာများ ပြုလုပ်ပေးမည်နည်း?' : 'What does this action do?'}
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
                        <li>PWA အဟောင်းနှင့် Browser CacheStorage အားလုံးကို အလိုအလျောက် ရှင်းလင်းပေးမည်။</li>
                        <li>Service Worker Script အသစ်ကို ချက်ချင်း အသက်သွင်းပေးမည်။</li>
                        <li>Firestore Database မှ မူရင်း Bookings & Services History များကို တိုက်ရိုက် ပြန်လည်ချိန်ညှိပေးမည်။</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                disabled={isRepairing}
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-wider cursor-pointer border border-stone-200 disabled:opacity-50"
              >
                {lang === 'my' ? 'ပိတ်မည် (Close)' : 'Close'}
              </button>

              <div className="flex items-center space-x-2">
                {repairResult?.success ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5 shadow-md active:scale-98 cursor-pointer transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'my' ? 'App အား ပြန်လည်ဖွင့်မည် (Reload App)' : 'Reload App'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isRepairing}
                    onClick={handlePerformRepair}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs uppercase tracking-wider font-mono flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-98 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'my' ? 'Cache ရှင်းပြီး Cloud မှ ပြန်ယူမည်' : 'Start Cloud Sync & Repair'}</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
