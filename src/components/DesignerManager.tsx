import React, { useState, useEffect } from 'react';
import { Designer } from '../types';
import { api } from '../api/client';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import { uploadImageToStorage } from '../utils/imageCompressor';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Star,
  Clock,
  X,
  Upload,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Calendar,
  DollarSign,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DesignerManagerProps {
  designers: Designer[];
  onRefresh: () => void;
}

const PRESET_AVATARS = [
  {
    name: 'Master Barber',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
  },
  {
    name: 'Hair Sculptor',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
  },
  {
    name: 'Fade Specialist',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
  },
  {
    name: 'Precision Artist',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
  },
  {
    name: 'Beard Stylist',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=400',
  },
  {
    name: 'VIP Groomer',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400',
  },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const QUICK_EXP = [1, 3, 5, 8, 10, 15];
const QUICK_COMMISSION = [30, 40, 50, 60, 70];

export const DesignerManager: React.FC<DesignerManagerProps> = ({
  designers,
  onRefresh,
}) => {
  // Full Screen Step-by-Step Flow State
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [editingDesigner, setEditingDesigner] = useState<Designer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Local optimistic state for instant zero-lag rendering
  const [displayDesigners, setDisplayDesigners] = useState<Designer[]>(designers);

  useEffect(() => {
    setDisplayDesigners(designers);
  }, [designers]);

  // Form Fields
  const [name, setName] = useState('');
  const [title, setTitle] = useState('Senior Barber');
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [commissionPercent, setCommissionPercent] = useState<number>(50);
  const [availableDays, setAvailableDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('19:00');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0].url);
  const [bio, setBio] = useState('');

  const openCreate = () => {
    setEditingDesigner(null);
    setName('');
    setTitle('Senior Barber');
    setExperienceYears(5);
    setCommissionPercent(50);
    setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    setStartTime('09:00');
    setEndTime('19:00');
    setAvatarUrl(PRESET_AVATARS[0].url);
    setBio('');
    setErrorMsg(null);
    setCurrentStep(1);
    setIsFullScreenOpen(true);
  };

  const openEdit = (d: Designer) => {
    setEditingDesigner(d);
    setName(d.name || '');
    setTitle(d.title || 'Senior Barber');
    setExperienceYears(d.experienceYears || 5);
    setCommissionPercent(d.commissionPercent ?? 50);
    setAvailableDays(
      d.availableDays && d.availableDays.length > 0
        ? d.availableDays
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    );
    setStartTime(d.workingHours?.start || '09:00');
    setEndTime(d.workingHours?.end || '19:00');
    setAvatarUrl(d.avatarUrl || PRESET_AVATARS[0].url);
    setBio(d.bio || '');
    setErrorMsg(null);
    setCurrentStep(1);
    setIsFullScreenOpen(true);
  };

  const toggleDay = (day: string) => {
    if (availableDays.includes(day)) {
      if (availableDays.length > 1) {
        setAvailableDays(availableDays.filter((d) => d !== day));
      }
    } else {
      setAvailableDays([...availableDays, day]);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);

    try {
      const url = await uploadImageToStorage(file, 'designers', 350, 350);
      if (url) {
        setAvatarUrl(url);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Please enter the stylist’s name.');
        return false;
      }
    }
    if (step === 3) {
      if (availableDays.length === 0) {
        setErrorMsg('Please select at least 1 working day.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const prevStep = () => {
    setErrorMsg(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSave = async () => {
    if (!validateStep(1) || !validateStep(3)) {
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Designer> = {
        name: name.trim(),
        title: title.trim() || 'Barber Stylist',
        experienceYears: Number(experienceYears) || 5,
        commissionPercent: Number(commissionPercent) ?? 50,
        specialties: ['Haircut', 'Styling'],
        avatarUrl: avatarUrl.trim() || PRESET_AVATARS[0].url,
        bio: bio.trim(),
        availableDays,
        workingHours: { start: startTime, end: endTime },
      };

      if (editingDesigner) {
        const updated = await api.updateDesigner(editingDesigner.id, payload);
        setDisplayDesigners((prev) => prev.map((d) => (d.id === editingDesigner.id ? { ...d, ...updated } : d)));
        showToast('Stylist profile updated.');
      } else {
        const created = await api.addDesigner(payload);
        setDisplayDesigners((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
        showToast('New stylist added.');
      }

      playSuccessChime();
      setIsFullScreenOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to save stylist. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    // Optimistic removal for instant feedback
    setDisplayDesigners((prev) => prev.filter((d) => d.id !== id));

    try {
      await api.deleteDesigner(id);
      playNotificationChime();
      showToast('Stylist removed.');
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast('Error removing stylist');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-mono border border-stone-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-stone-950 uppercase tracking-wider font-mono flex items-center space-x-2">
            <Users className="w-4 h-4 text-stone-700" />
            <span>Stylists & Staff ({displayDesigners.length})</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Manage stylist profiles, commissions, and shifts.</p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-stone-950 hover:bg-stone-800 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-sm cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Stylist (Full Screen)</span>
        </button>
      </div>

      {/* Designers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayDesigners.map((designer) => {
          const isActive = designer.active !== false;

          const handleToggleActive = async () => {
            try {
              const updated = await api.toggleDesignerActive(designer.id, !isActive);
              setDisplayDesigners((prev) =>
                prev.map((d) => (d.id === designer.id ? { ...d, active: !isActive } : d))
              );
              setToastMsg(`Stylist ${designer.name} is now ${!isActive ? 'Active' : 'Disabled'}`);
              setTimeout(() => setToastMsg(null), 3000);
              onRefresh();
            } catch (err) {
              console.error(err);
            }
          };

          return (
            <div
              key={designer.id}
              className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-all ${
                isActive ? 'border-stone-200' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div className="space-y-2.5">
                {/* Profile Card */}
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <img
                      src={designer.avatarUrl}
                      alt={designer.name}
                      referrerPolicy="no-referrer"
                      className={`w-12 h-12 rounded-xl object-cover border bg-stone-100 shrink-0 ${
                        isActive ? 'border-stone-200' : 'border-rose-300 opacity-60 grayscale'
                      }`}
                    />
                    <span
                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        isActive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-stone-950 font-mono truncate">
                        {designer.name}
                      </h3>
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border border-emerald-200 shrink-0">
                        {designer.commissionPercent ?? 50}% comm.
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 font-medium truncate mt-0.5">
                      {designer.title}
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] text-stone-400 font-mono mt-0.5">
                      <span>{designer.experienceYears || 5} yrs exp</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-bold">★ {designer.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Bio if exists */}
                {designer.bio && (
                  <p className="text-[11px] text-stone-500 line-clamp-1">
                    {designer.bio}
                  </p>
                )}

                {/* Working Days & Hours */}
                <div className="p-2 rounded-xl bg-stone-50 border border-stone-100 text-[11px] font-mono space-y-1">
                  <div className="flex justify-between text-stone-600">
                    <span className="text-stone-400">Shift:</span>
                    <span className="font-bold text-stone-800">
                      {designer.workingHours?.start || '09:00'} - {designer.workingHours?.end || '19:00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span className="text-stone-400">Days:</span>
                    <span className="font-medium text-stone-800 truncate ml-2">
                      {(designer.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions & Status Toggle */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleToggleActive}
                  className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                  }`}
                  title="Toggle Account Active Status"
                >
                  {isActive ? '● Active' : '○ Disabled'}
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setDeletingId(designer.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(designer)}
                    className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-mono font-bold inline-flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MINIMALIST FULL-SCREEN STEP-BY-STEP FLOW                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isFullScreenOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950 text-white flex flex-col justify-between overflow-y-auto">
            {/* Top Progress & Header Bar */}
            <div>
              {/* Progress Line */}
              <div className="w-full bg-stone-800 h-1">
                <div
                  className="bg-emerald-600 h-1 transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>

              {/* Navigation Header */}
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center text-emerald-300 font-mono font-bold text-xs">
                    0{currentStep}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block">
                      {editingDesigner ? 'Edit Stylist Flow' : 'New Stylist Flow'} • Step {currentStep} of {totalSteps}
                    </span>
                    <h3 className="text-sm font-bold text-stone-100 font-mono truncate">
                      {currentStep === 1 && 'Stylist Name & Title'}
                      {currentStep === 2 && 'Experience & Commission'}
                      {currentStep === 3 && 'Working Days & Shift Times'}
                      {currentStep === 4 && 'Profile Photo'}
                      {currentStep === 5 && 'Bio & Review'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullScreenOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel / Close</span>
                </button>
              </div>
            </div>

            {/* Main Interactive Step Canvas */}
            <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
              <div className="w-full space-y-6">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-rose-300 text-xs font-mono flex items-center space-x-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* STEP 1: NAME & TITLE */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-emerald-300 text-xs font-mono uppercase tracking-widest font-bold">
                        Question 01
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        What is the stylist's name & role?
                      </h2>
                      <p className="text-xs text-stone-400">
                        Enter the master barber or stylist's display name and their title.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-stone-400 text-xs font-mono mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          autoFocus
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              nextStep();
                            }
                          }}
                          placeholder="e.g. Vance Thorne"
                          className="w-full bg-stone-900 border-2 border-stone-800 focus:border-emerald-400 rounded-2xl px-5 py-4 text-base sm:text-lg text-white placeholder-stone-600 focus:outline-hidden transition-colors font-medium shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-400 text-xs font-mono mb-1.5">
                          Title / Position
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Senior Barber / Master Colorist"
                          className="w-full bg-stone-900 border border-stone-800 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm text-stone-200 placeholder-stone-600 focus:outline-hidden transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: EXPERIENCE & COMMISSION */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-emerald-300 text-xs font-mono uppercase tracking-widest font-bold">
                        Question 02
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Experience & Commission Rate
                      </h2>
                      <p className="text-xs text-stone-400">
                        Configure their background years and staff payout split percentage.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Experience */}
                      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
                        <label className="block text-stone-400 text-xs font-mono">
                          Experience (Years)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(Number(e.target.value))}
                          className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-400 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-hidden"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {QUICK_EXP.map((exp) => (
                            <button
                              key={exp}
                              type="button"
                              onClick={() => setExperienceYears(exp)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                experienceYears === exp
                                  ? 'bg-emerald-600 text-stone-950 font-bold'
                                  : 'bg-stone-800 text-stone-400 hover:text-white'
                              }`}
                            >
                              {exp} yrs
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Commission */}
                      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
                        <label className="block text-stone-400 text-xs font-mono">
                          Commission Rate (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={commissionPercent}
                          onChange={(e) => setCommissionPercent(Number(e.target.value))}
                          className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-400 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-hidden"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {QUICK_COMMISSION.map((comm) => (
                            <button
                              key={comm}
                              type="button"
                              onClick={() => setCommissionPercent(comm)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                commissionPercent === comm
                                  ? 'bg-emerald-600 text-stone-950 font-bold'
                                  : 'bg-stone-800 text-stone-400 hover:text-white'
                              }`}
                            >
                              {comm}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: WORKING DAYS & HOURS */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-emerald-300 text-xs font-mono uppercase tracking-widest font-bold">
                        Question 03
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Working Schedule & Shift Times
                      </h2>
                      <p className="text-xs text-stone-400">
                        Choose which days this stylist is available and their shift window.
                      </p>
                    </div>

                    {/* Days of week */}
                    <div className="space-y-2">
                      <label className="block text-stone-400 text-xs font-mono">
                        Available Days
                      </label>
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map((day) => {
                          const isSelected = availableDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`py-3 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-stone-950 border-emerald-400 shadow-md'
                                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-800'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Shift Times */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2">
                        <label className="block text-stone-400 text-xs font-mono">
                          Shift Start Time
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-400 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-hidden"
                        />
                      </div>

                      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2">
                        <label className="block text-stone-400 text-xs font-mono">
                          Shift End Time
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-400 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: AVATAR ASSET */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-emerald-300 text-xs font-mono uppercase tracking-widest font-bold">
                        Question 04
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Choose a profile avatar
                      </h2>
                      <p className="text-xs text-stone-400">
                        Pick a high-definition stylist portrait or upload a team photo.
                      </p>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {PRESET_AVATARS.map((p, idx) => {
                        const isSelected = avatarUrl === p.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatarUrl(p.url)}
                            className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-emerald-400 ring-2 ring-emerald-400/40 scale-95'
                                : 'border-stone-800 hover:border-stone-600 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-stone-950/50 flex items-center justify-center text-emerald-300">
                                <Check className="w-5 h-5" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Upload or URL */}
                    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="url"
                        placeholder="Paste image URL..."
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="w-full sm:flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-400"
                      />
                      <label className="w-full sm:w-auto px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-mono font-bold cursor-pointer flex items-center justify-center space-x-1.5 shrink-0 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 5: BIO & REVIEW */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-emerald-300 text-xs font-mono uppercase tracking-widest font-bold">
                        Step 05 • Review
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Review Stylist Profile
                      </h2>
                      <p className="text-xs text-stone-400">
                        Check profile details before saving to the stylist team.
                      </p>
                    </div>

                    {/* Preview Card */}
                    <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-4">
                      <div className="flex items-center space-x-4">
                        <img
                          src={avatarUrl}
                          alt={name}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-md shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white font-mono truncate">
                              {name}
                            </h3>
                            <span className="text-emerald-300 text-xs font-mono font-bold flex items-center space-x-1">
                              <Star className="w-3.5 h-3.5 fill-emerald-500" />
                              <span>5.0</span>
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 font-medium">{title}</p>
                          <p className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                            {experienceYears} Years Experience • {commissionPercent}% Commission
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800/80 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-stone-400">
                          <span>Shift:</span>
                          <span className="text-white font-bold">{startTime} - {endTime}</span>
                        </div>
                        <div className="flex justify-between text-stone-400">
                          <span>Working Days:</span>
                          <span className="text-emerald-300 font-bold">{availableDays.join(', ')}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-stone-400 text-xs font-mono mb-1.5">
                          Specialty Bio (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="e.g. Master of hot towel scissor work and skin fades with 10+ years of classic barbering experience."
                          className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-400 rounded-xl p-3 text-xs text-stone-200 placeholder-stone-600 focus:outline-hidden transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="border-t border-stone-800 bg-stone-950/95 backdrop-blur-md px-4 sm:px-6 py-4">
              <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-mono font-bold flex items-center space-x-2 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-300 text-stone-950 text-xs font-mono font-bold flex items-center space-x-2 cursor-pointer transition-all shadow-md active:scale-98"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-mono font-black flex items-center space-x-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : editingDesigner ? 'Save Profile' : 'Add Stylist'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-xs space-y-3 text-center shadow-xl">
            <h3 className="text-sm font-mono font-bold text-stone-950 uppercase">Delete Stylist?</h3>
            <p className="text-xs text-stone-500">Are you sure you want to remove this stylist?</p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
