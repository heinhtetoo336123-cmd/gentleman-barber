import React, { useEffect, useState } from 'react';
import { Booking, Service, Designer, AppStats, AuditLog } from '../types';
import { api } from '../api/client';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Scissors,
  Star,
  ShieldCheck,
  History,
  RefreshCw
} from 'lucide-react';

interface AdminStatsTabProps {
  stats: AppStats | null;
  bookings: Booking[];
  designers: Designer[];
  services: Service[];
}

export const AdminStatsTab: React.FC<AdminStatsTabProps> = ({
  stats,
  bookings,
  designers,
  services,
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Revenue calculation strictly for completed bookings
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const totalRevenue = completedBookings.reduce((sum, b) => sum + b.servicePrice, 0);

  const completedCount = completedBookings.length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

  const totalBookingsCount = bookings.length;
  const completionRate = totalBookingsCount > 0 ? Math.round((completedCount / totalBookingsCount) * 100) : 100;

  // Revenue per designer (Only completed bookings)
  const designerStatsMap: Record<string, { name: string; count: number; revenue: number; commission: number; commissionPercent: number }> = {};
  designers.forEach((d) => {
    designerStatsMap[d.id] = {
      name: d.name,
      count: 0,
      revenue: 0,
      commission: 0,
      commissionPercent: d.commissionPercent ?? 50,
    };
  });

  bookings.forEach((b) => {
    if (designerStatsMap[b.designerId]) {
      designerStatsMap[b.designerId].count += 1;
      if (b.status === 'completed') {
        const rev = b.servicePrice - (b.discountAmount || 0);
        designerStatsMap[b.designerId].revenue += rev;
        const commRate = designerStatsMap[b.designerId].commissionPercent;
        designerStatsMap[b.designerId].commission += Math.round((rev * commRate) / 100);
      }
    }
  });

  const designerPerformances = Object.values(designerStatsMap).sort((a, b) => b.revenue - a.revenue);

  // Popular Services Ranking
  const serviceStatsMap: Record<string, { name: string; count: number; category: string }> = {};
  services.forEach((s) => {
    serviceStatsMap[s.id] = { name: s.name, count: 0, category: s.category };
  });

  bookings.forEach((b) => {
    if (serviceStatsMap[b.serviceId]) {
      serviceStatsMap[b.serviceId].count += 1;
    }
  });

  const popularServicesList = Object.values(serviceStatsMap).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Revenue */}
        <div className="p-5 bg-white border border-emerald-200 rounded-3xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 font-mono tracking-wider">
            ${totalRevenue.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 flex items-center space-x-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Confirmed & Served Appointments</span>
          </p>
        </div>

        {/* Total Appointments */}
        <div className="p-5 bg-white border border-stone-200 rounded-3xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Total Bookings</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900 font-mono tracking-wider">
            {totalBookingsCount}
          </p>
          <p className="text-[11px] text-stone-500">
            {pendingCount} pending approval
          </p>
        </div>

        {/* Completion Rate */}
        <div className="p-5 bg-white border border-stone-200 rounded-3xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Completion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 font-mono tracking-wider">
            {completionRate}%
          </p>
          <p className="text-[11px] text-stone-500">
            {completedCount} completed, {cancelledCount} cancelled
          </p>
        </div>

        {/* Active Designers */}
        <div className="p-5 bg-white border border-stone-200 rounded-3xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Active Designers</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-stone-900 font-mono tracking-wider">
            {designers.length}
          </p>
          <p className="text-[11px] text-stone-500">
            {services.length} catalog haircuts/treatments
          </p>
        </div>

      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Designer Revenue Performance */}
        <div className="p-6 bg-white border border-stone-200 rounded-3xl space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono flex items-center space-x-2">
              <Star className="w-4 h-4 text-emerald-600" />
              <span>Designer Revenue Leaderboard</span>
            </h3>
            <span className="text-[11px] text-stone-500 font-mono">{designers.length} Stylists</span>
          </div>

          <div className="space-y-3">
            {designerPerformances.map((d, idx) => {
              const maxRev = designerPerformances[0]?.revenue || 1;
              const percent = Math.max(10, Math.round((d.revenue / maxRev) * 100));

              return (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-stone-900 flex items-center space-x-1.5">
                      <span className="text-[10px] text-emerald-600 font-mono font-bold">#{idx + 1}</span>
                      <span>{d.name}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-mono font-bold">
                        {d.commissionPercent}% Comms
                      </span>
                    </span>
                    <span className="font-mono text-emerald-700 font-bold flex items-center space-x-1.5">
                      <span>Ks {d.revenue.toLocaleString()}</span>
                      <span className="text-emerald-700 text-[10px] bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                        (Comm: Ks {d.commission.toLocaleString()})
                      </span>
                    </span>
                  </div>

                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Requested Services */}
        <div className="p-6 bg-white border border-stone-200 rounded-3xl space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono flex items-center space-x-2">
              <Scissors className="w-4 h-4 text-emerald-600" />
              <span>Most Requested Services</span>
            </h3>
            <span className="text-[11px] text-stone-500 font-mono">{services.length} Services</span>
          </div>

          <div className="space-y-3">
            {popularServicesList.slice(0, 5).map((srv, idx) => {
              const maxCount = popularServicesList[0]?.count || 1;
              const percent = Math.max(10, Math.round((srv.count / maxCount) * 100));

              return (
                <div key={srv.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-stone-900 truncate max-w-[200px]">
                      {idx + 1}. {srv.name}
                    </span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {srv.count} bookings
                    </span>
                  </div>

                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* System Activity Audit Logs Section */}
      <div className="p-6 bg-white border border-stone-200 rounded-3xl space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono flex items-center space-x-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
              <span>Admin & Staff System Activity Audit Logs</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">Real-time history of administrative changes, status updates, and setting edits</p>
          </div>
          
          <button
            onClick={loadAuditLogs}
            disabled={loadingLogs}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-300 cursor-pointer transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-stone-500 py-4 text-center">No system activity logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 text-stone-600 font-mono text-[10px] uppercase border-b border-stone-200">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Staff / Role</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-sans">
                {auditLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-2.5 font-mono text-[10px] text-emerald-700 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(log.timestamp).toLocaleDateString()})
                    </td>
                    <td className="p-2.5 font-bold text-stone-900 whitespace-nowrap">
                      <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-[10px]">
                        {log.adminName || (log as unknown as { userName?: string }).userName || 'Admin'}
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-700 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="p-2.5 text-stone-600 max-w-xs truncate">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
