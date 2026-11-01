import React, { useState } from 'react';
import { Campaign, CampaignStatus } from '../../types';
import {
  Rocket,
  TrendingUp,
  DollarSign,
  Play,
  Pause,
  Plus,
  Eye,
  MousePointerClick,
  ShoppingBag,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface CampaignCenterModuleProps {
  campaigns: Campaign[];
  onToggleStatus: (campaignId: string) => void;
  onUpdateBudget: (campaignId: string, budget: number) => void;
  onCreateCampaign: (campaign: Campaign) => void;
}

export const CampaignCenterModule: React.FC<CampaignCenterModuleProps> = ({
  campaigns,
  onToggleStatus,
  onUpdateBudget,
  onCreateCampaign
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Campaign Form State
  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState<Campaign['channel']>('TikTok Ads Boost');
  const [newProduct, setNewProduct] = useState('Bàn phím cơ Monsgeek M1W');
  const [newBudget, setNewBudget] = useState('3000000');

  // Format VND
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const totalSpent = campaigns.reduce((acc, c) => acc + c.spentVND, 0);
  const totalCommission = campaigns.reduce((acc, c) => acc + c.commissionEarnedVND, 0);
  const averageRoi = totalSpent > 0 ? Math.round(((totalCommission - totalSpent) / totalSpent) * 100) : 0;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const budget = parseInt(newBudget, 10) || 2000000;
    const campaign: Campaign = {
      id: 'camp-' + Date.now(),
      name: newName,
      channel: newChannel,
      productName: newProduct,
      budgetVND: budget,
      spentVND: 0,
      views: 0,
      clicks: 0,
      orders: 0,
      commissionEarnedVND: 0,
      roiPercentage: 0,
      status: 'running',
      startDate: new Date().toLocaleDateString('vi-VN'),
      endDate: '30 ngày tới'
    };

    onCreateCampaign(campaign);
    setIsCreateModalOpen(false);
    setNewName('');
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-cyan-400" />
            Campaign Center (Trung Tâm Chiến Dịch)
          </h2>
          <p className="text-[11px] text-slate-400">
            Giám sát ROI theo thời gian thực bởi Ads & Traffic AI
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Tạo Chiến Dịch</span>
        </button>
      </div>

      {/* Aggregate Financial Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800">
          <div className="text-[10px] text-slate-400 mb-0.5">Tổng Ngân Sách Đã Chi</div>
          <div className="text-sm font-bold text-white font-mono">{formatVND(totalSpent)}</div>
          <div className="text-[10px] text-slate-500 mt-1">4 chiến dịch</div>
        </div>

        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800">
          <div className="text-[10px] text-slate-400 mb-0.5">Hoa Hồng Thu Về</div>
          <div className="text-sm font-bold text-cyan-400 font-mono">{formatVND(totalCommission)}</div>
          <div className="text-[10px] text-emerald-400 mt-1">+23.2% tuần này</div>
        </div>

        <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800">
          <div className="text-[10px] text-slate-400 mb-0.5">ROI Bình Quân</div>
          <div className="text-sm font-bold text-emerald-400 font-mono">+{averageRoi}%</div>
          <div className="text-[10px] text-cyan-400 mt-1">Mục tiêu {'>'}150%</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#0d121d] rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-1 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tất cả ({campaigns.length})
        </button>
        <button
          onClick={() => setStatusFilter('running')}
          className={`flex-1 py-1 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'running'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Đang chạy
        </button>
        <button
          onClick={() => setStatusFilter('paused')}
          className={`flex-1 py-1 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'paused'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tạm dừng
        </button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-3">
        {filteredCampaigns.map((camp) => {
          const isRunning = camp.status === 'running';
          const spentPct = camp.budgetVND > 0 ? Math.min(100, Math.round((camp.spentVND / camp.budgetVND) * 100)) : 0;

          return (
            <div
              key={camp.id}
              className={`rounded-2xl bg-[#0d121d] p-3.5 border transition-all ${
                isRunning
                  ? 'border-slate-800 hover:border-slate-700 shadow-md'
                  : 'border-slate-800/60 opacity-75'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {camp.isDemo ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        DEMO
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        SUPABASE
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      {camp.channel}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Sản phẩm: <span className="text-slate-200 font-medium">{camp.productName}</span>
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white leading-snug">
                    {camp.name}
                  </h3>
                </div>

                {/* Status Toggle Button */}
                <button
                  onClick={() => onToggleStatus(camp.id)}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border ${
                    isRunning
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Đang chạy</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 text-slate-400" />
                      <span>Tạm dừng</span>
                    </>
                  )}
                </button>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-4 gap-1.5 bg-[#080d16] p-2.5 rounded-xl border border-slate-800/80 mb-2.5 text-center">
                <div>
                  <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                    <Eye className="w-2.5 h-2.5" /> Lượt xem
                  </div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {camp.views.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                    <MousePointerClick className="w-2.5 h-2.5" /> Lượt nhấp
                  </div>
                  <div className="text-xs font-bold text-purple-300 font-mono mt-0.5">
                    {camp.clicks.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                    <ShoppingBag className="w-2.5 h-2.5" /> Số đơn
                  </div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {camp.orders.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> ROI
                  </div>
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                    +{camp.roiPercentage}%
                  </div>
                </div>
              </div>

              {/* Budget Progress & Commission Result */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-[11px]">
                    Chi tiêu: <span className="font-mono text-white font-semibold">{formatVND(camp.spentVND)}</span> / {formatVND(camp.budgetVND)}
                  </span>
                  <span className="text-cyan-400 font-semibold font-mono text-[11px]">
                    Thu về: +{formatVND(camp.commissionEarnedVND)}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${spentPct}%` }}
                  />
                </div>
              </div>

              {/* Budget Adjuster */}
              <div className="pt-2 mt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">Thời gian: {camp.startDate} - {camp.endDate}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onUpdateBudget(camp.id, camp.budgetVND + 1000000)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition-colors"
                  >
                    +1 Triệu Ngân Sách
                  </button>
                  <button
                    onClick={() => onToggleStatus(camp.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                  >
                    {isRunning ? 'Tạm Dừng' : 'Bật Lại'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Tạo Chiến Dịch Mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-md rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                <Rocket className="w-4 h-4 text-cyan-400" />
                Khởi Tạo Chiến Dịch Mới
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên Chiến Dịch *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Chiến Dịch Mùa Siêu Sale 11.11..."
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Kênh Phân Phối</label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="TikTok Ads Boost">TikTok Spark Ads / Boost Video</option>
                  <option value="Shopee Affiliate Post">Shopee Affiliate Post / Livestream</option>
                  <option value="KOC Shortform Combo">KOC Shortform Combo Mạng Xã Hội</option>
                  <option value="Reels Seeding">Instagram Reels & Facebook Seeding</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Sản phẩm trọng tâm</label>
                <input
                  type="text"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ngân Sách Khởi Điểm (VNĐ)</label>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Kích Hoạt Chiến Dịch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
