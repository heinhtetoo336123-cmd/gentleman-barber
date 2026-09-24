import React, { useState } from 'react';
import { Star, X, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Booking, UserRole } from '../types';
import { api } from '../api/client';
import { playSuccessChime } from '../utils/audio';

interface BarberRatingModalProps {
  isOpen: boolean;
  booking: Booking | null;
  role: UserRole;
  lang?: 'en' | 'my';
  onClose: () => void;
  onSuccess?: (ratedBooking: Booking, rating: number) => void;
}

const RATING_LABELS_MY: Record<number, string> = {
  1: 'မကောင်းပါ (Poor)',
  2: 'သင့်တင့်ပါသည် (Fair)',
  3: 'ကောင်းပါသည် (Good)',
  4: 'အလွန်ကောင်းပါသည် (Very Good)',
  5: 'အထူးကောင်းမွန်ပါသည် (Excellent)',
};

const RATING_LABELS_EN: Record<number, string> = {
  1: 'Poor (1 Star)',
  2: 'Fair (2 Stars)',
  3: 'Good (3 Stars)',
  4: 'Very Good (4 Stars)',
  5: 'Excellent (5 Stars)',
};

export const BarberRatingModal: React.FC<BarberRatingModalProps> = ({
  isOpen,
  booking,
  role,
  lang = 'my',
  onClose,
  onSuccess,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !booking) return null;

  const isAlreadyRated = typeof booking.rating === 'number' && booking.rating > 0;
  const isWalkin = Boolean(booking.isWalkin || (booking.notes && booking.notes.includes('Walk-in')));
  const isAdminRating = role === 'admin' || role === 'superadmin';

  const activeStar = hoverRating || selectedRating;
  const ratingText = lang === 'my' ? RATING_LABELS_MY[activeStar] : RATING_LABELS_EN[activeStar];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyRated) {
      setErrorMsg(
        lang === 'my'
          ? 'ဤ Booking အတွက် Rating ပေးပြီးဖြစ်ပါသည် (တစ်ကြိမ်သာ ပေးခွင့်ရှိပါသည်)'
          : 'Rating already submitted for this booking (one-time only).'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.rateBooking(booking.id, selectedRating, reviewNote.trim() || undefined);
      playSuccessChime();
      if (onSuccess) {
        onSuccess(res.booking || { ...booking, rating: selectedRating, reviewNote }, selectedRating);
      }
      onClose();
    } catch (err: any) {
      console.error('Rating submit error:', err);
      setErrorMsg(err.message || 'Rating ပေးရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-emerald-100 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-emerald-100/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
              <Star className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {isWalkin && isAdminRating
                  ? (lang === 'my' ? '💈 Walk-in ဆံသပညာရှင် Rating' : '💈 Walk-in Barber Rating')
                  : (lang === 'my' ? '⭐️ ဆံသပညာရှင်အား Rating ပေးမည်' : '⭐️ Rate Barber Experience')}
              </h3>
              <p className="text-[11px] text-stone-500 font-mono">
                Code: {booking.bookingCode || booking.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Appointment Brief Card */}
        <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900">{booking.serviceName}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
              {isWalkin ? 'Walk-in' : 'Online Booking'}
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-600 text-[11px]">
            <span>
              {lang === 'my' ? 'ဆံသပညာရှင်:' : 'Barber:'}{' '}
              <strong className="text-stone-900">{booking.designerName}</strong>
            </span>
            <span>
              {booking.date} ({booking.timeSlot})
            </span>
          </div>
          {booking.customerName && (
            <div className="text-[11px] text-stone-500">
              {lang === 'my' ? 'ဧည့်သည်တော်:' : 'Customer:'} {booking.customerName}
            </div>
          )}
        </div>

        {/* Case 1: Already Rated -> Show Completed Info & Block Duplicate Rating */}
        {isAlreadyRated ? (
          <div className="space-y-3 py-2 text-center">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-700 text-white mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-emerald-900">
                {lang === 'my'
                  ? `Rating ${booking.rating}⭐️ ပေးပြီးဖြစ်ပါသည်`
                  : `Rated ${booking.rating}⭐️ Stars Successfully`}
              </p>
              <div className="flex justify-center space-x-1 py-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-6 h-6 ${
                      s <= (booking.rating || 5)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-stone-200'
                    }`}
                  />
                ))}
              </div>
              {booking.reviewNote && (
                <p className="text-xs text-stone-600 italic bg-white/80 p-2 rounded-xl border border-emerald-100">
                  "{booking.reviewNote}"
                </p>
              )}
              <div className="flex items-center justify-center space-x-1 text-[11px] text-stone-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {lang === 'my'
                    ? 'Booking တစ်ခုလျှင် တစ်ကြိမ်သာ ပေးခွင့်ရှိသောကြောင့် သတ်မှတ်ပြီးပါပြီ'
                    : 'Rating locked: 1 rating allowed per booking.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-2xl text-xs cursor-pointer transition-colors"
            >
              {lang === 'my' ? 'ပိတ်မည်' : 'Close'}
            </button>
          </div>
        ) : (
          /* Case 2: Not Yet Rated -> Provide Rating Form with Single-submission Guarantee */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* Interactive Stars Selector */}
            <div className="text-center space-y-1.5 py-1">
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                {lang === 'my' ? 'ကြယ်အရေအတွက် ရွေးချယ်ပါ' : 'Select Rating'}
              </p>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setSelectedRating(s)}
                    className="p-1 cursor-pointer transform hover:scale-115 active:scale-95 transition-all"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        s <= activeStar
                          ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                          : 'text-stone-300 hover:text-stone-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-emerald-800 transition-all">
                {ratingText}
              </p>
            </div>

            {/* Review Comment Box */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                {isAdminRating
                  ? (lang === 'my' ? 'Admin မှတ်ချက် / သုံးသပ်ချက် (မဖြစ်မနေ မလိုပါ)' : 'Admin Notes (Optional)')
                  : (lang === 'my' ? 'ဝန်ဆောင်မှုအပေါ် အကြံပြုချက် (မဖြစ်မနေ မလိုပါ)' : 'Feedback Note (Optional)')}
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  lang === 'my'
                    ? 'ဆံသပညာရှင်၏ လက်ရာနှင့် ဝန်ဆောင်မှုအပေါ် မှတ်ချက်ရေးနိုင်ပါသည်...'
                    : 'Share details about the haircut or styling experience...'
                }
                className="w-full bg-stone-50 border border-emerald-100 rounded-2xl p-2.5 text-xs text-stone-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>

            {/* One-time Rating Notice */}
            <div className="flex items-center space-x-1.5 p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {lang === 'my'
                  ? 'သတိပြုရန်: Booking တစ်ခုလျှင် တစ်ကြိမ်သာ ပေးခွင့်ရှိပါသည် (+50 Points ရရှိမည်)'
                  : 'Note: Single rating per booking only (+50 Royalty Points credited).'}
              </span>
            </div>

            {/* Modal Buttons */}
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-2xl cursor-pointer transition-colors"
              >
                {lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-2xl shadow-sm cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center space-x-1"
              >
                <Star className="w-3.5 h-3.5 fill-white text-white" />
                <span>
                  {isSubmitting
                    ? (lang === 'my' ? 'သိမ်းဆည်းနေပါသည်...' : 'Submitting...')
                    : (lang === 'my' ? `Rating ${selectedRating}⭐️ အတည်ပြုမည်` : `Submit ${selectedRating}⭐️`)}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
