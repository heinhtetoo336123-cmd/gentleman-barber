import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Designer, Booking } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { getBurmeseStatusLabel } from '../utils/burmeseTranslators';
import {
  Users,
  Search,
  Award,
  Edit,
  Trash2,
  Plus,
  Phone,
  Mail,
  UserCheck,
  Star,
  ShieldCheck,
  Check,
  X,
  Eye,
  Calendar,
  Clock,
  CreditCard,
  Scissors,
  MessageSquare,
  Camera,
  Sparkles,
  Filter,
  ChevronRight,
  ThumbsUp,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  UserX,
  ShieldAlert,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportClientsToCsv } from '../utils/exportHelpers';
import { ImageCropModal } from './ImageCropModal';
import { ClientDeleteFinancialModal, FinancialResolutionOption } from './ClientDeleteFinancialModal';

interface ClientManagerProps {
  designers: Designer[];
  bookings?: Booking[];
  clients?: UserProfile[];
  role?: string;
}

type ClientViewTab = 'clients' | 'feedbacks';

export const ClientManager: React.FC<ClientManagerProps> = ({
  designers,
  bookings = [],
  clients: propClients = [],
  role = 'admin',
}) => {
  const isSuperAdmin = role === 'superadmin';
  const [activeTab, setActiveTab] = useState<ClientViewTab>('clients');
  const [clients, setClients] = useState<UserProfile[]>(propClients || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('All');

  useEffect(() => {
    if (propClients && propClients.length > 0) {
      setClients(propClients);
    }
  }, [propClients]);
  
  // Feedback Tab Filter states
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>('All');
  const [feedbackDesignerFilter, setFeedbackDesignerFilter] = useState<string>('All');
  const [feedbackSearchTerm, setFeedbackSearchTerm] = useState<string>('');

  const [editingClient, setEditingClient] = useState<UserProfile | null>(null);
  const [viewingClientDetails, setViewingClientDetails] = useState<UserProfile | null>(null);
  const [clientToDelete, setClientToDelete] = useState<UserProfile | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Photo Preview Lightbox
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Cropper Modal state for Admin
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [cropTargetClient, setCropTargetClient] = useState<UserProfile | null>(null);
  const [rawImageForCrop, setRawImageForCrop] = useState<string>('');
  const [isCropOpen, setIsCropOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTier, setFormTier] = useState<'Bronze' | 'Silver' | 'Gold' | 'VIP'>('Bronze');
  const [formPoints, setFormPoints] = useState(0);
  const [formPreferredBarber, setFormPreferredBarber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadClients();
    const unsub = api.subscribeToClients((updatedClients) => {
      setClients(updatedClients);
    });
    return () => unsub();
  }, []);

  const loadClients = async () => {
    const data = await api.getClients();
    setClients(data || []);
  };

  const handleOpenEdit = (client: UserProfile) => {
    setEditingClient(client);
    setIsAddingNew(false);
    setFormName(client.name);
    setFormPhone(client.phone);
    setFormEmail(client.email || '');
    setFormTier(client.memberTier);
    setFormPoints(client.points || 0);
    setFormPreferredBarber(client.preferredBarberName || '');
    setFormNotes(client.notes || '');
    setFormAvatarUrl(client.avatarUrl || '');
  };

  const handleOpenNew = () => {
    setEditingClient(null);
    setIsAddingNew(true);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormTier('Bronze');
    setFormPoints(100);
    setFormPreferredBarber('');
    setFormNotes('');
    setFormAvatarUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) return;

    setSaveLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));

      if (editingClient) {
        await api.updateClient(editingClient.id, {
          name: formName,
          phone: formPhone,
          email: formEmail,
          memberTier: formTier,
          points: formPoints,
          preferredBarberName: formPreferredBarber,
          notes: formNotes,
          avatarUrl: formAvatarUrl,
        });
        await api.addAuditLog('Admin', 'Client Level Update', `Updated client ${formName} (${formPhone}) tier to ${formTier}, points: ${formPoints}`);
      } else {
        await api.addClient({
          name: formName,
          phone: formPhone,
          email: formEmail,
          memberTier: formTier,
          points: formPoints,
          preferredBarberName: formPreferredBarber,
          notes: formNotes,
          avatarUrl: formAvatarUrl,
        });
        await api.addAuditLog('Admin', 'Client Creation', `Created new client ${formName} (${formPhone}) with tier ${formTier}`);
      }

      setEditingClient(null);
      setIsAddingNew(false);
      loadClients();
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteClick = (client: UserProfile) => {
    setClientToDelete(client);
  };

  const handleConfirmDelete = async (
    clientId: string,
    financialAction: FinancialResolutionOption
  ) => {
    await api.deleteClient(clientId, financialAction);
    setClientToDelete(null);
    loadClients();
  };

  // Photo Crop Workflow for Admin
  const handleAdminPickPhoto = (client: UserProfile) => {
    setCropTargetClient(client);
    adminFileInputRef.current?.click();
  };

  const handleAdminFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cropTargetClient) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageForCrop(reader.result as string);
      setIsCropOpen(true);
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleAdminCropComplete = async (croppedDataUrl: string) => {
    if (!cropTargetClient) return;

    try {
      await api.updateClient(cropTargetClient.id, {
        avatarUrl: croppedDataUrl,
        photoBonusClaimed: true,
      });

      // Also update viewing details if open
      if (viewingClientDetails && viewingClientDetails.id === cropTargetClient.id) {
        setViewingClientDetails({
          ...viewingClientDetails,
          avatarUrl: croppedDataUrl,
        });
      }

      loadClients();
    } catch (err) {
      console.error('Failed to update client photo:', err);
    } finally {
      setIsCropOpen(false);
      setCropTargetClient(null);
      setRawImageForCrop('');
    }
  };

  // Filtered clients list
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTier = selectedTierFilter === 'All' || c.memberTier === selectedTierFilter;
    return matchesSearch && matchesTier;
  });

  // Extract all feedbacks/reviews from bookings
  const allReviews = bookings
    .filter((b) => b.rating && b.rating > 0)
    .sort((a, b) => new Date(b.ratedAt || b.date).getTime() - new Date(a.ratedAt || a.date).getTime());

  // Filtered reviews
  const filteredReviews = allReviews.filter((b) => {
    const matchesRating =
      feedbackRatingFilter === 'All' ||
      (feedbackRatingFilter === '5' && b.rating === 5) ||
      (feedbackRatingFilter === '4' && b.rating === 4) ||
      (feedbackRatingFilter === '3' && b.rating === 3) ||
      (feedbackRatingFilter === '1-2' && (b.rating === 1 || b.rating === 2));

    const matchesDesigner =
      feedbackDesignerFilter === 'All' ||
      b.designerId === feedbackDesignerFilter ||
      b.designerName.toLowerCase() === feedbackDesignerFilter.toLowerCase();

    const matchesSearch =
      feedbackSearchTerm === '' ||
      b.customerName.toLowerCase().includes(feedbackSearchTerm.toLowerCase()) ||
      b.customerPhone.includes(feedbackSearchTerm) ||
      b.bookingCode.toLowerCase().includes(feedbackSearchTerm.toLowerCase()) ||
      (b.reviewNote && b.reviewNote.toLowerCase().includes(feedbackSearchTerm.toLowerCase()));

    return matchesRating && matchesDesigner && matchesSearch;
  });

  // Overall satisfaction metrics
  const avgSalonRating =
    allReviews.length > 0
      ? (allReviews.reduce((acc, r) => acc + (r.rating || 5), 0) / allReviews.length).toFixed(1)
      : '5.0';
  const fiveStarReviewsCount = allReviews.filter((r) => r.rating === 5).length;
  const fiveStarPct = allReviews.length > 0 ? Math.round((fiveStarReviewsCount / allReviews.length) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Hidden file input for admin photo upload */}
      <input
        type="file"
        ref={adminFileInputRef}
        onChange={handleAdminFileSelected}
        accept="image/*"
        className="hidden"
      />

      {/* Header with Sub-tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-stone-900 uppercase tracking-wider font-mono flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>CLIENTS & CUSTOMER FEEDBACKS</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Client profiles, photos, service visit histories, and 5-star ratings & reviews
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center space-x-2">
          <div className="p-1 bg-stone-100 border border-stone-200 rounded-2xl flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-xs cursor-pointer transition-all flex items-center space-x-1.5 ${
                activeTab === 'clients'
                  ? 'bg-stone-950 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Clients Directory ({clients.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('feedbacks')}
              className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-xs cursor-pointer transition-all flex items-center space-x-1.5 ${
                activeTab === 'feedbacks'
                  ? 'bg-emerald-500 text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" />
              <span>Feedbacks & Reviews ({allReviews.length})</span>
            </button>
          </div>

          {activeTab === 'clients' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  exportClientsToCsv(clients, bookings);
                }}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center space-x-1.5 cursor-pointer border border-stone-300 shadow-2xs transition-all active:scale-95"
                title="Download Clients Directory as Excel (.csv)"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span className="hidden sm:inline">Excel Export</span>
              </button>

              <button
                onClick={handleOpenNew}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Client</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: CLIENTS DIRECTORY */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search client name, phone number, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {/* Tier filter */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {['All', 'Bronze', 'Silver', 'Gold', 'VIP'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTierFilter(tier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                    selectedTierFilter === tier
                      ? 'bg-emerald-500 text-stone-950 shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                  }`}
                >
                  {tier === 'All' ? 'All Clients' : `${tier} Level`}
                </button>
              ))}
            </div>
          </div>

          {/* Clients Cards Grid */}
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-2">
              <Users className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs text-stone-500">ရှာဖွေမှုနှင့် ကိုက်ညီသော သုံးစွဲသူ မရှိသေးပါ။</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredClients.map((client) => {
                const clientBookings = bookings.filter(
                  (b) =>
                    b.customerPhone === client.phone ||
                    b.customerName.toLowerCase() === client.name.toLowerCase()
                );
                const clientReviews = clientBookings.filter((b) => b.rating && b.rating > 0);
                const clientAvgRating =
                  clientReviews.length > 0
                    ? (
                        clientReviews.reduce((acc, r) => acc + (r.rating || 5), 0) /
                        clientReviews.length
                      ).toFixed(1)
                    : null;

                return (
                  <div
                    key={client.id}
                    className="bg-white border border-stone-200 hover:border-emerald-400 rounded-2xl p-4 space-y-3.5 transition-all relative shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Avatar with click to zoom preview */}
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="relative group shrink-0">
                          {client.avatarUrl ? (
                            <img
                              src={client.avatarUrl}
                              alt={client.name}
                              referrerPolicy="no-referrer"
                              onClick={() => setPreviewPhotoUrl(client.avatarUrl || null)}
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-stone-200 group-hover:border-emerald-400 cursor-pointer shadow-xs"
                            />
                          ) : (
                            <div
                              onClick={() => handleAdminPickPhoto(client)}
                              className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-900 border-2 border-emerald-300 flex items-center justify-center font-black text-base cursor-pointer hover:bg-emerald-200 transition-colors"
                              title="Click to upload client photo"
                            >
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          {/* Quick Photo Upload Icon Button */}
                          <button
                            type="button"
                            onClick={() => handleAdminPickPhoto(client)}
                            className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-stone-900 hover:bg-stone-700 text-white shadow-xs cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                            title="Upload/Crop Photo"
                          >
                            <Camera className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Name & Contact Info */}
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-stone-900 text-sm truncate">{client.name}</span>
                            <span
                              className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                                client.memberTier === 'VIP'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : client.memberTier === 'Gold'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : client.memberTier === 'Silver'
                                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                                  : 'bg-orange-100 text-orange-900 border-orange-300'
                              }`}
                            >
                              👑 {client.memberTier}
                            </span>
                            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                              <span>Active</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                            <span className="flex items-center space-x-1 font-mono">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{client.phone}</span>
                            </span>
                            {client.email && (
                              <span className="flex items-center space-x-1 text-stone-500 truncate max-w-[120px]">
                                <Mail className="w-3 h-3 text-stone-400" />
                                <span className="truncate">{client.email}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => setViewingClientDetails(client)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                          title="View Client Details, Photo & History"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>အသေးစိတ်</span>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(client)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                          title="Delete Client & Manage Financial Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats strip: Points, Total Visits, and Ratings */}
                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] text-stone-500 block font-mono">Member Points</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">{client.points || 0} pts</span>
                      </div>

                      <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] text-stone-500 block font-mono">Visits History</span>
                        <span className="font-semibold text-stone-800 text-xs">
                          {clientBookings.length} Times
                        </span>
                      </div>

                      <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-[10px] text-stone-500 block font-mono">Feedback Rating</span>
                        {clientAvgRating ? (
                          <span className="font-bold text-emerald-700 text-xs flex items-center space-x-0.5">
                            <Star className="w-3 h-3 fill-emerald-500 text-emerald-600" />
                            <span>{clientAvgRating} / 5</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400">No rating yet</span>
                        )}
                      </div>
                    </div>

                    {client.notes && (
                      <p className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-200 truncate">
                        Note: {client.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CLIENT FEEDBACKS & REVIEWS DASHBOARD */}
      {activeTab === 'feedbacks' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 p-4 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">Average Rating</span>
              <div className="flex items-center space-x-1.5">
                <Star className="w-5 h-5 fill-emerald-500 text-emerald-600" />
                <span className="text-xl font-black text-stone-900 font-mono">{avgSalonRating}</span>
                <span className="text-xs text-stone-400 font-mono">/ 5.0</span>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">Total Customer Reviews</span>
              <div className="text-xl font-black text-stone-900 font-mono">{allReviews.length}</div>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">5-Star Satisfaction</span>
              <div className="text-xl font-black text-emerald-700 font-mono">{fiveStarPct}%</div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono text-emerald-800 uppercase tracking-wider block font-bold">Review Points Awarded</span>
              <div className="text-xl font-black text-emerald-700 font-mono">+{allReviews.length * 50} PTS</div>
            </div>
          </div>

          {/* Feedback Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search feedback comment, customer name, booking code..."
                value={feedbackSearchTerm}
                onChange={(e) => setFeedbackSearchTerm(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {/* Stylist Filter */}
            <select
              value={feedbackDesignerFilter}
              onChange={(e) => setFeedbackDesignerFilter(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:border-emerald-500 font-semibold"
            >
              <option value="All">All Barbers / Stylists</option>
              {designers.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Rating Filter */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'All', label: 'All Ratings' },
                { id: '5', label: '⭐️ 5 Stars' },
                { id: '4', label: '⭐️ 4 Stars' },
                { id: '3', label: '⭐️ 3 Stars' },
                { id: '1-2', label: '⭐️ 1-2 Stars' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setFeedbackRatingFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                    feedbackRatingFilter === filter.id
                      ? 'bg-emerald-500 text-stone-950 shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedbacks List */}
          {filteredReviews.length === 0 ? (
            <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-2">
              <Star className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs text-stone-500">ရှာဖွေမှုနှင့် ကိုက်ညီသော သုံးသပ်ချက်များ မရှိသေးပါ။</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredReviews.map((review) => {
                const clientObj = clients.find(
                  (c) =>
                    c.phone === review.customerPhone ||
                    c.name.toLowerCase() === review.customerName.toLowerCase()
                );

                return (
                  <div
                    key={review.id}
                    className="bg-white border border-stone-200 hover:border-emerald-400 rounded-2xl p-4 space-y-3 transition-all shadow-2xs"
                  >
                    {/* Header: Client & Star Rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        {clientObj?.avatarUrl ? (
                          <img
                            src={clientObj.avatarUrl}
                            alt={review.customerName}
                            referrerPolicy="no-referrer"
                            onClick={() => setPreviewPhotoUrl(clientObj.avatarUrl || null)}
                            className="w-10 h-10 rounded-2xl object-cover border border-stone-200 cursor-pointer shadow-xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center justify-center font-black text-sm shrink-0">
                            {review.customerName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h4 className="font-bold text-stone-900 text-sm">{review.customerName}</h4>
                            {clientObj && (
                              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200">
                                {clientObj.memberTier}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 font-mono">{review.customerPhone}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center space-x-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= (review.rating || 5)
                                  ? 'fill-emerald-500 text-emerald-600'
                                  : 'text-stone-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono mt-0.5 block">
                          {review.ratedAt ? new Date(review.ratedAt).toLocaleDateString() : review.date}
                        </span>
                      </div>
                    </div>

                    {/* Review Note */}
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/60 text-xs">
                      {review.reviewNote ? (
                        <p className="text-stone-800 italic">"{review.reviewNote}"</p>
                      ) : (
                        <p className="text-stone-400 italic">No written comment provided (5-Star rating confirmed)</p>
                      )}
                    </div>

                    {/* Service & Barber Tag */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 pt-1 border-t border-stone-100">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-stone-900">{review.serviceName}</span>
                        <span>• Barber: <strong className="text-emerald-700">{review.designerName}</strong></span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-stone-400">{review.bookingCode}</span>
                        {clientObj && (
                          <button
                            onClick={() => setViewingClientDetails(clientObj)}
                            className="text-emerald-700 hover:text-emerald-900 font-bold font-mono text-[10px] underline cursor-pointer"
                          >
                            View Client
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CLIENT */}
      {(editingClient || isAddingNew) && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2 font-mono">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>{editingClient ? 'Client အချက်အလက် ပြင်ဆင်ရန်' : 'Client အကောင့်သစ် ထည့်သွင်းရန်'}</span>
              </h3>
              <button
                onClick={() => {
                  setEditingClient(null);
                  setIsAddingNew(false);
                }}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 mb-1 font-semibold">အမည် (Client Name)</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  placeholder="e.g. ကိုထက်"
                />
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">ဖုန်းနံပါတ် (Phone Number)</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  placeholder="e.g. 09263188228"
                />
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">အီးမေးလ် (Email - Optional)</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  placeholder="client@gmail.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">Member Level / Tier</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-emerald-800 font-bold focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  >
                    <option value="Bronze">Bronze Level</option>
                    <option value="Silver">Silver Level</option>
                    <option value="Gold">Gold Level</option>
                    <option value="VIP">VIP Level</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">Loyalty Points</label>
                  <input
                    type="number"
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">Preferred Barber / Stylist</label>
                <select
                  value={formPreferredBarber}
                  onChange={(e) => setFormPreferredBarber(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                >
                  <option value="">-- မရွေးချယ်ရသေးပါ --</option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.title})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">Notes (မှတ်ချက်)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-hidden focus:bg-white"
                  placeholder="Additional client notes..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setIsAddingNew(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs cursor-pointer border border-stone-300 font-medium"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                >
                  <span>{saveLoading ? 'သိမ်းဆည်းနေသည်...' : 'သိမ်းဆည်းမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPREHENSIVE CLIENT DETAILS, PHOTO, SERVICE HISTORY & FEEDBACKS */}
      {viewingClientDetails && (() => {
        const clientBookings = bookings.filter(
          (b) =>
            b.customerPhone === viewingClientDetails.phone ||
            b.customerName.toLowerCase() === viewingClientDetails.name.toLowerCase()
        );

        const completedBookings = clientBookings.filter(
          (b) => b.status === 'completed' || b.status === 'confirmed'
        );

        const totalSpent = completedBookings.reduce(
          (acc, b) => acc + (b.servicePrice - (b.discountAmount || 0)),
          0
        );

        const clientFeedbacks = clientBookings.filter((b) => b.rating && b.rating > 0);
        const clientAvgScore =
          clientFeedbacks.length > 0
            ? (
                clientFeedbacks.reduce((acc, r) => acc + (r.rating || 5), 0) /
                clientFeedbacks.length
              ).toFixed(1)
            : null;

        return (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-2xl max-h-[90vh] flex flex-col space-y-4 shadow-2xl overflow-hidden">
              {/* Header with Client Photo, Tier & Action Buttons */}
              <div className="flex items-start justify-between border-b border-stone-200 pb-4 shrink-0">
                <div className="flex items-start space-x-3.5">
                  {/* Avatar & Photo Upload Trigger */}
                  <div className="relative group shrink-0">
                    {viewingClientDetails.avatarUrl ? (
                      <img
                        src={viewingClientDetails.avatarUrl}
                        alt={viewingClientDetails.name}
                        referrerPolicy="no-referrer"
                        onClick={() => setPreviewPhotoUrl(viewingClientDetails.avatarUrl || null)}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 cursor-pointer shadow-md"
                      />
                    ) : (
                      <div
                        onClick={() => handleAdminPickPhoto(viewingClientDetails)}
                        className="w-14 h-14 rounded-2xl bg-emerald-500 text-stone-950 font-black text-xl flex items-center justify-center shadow-md cursor-pointer hover:bg-emerald-600"
                        title="Click to upload client photo"
                      >
                        {viewingClientDetails.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAdminPickPhoto(viewingClientDetails)}
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl bg-stone-900 hover:bg-stone-700 text-white shadow-md cursor-pointer"
                      title="Upload/Crop Photo"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-stone-900 font-mono tracking-tight">
                        {viewingClientDetails.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs font-mono">
                        👑 {viewingClientDetails.memberTier} Level
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 font-mono mt-0.5">{viewingClientDetails.phone}</p>
                    {viewingClientDetails.email && (
                      <p className="text-xs text-stone-400">{viewingClientDetails.email}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setViewingClientDetails(null)}
                  className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="overflow-y-auto space-y-4 pr-1">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-center">
                    <span className="text-[10px] text-stone-500 font-mono uppercase block">Total Visits</span>
                    <span className="text-base font-black text-stone-900 font-mono mt-0.5">
                      {clientBookings.length} Times
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-center">
                    <span className="text-[10px] text-stone-500 font-mono uppercase block">Completed Cuts</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5">
                      {completedBookings.length} Visits
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-300 text-center">
                    <span className="text-[10px] text-emerald-800 font-mono uppercase block font-bold">Total Spent</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5">
                      {formatPrice(totalSpent)}
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-center">
                    <span className="text-[10px] text-stone-500 font-mono uppercase block">Loyalty Points</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5">
                      {viewingClientDetails.points || 0} pts
                    </span>
                  </div>
                </div>

                {/* Direct Contact & Edit Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                  <div className="flex items-center space-x-2">
                    <a
                      href={`tel:${viewingClientDetails.phone}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs flex items-center space-x-1 cursor-pointer shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Direct Call</span>
                    </a>

                    <a
                      href={`viber://chat?number=%2B95${viewingClientDetails.phone.replace(/^09/, '9')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                      <span>Client Viber</span>
                    </a>
                  </div>

                  <button
                    onClick={() => {
                      const target = viewingClientDetails;
                      setViewingClientDetails(null);
                      handleOpenEdit(target);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Member Tier/Points ပြင်မည်</span>
                  </button>
                </div>

                {/* Client's Feedbacks & Reviews Section */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-black uppercase tracking-wider text-emerald-700 flex items-center space-x-1.5">
                      <Star className="w-4 h-4 text-emerald-600 fill-emerald-500" />
                      <span>ဖောက်သည်၏ RATING နှင့် သုံးသပ်ချက်များ (CLIENT REVIEWS)</span>
                    </h4>
                    {clientAvgScore && (
                      <span className="text-xs font-bold font-mono text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        ⭐ Average {clientAvgScore} / 5
                      </span>
                    )}
                  </div>

                  {clientFeedbacks.length === 0 ? (
                    <div className="p-4 text-center bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-500">
                      ဤ သုံးစွဲသူထံမှ Rating / Review မပေးရသေးပါ။
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientFeedbacks.map((f) => (
                        <div
                          key={f.id}
                          className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5 text-xs shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-stone-900">{f.serviceName}</span>
                              <span className="text-stone-400">•</span>
                              <span className="text-emerald-800 font-medium">Barber: {f.designerName}</span>
                            </div>

                            <div className="flex items-center space-x-0.5 text-emerald-600">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= (f.rating || 5)
                                      ? 'fill-emerald-500 text-emerald-600'
                                      : 'text-stone-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {f.reviewNote && (
                            <p className="text-stone-800 italic bg-white p-2 rounded-xl border border-stone-200">
                              "{f.reviewNote}"
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono pt-1">
                            <span>Ref: {f.bookingCode}</span>
                            <span>{f.ratedAt ? new Date(f.ratedAt).toLocaleDateString() : f.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client's Service Booking History */}
                <div className="space-y-2 pt-2 border-t border-stone-200">
                  <h4 className="text-xs font-mono font-black uppercase tracking-wider text-stone-900 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>ဒီ သုံးစွဲသူ၏ ဝန်ဆောင်မှု ရာဇဝင် (FULL SERVICE HISTORY)</span>
                  </h4>

                  {clientBookings.length === 0 ? (
                    <div className="p-5 text-center bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-500">
                      ဒီ သုံးစွဲသူအတွက် ဘိုကင် ရာဇဝင် မရှိသေးပါ။
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-emerald-700">{b.bookingCode}</span>
                              <span className="font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                {b.serviceName}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border bg-stone-100 text-stone-800 border-stone-200">
                              {getBurmeseStatusLabel(b.status)}
                            </span>
                          </div>

                          {/* Barber Completion Note if present */}
                          {b.completionNote && (
                            <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] text-stone-800">
                              <span className="font-bold text-emerald-900 font-mono">✂️ Barber Note: </span>
                              <span>"{b.completionNote}"</span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between text-stone-600 text-[11px] pt-1 border-t border-stone-200 gap-2">
                            <span className="flex items-center space-x-1 text-stone-900 font-medium">
                              <Scissors className="w-3 h-3 text-emerald-600" />
                              <span>{b.designerName}</span>
                            </span>

                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-emerald-600" />
                              <span>
                                {b.date} ({b.timeSlot})
                              </span>
                            </span>

                            <span className="font-mono font-bold text-emerald-700">
                              {formatPrice(b.servicePrice - (b.discountAmount || 0))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="text-right pt-2 border-t border-stone-200 shrink-0">
                <button
                  onClick={() => setViewingClientDetails(null)}
                  className="px-5 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  ပိတ်မည် (Close)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* LIGHTBOX MODAL FOR PHOTO PREVIEW */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-60 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-sm w-full bg-stone-900 p-2 rounded-3xl border border-stone-700 shadow-2xl">
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white text-stone-950 shadow-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Client Zoom"
              referrerPolicy="no-referrer"
              className="w-full h-80 object-cover rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* PHOTO CROPPER MODAL FOR ADMIN */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={rawImageForCrop}
        onClose={() => {
          setIsCropOpen(false);
          setCropTargetClient(null);
          setRawImageForCrop('');
        }}
        onCropComplete={handleAdminCropComplete}
        title={`Crop Photo for ${cropTargetClient?.name || 'Client'}`}
        cropShape="circle"
        outputSize={512}
      />

      {/* CLIENT DELETION & FINANCIAL RECONCILIATION MODAL */}
      <ClientDeleteFinancialModal
        isOpen={Boolean(clientToDelete)}
        onClose={() => setClientToDelete(null)}
        client={clientToDelete}
        bookings={bookings}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
};
