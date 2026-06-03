import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Building2, Megaphone, Ticket, CheckCircle, XCircle, Clock,
  TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getDashboardStats, getRedeemTrend, getCampaignPerformance, getVoucherGenerationTrend } from '@/services/analyticsService';
import { formatNumber } from '@/utils/formatters';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const StatCard = memo(function StatCard({ icon: Icon, label, value, color, index }) {
  const colorMap = {
    primary: 'from-primary-500 to-primary-700',
    blue: 'from-blue-500 to-blue-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    red: 'from-red-500 to-red-700',
    purple: 'from-purple-500 to-purple-700',
    teal: 'from-teal-500 to-teal-700',
  };

  const iconBgMap = {
    primary: 'bg-primary-100 text-primary-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    teal: 'bg-teal-100 text-teal-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', damping: 20 }}
      className="stat-card group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{formatNumber(value)}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBgMap[color] || iconBgMap.primary} transition-transform group-hover:scale-110`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorMap[color] || colorMap.primary} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
    </motion.div>
  );
});

const ChartCard = memo(function ChartCard({ title, children, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="card p-6"
    >
      <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
      {/* minHeight prevents Recharts from measuring -1 on first paint */}
      <div style={{ width: '100%', height: 280, minHeight: 280 }}>
        {children}
      </div>
    </motion.div>
  );
});

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2">
        <p className="text-xs text-slate-500">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.name}: {formatNumber(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    staleTime: 5 * 60 * 1000,
  });

  const { data: redeemTrend } = useQuery({
    queryKey: ['redeem-trend'],
    queryFn: () => getRedeemTrend(30),
    staleTime: 10 * 60 * 1000,
  });

  const { data: campaignPerf } = useQuery({
    queryKey: ['campaign-performance'],
    queryFn: getCampaignPerformance,
    staleTime: 10 * 60 * 1000,
  });

  const { data: generationTrend } = useQuery({
    queryKey: ['generation-trend'],
    queryFn: () => getVoucherGenerationTrend(30),
    staleTime: 10 * 60 * 1000,
  });

  const statCards = useMemo(() => [
    { icon: Users, label: 'Total Users', value: stats?.totalUsers || 0, color: 'blue' },
    { icon: Building2, label: 'Divisions', value: stats?.totalDivisions || 0, color: 'purple' },
    { icon: Megaphone, label: 'Campaigns', value: stats?.totalCampaigns || 0, color: 'amber' },
    { icon: Ticket, label: 'Total Vouchers', value: stats?.totalVouchers || 0, color: 'primary' },
    { icon: CheckCircle, label: 'Active Vouchers', value: stats?.activeVouchers || 0, color: 'emerald' },
    { icon: TrendingUp, label: 'Redeemed', value: stats?.usedVouchers || 0, color: 'teal' },
    { icon: XCircle, label: 'Expired', value: stats?.expiredVouchers || 0, color: 'red' },
  ], [stats]);

  if (statsLoading) {
    return <LoadingSpinner fullPage text="Loading dashboard..." />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your voucher management system</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        {statCards.map((card, idx) => (
          <StatCard key={card.label} {...card} index={idx} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Redemption Trend (Last 30 Days)" index={0}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={redeemTrend || []}>
              <defs>
                <linearGradient id="redeemGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F766E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="Redemptions" stroke="#0F766E" fill="url(#redeemGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Campaign Performance" index={1}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignPerf || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vouchers" name="Vouchers" fill="#14B8A6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="redeems" name="Redeems" fill="#0F766E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Voucher Generation Trend (Last 30 Days)" index={2}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={generationTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" name="Generated" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Voucher Usage Trend" index={3}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={redeemTrend || []}>
              <defs>
                <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="Usage" stroke="#22C55E" fill="url(#usageGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

export default DashboardPage;
