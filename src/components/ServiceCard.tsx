import React from 'react';
import { Service, UserRole } from '../types';
import { Clock, Tag, Sparkles, Scissors, Edit2 } from 'lucide-react';
import { formatPrice } from '../utils/formatters';

interface ServiceCardProps {
  service: Service;
  onSelectService: (service: Service) => void;
  role?: UserRole;
  onEditService?: (service: Service) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onSelectService,
  role,
  onEditService,
}) => {
  if (!service) return null;

  return (
    <div className="group relative bg-white rounded-2xl border border-stone-200 hover:border-emerald-400 overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col h-full">
      
      {/* Service Image Header */}
      <div className="relative h-44 w-full overflow-hidden bg-stone-100">
        <img
          src={service.imageUrl}
          alt={service.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
        
        {/* Category Pill */}
        <div className="absolute top-3 left-3 flex items-center space-x-1 bg-white/90 backdrop-blur-md text-stone-700 text-[11px] font-medium px-2.5 py-1 rounded-full border border-stone-200 shadow-2xs">
          <Tag className="w-3 h-3 text-emerald-600" />
          <span>{service.category}</span>
        </div>

        {/* Popular badge */}
        {service.popular && !role && (
          <div className="absolute top-3 right-3 flex items-center space-x-1 bg-emerald-500 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-sm">
            <Sparkles className="w-3 h-3" />
            <span>Popular</span>
          </div>
        )}

        {/* Admin Direct Edit Badge on Top Right */}
        {role === 'admin' && onEditService && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditService(service);
            }}
            className="absolute top-3 right-3 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-md flex items-center space-x-1 cursor-pointer border border-emerald-300 z-10 transition-transform active:scale-95"
            title="Edit Service Info & Price"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>ပြင်ဆင်ရန် (Edit)</span>
          </button>
        )}

        {/* Price & Duration Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <span className="text-xl font-black text-white font-mono tracking-tight drop-shadow-sm">{formatPrice(service.price)}</span>
          </div>
          <div className="flex items-center space-x-1 text-white text-xs bg-stone-900/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20">
            <Clock className="w-3.5 h-3.5 text-emerald-300" />
            <span>{service.durationMinutes} mins</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">
            {service.name}
          </h3>
          <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
            {service.description}
          </p>
        </div>

        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={() => onSelectService(service)}
            className="flex-1 flex items-center justify-center space-x-2 bg-stone-900 hover:bg-emerald-500 hover:text-white text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Book Service</span>
          </button>

          {role === 'admin' && onEditService && (
            <button
              onClick={() => onEditService(service)}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
              title="Edit Service Details"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>ပြင်ဆင်</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
