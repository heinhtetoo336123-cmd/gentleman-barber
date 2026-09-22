import React from 'react';
import { AppStats } from '../types';
import { formatPrice } from '../utils/formatters';
import { Calendar, DollarSign, Clock, Users, Scissors, TrendingUp } from 'lucide-react';

interface StatsOverviewProps {
  stats: AppStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      
      <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-3 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-mono text-stone-500 uppercase tracking-wider">Pending Requests</p>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl font-black text-stone-900 font-mono">{stats.pendingRequests}</span>
            {stats.pendingRequests > 0 && (
              <span className="text-[10px] text-emerald-900 font-semibold bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">Needs Action</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-3 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-mono text-stone-500 uppercase tracking-wider">Est. Revenue</p>
          <p className="text-lg font-black text-stone-900 font-mono">{formatPrice(stats.estimatedRevenue)}</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-3 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-mono text-stone-500 uppercase tracking-wider">Today's Bookings</p>
          <p className="text-xl font-black text-stone-900 font-mono">{stats.todayBookings}</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center space-x-3 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] font-mono text-stone-500 uppercase tracking-wider">Total Bookings</p>
          <p className="text-xl font-black text-stone-900 font-mono">{stats.totalBookings}</p>
        </div>
      </div>

    </div>
  );
};

