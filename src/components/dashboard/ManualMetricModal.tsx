import React, { useState } from 'react';
import { Plus, DollarSign, Calendar, ShoppingBag, MousePointerClick, X } from 'lucide-react';

interface ManualMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (metric: {
    metric_date: string;
    revenue_vnd: number;
    commission_vnd: number;
    total_orders: number;
    clicks: number;
    note?: string;
  }) => Promise<void>;
}

export const ManualMetricModal: React.FC<ManualMetricModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [metricDate, setMetricDate] = useState(todayStr);
  const [revenueVND, setRevenueVND] = useState('');
  const [commissionVND, setCommissionVND] = useState('');
  const [totalOrders, setTotalOrders] = useState('');
  const [clicks, setClicks] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit({
      metric_date: metricDate,
      revenue_vnd: Number(revenueVND) || 0,
      commission_vnd: Number(commissionVND) || 0,
      total_orders: Number(totalOrders) || 0,
      clicks: Number(clicks) || 0,
      note
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-[#0F1420] border border-cyan-500/30 p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Nhập Số Liệu Thực Tế Hàng Ngày
              </h3>
              <p className="text-[10px] text-slate-400">
                Ghi nhận số liệu chuẩn vào bảng Supabase (Không trộn với demo)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Ngày ghi nhận *</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={metricDate}
                onChange={(e) => setMetricDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Doanh số GMV (VNĐ) *</label>
              <input
                type="number"
                required
                min="0"
                value={revenueVND}
                onChange={(e) => setRevenueVND(e.target.value)}
                placeholder="VD: 15000000"
                className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Hoa hồng nhận (VNĐ) *</label>
              <input
                type="number"
                required
                min="0"
                value={commissionVND}
                onChange={(e) => setCommissionVND(e.target.value)}
                placeholder="VD: 2500000"
                className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Số đơn hàng thực tế *</label>
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="0"
                  value={totalOrders}
                  onChange={(e) => setTotalOrders(e.target.value)}
                  placeholder="VD: 45"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Lượt nhấp (Clicks) *</label>
              <div className="relative">
                <MousePointerClick className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="0"
                  value={clicks}
                  onChange={(e) => setClicks(e.target.value)}
                  placeholder="VD: 1200"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Ghi chú (Tùy chọn)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đơn TikTok Shop chiến dịch Mega Sale..."
              className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu Số Liệu Thực'}
          </button>
        </div>
      </form>
    </div>
  );
};
