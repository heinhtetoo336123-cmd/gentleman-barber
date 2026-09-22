import React, { useState, useEffect, useRef } from 'react';
import { PaymentSettings, BranchLocation } from '../types';
import { api } from '../api/client';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import { BrandLogo } from './BrandLogo';
import { ImageCropModal } from './ImageCropModal';
import {
  CreditCard,
  Phone,
  MapPin,
  Save,
  MessageSquare,
  Check,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Building2,
  Upload,
  Image as ImageIcon,
  Crop,
  RotateCcw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PaymentSettingsManager: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<PaymentSettings>({
    shopName: 'GENTLEMAN',
    tagline: 'Barber Shop',
    logoUrl: '',
    kpayAccountName: 'GENTLEMAN BARBER LOUNGE',
    kpayNumber: '09263188228',
    waveAccountName: 'GENTLEMAN BARBER LOUNGE',
    waveNumber: '09263188228',
    viberLink: 'https://viber.click/959263188228',
    viberPhone: '09263188228',
    shopPhone: '09263188228',
    shopAddress: 'No. 123, Pyay Road, Kamayut Township, Yangon',
    shopLocations: [
      { id: 'loc-1', name: 'Bahan Township, Yangon', desc: 'Main Flagship Lounge • Sayar San Rd', address: 'No. 45, Sayar San Rd, Bahan, Yangon', phone: '09263188228', active: true },
      { id: 'loc-2', name: 'Downtown Branch, Yangon', desc: 'Sule Square Area • VIP Styling Bar', address: 'Sule Square Level 2, Kyauktada, Yangon', phone: '09263188229', active: true },
      { id: 'loc-3', name: 'Sanchaung Branch, Yangon', desc: 'Shin Saw Pu Rd • Hair & Nail Spa', address: 'No. 88, Shin Saw Pu Rd, Sanchaung, Yangon', phone: '09263188230', active: true },
      { id: 'loc-4', name: 'Hlaing Township, Yangon', desc: 'Parami Rd • Modern Barber Studio', address: 'Parami Rd Junction, Hlaing, Yangon', phone: '09263188231', active: true },
    ],
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Logo Crop & Upload State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchLocation | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchDesc, setBranchDesc] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchActive, setBranchActive] = useState(true);

  useEffect(() => {
    const unsub = api.subscribeToSettings((data) => {
      if (data) {
        setSettings(data);
        if (data.logoUrl) {
          try {
            localStorage.setItem('gentleman_shop_logo', data.logoUrl);
          } catch {
            // ignore
          }
        }
      }
    });
    return () => unsub();
  }, []);

  const handleLogoFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('ကျေးဇူးပြု၍ ဓာတ်ပုံဖိုင် (PNG, JPG, SVG, WebP) သာ ရွေးချယ်ပေးပါရန်။');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setCropImageSrc(result);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setIsCropModalOpen(false);
    setCropImageSrc(null);

    // Apply logo to settings immediately
    const updatedSettings = { ...settings, logoUrl: croppedDataUrl };
    setSettings(updatedSettings);

    try {
      localStorage.setItem('gentleman_shop_logo', croppedDataUrl);
      window.dispatchEvent(
        new CustomEvent('shop-logo-updated', { detail: { logoUrl: croppedDataUrl } })
      );
    } catch {
      // ignore
    }

    playSuccessChime();
  };

  const handleResetDefaultLogo = () => {
    if (confirm('Shop Logo အား မူလ Logo အဖြစ် ပြန်လည်ပြောင်းလဲရန် သေချာပါသလား?')) {
      const updatedSettings = { ...settings, logoUrl: '' };
      setSettings(updatedSettings);
      try {
        localStorage.removeItem('gentleman_shop_logo');
        window.dispatchEvent(
          new CustomEvent('shop-logo-updated', { detail: { logoUrl: '/logo.png' } })
        );
      } catch {
        // ignore
      }
      playNotificationChime();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      // 1-second spring loading feedback
      await new Promise((r) => setTimeout(r, 950));
      await api.updateSettings(settings);
      if (settings.logoUrl) {
        try {
          localStorage.setItem('gentleman_shop_logo', settings.logoUrl);
          window.dispatchEvent(
            new CustomEvent('shop-logo-updated', { detail: { logoUrl: settings.logoUrl } })
          );
        } catch {
          // ignore
        }
      }
      await api.addAuditLog('Admin', 'Payment & Branch Settings Updated', `Updated Settings & Logo`);
      playSuccessChime();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Branch CRUD
  const openAddBranch = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchDesc('');
    setBranchAddress('');
    setBranchPhone(settings.shopPhone || '09263188228');
    setBranchActive(true);
    setIsBranchModalOpen(true);
  };

  const openEditBranch = (branch: BranchLocation) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
    setBranchDesc(branch.desc);
    setBranchAddress(branch.address || '');
    setBranchPhone(branch.phone || '');
    setBranchActive(branch.active);
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    const currentLocations = settings.shopLocations || [];
    let updatedLocations: BranchLocation[];

    if (editingBranch) {
      updatedLocations = currentLocations.map((b) =>
        b.id === editingBranch.id
          ? {
              ...b,
              name: branchName.trim(),
              desc: branchDesc.trim() || 'Active Service Branch',
              address: branchAddress.trim(),
              phone: branchPhone.trim(),
              active: branchActive,
            }
          : b
      );
    } else {
      const newBranch: BranchLocation = {
        id: `loc-${Date.now()}`,
        name: branchName.trim(),
        desc: branchDesc.trim() || 'Active Service Branch',
        address: branchAddress.trim(),
        phone: branchPhone.trim(),
        active: branchActive,
      };
      updatedLocations = [...currentLocations, newBranch];
    }

    setSettings((prev) => ({
      ...prev,
      shopLocations: updatedLocations,
    }));
    playNotificationChime();
    setIsBranchModalOpen(false);
  };

  const handleDeleteBranch = (id: string) => {
    const updated = (settings.shopLocations || []).filter((b) => b.id !== id);
    setSettings((prev) => ({
      ...prev,
      shopLocations: updated,
    }));
  };

  const toggleBranchActive = (id: string) => {
    const updated = (settings.shopLocations || []).map((b) =>
      b.id === id ? { ...b, active: !b.active } : b
    );
    setSettings((prev) => ({
      ...prev,
      shopLocations: updated,
    }));
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-6 space-y-6 shadow-2xs">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-stone-900 uppercase tracking-wider font-mono flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>ငွေချေမှု နှင့် ဆိုင်ခွဲ တည်နေရာများ (PAYMENT & BRANCH SETTINGS)</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Admin Side မှ KBZPay / WavePay အကောင့်၊ Viber Link နှင့် Client App ပင်မစာမျက်နှာတွင် ပြသသော ဆိုင်ခွဲလိပ်စာများကို ထိန်းချုပ်ပြင်ဆင်နိုင်ပါသည်။
          </p>
        </div>

        {saved && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Dynamic Brand Name & Identity Section */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 text-white rounded-3xl space-y-4 shadow-lg border border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 font-bold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shop Branding & Name Options (ဆိုင်အမည် ထိန်းချုပ်ရန်)</span>
              </span>
              <h3 className="text-base font-black tracking-wide text-white mt-0.5">
                Brand Name & Identity Customizer
              </h3>
            </div>
            <span className="text-[11px] font-mono text-stone-400">
              Active: <strong className="text-white">{settings.shopName || 'GENTLEMAN'}</strong>
            </span>
          </div>

          {/* Custom Brand Name & Tagline Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5 font-mono">
                Custom Brand Name (ဆိုင်အမည် / Brand Name)
              </label>
              <input
                type="text"
                value={settings.shopName || ''}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-hidden font-bold tracking-wider placeholder:text-stone-500"
                placeholder="e.g. GENTLEMAN"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5 font-mono">
                Tagline / Subtitle (ဆောင်ပုဒ် / အညွှန်း)
              </label>
              <input
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-hidden placeholder:text-stone-500"
                placeholder="e.g. Barber & Grooming Lounge"
              />
            </div>
          </div>

          {/* Shop Logo & Icon Upload Section */}
          <div className="p-4 bg-stone-950/90 rounded-2xl border border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase text-emerald-300 flex items-center space-x-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-300" />
                <span>Shop Logo & App Icon (ဆိုင် Logo ဓာတ်ပုံ တင်ရန်)</span>
              </label>
              {settings.logoUrl && (
                <button
                  type="button"
                  onClick={handleResetDefaultLogo}
                  className="text-[10px] font-mono text-stone-400 hover:text-rose-400 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Live Preview Circle */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-full border-2 border-emerald-500/80 bg-white shadow-md p-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={settings.logoUrl || '/logo.png'}
                    alt="Active Shop Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.png';
                    }}
                  />
                </div>
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-stone-900 border border-stone-700 text-stone-300 text-[9px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                  {settings.logoUrl ? 'Custom' : 'Default'}
                </span>
              </div>

              {/* Upload Drop Zone & Actions */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleLogoFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className={`flex-1 w-full border-2 border-dashed rounded-2xl p-4 text-center transition-all flex flex-col items-center justify-center space-y-2 ${
                  isDraggingOver
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-stone-700 hover:border-stone-600 bg-stone-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleLogoFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-mono font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Logo ဓာတ်ပုံရွေးချယ်မည် (Upload Image)</span>
                  </button>

                  {settings.logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCropImageSrc(settings.logoUrl || null);
                        setIsCropModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-mono text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Crop / Resize</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-stone-400 font-sans">
                  သို့မဟုတ် ဤနေရာသို့ Logo ပုံ ဆွဲထည့်ပါ (Drag & Drop) • PNG, JPG, WebP, SVG ထောက်ပံ့ပါသည်
                </p>
              </div>
            </div>
          </div>

          {/* Live Mockup Badge */}
          <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="text-stone-500 font-mono text-[10px] uppercase">Live Header Preview:</span>
              <BrandLogo
                size={28}
                logoUrl={settings.logoUrl}
                shopName={settings.shopName}
                tagline={settings.tagline}
              />
              <span className="font-mono font-black text-emerald-300 text-sm tracking-wider">
                {settings.shopName || 'GENTLEMAN'}
              </span>
              <span className="text-[10px] text-stone-400 font-mono hidden sm:inline">
                • {settings.tagline || 'Barber & Grooming Lounge'}
              </span>
            </div>
            <span className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full font-mono">
              Auto-Applies App-wide
            </span>
          </div>
        </div>
        
        {/* KBZPay / WavePay Accounts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* KBZPay */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-sm font-bold text-blue-700 flex items-center space-x-2 font-mono">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>KBZPay Account Details</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                KBZPay Account Name (အကောင့်အမည်)
              </label>
              <input
                type="text"
                value={settings.kpayAccountName}
                onChange={(e) => setSettings({ ...settings, kpayAccountName: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. GENTLEMAN BARBER LOUNGE"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                KBZPay Phone Number (ဖုန်းနံပါတ်)
              </label>
              <input
                type="text"
                value={settings.kpayNumber}
                onChange={(e) => setSettings({ ...settings, kpayNumber: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. 09263188228"
              />
            </div>
          </div>

          {/* WavePay */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-sm font-bold text-emerald-800 flex items-center space-x-2 font-mono">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>WavePay Account Details</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                WavePay Account Name (အကောင့်အမည်)
              </label>
              <input
                type="text"
                value={settings.waveAccountName}
                onChange={(e) => setSettings({ ...settings, waveAccountName: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. GENTLEMAN BARBER LOUNGE"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                WavePay Phone Number (ဖုန်းနံပါတ်)
              </label>
              <input
                type="text"
                value={settings.waveNumber}
                onChange={(e) => setSettings({ ...settings, waveNumber: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. 09263188228"
              />
            </div>
          </div>

        </div>

        {/* Viber & Shop Hotline Contacts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Viber Direct Settings */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-sm font-bold text-purple-800 flex items-center space-x-2 font-mono">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <span>Viber Direct Link & Phone</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Viber Direct Link (URL)
              </label>
              <input
                type="text"
                value={settings.viberLink}
                onChange={(e) => setSettings({ ...settings, viberLink: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:border-purple-500 focus:outline-hidden"
                placeholder="e.g. https://viber.click/959263188228"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Viber Contact Phone Number
              </label>
              <input
                type="text"
                value={settings.viberPhone}
                onChange={(e) => setSettings({ ...settings, viberPhone: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:border-purple-500 focus:outline-hidden"
                placeholder="e.g. 09263188228"
              />
            </div>
          </div>

          {/* Shop General Info */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <h3 className="text-sm font-bold text-emerald-800 flex items-center space-x-2 font-mono">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Shop Hotline & Main HQ</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Shop Hotline Phone
              </label>
              <input
                type="text"
                value={settings.shopPhone}
                onChange={(e) => setSettings({ ...settings, shopPhone: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. 09263188228"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Shop Main Address (ပင်မရုံးချုပ် လိပ်စာ)
              </label>
              <textarea
                rows={2}
                value={settings.shopAddress}
                onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:border-emerald-500 focus:outline-hidden"
                placeholder="Address detail..."
              />
            </div>
          </div>

        </div>

        {/* 🏢 Branch Locations Manager (Admin Controlled) */}
        <div className="p-4 sm:p-5 bg-emerald-500/5 rounded-3xl border border-emerald-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-stone-900 uppercase font-mono tracking-wider flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>ဆိုင်ခွဲ တည်နေရာများ စီမံခန့်ခွဲမှု (BRANCH LOCATIONS MANAGER)</span>
              </h3>
              <p className="text-xs text-stone-600">
                Client Side ပင်မစာမျက်နှာရှိ တည်နေရာ ရွေးချယ်မှု (Current Location Selector) တွင် ပြသမည့် ဆိုင်ခွဲများကို ထည့်သွင်း/ပြင်ဆင်/ဖျက်ပစ်နိုင်ပါသည်။
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              type="button"
              onClick={openAddBranch}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ဆိုင်ခွဲအသစ် ထည့်ရန်</span>
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(settings.shopLocations || []).map((branch) => (
              <div
                key={branch.id}
                className={`bg-white rounded-2xl border p-3.5 space-y-2 transition-all shadow-2xs ${
                  branch.active ? 'border-stone-200' : 'border-stone-200/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-stone-900 line-clamp-1">{branch.name}</h4>
                      <p className="text-[11px] text-stone-500 line-clamp-1">{branch.desc}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleBranchActive(branch.id)}
                    title={branch.active ? 'Active (Click to Hide)' : 'Hidden (Click to Enable)'}
                    className={`p-1 rounded-lg text-xs font-bold cursor-pointer ${
                      branch.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-stone-100 text-stone-400 border border-stone-200'
                    }`}
                  >
                    {branch.active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {branch.address && (
                  <p className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-100 font-mono">
                    📍 {branch.address}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
                  <span className="text-stone-500 font-mono">☎ {branch.phone || '09263188228'}</span>
                  
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => openEditBranch(branch)}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-[10px] cursor-pointer flex items-center space-x-1 border border-stone-200"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBranch(branch.id)}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {(settings.shopLocations || []).length === 0 && (
            <div className="text-center py-6 text-stone-400 text-xs bg-white rounded-2xl border border-stone-200">
              ဆိုင်ခွဲများ မထည့်သွင်းရသေးပါ။ + ဆိုင်ခွဲအသစ် ထည့်ရန် နှိပ်ပါ။
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-extrabold text-xs uppercase tracking-wider flex items-center space-x-2 cursor-pointer transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'သိမ်းဆည်းနေပါသည်...' : 'ပြောင်းလဲမှုများ သိမ်းဆည်းမည် (Save Settings)'}</span>
          </motion.button>
        </div>

      </form>

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm font-bold text-stone-900 uppercase font-mono">
                {editingBranch ? 'Edit Branch Location' : 'Add New Branch Location'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Branch Name (ဆိုင်ခွဲ အမည်) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bahan Township, Yangon"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Tagline / Short Desc</label>
                <input
                  type="text"
                  placeholder="e.g. Main Flagship Lounge • Sayar San Rd"
                  value={branchDesc}
                  onChange={(e) => setBranchDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Address Detail (အသေးစိတ် လိပ်စာ)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. No. 45, Sayar San Rd, Bahan, Yangon"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Branch Contact Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 09263188228"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={branchActive}
                    onChange={(e) => setBranchActive(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <span className="text-stone-700 font-medium">Show in Client Location Selector (ဖွင့်ထားမည်)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold cursor-pointer shadow-xs"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Image Crop Modal for Logo */}
      {isCropModalOpen && cropImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropImageSrc}
          title="Shop Logo နေရာညှိခြင်းနှင့် အဝိုင်း Crop ပြုလုပ်ခြင်း (Logo Crop & Alignment)"
          cropShape="circle"
          aspectRatio={1}
          outputSize={512}
          onClose={() => {
            setIsCropModalOpen(false);
            setCropImageSrc(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}

    </div>
  );
};
