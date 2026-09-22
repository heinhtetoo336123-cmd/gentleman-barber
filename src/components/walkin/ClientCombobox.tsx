import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserCheck, Phone, ChevronDown, X, AlertCircle, Sparkles, CheckCircle2, UserPlus, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { normalizePhoneNumber, phonesMatch } from '../../utils/notifications';

export interface KnownClient {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisitDate: string;
  isRegistered?: boolean;
}

interface ClientComboboxProps {
  nameValue: string;
  phoneValue: string;
  onChangeName: (name: string) => void;
  onChangePhone: (phone: string) => void;
  knownClients: KnownClient[];
  lang?: 'en' | 'my';
  placeholderName?: string;
  placeholderPhone?: string;
  requiredName?: boolean;
  idPrefix?: string;
}

// Check if current name represents an anonymous Walk-in Guest
export function isAnonymousGuestName(name: string): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  return (
    clean === 'walk-in guest' ||
    clean === 'walk-in' ||
    clean === 'walkin guest' ||
    clean === 'walkin' ||
    clean === 'guest' ||
    clean === 'ဆိုင်ရောက် ဧည့်သည်' ||
    clean === 'ဧည့်သည်'
  );
}

export const ClientCombobox: React.FC<ClientComboboxProps> = ({
  nameValue,
  phoneValue,
  onChangeName,
  onChangePhone,
  knownClients,
  lang = 'en',
  placeholderName = 'e.g. Ko Aung / Mg Mg',
  placeholderPhone = '09...',
  requiredName = true,
  idPrefix = 'walkin'
}) => {
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [numberBlockedWarning, setNumberBlockedWarning] = useState<string | null>(null);

  const nameContainerRef = useRef<HTMLDivElement>(null);
  const phoneContainerRef = useRef<HTMLDivElement>(null);

  const isGuestMode = isAnonymousGuestName(nameValue);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nameContainerRef.current && !nameContainerRef.current.contains(event.target as Node)) {
        setIsNameDropdownOpen(false);
      }
      if (phoneContainerRef.current && !phoneContainerRef.current.contains(event.target as Node)) {
        setIsPhoneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if currently entered client exists in known clients
  const matchedExistingClient = useMemo(() => {
    if (isGuestMode) return null;
    const cleanPhone = phoneValue ? normalizePhoneNumber(phoneValue) : '';
    const cleanName = nameValue ? nameValue.trim().toLowerCase() : '';

    if (!cleanPhone && !cleanName) return null;

    return knownClients.find(c => {
      if (cleanPhone && c.phone && phonesMatch(c.phone, cleanPhone)) return true;
      if (cleanName && c.name && c.name.trim().toLowerCase() === cleanName && !isAnonymousGuestName(c.name)) return true;
      return false;
    }) || null;
  }, [nameValue, phoneValue, knownClients, isGuestMode]);

  // Matching clients filtered by typed name
  const nameFilteredClients = useMemo(() => {
    const q = nameValue.trim().toLowerCase();
    const list = knownClients.filter(c => !isAnonymousGuestName(c.name));
    if (!q || isAnonymousGuestName(nameValue)) {
      return [...list].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 10);
    }
    return list
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, 12);
  }, [knownClients, nameValue]);

  // Matching clients filtered by typed phone
  const phoneFilteredClients = useMemo(() => {
    const q = phoneValue.trim();
    const qNorm = normalizePhoneNumber(q);
    const list = knownClients.filter(c => !isAnonymousGuestName(c.name) && c.phone);
    if (!q) {
      return [...list].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 10);
    }
    return list
      .filter(c => {
        const norm = normalizePhoneNumber(c.phone || '');
        return (norm && norm.includes(qNorm)) || (c.phone && c.phone.includes(q));
      })
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, 12);
  }, [knownClients, phoneValue]);

  // Handle client selection from either dropdown
  const handleSelectClient = (client: KnownClient) => {
    onChangeName(client.name);
    if (isAnonymousGuestName(client.name)) {
      onChangePhone('');
    } else {
      onChangePhone(client.phone || '');
    }
    setIsNameDropdownOpen(false);
    setIsPhoneDropdownOpen(false);
  };

  // Quick 1-Click Anonymous Walk-in Guest
  const handleSelectWalkinGuest = () => {
    onChangeName('Walk-in Guest');
    onChangePhone('');
    setIsNameDropdownOpen(false);
    setIsPhoneDropdownOpen(false);
  };

  // Clear all fields
  const handleClear = () => {
    onChangeName('');
    onChangePhone('');
    setIsNameDropdownOpen(false);
    setIsPhoneDropdownOpen(false);
  };

  // Handle Name Input Change (Prevent numbers in name)
  const handleNameChange = (val: string) => {
    const hasNumbers = /[0-9\u1040-\u1049]/.test(val);
    if (hasNumbers) {
      const stripped = val.replace(/[0-9\u1040-\u1049]/g, '');
      onChangeName(stripped);
      setNumberBlockedWarning(
        lang === 'my'
          ? '⚠️ အမည်တွင် ဂဏန်း ထည့်၍မရပါ (ဖုန်းနံပါတ် အကွက်တွင် ရိုက်ထည့်ပါ)'
          : '⚠️ Numbers not allowed in name field'
      );
      setTimeout(() => setNumberBlockedWarning(null), 2500);
      setIsNameDropdownOpen(true);
      return;
    }

    onChangeName(val);
    setIsNameDropdownOpen(true);

    if (isAnonymousGuestName(val)) {
      onChangePhone('');
      return;
    }

    // Auto-fill phone if exact single client name matches
    if (val.trim()) {
      const exactMatch = knownClients.find(
        (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase() && !isAnonymousGuestName(c.name)
      );
      if (exactMatch && exactMatch.phone && !phoneValue) {
        onChangePhone(exactMatch.phone);
      }
    }
  };

  // Handle Phone Input Change
  const handlePhoneChange = (val: string) => {
    onChangePhone(val);
    setIsPhoneDropdownOpen(true);

    if (val.trim().length >= 7 && !nameValue) {
      const match = knownClients.find((c) => phonesMatch(c.phone, val));
      if (match && match.name && !isAnonymousGuestName(match.name)) {
        onChangeName(match.name);
      }
    }
  };

  return (
    <div className="space-y-3 font-sans">
      
      {/* CARD CONTAINER */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs">
        
        {/* Status Header Indicator & Quick Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-100 text-xs flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            {isGuestMode ? (
              <span className="inline-flex items-center space-x-1 text-emerald-800 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>Walk-in Guest Mode ({lang === 'my' ? 'ဖုန်းနံပါတ်မလိုပါ' : 'No phone needed'})</span>
              </span>
            ) : matchedExistingClient ? (
              <span className="inline-flex items-center space-x-1 text-emerald-800 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>
                  {lang === 'my'
                    ? `စာရင်းရှိ Client: ${matchedExistingClient.name} (${matchedExistingClient.visitCount} visits)`
                    : `Existing Client: ${matchedExistingClient.name} (${matchedExistingClient.visitCount} visits)`}
                </span>
              </span>
            ) : nameValue.trim() ? (
              <span className="inline-flex items-center space-x-1 text-blue-800 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>
                  {lang === 'my'
                    ? '✨ Client အသစ်အဖြစ် အလိုအလျောက် မှတ်သားမည်'
                    : '✨ Will be saved as New Client'}
                </span>
              </span>
            ) : (
              <span className="text-stone-500 text-[11px] font-medium">
                {lang === 'my' ? 'အမည် သို့မဟုတ် ဖုန်း ရိုက်ထည့်၍ စာရင်းမှ ရွေးချယ်နိုင်ပါသည်' : 'Type name or phone to auto-suggest existing clients'}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick 1-Click Anonymous Walk-in Guest Button */}
            <button
              type="button"
              onClick={handleSelectWalkinGuest}
              className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all border flex items-center space-x-1 ${
                isGuestMode
                  ? 'bg-stone-900 text-emerald-300 border-stone-900 shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
              title="Set as anonymous guest"
            >
              <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Walk-in Guest</span>
            </button>

            {(nameValue || phoneValue) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-stone-400 hover:text-rose-600 font-mono flex items-center space-x-1 cursor-pointer transition-colors p-1"
                title="Clear inputs"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ရှင်းမည်' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Field Integrated Grid: Name & Phone with In-place Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* ========================================================================= */}
          {/* CUSTOMER NAME INPUT & IN-PLACE AUTOCOMPLETE DROPDOWN                     */}
          {/* ========================================================================= */}
          <div className="relative" ref={nameContainerRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-stone-700 uppercase font-mono tracking-wider flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-stone-900" />
                <span>{lang === 'my' ? 'ဧည့်သည် အမည် (Customer Name)' : 'Customer Name'}</span>
                {requiredName && <span className="text-rose-500">*</span>}
              </label>

              {knownClients.length > 0 && (
                <span className="text-[10px] font-mono text-stone-400">
                  {lang === 'my' ? 'စာရင်းမှ ရွေးရန်' : 'type to search'}
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id={`${idPrefix}-customer-name-input`}
                type="text"
                required={requiredName}
                placeholder={placeholderName}
                value={nameValue}
                onFocus={() => setIsNameDropdownOpen(true)}
                onChange={(e) => handleNameChange(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const clean = pastedText.replace(/[0-9\u1040-\u1049]/g, '');
                  if (clean !== pastedText) {
                    setNumberBlockedWarning(
                      lang === 'my'
                        ? '⚠️ အမည်တွင် ဂဏန်း ထည့်၍မရပါ'
                        : '⚠️ Numbers removed from name'
                    );
                    setTimeout(() => setNumberBlockedWarning(null), 2500);
                  }
                  handleNameChange(nameValue + clean);
                }}
                className={`w-full bg-stone-50 border rounded-xl py-2 pl-3 pr-8 text-xs text-stone-900 font-bold focus:outline-hidden transition-all ${
                  isGuestMode
                    ? 'border-emerald-300 bg-emerald-50/40 text-stone-900'
                    : 'border-stone-300 focus:border-stone-900 focus:bg-white shadow-2xs'
                }`}
              />

              <button
                type="button"
                onClick={() => setIsNameDropdownOpen(!isNameDropdownOpen)}
                className="absolute right-2 p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer transition-colors"
                title="Toggle Name List"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isNameDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* NAME DROPDOWN POPOVER */}
            <AnimatePresence>
              {isNameDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-60 flex flex-col font-sans"
                >
                  <div className="p-2 bg-stone-50 border-b border-stone-100 text-[10px] font-mono text-stone-500 flex items-center justify-between">
                    <span>
                      {lang === 'my' ? 'ကိုက်ညီသော အမည်များ' : 'Matching Clients by Name'} ({nameFilteredClients.length})
                    </span>
                    {nameValue && !isGuestMode && (
                      <span className="text-emerald-800 font-bold">"{nameValue}"</span>
                    )}
                  </div>

                  <div className="overflow-y-auto divide-y divide-stone-50 flex-1 p-1">
                    {/* Quick Walk-in Guest item */}
                    <button
                      type="button"
                      onClick={handleSelectWalkinGuest}
                      className="w-full p-2 rounded-xl text-left flex items-center justify-between hover:bg-emerald-50 text-stone-900 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-md bg-stone-900 text-emerald-300 flex items-center justify-center text-[10px] font-bold">⚡</span>
                        <span className="font-bold text-stone-900">Walk-in Guest ({lang === 'my' ? 'ဧည့်သည်' : 'No Phone'})</span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-400">Quick</span>
                    </button>

                    {/* Matching list */}
                    {nameFilteredClients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-stone-400 font-mono">
                        {lang === 'my' ? 'ကိုက်ညီသော အမည် မရှိပါ (အသစ်အဖြစ် သိမ်းဆည်းပါမည်)' : 'No matching clients found'}
                      </div>
                    ) : (
                      nameFilteredClients.map((client) => {
                        const isSelected = nameValue && client.name.toLowerCase() === nameValue.toLowerCase();
                        return (
                          <button
                            key={client.id || client.name + client.phone}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                              isSelected
                                ? 'bg-emerald-50 text-stone-950 font-bold border border-emerald-200'
                                : 'hover:bg-stone-50 text-stone-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <div className="w-6 h-6 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <span className="font-bold text-stone-900 block truncate">{client.name}</span>
                                {client.phone && (
                                  <span className="text-[10px] font-mono text-stone-500 block">
                                    {client.phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {client.visitCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[9px] font-bold">
                                  {client.visitCount} visits
                                </span>
                              )}
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ========================================================================= */}
          {/* CUSTOMER PHONE INPUT & IN-PLACE AUTOCOMPLETE DROPDOWN                    */}
          {/* ========================================================================= */}
          <div className="relative" ref={phoneContainerRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-stone-700 uppercase font-mono tracking-wider flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-stone-900" />
                <span>{lang === 'my' ? 'ဖုန်းနံပါတ် (Customer Phone)' : 'Customer Phone'}</span>
              </label>

              {isGuestMode ? (
                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                  {lang === 'my' ? 'မလိုအပ်ပါ' : 'optional for guest'}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-stone-400">
                  {lang === 'my' ? 'ဂဏန်း ရိုက်ထည့်ရှာရန်' : 'type phone'}
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id={`${idPrefix}-customer-phone-input`}
                type="tel"
                disabled={isGuestMode}
                placeholder={isGuestMode ? 'Walk-in Guest (No phone)' : placeholderPhone}
                value={isGuestMode ? '' : phoneValue}
                onFocus={() => {
                  if (!isGuestMode) setIsPhoneDropdownOpen(true);
                }}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={`w-full rounded-xl py-2 pl-3 pr-8 text-xs font-mono font-bold transition-all ${
                  isGuestMode
                    ? 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed select-none'
                    : 'bg-stone-50 border border-stone-300 text-stone-900 focus:bg-white focus:outline-hidden focus:border-stone-900 shadow-2xs'
                }`}
              />

              {!isGuestMode && (
                <button
                  type="button"
                  onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                  className="absolute right-2 p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer transition-colors"
                  title="Toggle Phone List"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPhoneDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* PHONE DROPDOWN POPOVER */}
            <AnimatePresence>
              {isPhoneDropdownOpen && !isGuestMode && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-60 flex flex-col font-sans"
                >
                  <div className="p-2 bg-stone-50 border-b border-stone-100 text-[10px] font-mono text-stone-500 flex items-center justify-between">
                    <span>
                      {lang === 'my' ? 'ကိုက်ညီသော ဖုန်းနံပါတ်များ' : 'Matching Clients by Phone'} ({phoneFilteredClients.length})
                    </span>
                    {phoneValue && (
                      <span className="text-emerald-800 font-bold">"{phoneValue}"</span>
                    )}
                  </div>

                  <div className="overflow-y-auto divide-y divide-stone-50 flex-1 p-1">
                    {phoneFilteredClients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-stone-400 font-mono">
                        {lang === 'my' ? 'ကိုက်ညီသော ဖုန်းနံပါတ် မရှိပါ' : 'No matching phone numbers found'}
                      </div>
                    ) : (
                      phoneFilteredClients.map((client) => {
                        const isSelected = phoneValue && phonesMatch(phoneValue, client.phone);
                        return (
                          <button
                            key={client.id || client.name + client.phone}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                              isSelected
                                ? 'bg-emerald-50 text-stone-950 font-bold border border-emerald-200'
                                : 'hover:bg-stone-50 text-stone-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <div className="w-6 h-6 rounded-lg bg-stone-900 text-emerald-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                                📞
                              </div>
                              <div className="truncate">
                                <span className="font-mono font-bold text-stone-950 block text-xs">{client.phone}</span>
                                <span className="text-[10px] text-stone-600 font-bold block truncate">
                                  {client.name}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {client.visitCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[9px] font-bold">
                                  {client.visitCount} visits
                                </span>
                              )}
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Warning Notice */}
      <AnimatePresence>
        {numberBlockedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-mono font-bold flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{numberBlockedWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setNumberBlockedWarning(null)}
              className="text-stone-400 hover:text-stone-700 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
