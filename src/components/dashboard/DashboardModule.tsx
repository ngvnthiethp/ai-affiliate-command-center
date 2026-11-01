import React, { useState } from 'react';
import {
  DashboardMetric,
  DailyPerformance,
  ModuleType,
  ProductItem
} from '../../types';
import { sevenDayPerformance, platformDistribution } from '../../data/mockData';
import {
  TrendingUp,
  ShoppingBag,
  MousePointerClick,
  Percent,
  Sparkles,
  Flame,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  Bot
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

import { Plus, Database } from 'lucide-react';

interface DashboardModuleProps {
  metrics: DashboardMetric;
  chartPerformance7D: DailyPerformance[];
  onNavigate: (module: ModuleType) => void;
  onSync: () => void;
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onOpenManualMetricModal: () => void;
  dataSourceFilter: 'all' | 'real_only' | 'demo_only';
  realMetricsCount: number;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  metrics,
  chartPerformance7D,
  onNavigate,
  onSync,
  products,
  onSelectProduct,
  onOpenManualMetricModal,
  dataSourceFilter,
  realMetricsCount
}) => {
  const [chartMetric, setChartMetric] = useState<'both' | 'commission' | 'revenue'>('both');

  // Format VND currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Hero Financial Summary Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1527] via-[#0B0F1C] to-[#150D2A] p-4 border border-cyan-500/30 shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 flex-wrap gap-2">
            <span className="flex items-center gap-1.5 font-medium text-cyan-400">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Hoa Hồng Thực Nhận
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ml-1 ${
                dataSourceFilter === 'real_only' || realMetricsCount > 0
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-purple-950 text-purple-300 border-purple-800'
              }`}>
                {dataSourceFilter === 'real_only' ? 'LIVE SUPABASE' : realMetricsCount > 0 ? 'KẾT HỢP' : 'DEMO SANDBOX'}
              </span>
            </span>

            <button
              onClick={onOpenManualMetricModal}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] flex items-center gap-1 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>Nhập Số Liệu Thực</span>
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-2 my-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
              {formatVND(metrics.commissionVND)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800/80 text-xs">
            <div className="text-slate-400">
              Tổng doanh số phát sinh (GMV):{' '}
              <span className="text-slate-200 font-semibold font-mono">
                {formatVND(metrics.revenueVND)}
              </span>
            </div>
            <div className="text-cyan-300 font-mono text-[11px]">
              Ước tính hôm nay: {formatVND(metrics.todayEstimatedCommission)}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Tổng Đơn Hàng</span>
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {metrics.totalOrders.toLocaleString()} <span className="text-xs font-normal text-slate-400">đơn</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center">
            {realMetricsCount > 0 ? `${realMetricsCount} ngày số liệu thật` : 'Dữ liệu mô phỏng'}
          </div>
        </div>

        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Lượt Nhấp (Clicks)</span>
            <MousePointerClick className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {metrics.clicks.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-300 mt-1">
            CPC bình quân: ~480đ
          </div>
        </div>

        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Tỷ Lệ Chuyển Đổi</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {metrics.conversionRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Chuẩn ngành: 2.5% - 3.8%
          </div>
        </div>

        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Đội Ngũ AI</span>
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-mono">
            5/5 <span className="text-xs font-normal text-slate-400">Agent</span>
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-1">
            Tự động cào & viết 24/7
          </div>
        </div>
      </div>

      {/* 7-Day Performance Chart (Recharts) */}
      <div className="rounded-2xl bg-[#0d121d] p-4 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Biểu Đồ Doanh Thu & Hoa Hồng (7 Ngày)
            </h3>
            <p className="text-[11px] text-slate-400">Đơn vị: Triệu VNĐ (cập nhật từ Supabase / Demo)</p>
          </div>

          {/* Metric toggle */}
          <div className="flex items-center gap-1 bg-[#131b2a] p-1 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setChartMetric('both')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                chartMetric === 'both' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400'
              }`}
            >
              Cả hai
            </button>
            <button
              onClick={() => setChartMetric('commission')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                chartMetric === 'commission' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400'
              }`}
            >
              Hoa hồng
            </button>
            <button
              onClick={() => setChartMetric('revenue')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                chartMetric === 'revenue' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400'
              }`}
            >
              Doanh thu
            </button>
          </div>
        </div>

        {chartPerformance7D.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl">
            <Database className="w-6 h-6 text-slate-600 mb-1.5" />
            <p className="text-xs text-slate-300 font-semibold mb-1">Chưa có số liệu thực tế nào từ Supabase</p>
            <p className="text-[10px] text-slate-500 mb-2">Bấm "+ Nhập Số Liệu Thực" để ghi nhận đơn hàng và doanh số</p>
            <button
              onClick={onOpenManualMetricModal}
              className="px-3 py-1 rounded-lg bg-cyan-500 text-black font-bold text-xs"
            >
              + Nhập Số Liệu Ngay
            </button>
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPerformance7D} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={(value: any, name: any) => [
                  `${value} Triệu VNĐ`,
                  name === 'commission' ? 'Hoa hồng thực' : 'Doanh thu (GMV)'
                ]}
              />
              {(chartMetric === 'both' || chartMetric === 'revenue') && (
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="#A855F7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              )}
              {(chartMetric === 'both' || chartMetric === 'commission') && (
                <Area
                  type="monotone"
                  dataKey="commission"
                  name="commission"
                  stroke="#00F0FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCommission)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" /> Hoa hồng: 28.92M
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Doanh thu: 184.5M
            </span>
          </div>
          <span className="text-slate-500">Chu kỳ 7 ngày</span>
        </div>
      </div>

      {/* Platform Distribution & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Platform Share */}
        <div className="rounded-xl bg-[#0d121d] p-3.5 border border-slate-800/80">
          <h4 className="text-xs font-bold text-white mb-2 flex items-center justify-between">
            <span>Kênh Phân Phối Affiliate</span>
            <span className="text-[10px] text-slate-400">Thị trường VN</span>
          </h4>
          <div className="space-y-2">
            {platformDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className="font-mono text-cyan-400 font-semibold">{item.share}% ({item.revenue} Tr)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.share}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Launchpad */}
        <div className="rounded-xl bg-[#0d121d] p-3.5 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Tác Vụ Nhanh (1-Chạm)
            </h4>
            <p className="text-[11px] text-slate-400 mb-2">Thao tác kích hoạt cho quản trị viên</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigate('product-hunter')}
              className="p-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Săn Deal Mới</span>
            </button>
            <button
              onClick={() => onNavigate('content-factory')}
              className="p-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tạo Kịch Bản</span>
            </button>
            <button
              onClick={onSync}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đồng Bộ Đơn</span>
            </button>
            <button
              onClick={() => onNavigate('ai-manager')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>5 AI Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 2 Viral Deals Spotlight */}
      <div className="rounded-xl bg-[#0d121d] p-3.5 border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Top Deal Tiềm Năng Nhất Hôm Nay
          </h4>
          <button
            onClick={() => onNavigate('product-hunter')}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center font-medium"
          >
            Xem tất cả <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        <div className="space-y-2">
          {products.slice(0, 2).map((prod) => (
            <div
              key={prod.id}
              className="p-2.5 rounded-lg bg-[#080d16] border border-slate-800/90 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-md object-cover shrink-0 border border-slate-700"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{prod.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="text-cyan-400 font-semibold font-mono">
                      Hoa hồng: {prod.commissionRate}% (+{formatVND(prod.estimatedCommissionVND)})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">Viral: {prod.viralScore}/100</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectProduct(prod);
                  onNavigate('content-factory');
                }}
                className="px-2.5 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black font-semibold text-[11px] shrink-0 transition-colors"
              >
                Giao AI Viết
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
