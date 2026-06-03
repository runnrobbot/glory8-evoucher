import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardStats, getRedeemTrend, getCampaignPerformance, getVoucherGenerationTrend } from '@/services/analyticsService';
import { formatNumber, formatPercentage } from '@/utils/formatters';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { motion } from 'framer-motion';
import { TrendingUp, Ticket, CheckCircle, XCircle, BarChart3, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#0F766E', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];

function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats, staleTime: 5 * 60 * 1000 });
  const { data: redeemTrend } = useQuery({ queryKey: ['redeem-trend-60'], queryFn: () => getRedeemTrend(60), staleTime: 10 * 60 * 1000 });
  const { data: campaignPerf } = useQuery({ queryKey: ['campaign-performance'], queryFn: getCampaignPerformance, staleTime: 10 * 60 * 1000 });
  const { data: genTrend } = useQuery({ queryKey: ['generation-trend-60'], queryFn: () => getVoucherGenerationTrend(60), staleTime: 10 * 60 * 1000 });

  if (isLoading) return <LoadingSpinner fullPage text="Loading analytics..." />;

  const pieData = [
    { name: 'Active', value: stats?.activeVouchers || 0 },
    { name: 'Used', value: stats?.usedVouchers || 0 },
    { name: 'Expired', value: stats?.expiredVouchers || 0 },
  ].filter((d) => d.value > 0);

  const redeemRate = stats?.totalVouchers ? ((stats.usedVouchers / stats.totalVouchers) * 100) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1><p className="page-subtitle">Detailed performance metrics and trends</p></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Ticket, label: 'Total Vouchers', value: formatNumber(stats?.totalVouchers || 0), color: 'primary' },
          { icon: CheckCircle, label: 'Active', value: formatNumber(stats?.activeVouchers || 0), color: 'emerald' },
          { icon: TrendingUp, label: 'Redeem Rate', value: formatPercentage(redeemRate), color: 'teal' },
          { icon: XCircle, label: 'Expired', value: formatNumber(stats?.expiredVouchers || 0), color: 'red' },
        ].map((card, idx) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="stat-card">
            <card.icon className={`w-5 h-5 text-${card.color === 'primary' ? 'primary-600' : card.color + '-500'} mb-2`} />
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6"><h3 className="text-base font-semibold mb-4">Redeem Trend (60 Days)</h3><div className="h-[300px]"><ResponsiveContainer><AreaChart data={redeemTrend || []}><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0F766E" stopOpacity={0.2}/><stop offset="95%" stopColor="#0F766E" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={(v)=>v.slice(5)}/><YAxis tick={{fontSize:10}}/><Tooltip/><Area type="monotone" dataKey="count" name="Redeems" stroke="#0F766E" fill="url(#rg)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>

        <div className="card p-6"><h3 className="text-base font-semibold mb-4">Voucher Distribution</h3><div className="h-[300px]"><ResponsiveContainer><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div></div>

        <div className="card p-6"><h3 className="text-base font-semibold mb-4">Campaign Performance</h3><div className="h-[300px]"><ResponsiveContainer><BarChart data={campaignPerf || []}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Bar dataKey="vouchers" name="Vouchers" fill="#14B8A6" radius={[4,4,0,0]}/><Bar dataKey="redeems" name="Redeems" fill="#0F766E" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>

        <div className="card p-6"><h3 className="text-base font-semibold mb-4">Generation Trend (60 Days)</h3><div className="h-[300px]"><ResponsiveContainer><LineChart data={genTrend || []}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={(v)=>v.slice(5)}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line type="monotone" dataKey="count" name="Generated" stroke="#22C55E" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
