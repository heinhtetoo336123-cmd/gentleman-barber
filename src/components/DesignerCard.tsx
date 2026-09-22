import React from 'react';
import { Designer, Booking } from '../types';
import { calculateBarberRating } from '../utils/formatters';
import { Clock, Calendar, CheckCircle2, Sparkles, Star, Phone } from 'lucide-react';

interface DesignerCardProps {
  designer: Designer;
  bookings?: Booking[];
  onSelectDesigner: (designer: Designer) => void;
}

export const DesignerCard: React.FC<DesignerCardProps> = ({ designer, bookings, onSelectDesigner }) => {
  if (!designer) return null;

  const specialtiesList = Array.isArray(designer.specialties) ? designer.specialties : [];
  const daysList = Array.isArray(designer.availableDays) ? designer.availableDays : [];
  const startHour = designer.workingHours?.start || '09:00';
  const endHour = designer.workingHours?.end || '18:00';

  const { ratingDisplay, reviewsCount } = calculateBarberRating(designer, bookings);

  return (
    <div className="group bg-white rounded-2xl border border-emerald-100 hover:border-emerald-500 p-4 transition-all duration-300 hover:shadow-lg flex flex-col justify-between">
      
      {/* Top Header: Avatar & Info */}
      <div className="flex items-start space-x-4">
        <div className="relative shrink-0">
          <img
            src={designer.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
            alt={designer.name || 'Designer'}
            referrerPolicy="no-referrer"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-emerald-100 group-hover:border-emerald-500 transition-colors shadow-xs"
          />
          {designer.featured && (
            <div className="absolute -top-1 -right-1 bg-emerald-700 text-white p-1 rounded-full shadow-xs" title="Featured Master">
              <Sparkles className="w-3 h-3" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-emerald-700 transition-colors truncate">
              {designer.name || 'Staff Member'}
            </h3>
            <span className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 flex items-center space-x-0.5" title={`${reviewsCount} verified reviews`}>
              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
              <span>{ratingDisplay}</span>
            </span>
          </div>

          <p className="text-xs text-emerald-800 font-semibold truncate mt-0.5">
            {designer.title || 'Barber Stylist'}
          </p>

          {/* Phone Number Display */}
          {designer.phone && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-mono font-bold mt-1 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200/70 w-fit">
              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{designer.phone}</span>
            </div>
          )}

          <div className="flex items-center space-x-1 text-xs text-stone-500 mt-1">
            <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="font-mono">{designer.experienceYears || 5} yrs experience</span>
          </div>
        </div>
      </div>

      {/* Bio excerpt */}
      {designer.bio && (
        <p className="text-xs text-stone-600 mt-3 line-clamp-2 leading-relaxed">
          {designer.bio}
        </p>
      )}

      {/* Specialties Badges */}
      {specialtiesList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {specialtiesList.map((spec, i) => (
            <span
              key={i}
              className="text-[11px] font-medium bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-md border border-stone-200"
            >
              {spec}
            </span>
          ))}
        </div>
      )}

      {/* Footer Schedule info & Action */}
      <div className="mt-4 pt-3.5 border-t border-stone-100 flex items-center justify-between">
        <div className="text-xs text-stone-500 flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
          <span className="truncate max-w-[170px] sm:max-w-xs">{daysList.slice(0, 4).join(', ')} ({startHour}-{endHour})</span>
        </div>

        <button
          onClick={() => onSelectDesigner(designer)}
          className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Select</span>
        </button>
      </div>

    </div>
  );
};
