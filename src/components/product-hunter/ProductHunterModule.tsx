import React, { useState } from 'react';
import { ProductItem, PlatformType } from '../../types';
import {
  Flame,
  Search,
  Filter,
  Copy,
  Link2,
  Sparkles,
  Plus,
  Star,
  TrendingUp,
  Tag,
  ArrowUpRight,
  Check,
  ShoppingBag,
  Edit3
} from 'lucide-react';

interface ProductHunterModuleProps {
  products: ProductItem[];
  onSelectProductForScript: (product: ProductItem) => void;
  onCopyLink: (link: string, label: string) => void;
  onAddProduct: (product: ProductItem) => void;
  onUpdateProduct?: (id: string, updates: Partial<ProductItem>) => void;
}

export const ProductHunterModule: React.FC<ProductHunterModuleProps> = ({
  products,
  onSelectProductForScript,
  onCopyLink,
  onAddProduct,
  onUpdateProduct
}) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minCommission, setMinCommission] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New product form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ProductItem['category']>('Công nghệ');
  const [newPlatform, setNewPlatform] = useState<PlatformType>('tiktok');
  const [newPrice, setNewPrice] = useState('450000');
  const [newCommissionRate, setNewCommissionRate] = useState('20');
  const [newAffiliateUrl, setNewAffiliateUrl] = useState('');

  // Format VND
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredProducts = products.filter((p) => {
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (p.commissionRate < minCommission) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.trendReason.toLowerCase().includes(q);
    }
    return true;
  });

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const price = parseInt(newPrice, 10) || 500000;
    const rate = parseInt(newCommissionRate, 10) || 15;
    const estimated = Math.round((price * rate) / 100);

    const product: ProductItem = {
      id: 'prod-' + Date.now(),
      name: newName,
      category: newCategory,
      platform: newPlatform,
      priceVND: price,
      commissionRate: rate,
      estimatedCommissionVND: estimated,
      viralScore: Math.floor(Math.random() * 15) + 82, // 82-96
      soldCount7D: Math.floor(Math.random() * 1500) + 400,
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
      affiliateUrl: newAffiliateUrl || 'https://vt.tiktok.com/ZS2k9xLM1/?utm_source=ai_acc',
      shortUrl: 'https://acc.link/' + Math.random().toString(36).substring(2, 7),
      trendReason: 'Sản phẩm mới được thêm thủ công vào hệ thống giám sát AI.',
      inStock: true,
      commissionStatus: 'stable'
    };

    onAddProduct(product);
    setIsAddModalOpen(false);
    setNewName('');
    setNewAffiliateUrl('');
  };

  // Edit product form state
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ProductItem['category']>('Công nghệ');
  const [editPlatform, setEditPlatform] = useState<PlatformType>('tiktok');
  const [editPrice, setEditPrice] = useState('450000');
  const [editCommissionRate, setEditCommissionRate] = useState('20');
  const [editAffiliateUrl, setEditAffiliateUrl] = useState('');
  const [editTrendReason, setEditTrendReason] = useState('');

  const openEditModal = (prod: ProductItem) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditCategory(prod.category);
    setEditPlatform(prod.platform);
    setEditPrice(String(prod.priceVND));
    setEditCommissionRate(String(prod.commissionRate));
    setEditAffiliateUrl(prod.affiliateUrl);
    setEditTrendReason(prod.trendReason || '');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim()) return;

    const price = parseInt(editPrice, 10) || 500000;
    const rate = parseInt(editCommissionRate, 10) || 15;
    const estimated = Math.round((price * rate) / 100);

    onUpdateProduct?.(editingProduct.id, {
      name: editName.trim(),
      category: editCategory,
      platform: editPlatform,
      priceVND: price,
      commissionRate: rate,
      estimatedCommissionVND: estimated,
      affiliateUrl: editAffiliateUrl.trim(),
      trendReason: editTrendReason.trim()
    });

    setEditingProduct(null);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-cyan-400" />
            Product Hunter (Săn Deal Hot)
          </h2>
          <p className="text-[11px] text-slate-400">
            Quét tự động bởi Scout AI · Hoa hồng tối thiểu 15%
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Thêm Deal</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-xl bg-[#0d121d] p-3 border border-slate-800 space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, xu hướng, từ khóa..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080d16] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Platform Tabs (Segmented Control) */}
        <div className="flex items-center gap-1 p-1 bg-[#080d16] rounded-lg border border-slate-800/80 text-xs">
          <button
            onClick={() => setPlatformFilter('all')}
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-colors ${
              platformFilter === 'all'
                ? 'bg-cyan-500 text-black font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tất cả ({products.length})
          </button>
          <button
            onClick={() => setPlatformFilter('tiktok')}
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-colors ${
              platformFilter === 'tiktok'
                ? 'bg-cyan-500 text-black font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TikTok Shop
          </button>
          <button
            onClick={() => setPlatformFilter('shopee')}
            className={`flex-1 py-1 px-2 rounded-md font-medium transition-colors ${
              platformFilter === 'shopee'
                ? 'bg-cyan-500 text-black font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Shopee
          </button>
        </div>

        {/* Secondary Filter: Category & Min Commission */}
        <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            {['all', 'Công nghệ', 'Làm đẹp & Chăm sóc', 'Gia dụng thông minh', 'Thời trang & Phụ kiện', 'Ẩm thực'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
                }`}
              >
                {cat === 'all' ? 'Tất cả ngành' : cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMinCommission((prev) => (prev === 20 ? 0 : 20))}
            className={`px-2 py-0.5 rounded whitespace-nowrap border shrink-0 transition-colors ${
              minCommission >= 20
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            }`}
          >
            Hoa hồng ≥ 20%
          </button>
        </div>
      </div>

      {/* Product List */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl bg-[#0d121d] p-8 text-center border border-slate-800">
          <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-white mb-1">Không tìm thấy deal phù hợp</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Thử thay đổi từ khóa hoặc đặt lại bộ lọc ngành hàng
          </p>
          <button
            onClick={() => {
              setPlatformFilter('all');
              setCategoryFilter('all');
              setMinCommission(0);
              setSearchQuery('');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-400 text-xs font-semibold hover:bg-slate-700"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((prod) => {
            return (
              <div
                key={prod.id}
                className="rounded-2xl bg-[#0d121d] p-3.5 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-2.5"
              >
                {/* Product Main Row */}
                <div className="flex gap-3">
                  <div className="relative w-18 h-18 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 px-1 rounded text-[9px] font-bold bg-black/80 text-cyan-300 uppercase">
                      {prod.platform}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h3 className="text-xs font-bold text-white leading-snug line-clamp-2">
                        {prod.name}
                      </h3>
                      {/* Edit Button & Viral Score Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditModal(prod)}
                          title="Sửa thông tin deal"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 border border-slate-700/80 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                          ⚡ {prod.viralScore}/100
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 flex-wrap">
                      {prod.isDemo ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-950/90 border border-purple-800 text-purple-300">
                          DEMO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/90 border border-emerald-800 text-emerald-300">
                          THỰC TẾ
                        </span>
                      )}
                      <span>{prod.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center text-amber-400">
                        <Star className="w-3 h-3 fill-current mr-0.5" />
                        {prod.rating}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Đã bán: {prod.soldCount7D.toLocaleString()}</span>
                    </div>

                    {/* Price & Commission Block */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white font-mono">
                        {formatVND(prod.priceVND)}
                      </span>
                      <span className="text-xs font-bold text-cyan-400 font-mono">
                        Hoa hồng {prod.commissionRate}% (+{formatVND(prod.estimatedCommissionVND)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trend reason insight */}
                <div className="p-2 rounded-lg bg-[#080d16] border border-slate-800/80 text-[10px] text-slate-300 flex items-start gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-cyan-300">Lý do Viral:</strong> {prod.trendReason}
                  </span>
                </div>

                {/* Interactive Action Bar */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  {/* Copy UTM Affiliate Link */}
                  <button
                    onClick={() => onCopyLink(prod.affiliateUrl, 'Link Affiliate chuẩn UTM')}
                    className="flex-1 min-h-[36px] py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span>Sao chép Link</span>
                  </button>

                  {/* Copy Shortlink */}
                  <button
                    onClick={() => onCopyLink(prod.shortUrl, 'Link Rút Gọn (Shortlink)')}
                    title={prod.shortUrl}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
                  >
                    <Link2 className="w-3 h-3 text-purple-400" />
                    <span className="hidden sm:inline">Rút gọn</span>
                  </button>

                  {/* Hand off to Copywriter AI */}
                  <button
                    onClick={() => onSelectProductForScript(prod)}
                    className="flex-1 min-h-[36px] py-1.5 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-cyan-500/10"
                  >
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Giao AI Viết Bài</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Thêm Deal Thủ Công */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleAddNew}
            className="w-full max-w-md rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                <Plus className="w-4 h-4 text-cyan-400" />
                Thêm Deal Sản Phẩm Mới
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Cốc giữ nhiệt Tyeso 750ml inox 304..."
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nền tảng</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as PlatformType)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="tiktok">TikTok Shop</option>
                    <option value="shopee">Shopee</option>
                    <option value="lazada">Lazada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ngành hàng</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="Làm đẹp & Chăm sóc">Làm đẹp & Chăm sóc</option>
                    <option value="Gia dụng thông minh">Gia dụng thông minh</option>
                    <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
                    <option value="Ẩm thực">Ẩm thực</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Giá bán (VNĐ)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Hoa hồng (%)</label>
                  <input
                    type="number"
                    value={newCommissionRate}
                    onChange={(e) => setNewCommissionRate(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Link Affiliate (nếu có)</label>
                <input
                  type="url"
                  value={newAffiliateUrl}
                  onChange={(e) => setNewAffiliateUrl(e.target.value)}
                  placeholder="https://vt.tiktok.com/... hoặc https://shope.ee/..."
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Lưu & Chấm Điểm
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Chỉnh Sửa Deal Sản Phẩm */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                Chỉnh Sửa Deal Sản Phẩm
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nền tảng</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value as PlatformType)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="tiktok">TikTok Shop</option>
                    <option value="shopee">Shopee</option>
                    <option value="lazada">Lazada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ngành hàng</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="Làm đẹp & Chăm sóc">Làm đẹp & Chăm sóc</option>
                    <option value="Gia dụng thông minh">Gia dụng thông minh</option>
                    <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
                    <option value="Ẩm thực">Ẩm thực</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Giá bán (VNĐ)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Hoa hồng (%)</label>
                  <input
                    type="number"
                    value={editCommissionRate}
                    onChange={(e) => setEditCommissionRate(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Link Affiliate</label>
                <input
                  type="url"
                  value={editAffiliateUrl}
                  onChange={(e) => setEditAffiliateUrl(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ghi chú / Lý do Viral</label>
                <input
                  type="text"
                  value={editTrendReason}
                  onChange={(e) => setEditTrendReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Cập Nhật Deal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
