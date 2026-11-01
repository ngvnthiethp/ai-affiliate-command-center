import React, { useState, useRef, useMemo } from 'react';
import {
  ProductItem,
  PlatformType,
  PipelineStatus,
  ProductCompetitor,
  AuthUser,
  SystemLog
} from '../../types';
import {
  Flame,
  Search,
  Filter,
  Copy,
  Sparkles,
  Plus,
  Star,
  TrendingUp,
  Tag,
  ArrowUpRight,
  Check,
  ShoppingBag,
  Edit3,
  Trash2,
  FileText,
  Upload,
  Globe,
  Link2,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Users,
  Compass,
  ArrowRight,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';
import { productIntelligenceService, CompetitorComparisonSummary, CSVParseResult } from '../../services/productIntelligenceService';

interface ProductHunterModuleProps {
  products: ProductItem[];
  onSelectProductForScript: (product: ProductItem) => void;
  onCopyLink: (link: string, label: string) => void;
  onAddProduct: (product: ProductItem) => void;
  onAddMultipleProducts?: (products: ProductItem[]) => void;
  onUpdateProduct?: (id: string, updates: Partial<ProductItem>) => void;
  onDeleteProduct?: (id: string) => void;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
  addToast?: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  addSystemLog?: (level: SystemLog['level'], source: SystemLog['source'], message: string) => Promise<{ error: string | null }>;
}

export const ProductHunterModule: React.FC<ProductHunterModuleProps> = ({
  products,
  onSelectProductForScript,
  onCopyLink,
  onAddProduct,
  onAddMultipleProducts,
  onUpdateProduct,
  onDeleteProduct,
  currentUser,
  onOpenAuthModal,
  addToast,
  addSystemLog
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pipelineFilter, setPipelineFilter] = useState<'all' | PipelineStatus | 'FAVORITES'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'commission_rate' | 'commission_vnd' | 'price_asc' | 'newest'>('score');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState<boolean>(false);
  const [detailProduct, setDetailProduct] = useState<ProductItem | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'overview' | 'ai_analysis' | 'competitors' | 'data_source'>('overview');
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // AI Analysis state
  const [analyzingProductId, setAnalyzingProductId] = useState<string | null>(null);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState<number>(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<any>(null);

  // ============================================================================
  // FORM STATES: 1. Manual Input Form
  // ============================================================================
  const [manName, setManName] = useState('');
  const [manCategory, setManCategory] = useState<ProductItem['category']>('Công nghệ');
  const [manPlatform, setManPlatform] = useState<PlatformType>('tiktok');
  const [manPrice, setManPrice] = useState('350000');
  const [manOrigPrice, setManOrigPrice] = useState('');
  const [manCommissionRate, setManCommissionRate] = useState('18');
  const [manAffiliateUrl, setManAffiliateUrl] = useState('');
  const [manSourceUrl, setManSourceUrl] = useState('');
  const [manDescription, setManDescription] = useState('');
  const [manUsp, setManUsp] = useState('');
  const [manSoldCount, setManSoldCount] = useState('');
  const [manRating, setManRating] = useState('5.0');
  const [manReviewCount, setManReviewCount] = useState('');
  const [manNotes, setManNotes] = useState('');

  // ============================================================================
  // FORM STATES: 2. CSV Import
  // ============================================================================
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CSVParseResult | null>(null);
  const [csvDuplicateAction, setCsvDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

  // ============================================================================
  // FORM STATES: 3. URL Import
  // ============================================================================
  const [urlInput, setUrlInput] = useState('');
  const [urlParseResult, setUrlParseResult] = useState<{
    valid: boolean;
    platform: PlatformType;
    canonicalUrl: string;
    productTitleHint?: string;
    error?: string;
  } | null>(null);
  const [urlPrice, setUrlPrice] = useState('299000');
  const [urlCommissionRate, setUrlCommissionRate] = useState('18');
  const [urlCategory, setUrlCategory] = useState<ProductItem['category']>('Công nghệ');
  const [urlAffiliateUrl, setUrlAffiliateUrl] = useState('');

  // ============================================================================
  // FORM STATES: 4. Competitor Add in Detail Modal
  // ============================================================================
  const [compName, setCompName] = useState('');
  const [compUrl, setCompUrl] = useState('');
  const [compPrice, setCompPrice] = useState('');
  const [compCommission, setCompCommission] = useState('');
  const [compNotes, setCompNotes] = useState('');

  // Format currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // ============================================================================
  // REAL-TIME STATS: Discovery Dashboard KPIs
  // ============================================================================
  const stats = useMemo(() => {
    const total = products.length;
    const analyzing = products.filter((p) => p.pipelineStatus === 'ANALYZING').length;
    const highOpp = products.filter((p) => {
      const s = p.opportunityScore?.totalScore || p.viralScore || 0;
      return s >= 80;
    }).length;
    const approved = products.filter((p) => p.pipelineStatus === 'APPROVED').length;
    const favorites = products.filter((p) => p.isFavorite).length;

    return { total, analyzing, highOpp, approved, favorites };
  }, [products]);

  // ============================================================================
  // FILTERING & SORTING
  // ============================================================================
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Platform filter
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      // Category filter
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      // Pipeline status filter
      if (pipelineFilter === 'FAVORITES') {
        if (!p.isFavorite) return false;
      } else if (pipelineFilter !== 'all') {
        const pStatus = p.pipelineStatus || 'DISCOVERED';
        if (pStatus !== pipelineFilter) return false;
      }
      // Search query (name, usp, notes, category)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchUsp = (p.usp || '').toLowerCase().includes(q);
        const matchNotes = (p.trendReason || '').toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        if (!matchName && !matchUsp && !matchNotes && !matchCat) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = a.opportunityScore?.totalScore || a.viralScore || 0;
        const scoreB = b.opportunityScore?.totalScore || b.viralScore || 0;
        return scoreB - scoreA;
      }
      if (sortBy === 'commission_rate') {
        return (b.commissionRate || 0) - (a.commissionRate || 0);
      }
      if (sortBy === 'commission_vnd') {
        return (b.estimatedCommissionVND || 0) - (a.estimatedCommissionVND || 0);
      }
      if (sortBy === 'price_asc') {
        return (a.priceVND || 0) - (b.priceVND || 0);
      }
      // newest
      return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
    });
  }, [products, platformFilter, categoryFilter, pipelineFilter, searchQuery, sortBy]);

  // ============================================================================
  // HANDLERS: 1. Manual Input Submission
  // ============================================================================
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manName.trim()) {
      addToast?.('Vui lòng nhập tên sản phẩm!', 'warning');
      return;
    }

    const price = parseInt(manPrice, 10) || 350000;
    const origPrice = manOrigPrice ? parseInt(manOrigPrice, 10) : undefined;
    const rate = parseFloat(manCommissionRate) || 15;
    const sold = manSoldCount ? parseInt(manSoldCount, 10) : 0;
    const rating = manRating ? parseFloat(manRating) : 5.0;
    const reviews = manReviewCount ? parseInt(manReviewCount, 10) : 0;

    const partialItem: Partial<ProductItem> = {
      name: manName.trim(),
      category: manCategory,
      platform: manPlatform,
      priceVND: price,
      originalPriceVND: origPrice,
      commissionRate: rate,
      estimatedCommissionVND: Math.round((price * rate) / 100),
      affiliateUrl: manAffiliateUrl.trim(),
      sourceUrl: manSourceUrl.trim(),
      description: manDescription.trim(),
      usp: manUsp.trim(),
      soldCount7D: sold,
      rating: rating,
      reviewCount: reviews,
      trendReason: manNotes.trim() || 'Nhập thủ công bởi người dùng.',
      sourceType: 'manual',
      dataSource: 'Manual Input',
      collectedAt: new Date().toISOString(),
      inStock: true,
      commissionStatus: 'stable',
      pipelineStatus: 'DISCOVERED',
      isFavorite: false
    };

    const initialScore = productIntelligenceService.calculateOpportunityScore(partialItem);
    const fullProduct: ProductItem = {
      ...partialItem as ProductItem,
      id: 'prod-' + Date.now(),
      opportunityScore: initialScore,
      viralScore: initialScore.totalScore,
      dataReliability: initialScore.breakdown.dataReliability.score * 10,
      imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
      shortUrl: manAffiliateUrl || 'https://acc.link/' + Math.random().toString(36).substring(2, 7)
    };

    onAddProduct(fullProduct);
    setIsAddModalOpen(false);

    // Reset fields
    setManName('');
    setManAffiliateUrl('');
    setManSourceUrl('');
    setManDescription('');
    setManUsp('');
    setManNotes('');
    setManOrigPrice('');
  };

  // ============================================================================
  // HANDLERS: 2. CSV File Upload & Parsing
  // ============================================================================
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      addToast?.('Vui lòng chọn tệp định dạng .csv!', 'error');
      return;
    }

    setCsvFile(file);
    setIsProcessingCsv(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = productIntelligenceService.parseCSV(text);
      setCsvParseResult(parsed);
      setIsProcessingCsv(false);
    };
    reader.onerror = () => {
      addToast?.('Không thể đọc file CSV. Vui lòng kiểm tra encoding UTF-8.', 'error');
      setIsProcessingCsv(false);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = () => {
    if (!csvParseResult || csvParseResult.rows.length === 0) return;

    const { unique, duplicates } = productIntelligenceService.detectDuplicates(
      csvParseResult.rows,
      products
    );

    let itemsToInsert: ProductItem[] = [];

    // Unique items
    unique.forEach((u) => {
      const full: ProductItem = {
        ...u as ProductItem,
        id: 'prod-' + Date.now() + Math.random().toString(36).substring(2, 6),
        imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
        shortUrl: u.affiliateUrl || 'https://acc.link/' + Math.random().toString(36).substring(2, 7)
      };
      itemsToInsert.push(full);
    });

    // Duplicates action
    if (csvDuplicateAction === 'update' && duplicates.length > 0) {
      duplicates.forEach(({ newItem, existingItem }) => {
        onUpdateProduct?.(existingItem.id, {
          priceVND: newItem.priceVND || existingItem.priceVND,
          commissionRate: newItem.commissionRate || existingItem.commissionRate,
          usp: newItem.usp || existingItem.usp,
          description: newItem.description || existingItem.description
        });
      });
      addToast?.(`Đã cập nhật ${duplicates.length} sản phẩm trùng!`, 'info');
    }

    if (itemsToInsert.length > 0) {
      if (onAddMultipleProducts) {
        onAddMultipleProducts(itemsToInsert);
      } else {
        itemsToInsert.forEach((item) => onAddProduct(item));
      }
    }

    setIsCsvModalOpen(false);
    setCsvFile(null);
    setCsvParseResult(null);
  };

  // ============================================================================
  // HANDLERS: 3. URL Import
  // ============================================================================
  const handleTestUrl = () => {
    if (!urlInput.trim()) {
      setUrlParseResult({ valid: false, platform: 'tiktok', canonicalUrl: '', error: 'Vui lòng nhập URL sản phẩm!' });
      return;
    }
    const res = productIntelligenceService.parseProductURL(urlInput);
    setUrlParseResult(res);
    if (res.valid) {
      if (res.productTitleHint && !manName) {
        setManName(res.productTitleHint);
      }
    }
  };

  const handleConfirmUrlImport = () => {
    if (!urlParseResult || !urlParseResult.valid) {
      addToast?.('Vui lòng kiểm tra URL hợp lệ trước khi nhập!', 'warning');
      return;
    }

    const price = parseInt(urlPrice, 10) || 299000;
    const rate = parseFloat(urlCommissionRate) || 18;
    const name = urlParseResult.productTitleHint || `Sản phẩm ${urlParseResult.platform.toUpperCase()} (${new Date().toLocaleDateString('vi-VN')})`;

    const partialItem: Partial<ProductItem> = {
      name,
      category: urlCategory,
      platform: urlParseResult.platform,
      priceVND: price,
      commissionRate: rate,
      estimatedCommissionVND: Math.round((price * rate) / 100),
      affiliateUrl: urlAffiliateUrl.trim() || urlParseResult.canonicalUrl,
      sourceUrl: urlParseResult.canonicalUrl,
      sourceType: 'url_import',
      dataSource: `URL Canonical (${urlParseResult.platform.toUpperCase()})`,
      collectedAt: new Date().toISOString(),
      trendReason: 'Nhập thông qua trích xuất URL chuẩn hóa.',
      inStock: true,
      commissionStatus: 'stable',
      pipelineStatus: 'DISCOVERED',
      isFavorite: false
    };

    const initialScore = productIntelligenceService.calculateOpportunityScore(partialItem);
    const fullProduct: ProductItem = {
      ...partialItem as ProductItem,
      id: 'prod-' + Date.now(),
      opportunityScore: initialScore,
      viralScore: initialScore.totalScore,
      dataReliability: initialScore.breakdown.dataReliability.score * 10,
      imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
      shortUrl: urlAffiliateUrl.trim() || 'https://acc.link/' + Math.random().toString(36).substring(2, 7)
    };

    onAddProduct(fullProduct);
    setIsUrlModalOpen(false);
    setUrlInput('');
    setUrlParseResult(null);
    addToast?.(`Đã tiếp nhận sản phẩm từ ${urlParseResult.platform.toUpperCase()}!`, 'success');
  };

  // ============================================================================
  // HANDLERS: 4. AI Analysis Trigger (Gemini via Edge Function)
  // ============================================================================
  const handleRunAIAnalysis = async (product: ProductItem, forceRefresh = false) => {
    if (!currentUser) {
      addToast?.('Vui lòng đăng nhập Supabase trước khi sử dụng AI Brain!', 'warning');
      onOpenAuthModal?.();
      return;
    }

    // Set status to ANALYZING in UI
    onUpdateProduct?.(product.id, { pipelineStatus: 'ANALYZING' });
    setAnalyzingProductId(product.id);
    setAnalysisElapsedSeconds(0);

    const controller = new AbortController();
    analysisAbortRef.current = controller;

    timerRef.current = setInterval(() => {
      setAnalysisElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const result = await productIntelligenceService.analyzeProductWithAI(product, {
        forceRefresh,
        signal: controller.signal
      });

      if (timerRef.current) clearInterval(timerRef.current);
      setAnalyzingProductId(null);

      if (result.success && result.analysis) {
        // Persist AI analysis and calculated opportunity score
        const updates: Partial<ProductItem> = {
          aiAnalysis: result.analysis,
          opportunityScore: result.score,
          viralScore: result.score.totalScore,
          dataReliability: result.score.breakdown.dataReliability.score * 10,
          pipelineStatus: 'SHORTLISTED',
          lastAnalyzedAt: new Date().toISOString()
        };

        onUpdateProduct?.(product.id, updates);

        // Update active detail drawer if opened
        if (detailProduct?.id === product.id) {
          setDetailProduct({ ...detailProduct, ...updates });
        }

        if (result.fromCache) {
          addToast?.(`Đã tải kết quả phân tích AI (từ bộ nhớ đệm, 0 token)!`, 'info');
        } else {
          addToast?.(
            `Phân tích hoàn tất qua ${result.providerUsed || 'Gemini'}! Điểm cơ hội: ${result.score.totalScore}/100`,
            'success'
          );
          addSystemLog?.('success', 'Gemini', `Hoàn thành phân tích sản phẩm "${product.name}" (${result.score.totalScore}đ).`);
        }
      } else {
        onUpdateProduct?.(product.id, { pipelineStatus: 'DISCOVERED' });
        addToast?.(`Lỗi phân tích AI: ${result.error || 'Vui lòng thử lại'}`, 'error');
      }
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAnalyzingProductId(null);
      if (err?.name === 'AbortError' || analysisAbortRef.current?.signal.aborted) {
        addToast?.('Đã hủy tiến trình phân tích AI theo yêu cầu.', 'info');
        onUpdateProduct?.(product.id, { pipelineStatus: 'DISCOVERED' });
        return;
      }
      addToast?.('Lỗi kết nối khi phân tích AI.', 'error');
    }
  };

  const handleCancelAnalysis = () => {
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
      analysisAbortRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setAnalyzingProductId(null);
    setAnalysisElapsedSeconds(0);
  };

  // ============================================================================
  // HANDLERS: 5. Pipeline Status & Favorites
  // ============================================================================
  const handleToggleFavorite = (product: ProductItem) => {
    const nextState = !product.isFavorite;
    onUpdateProduct?.(product.id, { isFavorite: nextState });
    addToast?.(
      nextState ? `Đã thêm "${product.name.slice(0, 20)}..." vào Watchlist!` : `Đã bỏ khỏi Watchlist!`,
      'info'
    );
  };

  const handleChangePipelineStatus = (product: ProductItem, status: PipelineStatus) => {
    onUpdateProduct?.(product.id, { pipelineStatus: status });
    addToast?.(`Đã chuyển sản phẩm sang: ${status}`, 'success');
  };

  // ============================================================================
  // HANDLERS: 6. Add Competitor
  // ============================================================================
  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailProduct || !compName.trim()) return;

    const price = parseInt(compPrice, 10) || 0;
    const comm = compCommission ? parseFloat(compCommission) : undefined;

    const newComp: ProductCompetitor = {
      id: 'comp-' + Date.now(),
      name: compName.trim(),
      url: compUrl.trim() || undefined,
      priceVND: price,
      commissionRate: comm,
      notes: compNotes.trim() || undefined,
      isDirect: true
    };

    const currentComps = detailProduct.competitors || [];
    const updatedComps = [...currentComps, newComp];

    onUpdateProduct?.(detailProduct.id, { competitors: updatedComps });
    setDetailProduct({ ...detailProduct, competitors: updatedComps });

    setCompName('');
    setCompUrl('');
    setCompPrice('');
    setCompCommission('');
    setCompNotes('');
    addToast?.('Đã thêm sản phẩm đối thủ thành công!', 'success');
  };

  // Get score tier styling
  const getScoreBadge = (scoreNum: number, tier?: string) => {
    if (scoreNum >= 80) {
      return {
        bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80',
        label: tier || 'HIGH OPPORTUNITY',
        barBg: 'bg-emerald-400'
      };
    }
    if (scoreNum >= 65) {
      return {
        bg: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80',
        label: tier || 'POTENTIAL',
        barBg: 'bg-cyan-400'
      };
    }
    if (scoreNum >= 50) {
      return {
        bg: 'bg-amber-950/70 text-amber-300 border-amber-800/80',
        label: tier || 'NEEDS RESEARCH',
        barBg: 'bg-amber-400'
      };
    }
    return {
      bg: 'bg-slate-900 text-slate-400 border-slate-700',
      label: tier || 'LOW PRIORITY',
      barBg: 'bg-slate-500'
    };
  };

  return (
    <div className="space-y-4 pb-8 text-slate-100">
      {/* ==================================================================== */}
      {/* 1. DISCOVERY DASHBOARD (Real-Time KPIs) */}
      {/* ==================================================================== */}
      <div className="rounded-2xl bg-[#0B0F19] p-3.5 border border-slate-800 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Product Discovery Dashboard
              </h2>
              <p className="text-[10px] text-slate-400">
                Hệ thống thu thập & xếp hạng tiềm năng Affiliate (Thị trường VN)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1 shadow-md shadow-cyan-500/20"
              title="Nhập sản phẩm thủ công"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Thủ Công</span>
            </button>
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700"
              title="Nhập hàng loạt từ file CSV"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => setIsUrlModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700"
              title="Nhập từ URL Shopee / TikTok / Lazada"
            >
              <Link2 className="w-3.5 h-3.5 text-purple-400" />
              <span>URL</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-[#07090E] border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-medium">Tổng Sản Phẩm</span>
            <span className="text-sm font-bold text-white font-mono">{stats.total}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#07090E] border border-slate-800/80">
            <span className="text-[10px] text-amber-300 block font-medium">Đang Phân Tích</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{stats.analyzing}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#07090E] border border-slate-800/80">
            <span className="text-[10px] text-emerald-300 block font-medium">Tiềm Năng Cao (≥80đ)</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{stats.highOpp}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#07090E] border border-slate-800/80">
            <span className="text-[10px] text-purple-300 block font-medium">Đã Duyệt Kịch Bản</span>
            <span className="text-sm font-bold text-purple-400 font-mono">{stats.approved}</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. SEARCH & ADVANCED FILTERS */}
      {/* ==================================================================== */}
      <div className="rounded-2xl bg-[#0B0F19] p-3 border border-slate-800 space-y-2.5 text-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, USP, ngành hàng..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#07090E] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Platform */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Nền Tảng:</label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as any)}
              className="w-full p-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tất cả sàn</option>
              <option value="tiktok">TikTok Shop</option>
              <option value="shopee">Shopee</option>
              <option value="lazada">Lazada</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Ngành Hàng:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tất cả ngành</option>
              <option value="Công nghệ">Công nghệ</option>
              <option value="Làm đẹp & Chăm sóc">Làm đẹp & Chăm sóc</option>
              <option value="Gia dụng thông minh">Gia dụng thông minh</option>
              <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
              <option value="Ẩm thực">Ẩm thực</option>
            </select>
          </div>

          {/* Pipeline Status */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Trạng Thái Vòng Đời:</label>
            <select
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value as any)}
              className="w-full p-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="FAVORITES">⭐ Chỉ xem Watchlist</option>
              <option value="DISCOVERED">DISCOVERED (Mới)</option>
              <option value="ANALYZING">ANALYZING (Đang phân tích)</option>
              <option value="SHORTLISTED">SHORTLISTED (Rút gọn)</option>
              <option value="APPROVED">APPROVED (Đã duyệt)</option>
              <option value="CONTENT_CREATED">CONTENT_CREATED (Đã tạo kịch bản)</option>
              <option value="PUBLISHED">PUBLISHED (Đã đăng)</option>
              <option value="REJECTED">REJECTED (Loại bỏ)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Sắp Xếp Theo:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full p-1.5 rounded-lg bg-[#07090E] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="score">Điểm cơ hội (Cao ➔ Thấp)</option>
              <option value="commission_rate">Tỷ lệ hoa hồng (%) cao nhất</option>
              <option value="commission_vnd">Tiền hoa hồng (VNĐ) cao nhất</option>
              <option value="price_asc">Giá bán (Thấp ➔ Cao)</option>
              <option value="newest">Mới cập nhật nhất</option>
            </select>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. PRODUCT CARDS LIST */}
      {/* ==================================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-slate-400">
            Hiển thị <strong className="text-white">{filteredProducts.length}</strong> / {products.length} sản phẩm
          </span>
          <span className="text-[10px] text-slate-500 italic">
            * Điểm cơ hội: Đánh giá suy luận AI, không cam kết doanh số bán.
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#0B0F19] border border-slate-800 text-center space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-300">Không tìm thấy sản phẩm phù hợp</h3>
            <p className="text-[11px] text-slate-500">
              Thử xóa bớt bộ lọc hoặc thêm sản phẩm mới bằng nút "Thêm Thủ Công" / "CSV" / "URL".
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const oppScore = product.opportunityScore?.totalScore || product.viralScore || 75;
            const badge = getScoreBadge(oppScore, product.opportunityScore?.tier);
            const isAnalyzing = analyzingProductId === product.id;
            const expectedComm = Math.round((product.priceVND * product.commissionRate) / 100);

            return (
              <div
                key={product.id}
                className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 hover:border-cyan-500/40 transition-all shadow-md space-y-3"
              >
                {/* Header: Platform pill, Category, Watchlist star, Pipeline Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Platform Tag */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        product.platform === 'tiktok'
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                          : product.platform === 'shopee'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                          : 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                      }`}
                    >
                      {product.platform === 'tiktok' ? 'TikTok Shop' : product.platform.toUpperCase()}
                    </span>

                    {/* Category */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
                      {product.category}
                    </span>

                    {/* Reliability Pill */}
                    {product.dataReliability !== undefined && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-400">
                        Tin cậy: {product.dataReliability}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Pipeline Status Select */}
                    <select
                      value={product.pipelineStatus || 'DISCOVERED'}
                      onChange={(e) => handleChangePipelineStatus(product, e.target.value as PipelineStatus)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#07090E] border border-slate-700 text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="DISCOVERED">Mới</option>
                      <option value="ANALYZING">Đang phân tích</option>
                      <option value="SHORTLISTED">Rút gọn</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="CONTENT_CREATED">Đã tạo kịch bản</option>
                      <option value="PUBLISHED">Đã đăng</option>
                      <option value="REJECTED">Loại bỏ</option>
                    </select>

                    {/* Favorite / Watchlist Button */}
                    <button
                      onClick={() => handleToggleFavorite(product)}
                      className={`p-1 rounded-lg border transition-colors ${
                        product.isFavorite
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                      title={product.isFavorite ? 'Bỏ theo dõi' : 'Thêm vào Watchlist'}
                    >
                      <Star className={`w-3.5 h-3.5 ${product.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Product Core Info */}
                <div className="flex items-start gap-3">
                  {/* Thumbnail / Placeholder */}
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <Tag className="w-5 h-5 text-slate-500 absolute" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3
                      onClick={() => {
                        setDetailProduct(product);
                        setDetailActiveTab('overview');
                      }}
                      className="text-xs font-bold text-white hover:text-cyan-400 cursor-pointer line-clamp-2 leading-tight transition-colors"
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    {/* Price & Commission Block */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-cyan-300 font-mono">
                        {formatVND(product.priceVND)}
                      </span>
                      {product.originalPriceVND && product.originalPriceVND > product.priceVND && (
                        <span className="text-[10px] text-slate-500 line-through font-mono">
                          {formatVND(product.originalPriceVND)}
                        </span>
                      )}

                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">
                        Hoa hồng: {product.commissionRate}% (~{formatVND(expectedComm)})
                      </span>
                    </div>

                    {/* USP snippet if available */}
                    {product.usp && (
                      <p className="text-[10px] text-slate-400 line-clamp-1 italic">
                        ⚡ USP: {product.usp}
                      </p>
                    )}
                  </div>
                </div>

                {/* Opportunity Score Gauge Banner */}
                <div className="p-2.5 rounded-xl bg-[#07090E] border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Compass className="w-3 h-3 text-cyan-400" />
                      <span>Opportunity Score:</span>
                    </span>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${badge.bg}`}>
                      {oppScore}/100 · {badge.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${badge.barBg} transition-all duration-500`}
                      style={{ width: `${Math.min(100, oppScore)}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  {/* AI Analysis Button */}
                  <button
                    onClick={() => handleRunAIAnalysis(product, true)}
                    disabled={isAnalyzing}
                    className="flex-1 min-h-[36px] py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 hover:from-cyan-500 hover:to-purple-600 hover:text-black text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Phân tích... ({analysisElapsedSeconds}s)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{product.aiAnalysis ? 'Phân Tích Lại' : 'Phân Tích AI'}</span>
                      </>
                    )}
                  </button>

                  {/* Cancel Button if running */}
                  {isAnalyzing && (
                    <button
                      onClick={handleCancelAnalysis}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold"
                    >
                      Hủy
                    </button>
                  )}

                  {/* Detail Drawer Button */}
                  <button
                    onClick={() => {
                      setDetailProduct(product);
                      setDetailActiveTab('overview');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Chi Tiết</span>
                  </button>

                  {/* Send to Content Factory Button */}
                  <button
                    onClick={() => {
                      onSelectProductForScript(product);
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Chuyển sang Xưởng Kịch Bản tạo video"
                  >
                    <span>Lên Kịch Bản</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Bạn có chắc muốn xóa sản phẩm "${product.name}"?`)) {
                        onDeleteProduct?.(product.id);
                      }
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 transition-colors"
                    title="Xóa sản phẩm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: Thêm Sản Phẩm Thủ Công (Manual Input Modal) */}
      {/* ==================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Thêm Sản Phẩm Mới (Manual Input)
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={manName}
                  onChange={(e) => setManName(e.target.value)}
                  placeholder="Ví dụ: Tai nghe chống ồn không dây ANC Space One..."
                  className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Ngành hàng *</label>
                  <select
                    value={manCategory}
                    onChange={(e) => setManCategory(e.target.value as any)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="Làm đẹp & Chăm sóc">Làm đẹp & Chăm sóc</option>
                    <option value="Gia dụng thông minh">Gia dụng thông minh</option>
                    <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
                    <option value="Ẩm thực">Ẩm thực</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Nền tảng *</label>
                  <select
                    value={manPlatform}
                    onChange={(e) => setManPlatform(e.target.value as any)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="tiktok">TikTok Shop</option>
                    <option value="shopee">Shopee</option>
                    <option value="lazada">Lazada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Giá bán (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={manPrice}
                    onChange={(e) => setManPrice(e.target.value)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Giá gốc niêm yết (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="Không bắt buộc"
                    value={manOrigPrice}
                    onChange={(e) => setManOrigPrice(e.target.value)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Hoa hồng (%) *</label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="1"
                    max="80"
                    value={manCommissionRate}
                    onChange={(e) => setManCommissionRate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Lượt đã bán (nếu có)</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 1250"
                    value={manSoldCount}
                    onChange={(e) => setManSoldCount(e.target.value)}
                    className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Link Affiliate</label>
                <input
                  type="url"
                  placeholder="https://vt.tiktok.com/... hoặc https://s.shopee.vn/..."
                  value={manAffiliateUrl}
                  onChange={(e) => setManAffiliateUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Link sản phẩm gốc (Source URL)</label>
                <input
                  type="url"
                  placeholder="https://shopee.vn/san-pham-abc..."
                  value={manSourceUrl}
                  onChange={(e) => setManSourceUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">USP (Điểm bán hàng độc nhất)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chống ồn chủ động ANC -38dB, pin trâu 40h..."
                  value={manUsp}
                  onChange={(e) => setManUsp(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mô tả sản phẩm</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả công dụng, đối tượng sử dụng..."
                  value={manDescription}
                  onChange={(e) => setManDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
                >
                  Lưu Sản Phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: Nhập File CSV (CSV Import Modal) */}
      {/* ==================================================================== */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Nhập Danh Sách Sản Phẩm (CSV Import)
                </h3>
              </div>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              Hệ thống tự động phát hiện các cột: <strong>Tên sản phẩm, Giá bán, Hoa hồng (%), Danh mục, Nền tảng, Link Affiliate, USP</strong>.
            </p>

            {/* Dropzone */}
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-[#080D16] text-center space-y-2 cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-6 h-6 text-cyan-400 mx-auto" />
              <div className="text-xs text-white font-semibold">
                {csvFile ? csvFile.name : 'Nhấn để chọn file .csv hoặc kéo thả vào đây'}
              </div>
              <p className="text-[10px] text-slate-500">Hỗ trợ encoding UTF-8, kích thước tối đa 5MB</p>
            </div>

            {/* Parse Results Preview */}
            {csvParseResult && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    Tìm thấy: <span className="text-cyan-400">{csvParseResult.rows.length}</span> sản phẩm hợp lệ
                  </span>
                  {csvParseResult.missingFieldsWarnings.length > 0 && (
                    <span className="text-[10px] text-amber-400">
                      {csvParseResult.missingFieldsWarnings.length} cảnh báo thiếu trường
                    </span>
                  )}
                </div>

                {/* Duplicates Options */}
                <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-300 text-[11px]">Xử lý sản phẩm trùng lặp:</div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="dup_action"
                        checked={csvDuplicateAction === 'skip'}
                        onChange={() => setCsvDuplicateAction('skip')}
                        className="text-cyan-500"
                      />
                      <span>Bỏ qua sản phẩm trùng</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="dup_action"
                        checked={csvDuplicateAction === 'update'}
                        onChange={() => setCsvDuplicateAction('update')}
                        className="text-cyan-500"
                      />
                      <span>Cập nhật thông tin bản ghi trùng</span>
                    </label>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl bg-[#080D16]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">Tên sản phẩm</th>
                        <th className="p-2">Giá</th>
                        <th className="p-2">Hoa hồng</th>
                        <th className="p-2">Sàn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                      {csvParseResult.rows.slice(0, 5).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-2 font-sans truncate max-w-[150px]">{r.name}</td>
                          <td className="p-2 text-cyan-300">{formatVND(r.priceVND || 0)}</td>
                          <td className="p-2 text-emerald-400">{r.commissionRate}%</td>
                          <td className="p-2 uppercase">{r.platform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmCsvImport}
                disabled={!csvParseResult || csvParseResult.rows.length === 0}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-40"
              >
                Xác Nhận Nhập ({csvParseResult ? csvParseResult.rows.length : 0}) Sản Phẩm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: Nhập từ URL (URL Import Modal) */}
      {/* ==================================================================== */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Nhập Sản Phẩm Bằng URL (TikTok / Shopee / Lazada)
                </h3>
              </div>
              <button onClick={() => setIsUrlModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="font-semibold text-cyan-300">💡 Nguyên tắc bảo mật & tuân thủ:</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Hệ thống chuẩn hóa URL, trích xuất mã sản phẩm chuẩn và phân loại sàn tự động mà không can thiệp trái phép, vượt CAPTCHA hay phá hoại hạ tầng của bên thứ ba.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300 mb-1 font-semibold">Dán URL Sản Phẩm:</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://shopee.vn/... hoặc https://vt.tiktok.com/..."
                  className="flex-1 p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestUrl}
                  className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold"
                >
                  Kiểm Tra
                </button>
              </div>
            </div>

            {/* URL Parse Output */}
            {urlParseResult && (
              <div className="space-y-2.5">
                {urlParseResult.valid ? (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>URL hợp lệ từ {urlParseResult.platform.toUpperCase()}!</span>
                    </div>

                    <div className="text-[10px] text-slate-300 space-y-1">
                      <div>
                        <span className="text-slate-400">Canonical URL:</span>{' '}
                        <code className="text-cyan-300 font-mono break-all">{urlParseResult.canonicalUrl}</code>
                      </div>
                      {urlParseResult.productTitleHint && (
                        <div>
                          <span className="text-slate-400">Gợi ý tên:</span>{' '}
                          <span className="text-white font-medium">{urlParseResult.productTitleHint}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{urlParseResult.error}</span>
                  </div>
                )}

                {/* Additional Information inputs */}
                {urlParseResult.valid && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Giá bán (VNĐ) *</label>
                        <input
                          type="number"
                          value={urlPrice}
                          onChange={(e) => setUrlPrice(e.target.value)}
                          className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Hoa hồng (%) *</label>
                        <input
                          type="number"
                          value={urlCommissionRate}
                          onChange={(e) => setUrlCommissionRate(e.target.value)}
                          className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Ngành hàng *</label>
                      <select
                        value={urlCategory}
                        onChange={(e) => setUrlCategory(e.target.value as any)}
                        className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="Công nghệ">Công nghệ</option>
                        <option value="Làm đẹp & Chăm sóc">Làm đẹp & Chăm sóc</option>
                        <option value="Gia dụng thông minh">Gia dụng thông minh</option>
                        <option value="Thời trang & Phụ kiện">Thời trang & Phụ kiện</option>
                        <option value="Ẩm thực">Ẩm thực</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-medium">Link Affiliate (nếu khác link gốc)</label>
                      <input
                        type="url"
                        placeholder="Link affiliate rút gọn..."
                        value={urlAffiliateUrl}
                        onChange={(e) => setUrlAffiliateUrl(e.target.value)}
                        className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmUrlImport}
                disabled={!urlParseResult?.valid}
                className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black text-xs font-bold shadow-lg shadow-purple-500/20 disabled:opacity-40"
              >
                Xác Nhận Nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: PRODUCT DETAIL & INTELLIGENCE DRAWER */}
      {/* ==================================================================== */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto text-xs">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      detailProduct.platform === 'tiktok'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : detailProduct.platform === 'shopee'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {detailProduct.platform.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-400">{detailProduct.category}</span>
                </div>
                <h2 className="text-sm font-bold text-white leading-tight">{detailProduct.name}</h2>
              </div>

              <button
                onClick={() => setDetailProduct(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-800 pb-1 text-xs">
              <button
                onClick={() => setDetailActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  detailActiveTab === 'overview'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Tổng Quan & Điểm Số</span>
              </button>

              <button
                onClick={() => setDetailActiveTab('ai_analysis')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  detailActiveTab === 'ai_analysis'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Phân Tích AI Brain</span>
              </button>

              <button
                onClick={() => setDetailActiveTab('competitors')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  detailActiveTab === 'competitors'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Đối Thủ Cạnh Tranh</span>
              </button>

              <button
                onClick={() => setDetailActiveTab('data_source')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  detailActiveTab === 'data_source'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Nguồn & Vòng Đời</span>
              </button>
            </div>

            {/* TAB 1: TỔNG QUAN & OPPORTUNITY SCORE BREAKDOWN */}
            {detailActiveTab === 'overview' && (
              <div className="space-y-3">
                {/* Score Summary Box */}
                {(() => {
                  const scoreObj = detailProduct.opportunityScore || productIntelligenceService.calculateOpportunityScore(detailProduct);
                  const badge = getScoreBadge(scoreObj.totalScore, scoreObj.tier);

                  return (
                    <div className="p-3 rounded-xl bg-[#080D16] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            Điểm Đánh Giá Tiềm Năng (Opportunity Score)
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-white">{scoreObj.totalScore}</span>
                            <span className="text-slate-500 font-mono">/ 100</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                              {scoreObj.tier}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Hoa hồng thực nhận / đơn:</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ~{formatVND(Math.round((detailProduct.priceVND * detailProduct.commissionRate) / 100))}
                          </span>
                        </div>
                      </div>

                      {/* 6 Criteria Breakdown */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] font-semibold text-slate-300">
                          Chi Tiết 6 Tiêu Chí Trọng Số (Score Breakdown):
                        </div>

                        {/* Criterion 1: Affiliate Commission */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">1. Affiliate Commission (Trọng số 20)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.affiliateCommission.score} / 20
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.affiliateCommission.explanation}
                          </p>
                        </div>

                        {/* Criterion 2: Market Demand */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">2. Market Demand (Trọng số 20)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.marketDemand.score} / 20
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.marketDemand.explanation}
                          </p>
                        </div>

                        {/* Criterion 3: TikTok Content Potential */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">3. TikTok Content Potential (Trọng số 20)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.tiktokContentPotential.score} / 20
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.tiktokContentPotential.explanation}
                          </p>
                        </div>

                        {/* Criterion 4: Competition */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">4. Competition (Trọng số 15)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.competition.score} / 15
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.competition.explanation}
                          </p>
                        </div>

                        {/* Criterion 5: Price & Conversion Potential */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">5. Price & Conversion (Trọng số 15)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.priceConversion.score} / 15
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.priceConversion.explanation}
                          </p>
                        </div>

                        {/* Criterion 6: Data Reliability */}
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800/60 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-200">6. Data Reliability (Trọng số 10)</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {scoreObj.breakdown.dataReliability.score} / 10
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {scoreObj.breakdown.dataReliability.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Required Disclaimer */}
                      <div className="p-2 bg-amber-950/20 border border-amber-800/30 rounded-lg text-[10px] text-amber-300/80 italic">
                        ⚠️ {scoreObj.disclaimer}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: PHÂN TÍCH AI BRAIN */}
            {detailActiveTab === 'ai_analysis' && (
              <div className="space-y-3">
                {detailProduct.aiAnalysis ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-purple-950/30 border border-purple-800/40 text-purple-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Phân tích bởi {detailProduct.aiAnalysis.providerUsed || 'Gemini'} ({detailProduct.aiAnalysis.modelUsed || 'gemini-2.5-flash'})</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 border border-purple-700/50">
                        {detailProduct.aiAnalysis.inferenceType}
                      </span>
                    </div>

                    {/* Target Audience & Solved Needs */}
                    <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Chân Dung Khách Hàng Mục Tiêu:</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {detailProduct.aiAnalysis.targetAudience}
                      </p>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <strong>Nhu cầu giải quyết:</strong> {detailProduct.aiAnalysis.solvedNeeds}
                      </div>
                    </div>

                    {/* Extracted USPs */}
                    {detailProduct.aiAnalysis.extractedUSPs && detailProduct.aiAnalysis.extractedUSPs.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-white">Điểm Bán Hàng Độc Nhất (USPs):</div>
                        <ul className="text-[11px] text-cyan-300 space-y-0.5 pl-4 list-disc">
                          {detailProduct.aiAnalysis.extractedUSPs.map((usp, i) => (
                            <li key={i}>{usp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Content Angles */}
                    {detailProduct.aiAnalysis.contentAngles && (
                      <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-purple-300">Góc Tiếp Cận Kịch Bản Video Ngắn:</div>
                        <div className="space-y-1">
                          {detailProduct.aiAnalysis.contentAngles.map((angle, i) => (
                            <div key={i} className="p-1.5 rounded bg-black/40 text-[11px] text-slate-200">
                              🎬 {angle}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pros, Cons, Risks */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-800/30 space-y-1">
                        <div className="text-[10px] font-bold text-emerald-400">Ưu điểm:</div>
                        <ul className="text-[10px] text-slate-300 pl-3 list-disc space-y-0.5">
                          {detailProduct.aiAnalysis.pros.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2 rounded-xl bg-red-950/20 border border-red-800/30 space-y-1">
                        <div className="text-[10px] font-bold text-red-400">Rủi ro & Cảnh báo:</div>
                        <ul className="text-[10px] text-slate-300 pl-3 list-disc space-y-0.5">
                          {detailProduct.aiAnalysis.risks.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Commission Clarification */}
                    <div className="p-2 rounded-xl bg-[#080D16] border border-slate-800 text-[10px] text-slate-400">
                      💰 <strong>Lưu ý ngân sách:</strong> {detailProduct.aiAnalysis.commissionAnalysis.marginNote}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#080D16] border border-slate-800 text-center space-y-2">
                    <Sparkles className="w-6 h-6 text-purple-400 mx-auto" />
                    <p className="text-xs text-slate-300">Sản phẩm này chưa được phân tích bằng AI Brain.</p>
                    <button
                      onClick={() => handleRunAIAnalysis(detailProduct, true)}
                      className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-black text-xs font-bold"
                    >
                      Bắt Đầu Phân Tích Ngay
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ĐỐI THỦ CẠNH TRANH (COMPETITOR INSIGHT) */}
            {detailActiveTab === 'competitors' && (
              <div className="space-y-3">
                {/* Competitor Overview Analysis */}
                {(() => {
                  const summary: CompetitorComparisonSummary = productIntelligenceService.compareCompetitors(
                    detailProduct,
                    detailProduct.competitors || []
                  );

                  return (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-[#080D16] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Giá thấp nhất</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            {formatVND(summary.lowestPrice)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#080D16] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Giá trung bình</span>
                          <span className="text-xs font-bold text-white font-mono">
                            {formatVND(summary.averagePrice)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#080D16] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Giá cao nhất</span>
                          <span className="text-xs font-bold text-amber-400 font-mono">
                            {formatVND(summary.highestPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Insights */}
                      <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-200">Đánh giá cơ hội cạnh tranh:</div>
                        <ul className="text-[10px] text-cyan-300 pl-3 list-disc space-y-0.5">
                          {summary.keyDifferentiators.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Add Competitor Form */}
                      <form onSubmit={handleAddCompetitor} className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold text-white">Thêm đối thủ cạnh tranh mới:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Tên shop hoặc deal đối thủ..."
                            value={compName}
                            onChange={(e) => setCompName(e.target.value)}
                            className="p-2 rounded-lg bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            required
                            placeholder="Giá bán đối thủ (VNĐ)..."
                            value={compPrice}
                            onChange={(e) => setCompPrice(e.target.value)}
                            className="p-2 rounded-lg bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="url"
                            placeholder="Link sản phẩm đối thủ..."
                            value={compUrl}
                            onChange={(e) => setCompUrl(e.target.value)}
                            className="p-2 rounded-lg bg-[#080D16] border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Ghi chú điểm mạnh/yếu của đối thủ..."
                            value={compNotes}
                            onChange={(e) => setCompNotes(e.target.value)}
                            className="p-2 rounded-lg bg-[#080D16] border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold"
                          >
                            Thêm Đối Thủ
                          </button>
                        </div>
                      </form>

                      {/* Competitor List */}
                      {detailProduct.competitors && detailProduct.competitors.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">
                            Danh sách đối thủ đã thêm ({detailProduct.competitors.length}):
                          </div>
                          <div className="space-y-1">
                            {detailProduct.competitors.map((c) => (
                              <div
                                key={c.id}
                                className="p-2 rounded-lg bg-[#080D16] border border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-white">{c.name}</div>
                                  <div className="text-[10px] text-slate-400">{c.notes || 'Không có ghi chú'}</div>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-amber-300 font-mono">{formatVND(c.priceVND)}</span>
                                  {c.url && (
                                    <a
                                      href={c.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-cyan-400 block hover:underline"
                                    >
                                      Xem link ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 4: NGUỒN DỮ LIỆU & VÒNG ĐỜI */}
            {detailActiveTab === 'data_source' && (
              <div className="space-y-2.5 p-3 rounded-xl bg-[#080D16] border border-slate-800 text-xs">
                <div className="font-bold text-white">Thuộc Tính Dữ Liệu & Nguồn Gốc:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Nguồn tiếp nhận (source_type):</span>
                    <span className="font-mono text-cyan-300 uppercase">{detailProduct.sourceType || 'manual'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tên nguồn (data_source):</span>
                    <span className="text-white">{detailProduct.dataSource || 'Manual Input'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Thời điểm thu thập (collected_at):</span>
                    <span className="font-mono text-slate-300">
                      {detailProduct.collectedAt ? new Date(detailProduct.collectedAt).toLocaleString('vi-VN') : 'Không ghi nhận'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Chỉ số tin cậy (data_reliability):</span>
                    <span className="font-mono text-emerald-400 font-bold">{detailProduct.dataReliability || 80}%</span>
                  </div>
                </div>

                {detailProduct.sourceUrl && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">URL nguồn gốc đã xác thực:</span>
                    <a
                      href={detailProduct.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-cyan-400 text-[11px] break-all hover:underline"
                    >
                      {detailProduct.sourceUrl}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  onSelectProductForScript(detailProduct);
                  setDetailProduct(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <span>Chuyển Sang Kịch Bản</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setDetailProduct(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
