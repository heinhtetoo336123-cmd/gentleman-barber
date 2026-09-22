import React, { useState, useEffect } from 'react';
import { Service } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import { uploadImageToStorage } from '../utils/imageCompressor';
import { ImageCropModal } from './ImageCropModal';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  Scissors,
  Search,
  X,
  Upload,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Sparkles,
  Crop,
  CheckCircle,
  GripVertical,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ServiceCatalogManagerProps {
  services: Service[];
  onRefresh: () => void;
  initialEditService?: Service | null;
  onClearInitialEditService?: () => void;
}

export const PRESET_PHOTOS = [
  {
    name: 'Fade & Hair Cut',
    url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Scissor Texturing',
    url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Scalp Waterfall Shampoo',
    url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Clarifying Shampoo',
    url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Creative Colour Art',
    url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Korean Perm & Curls',
    url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Handcrafted Dreadlocks',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'Beard & Hair Combo',
    url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=600',
  },
];

export const CATEGORIES_CONFIG = [
  { id: 'Hair Cut', label: 'Hair Cut', myLabel: 'ဆံပင်ညှပ်/ပုံသွင်း', icon: '✂️', desc: 'Fade, Scissor Cut, Beard Trim & Style' },
  { id: 'Shampoo', label: 'Shampoo', myLabel: 'ခေါင်းလျှော်/စပါ', icon: '🧴', desc: 'Scalp Detox Waterfall, Acupressure Wash' },
  { id: 'Colour', label: 'Colour', myLabel: 'ဆံပင်ဆိုး/ဒီဇိုင်း', icon: '🎨', desc: 'Full Color, Balayage Highlights, Bleaching' },
  { id: 'Perming', label: 'Perming', myLabel: 'ကောက်-ဖြောင့်/ပုံကျ', icon: '🌊', desc: 'Korean Wave Perm, Down Perm, Spiral' },
  { id: 'Dreadlock', label: 'Dreadlock', myLabel: 'ဒရက်လော့ ဖန်တီး/ပြုပြင်', icon: '🪢', desc: 'Classic Dreadlocks, Retwist, Interlocking' },
];

const QUICK_PRICES = [10000, 15000, 20000, 25000, 30000, 45000, 60000, 120000];
const QUICK_DURATIONS = [30, 45, 60, 75, 90, 120, 180];

export const ServiceCatalogManager: React.FC<ServiceCatalogManagerProps> = ({
  services,
  onRefresh,
  initialEditService,
  onClearInitialEditService,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Full Screen Step-by-Step Mode State (Emerald Light Theme)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Image Cropper States
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string>('');

  // Local state for immediate responsiveness
  const [displayServices, setDisplayServices] = useState<Service[]>(services);

  useEffect(() => {
    setDisplayServices(services);
  }, [services]);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hair Cut');
  const [price, setPrice] = useState<number>(15000);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [pointsEarned, setPointsEarned] = useState<number>(50);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_PHOTOS[0].url);
  const [popular, setPopular] = useState(false);
  const [active, setActive] = useState(true);

  // Quick Reorder Mode
  const [isReordering, setIsReordering] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);

  useEffect(() => {
    if (initialEditService) {
      openEdit(initialEditService);
      if (onClearInitialEditService) {
        onClearInitialEditService();
      }
    }
  }, [initialEditService]);

  const openCreate = (defaultCategory: string = 'Hair Cut') => {
    setEditingService(null);
    setName('');
    setCategory(defaultCategory);
    setPrice(15000);
    setDurationMinutes(30);
    setPointsEarned(50);
    setDisplayOrder(displayServices.length + 1);
    setDescription('');
    setImageUrl(PRESET_PHOTOS[0].url);
    setPopular(false);
    setActive(true);
    setErrorMsg(null);
    setCurrentStep(1);
    setIsFullScreenOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setName(s.name || '');
    setCategory(s.category || 'Hair Cut');
    setPrice(s.price || 15000);
    setDurationMinutes(s.durationMinutes || 30);
    setPointsEarned(s.pointsEarned ?? 50);
    setDisplayOrder(s.displayOrder || (displayServices.findIndex(item => item.id === s.id) + 1));
    setDescription(s.description || '');
    setImageUrl(s.imageUrl || PRESET_PHOTOS[0].url);
    setPopular(!!s.popular);
    setActive(s.active !== false);
    setErrorMsg(null);
    setCurrentStep(1);
    setIsFullScreenOpen(true);
  };

  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropSourceUrl(reader.result);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string, blob: Blob) => {
    setIsCropModalOpen(false);
    setUploadingImage(true);
    try {
      // Use cropped data URL directly or upload to storage
      const file = new File([blob], `service_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const cloudUrl = await uploadImageToStorage(file, 'services', 600, 400);
      setImageUrl(cloudUrl || croppedDataUrl);
      showToast('Image cropped & updated');
    } catch (err) {
      console.error('Failed to upload cropped image:', err);
      setImageUrl(croppedDataUrl);
    } finally {
      setUploadingImage(false);
    }
  };

  const openCropForCurrentImage = () => {
    if (imageUrl) {
      setCropSourceUrl(imageUrl);
      setIsCropModalOpen(true);
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Please enter a service name.');
        return false;
      }
    }
    if (step === 2) {
      if (!category) {
        setErrorMsg('Please choose a category.');
        return false;
      }
    }
    if (step === 3) {
      if (!price || price <= 0) {
        setErrorMsg('Please enter a valid price in MMK.');
        return false;
      }
      if (!durationMinutes || durationMinutes <= 0) {
        setErrorMsg('Please enter a valid duration.');
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
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Service> = {
        name: name.trim(),
        category,
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        pointsEarned: Number(pointsEarned) || 50,
        displayOrder: Number(displayOrder) || 1,
        description: description.trim(),
        imageUrl: imageUrl.trim() || PRESET_PHOTOS[0].url,
        popular,
        active,
      };

      if (editingService) {
        const updated = await api.updateService(editingService.id, payload);
        setDisplayServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, ...updated } : s)));
        showToast('Service updated successfully.');
      } else {
        const created = await api.addService(payload);
        setDisplayServices((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
        showToast('New service added.');
      }

      playSuccessChime();
      setIsFullScreenOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to save service. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveService = async (serviceId: string, direction: 'up' | 'down') => {
    const currentList = [...displayServices];
    const idx = currentList.findIndex(s => s.id === serviceId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const swapped = [...currentList];
    const temp = swapped[idx];
    swapped[idx] = swapped[targetIdx];
    swapped[targetIdx] = temp;

    // Immediately update orders
    const reordered = swapped.map((s, i) => ({ ...s, displayOrder: i + 1 }));
    setDisplayServices(reordered);

    try {
      const orderedIds = reordered.map(s => s.id);
      await api.reorderServices(orderedIds);
      playSuccessChime();
      showToast(`Client order updated: ${direction === 'up' ? 'Moved Up' : 'Moved Down'}`);
      onRefresh();
    } catch (e) {
      console.error('Failed to update service order:', e);
      showToast('Error updating order');
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    setDisplayServices((prev) => prev.filter((s) => s.id !== id));

    try {
      await api.deleteService(id);
      playNotificationChime();
      showToast('Service removed.');
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast('Error removing service');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const toggleActive = async (s: Service) => {
    const nextActive = !s.active;
    setDisplayServices((prev) => prev.map((item) => (item.id === s.id ? { ...item, active: nextActive } : item)));

    try {
      await api.updateService(s.id, { active: nextActive });
      playNotificationChime();
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredServices = displayServices.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-bold border border-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-stone-950 uppercase tracking-wider flex items-center space-x-2">
            <Scissors className="w-4 h-4 text-emerald-700" />
            <span>Service Catalog ({displayServices.length})</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Manage salon services, pricing & client display order</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsReordering(!isReordering)}
            className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border ${
              isReordering
                ? 'bg-emerald-800 text-white border-emerald-900 ring-2 ring-emerald-600/30'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>{isReordering ? 'Close Order Manager' : 'Adjust Client Show Order'}</span>
          </button>

          <button
            onClick={() => openCreate()}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Service</span>
          </button>
        </div>
      </div>

      {/* Quick Order Adjustment Banner */}
      {isReordering && (
        <div className="p-4 bg-emerald-900 text-white rounded-2xl border border-emerald-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ListOrdered className="w-5 h-5 text-emerald-300" />
              <div>
                <h3 className="text-xs font-bold">Client Side Display Order Manager</h3>
                <p className="text-[11px] text-emerald-200">
                  Services are displayed to customers in this exact top-to-bottom sequence. Click ▲ or ▼ to move. (Hair Cut is default #1).
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsReordering(false)}
              className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-72 overflow-y-auto pr-1">
            {displayServices.map((srv, idx) => (
              <div
                key={srv.id}
                className="bg-emerald-950/80 border border-emerald-700/60 rounded-xl p-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <img src={srv.imageUrl} alt={srv.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{srv.name}</p>
                    <p className="text-[10px] text-emerald-300">{srv.category}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveService(srv.id, 'up')}
                    className="p-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-30 text-white cursor-pointer transition-colors"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === displayServices.length - 1}
                    onClick={() => handleMoveService(srv.id, 'down')}
                    className="p-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-30 text-white cursor-pointer transition-colors"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-emerald-100 focus:border-emerald-500 rounded-xl pl-9 pr-8 py-2.5 text-xs text-stone-900 focus:outline-none transition-colors shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('All')}
            className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              categoryFilter === 'All'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-stone-700 border-emerald-100 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">✨ All Services</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                categoryFilter === 'All' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-50 text-emerald-800'
              }`}>
                {displayServices.length}
              </span>
            </div>
            <span className={`text-[10px] truncate mt-1 ${categoryFilter === 'All' ? 'text-emerald-100' : 'text-stone-400'}`}>
              အားလုံး
            </span>
          </button>

          {CATEGORIES_CONFIG.map((cat) => {
            const count = displayServices.filter((s) => s.category === cat.id).length;
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold'
                    : 'bg-white text-stone-700 border-emerald-100 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">
                    {cat.icon} {cat.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    {count}
                  </span>
                </div>
                <span className={`text-[10px] truncate mt-1 ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                  {cat.myLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Add for Selected Category */}
        {categoryFilter !== 'All' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-base">
                {CATEGORIES_CONFIG.find((c) => c.id === categoryFilter)?.icon || '✂️'}
              </span>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">
                  {categoryFilter}
                </h4>
                <p className="text-[11px] text-emerald-800 font-medium">
                  {CATEGORIES_CONFIG.find((c) => c.id === categoryFilter)?.desc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreate(categoryFilter)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Add {categoryFilter}</span>
            </button>
          </div>
        )}
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-emerald-100">
          <Scissors className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-stone-600">No services found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredServices.map((service, idx) => (
            <div
              key={service.id}
              className={`bg-white rounded-2xl border p-3.5 flex flex-col justify-between space-y-3 transition-all hover:shadow-md ${
                service.active ? 'border-emerald-100 hover:border-emerald-300' : 'border-stone-200 opacity-60 bg-stone-50/50'
              }`}
            >
              <div className="space-y-2.5">
                {/* Photo & Badge */}
                <div className="relative rounded-xl overflow-hidden aspect-16/9 bg-stone-100 border border-stone-100">
                  <img
                    src={service.imageUrl}
                    alt={service.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 flex items-center space-x-1">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 backdrop-blur-xs text-white text-[10px] font-bold">
                      {service.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold" title="Client show position">
                      #{idx + 1}
                    </span>
                  </div>
                  {service.popular && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                      ★ POPULAR
                    </div>
                  )}
                </div>

                {/* Name & Desc */}
                <div>
                  <h3 className="font-bold text-xs text-stone-950 line-clamp-1">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                      {service.description}
                    </p>
                  )}
                </div>

                {/* Price & Duration */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs">
                  <span className="font-bold font-mono text-emerald-900">{formatPrice(service.price)}</span>
                  <span className="text-[11px] text-stone-600 flex items-center space-x-1 font-medium">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>{service.durationMinutes} min</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-emerald-50 flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(service)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      service.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}
                  >
                    {service.active ? 'Active' : 'Disabled'}
                  </button>

                  {/* Move Up / Move Down quick controls */}
                  <div className="flex items-center space-x-0.5 border border-stone-200 rounded-lg p-0.5 bg-stone-50">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveService(service.id, 'up')}
                      className="p-1 text-stone-500 hover:text-emerald-700 disabled:opacity-30 rounded hover:bg-white cursor-pointer"
                      title="Move Up in Client List"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === filteredServices.length - 1}
                      onClick={() => handleMoveService(service.id, 'down')}
                      className="p-1 text-stone-500 hover:text-emerald-700 disabled:opacity-30 rounded hover:bg-white cursor-pointer"
                      title="Move Down in Client List"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setDeletingId(service.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(service)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP-BY-STEP SERVICE MODAL (EMERALD LIGHT THEME)                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isFullScreenOpen && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white text-stone-900 w-full max-w-xl rounded-3xl border border-emerald-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Top Progress Bar */}
              <div className="w-full bg-emerald-100 h-1.5">
                <div
                  className="bg-emerald-600 h-1.5 transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>

              {/* Header */}
              <div className="px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                    {currentStep}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      {editingService ? 'Edit Service' : 'Add New Service'}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      Step {currentStep} of {totalSteps}: {
                        currentStep === 1 ? 'Name & Details' :
                        currentStep === 2 ? 'Category' :
                        currentStep === 3 ? 'Pricing & Duration' :
                        currentStep === 4 ? 'Photo & Crop' : 'Review & Confirm'
                      }
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullScreenOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step Content Canvas */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* STEP 1: SERVICE NAME & DESC */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-stone-700 text-xs font-bold mb-1">
                        Service Name *
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
                        placeholder="e.g. Signature Fade & Scissor Cut"
                        className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-900 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-stone-700 text-xs font-bold mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief notes about what this service includes..."
                        className="w-full bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white rounded-xl p-3 text-xs text-stone-900 focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: CATEGORY SELECTION */}
                {currentStep === 2 && (
                  <div className="space-y-3">
                    <label className="block text-stone-700 text-xs font-bold">
                      Select Service Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CATEGORIES_CONFIG.map((cat) => {
                        const isSelected = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-600/20'
                                : 'bg-white border-stone-200 hover:border-emerald-300 text-stone-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-lg">{cat.icon}</span>
                                <span className="text-xs font-bold">{cat.label}</span>
                                <span className="text-[10px] text-stone-500">({cat.myLabel})</span>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">{cat.desc}</p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-700 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 3: PRICE & DURATION */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Price input */}
                      <div className="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                        <label className="block text-stone-700 text-xs font-bold">
                          Price (MMK)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="w-full bg-white border border-stone-200 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-stone-900 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1 pt-1">
                          {QUICK_PRICES.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPrice(p)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                price === p
                                  ? 'bg-emerald-700 text-white font-bold'
                                  : 'bg-white text-stone-700 border border-stone-200 hover:border-emerald-400'
                              }`}
                            >
                              {p.toLocaleString()} K
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration input */}
                      <div className="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                        <label className="block text-stone-700 text-xs font-bold">
                          Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          step={5}
                          min={5}
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white border border-stone-200 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-stone-900 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1 pt-1">
                          {QUICK_DURATIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDurationMinutes(d)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                durationMinutes === d
                                  ? 'bg-emerald-700 text-white font-bold'
                                  : 'bg-white text-stone-700 border border-stone-200 hover:border-emerald-400'
                              }`}
                            >
                              {d} mins
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Client Display Order input */}
                    <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-emerald-950 text-xs font-bold">
                          Client Side Show Order Rank
                        </label>
                        <p className="text-[11px] text-stone-600">
                          Set the exact display sequence shown to customers on the Home tab (e.g. 1 = Top/First).
                        </p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={displayOrder}
                        onChange={(e) => setDisplayOrder(Math.max(1, Number(e.target.value)))}
                        className="w-20 bg-white border border-emerald-300 focus:border-emerald-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-center text-stone-900 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 4: PHOTO ASSET & CROPPER */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    {/* Current Preview with Crop Action */}
                    <div className="flex items-center space-x-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                      <img
                        src={imageUrl}
                        alt="Service Preview"
                        className="w-20 h-16 rounded-xl object-cover border border-emerald-200 shadow-2xs shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-950 block">Current Service Photo</span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={openCropForCurrentImage}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            <span>Crop / Resize Photo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Presets Grid */}
                    <div>
                      <label className="block text-stone-700 text-xs font-bold mb-2">
                        Or Choose from Presets
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_PHOTOS.map((p, idx) => {
                          const isSelected = imageUrl === p.url;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setImageUrl(p.url)}
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-emerald-600 ring-2 ring-emerald-600/30'
                                  : 'border-stone-200 hover:border-emerald-400 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center text-white">
                                  <Check className="w-5 h-5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Upload with Auto Cropper */}
                    <div className="flex items-center space-x-2 pt-1">
                      <label className="w-full px-4 py-2.5 bg-white border border-dashed border-emerald-400 hover:border-emerald-600 hover:bg-emerald-50/50 text-emerald-900 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center space-x-2 transition-colors">
                        <Upload className="w-4 h-4 text-emerald-700" />
                        <span>{uploadingImage ? 'Uploading & Cropping...' : 'Upload & Crop Custom Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFilePicked}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 5: REVIEW & CONFIRM */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    {/* Preview Card */}
                    <div className="bg-white border border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="relative h-36 w-full bg-stone-100">
                        <img
                          src={imageUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-emerald-900/80 text-white text-[10px] font-bold">
                          {category}
                        </div>
                        {popular && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                            POPULAR
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 space-y-2">
                        <h4 className="font-bold text-sm text-stone-900">{name}</h4>
                        {description && (
                          <p className="text-xs text-stone-500 line-clamp-2">{description}</p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-100 text-xs">
                          <span className="text-emerald-800 font-bold font-mono text-sm">{formatPrice(price)}</span>
                          <span className="text-stone-600 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{durationMinutes} mins</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 text-xs">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={popular}
                          onChange={(e) => setPopular(e.target.checked)}
                          className="w-4 h-4 accent-emerald-700 rounded"
                        />
                        <span className="font-bold text-stone-800">Popular Badge</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => setActive(e.target.checked)}
                          className="w-4 h-4 accent-emerald-700 rounded"
                        />
                        <span className="font-bold text-stone-800">Active Service</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3.5 border-t border-emerald-100 bg-white flex items-center justify-between">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
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
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs active:scale-98"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs active:scale-98 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : editingService ? 'Save Changes' : 'Add Service'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Crop Modal */}
      {isCropModalOpen && cropSourceUrl && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropSourceUrl}
          onClose={() => setIsCropModalOpen(false)}
          onCropComplete={handleCropComplete}
          title="Service Photo Crop & Resize"
          cropShape="square"
          aspectRatio={16 / 9}
          outputSize={600}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-xs space-y-3 text-center shadow-xl">
            <h3 className="text-sm font-bold text-stone-950">Delete Service?</h3>
            <p className="text-xs text-stone-500">Are you sure you want to remove this service from the catalog?</p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
