import React, { useState, useEffect } from 'react';
import { AuthUser, ContentScript, ProductItem, ScriptStatus, SystemLog } from '../../types';
import {
  Clapperboard,
  Sparkles,
  CheckCircle2,
  Copy,
  Download,
  Clock,
  Video,
  Split,
  Hash,
  AlertCircle,
  LogIn,
  Save,
  Plus,
  Trash2,
  Cpu,
  RefreshCw,
  ShoppingBag,
  Percent,
  Tag,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { edgeFunctionService, AIScriptOutput } from '../../services/edgeFunctionService';
import { aiLogService } from '../../services/aiLogService';

interface ContentFactoryModuleProps {
  scripts: ContentScript[];
  products: ProductItem[];
  selectedProductForScript: ProductItem | null;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
  onNavigateToProductHunter?: () => void;
  addToast?: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  addSystemLog?: (level: SystemLog['level'], source: SystemLog['source'], message: string) => Promise<{ error: string | null }>;
  onClearSelectedProduct: () => void;
  onApproveScript: (scriptId: string) => void;
  onToggleHookVariant: (scriptId: string) => void;
  onCopyText: (text: string, label: string) => void;
  onDownloadTxt: (script: ContentScript) => void;
  onCreateScript: (newScript: ContentScript) => Promise<void> | void;
}

export const ContentFactoryModule: React.FC<ContentFactoryModuleProps> = ({
  scripts,
  products,
  selectedProductForScript,
  currentUser,
  onOpenAuthModal,
  onNavigateToProductHunter,
  addToast,
  onClearSelectedProduct,
  onApproveScript,
  onToggleHookVariant,
  onCopyText,
  onDownloadTxt,
  onCreateScript
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | ScriptStatus>('all');

  // Modal 1: Generate Form
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(
    Boolean(selectedProductForScript)
  );

  // Modal 2: Preview & Edit AI Generated Script before saving to DB
  const [previewScript, setPreviewScript] = useState<ContentScript | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  // Form State for new script generation
  const [targetProductId, setTargetProductId] = useState<string>(
    selectedProductForScript ? selectedProductForScript.id : products[0]?.id || ''
  );
  const [targetAudience, setTargetAudience] = useState<string>(
    'Khách hàng trẻ 18-35 tuổi, thích săn deal online, dân văn phòng & sinh viên'
  );
  const [selectedTone, setSelectedTone] = useState<ContentScript['tone']>('Review chân thực');
  const [targetDuration, setTargetDuration] = useState<string>('35s - 45s');
  const [keyFeatures, setKeyFeatures] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<{ message: string; hint?: string; details?: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Dọn dẹp request khi component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Sync selectedProductForScript when incoming prop changes
  useEffect(() => {
    if (selectedProductForScript) {
      setTargetProductId(selectedProductForScript.id);
      setIsGenerateModalOpen(true);
      setGenerationError(null);
    } else if (products.length > 0 && !targetProductId) {
      setTargetProductId(products[0].id);
    }
  }, [selectedProductForScript, products, targetProductId]);

  const filteredScripts = scripts.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  // Find currently selected product in the form
  const currentSelectedProduct = products.find((p) => p.id === targetProductId) || products[0];

  // Hủy tiến trình AI do người dùng bấm nút
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setElapsedSeconds(0);
    if (addToast) {
      addToast('Đã dừng yêu cầu tạo kịch bản theo yêu cầu của bạn.', 'info');
    }
  };

  // Handle Generate with Supabase Edge Function & Gemini
  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return; // Prevent duplicate clicks

    setGenerationError(null);

    if (products.length === 0 || !currentSelectedProduct) {
      if (addToast) addToast('Vui lòng thêm sản phẩm bên Product Hunter trước khi tạo kịch bản.', 'warning');
      return;
    }

    // Require Auth
    if (!currentUser) {
      if (addToast) {
        addToast('Vui lòng đăng nhập Supabase trước khi tạo kịch bản bằng Gemini AI!', 'warning');
      }
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setIsGenerating(true);
    setElapsedSeconds(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const res = await edgeFunctionService.generateScript(
        {
          productName: currentSelectedProduct.name,
          category: currentSelectedProduct.category,
          platform: currentSelectedProduct.platform,
          priceVND: currentSelectedProduct.priceVND,
          commissionRate: currentSelectedProduct.commissionRate,
          targetAudience: targetAudience.trim() || undefined,
          tone: selectedTone,
          targetDuration,
          keyFeatures: keyFeatures.trim() || undefined
        },
        {
          signal: controller.signal
        }
      );

      clearInterval(timer);
      abortControllerRef.current = null;

      // Nếu người dùng đã hủy
      if (res.code === 'ABORTED' || controller.signal.aborted) {
        setIsGenerating(false);
        setElapsedSeconds(0);
        return;
      }

      if (!res.success || !res.data) {
        // Classify error exactly per specification
        let hint = res.hint;
        const isOverloaded =
          res.code === 'SERVICE_UNAVAILABLE' ||
          res.error?.includes('503') ||
          res.error?.includes('quá tải') ||
          res.error?.includes('high demand');

        if (isOverloaded) {
          hint = 'Máy chủ AI của Google đang có lượng truy cập đột biến tạm thời (Spikes in demand). Hãy thử lại sau ít phút.';
        } else if (res.code === 'TIMEOUT' || res.code === '504') {
          hint = 'Gemini cần thời gian hoàn thành kịch bản video (thường 20-45 giây). Máy chủ đang phản hồi chậm hoặc mạng chập chờn. Vui lòng bấm thử lại hoặc chọn thời lượng 20s - 30s.';
        } else if (res.code === 'RATE_LIMIT_EXCEEDED' || res.code === '429') {
          hint = 'Hạn mức Gemini API đã chạm giới hạn (429 Rate Limit). Thử lại sau ít phút hoặc nâng hạn mức quota.';
        } else if (res.code === 'FUNCTION_NOT_FOUND') {
          hint = 'Edge Function chưa được deploy trên Supabase. Bạn có thể deploy qua Supabase Dashboard/CLI hoặc dùng mẫu kịch bản offline.';
        } else if (res.code === 'UNAUTHORIZED' || res.code === '401') {
          hint = 'Phiên đăng nhập đã hết hạn. Vui lòng nhấn "Đăng Nhập Quản Trị" để đăng nhập lại.';
        } else if (res.code === 'API_KEY_INVALID' || res.code === 'MISSING_GEMINI_KEY') {
          hint = 'Kiểm tra biến môi trường GEMINI_API_KEY trong Supabase Secrets.';
        } else if (!hint) {
          hint = 'Vui lòng kiểm tra kết nối mạng và thử lại.';
        }

        const errorMsg = isOverloaded
          ? 'Gemini hiện đang quá tải. Vui lòng thử lại sau ít phút.'
          : (res.error || 'Không thể tạo kịch bản từ Gemini');

        setGenerationError({
          message: errorMsg,
          details: res.details,
          hint: hint
        });

        // Ghi log đúng MỘT LẦN vào bảng ai_task_logs khi kết thúc thất bại thật
        await aiLogService.logAITask({
          level: 'error',
          source: 'Copywriter AI',
          message: `Thất bại khi gọi Gemini: ${res.code || 'ERROR'} - ${errorMsg.slice(0, 100)}`
        });

        setIsGenerating(false);
        setElapsedSeconds(0);
        return;
      }

      // Successful AI generation
      const aiOutput: AIScriptOutput = res.data;

      // Không lưu bản nháp rỗng nếu thiếu tiêu đề hoặc nội dung
      if (!aiOutput.title && !aiOutput.bodyStory) {
        setGenerationError({
          message: 'Dữ liệu trả về từ Gemini không đầy đủ.',
          hint: 'Vui lòng thử tạo lại kịch bản.'
        });
        setIsGenerating(false);
        setElapsedSeconds(0);
        return;
      }

      const stagedScript: ContentScript = {
        id: 'script-' + Date.now(),
        productId: currentSelectedProduct.id,
        productName: currentSelectedProduct.name,
        platform: currentSelectedProduct.platform,
        title: aiOutput.title || `Kịch bản Shortform: ${currentSelectedProduct.name.slice(0, 35)}...`,
        targetDuration: aiOutput.targetDuration || targetDuration,
        hookVariantA: aiOutput.hookVariantA || `Đừng bỏ qua ${currentSelectedProduct.name} nếu bạn đang tìm kiếm giải pháp tối ưu!`,
        hookVariantB: aiOutput.hookVariantB || `Bí mật về ${currentSelectedProduct.name} ít người tiết lộ trước ngày siêu sale...`,
        activeHook: aiOutput.activeHook || 'A',
        bodyStory: aiOutput.bodyStory || `Trải nghiệm thực tế sử dụng ${currentSelectedProduct.name} trong 7 ngày.`,
        voiceoverLines: Array.isArray(aiOutput.voiceoverLines) && aiOutput.voiceoverLines.length > 0
          ? aiOutput.voiceoverLines
          : [
              {
                timestamp: '00:00 - 00:04',
                speech: aiOutput.hookVariantA || 'Xem ngay trước khi hết hàng!',
                action: 'Cầm sản phẩm unbox trên tay'
              },
              {
                timestamp: '00:05 - 00:25',
                speech: `Đây là ${currentSelectedProduct.name}, tính năng vượt trội trong tầm giá.`,
                action: 'Quay cận cảnh chi tiết và test thực tế'
              },
              {
                timestamp: '00:26 - 00:35',
                speech: aiOutput.callToAction || 'Bấm ngay giỏ hàng góc trái bên dưới để săn deal!',
                action: 'Chỉ tay vào giỏ hàng màu vàng góc trái màn hình'
              }
            ],
        callToAction: aiOutput.callToAction || 'Bấm ngay giỏ hàng góc trái màn hình để săn voucher giảm giá và freeship!',
        hashtags: Array.isArray(aiOutput.hashtags) && aiOutput.hashtags.length > 0
          ? aiOutput.hashtags
          : [`#${currentSelectedProduct.platform === 'tiktok' ? 'tiktokshopvietnam' : 'shopeehaul'}`, '#reviewchansinh', '#dealhot'],
        status: 'draft',
        tone: selectedTone,
        createdAt: 'Vừa sinh bởi Gemini Flash (Supabase Edge Function)',
        estimatedViews: aiOutput.estimatedViews || '60k - 150k',
        unverifiedClaimsNotes: aiOutput.unverifiedClaimsNotes || 'Lưu ý tuân thủ: Tránh khẳng định tuyệt đối về hiệu quả hoặc cam kết chữa dứt điểm theo chính sách TikTok Shop.'
      };

      // Ghi log duy nhất MỘT LẦN vào bảng ai_task_logs khi thành công
      await aiLogService.logAITask({
        level: 'info',
        source: 'Copywriter AI',
        message: `Sinh kịch bản Gemini Flash thành công: "${stagedScript.title.slice(0, 80)}"`
      });

      if (addToast) {
        addToast('Gemini đã sinh xong kịch bản! Vui lòng xem trước và chỉnh sửa trước khi lưu.', 'success');
      }

      setIsGenerating(false);
      setIsGenerateModalOpen(false);
      onClearSelectedProduct();

      // Open Preview & Edit Modal
      setPreviewScript(stagedScript);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      setIsGenerating(false);
      setGenerationError({
        message: err?.message || 'Lỗi không xác định khi gọi AI',
        hint: 'Kiểm tra kết nối mạng và tài khoản Supabase'
      });
    }
  };

  // Fallback offline generator if edge function is not yet deployed or user wants to test offline
  const handleUseOfflineFallback = () => {
    if (!currentSelectedProduct) return;

    const offlineScript: ContentScript = {
      id: 'script-' + Date.now(),
      productId: currentSelectedProduct.id,
      productName: currentSelectedProduct.name,
      platform: currentSelectedProduct.platform,
      title: `Kịch bản Shortform Triệu View: ${currentSelectedProduct.name.slice(0, 35)}...`,
      targetDuration,
      hookVariantA: `Đừng lướt qua nếu bạn đang tìm kiếm giải pháp cho ${currentSelectedProduct.category.toLowerCase()} với giá hời!`,
      hookVariantB: `Bí mật mà các shop bán ${currentSelectedProduct.category.toLowerCase()} không muốn bạn biết trước ngày sale...`,
      activeHook: 'A',
      bodyStory: `Trải nghiệm thực tế sử dụng ${currentSelectedProduct.name}. Phân tích ưu điểm vượt trội so với các đối thủ cùng phân khúc giá ${Number(currentSelectedProduct.priceVND).toLocaleString('vi-VN')} VNĐ.`,
      voiceoverLines: [
        {
          timestamp: '00:00 - 00:04',
          speech: 'Đừng lướt qua nếu bạn đang tìm kiếm giải pháp này!',
          action: 'Cầm sản phẩm unbox nhanh trên tay, zoom cận cảnh logo thương hiệu'
        },
        {
          timestamp: '00:05 - 00:18',
          speech: `Đây là ${currentSelectedProduct.name}, trải nghiệm thực tế vượt xa kỳ vọng trong tầm giá!`,
          action: 'Test tính năng chính, đưa ra kết quả đo lường cụ thể'
        },
        {
          timestamp: '00:19 - 00:30',
          speech: 'Đặc biệt shop đang có voucher trợ giá freeship và bảo hành chính hãng đổi mới.',
          action: 'Chỉ tay vào góc trái màn hình nơi hiển thị giỏ hàng TikTok Shop / Shopee'
        },
        {
          timestamp: '00:31 - 00:40',
          speech: 'Bấm ngay giỏ hàng góc trái bên dưới để săn deal hời trước khi hết số lượng nhé!',
          action: 'Vẫy tay chào và tạo hiệu ứng âm thanh click giỏ hàng'
        }
      ],
      callToAction: 'Bấm ngay giỏ hàng góc trái màn hình để săn voucher giảm giá và freeship số lượng có hạn!',
      hashtags: [
        `#${currentSelectedProduct.platform === 'tiktok' ? 'tiktokshopvietnam' : 'shopeehaul'}`,
        '#reviewchansinh',
        '#dealhot'
      ],
      status: 'draft',
      tone: selectedTone,
      createdAt: 'Bản nháp mẫu dự phòng',
      estimatedViews: '50k - 120k',
      unverifiedClaimsNotes: 'Lưu ý tuân thủ: Tránh các từ cấm như cam kết 100%, bảo hành trọn đời không căn cứ.'
    };

    setPreviewScript(offlineScript);
    setIsGenerateModalOpen(false);
    setIsPreviewModalOpen(true);
    setGenerationError(null);
  };

  // Confirm Save Script to Supabase content_drafts
  const handleConfirmSaveToDrafts = async () => {
    if (!previewScript || isSaving) return;

    if (!previewScript.title?.trim() || !previewScript.bodyStory?.trim()) {
      if (addToast) addToast('Kịch bản không thể để trống tiêu đề hoặc nội dung câu chuyện.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await onCreateScript(previewScript);
      setIsPreviewModalOpen(false);
      setPreviewScript(null);
    } catch (err: any) {
      if (addToast) addToast(`Lỗi khi lưu kịch bản: ${err?.message || 'Không xác định'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Scene Line helpers in Preview Modal
  const handleUpdateScene = (index: number, field: 'timestamp' | 'speech' | 'action', value: string) => {
    if (!previewScript) return;
    const updatedLines = [...previewScript.voiceoverLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setPreviewScript({ ...previewScript, voiceoverLines: updatedLines });
  };

  const handleAddScene = () => {
    if (!previewScript) return;
    const newScene = {
      timestamp: '00:35 - 00:45',
      speech: 'Lời thoại bổ sung...',
      action: 'Góc quay minh họa'
    };
    setPreviewScript({
      ...previewScript,
      voiceoverLines: [...previewScript.voiceoverLines, newScene]
    });
  };

  const handleRemoveScene = (index: number) => {
    if (!previewScript || previewScript.voiceoverLines.length <= 1) return;
    const updatedLines = previewScript.voiceoverLines.filter((_, i) => i !== index);
    setPreviewScript({ ...previewScript, voiceoverLines: updatedLines });
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Clapperboard className="w-4 h-4 text-cyan-400" />
            Content Factory (Xưởng Kịch Bản)
          </h2>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            Backend: Supabase Edge Functions + Gemini 2.5 Flash
          </p>
        </div>

        <button
          onClick={() => {
            setGenerationError(null);
            setIsGenerateModalOpen(true);
          }}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Tạo Kịch Bản Mới</span>
        </button>
      </div>

      {/* Auth Banner if not logged in */}
      {!currentUser && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Bạn đang xem chế độ khách. Đăng nhập Supabase để gọi Gemini API và lưu vào database.</span>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-2.5 py-1 rounded-lg bg-amber-400 text-black text-xs font-bold shrink-0 hover:bg-amber-300 transition-colors flex items-center gap-1"
            >
              <LogIn className="w-3 h-3" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      )}

      {/* Status Segmented Filter */}
      <div className="flex items-center gap-1 p-1 bg-[#0d121d] rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tất cả ({scripts.length})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'pending'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Chờ duyệt
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'approved'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Đã duyệt
        </button>
        <button
          onClick={() => setStatusFilter('draft')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'draft'
              ? 'bg-cyan-500 text-black font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bản nháp
        </button>
      </div>

      {/* Script Cards List */}
      <div className="space-y-3.5">
        {filteredScripts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#0d121d] border border-slate-800">
            <Clapperboard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Không có kịch bản nào phù hợp bộ lọc.</p>
          </div>
        ) : (
          filteredScripts.map((script) => {
            const isApproved = script.status === 'approved';
            const isPending = script.status === 'pending';
            const currentHook = script.activeHook === 'A' ? script.hookVariantA : script.hookVariantB;

            return (
              <div
                key={script.id}
                className="rounded-2xl bg-[#0d121d] p-3.5 border border-slate-800 hover:border-slate-700 shadow-md space-y-3"
              >
                {/* Header Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {script.isDemo ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                          DEMO
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          SUPABASE
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {script.platform}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {script.tone}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {script.targetDuration}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white leading-snug">
                      {script.title}
                    </h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Sản phẩm: <span className="text-slate-200 font-medium">{script.productName}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                      isApproved
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : isPending
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isApproved ? 'Đã duyệt' : isPending ? 'Chờ duyệt' : 'Bản nháp'}
                  </span>
                </div>

                {/* Hook Box with A/B Toggle */}
                <div className="rounded-xl bg-[#080d16] p-3 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <Split className="w-3.5 h-3.5" />
                      <span>Hook 3 Giây Đầu Giữ Chân Người Xem:</span>
                    </div>

                    {/* A/B Switcher */}
                    <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                      <button
                        onClick={() => onToggleHookVariant(script.id)}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          script.activeHook === 'A'
                            ? 'bg-cyan-500 text-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Biến thể A
                      </button>
                      <button
                        onClick={() => onToggleHookVariant(script.id)}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          script.activeHook === 'B'
                            ? 'bg-cyan-500 text-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Biến thể B
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-white font-medium italic bg-[#0f172a]/80 p-2.5 rounded-lg border border-cyan-500/20 leading-relaxed">
                    "{currentHook}"
                  </p>
                </div>

                {/* Voiceover & Storyboard Breakdown */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-purple-400" />
                    <span>Phân Cảnh Lời Thoại (Voiceover & Action):</span>
                  </div>
                  <div className="space-y-1 bg-[#080d16] p-2.5 rounded-xl border border-slate-800/80">
                    {script.voiceoverLines.map((line, idx) => (
                      <div key={idx} className="text-[11px] py-1 border-b border-slate-800/50 last:border-none flex gap-2">
                        <span className="font-mono text-cyan-400 shrink-0 font-medium">
                          [{line.timestamp}]
                        </span>
                        <div className="flex-1">
                          <span className="text-slate-200 font-medium">"{line.speech}"</span>
                          <span className="block text-[10px] text-purple-300/80 italic">
                            ↳ Máy quay: {line.action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call To Action & Hashtags */}
                <div className="bg-[#080d16] p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-[11px]">
                  <div>
                    <span className="font-semibold text-amber-400">CTA (Giỏ hàng): </span>
                    <span className="text-slate-200">{script.callToAction}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-cyan-400 font-mono text-[10px]">
                    <Hash className="w-3 h-3 text-slate-500" />
                    {script.hashtags.map((h, i) => (
                      <span key={i}>{h}</span>
                    ))}
                  </div>
                </div>

                {/* Unverified Claims & Compliance Note (if any) */}
                {script.unverifiedClaimsNotes && (
                  <div className="text-[10px] text-amber-300/90 bg-amber-950/25 p-2 rounded-lg border border-amber-900/50 flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{script.unverifiedClaimsNotes}</span>
                  </div>
                )}

                {/* Actions: Approve / Copy / Download */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  {!isApproved && (
                    <button
                      onClick={() => onApproveScript(script.id)}
                      className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Duyệt Kịch Bản</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const fullText = `[KỊCH BẢN: ${script.title}]\n\nHOOK: ${currentHook}\n\nTHÂN BÀI:\n${script.bodyStory}\n\nLỜI THOẠI:\n${script.voiceoverLines.map((l) => `${l.timestamp}: ${l.speech}`).join('\n')}\n\nCTA: ${script.callToAction}\n\nHASHTAG: ${script.hashtags.join(' ')}`;
                      onCopyText(fullText, 'Toàn bộ kịch bản máy nhắc chữ');
                    }}
                    className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sao chép kịch bản</span>
                  </button>

                  <button
                    onClick={() => onDownloadTxt(script)}
                    title="Tải file kịch bản dạng .txt"
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Tải .txt</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Form Yêu Cầu Tạo Kịch Bản Bằng Gemini Edge Function */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleGenerateSubmit}
            className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sản Xuất Kịch Bản Video Bằng Gemini AI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGenerateModalOpen(false);
                  onClearSelectedProduct();
                  setGenerationError(null);
                }}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* Error banner if previous call failed */}
            {generationError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{generationError.message}</span>
                </div>
                {generationError.hint && (
                  <p className="text-[11px] text-red-200/90 pl-6">{generationError.hint}</p>
                )}
                {generationError.details && (
                  <pre className="text-[10px] text-slate-300 bg-black/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {generationError.details}
                  </pre>
                )}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseOfflineFallback}
                    className="text-[11px] underline text-cyan-300 hover:text-cyan-200"
                  >
                    Dùng mẫu kịch bản offline để tiếp tục test giao diện →
                  </button>
                </div>
              </div>
            )}

            {/* Empty Products Alert */}
            {products.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5 text-center my-2">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <div className="space-y-1">
                  <p className="font-bold text-white">Chưa Có Sản Phẩm Trong Kho</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Content Factory cần dữ liệu sản phẩm từ bảng <code className="text-cyan-300">products</code> để sinh kịch bản đúng giá và ngành hàng. Hãy thêm sản phẩm tại Product Hunter trước khi tạo kịch bản!
                  </p>
                </div>
                {onNavigateToProductHunter && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsGenerateModalOpen(false);
                      onNavigateToProductHunter();
                    }}
                    className="mx-auto mt-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Đến Product Hunter Ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Product Selection */}
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Chọn Sản Phẩm Cần Viết Kịch Bản *
                  </label>
                  <select
                    value={targetProductId}
                    onChange={(e) => setTargetProductId(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.platform.toUpperCase()}] {p.name.slice(0, 45)}... ({Number(p.priceVND).toLocaleString('vi-VN')} đ · HH {p.commissionRate}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Product Overview Card */}
                {currentSelectedProduct && (
                  <div className="p-3 rounded-xl bg-[#080D16] border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5 truncate">
                        <ShoppingBag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{currentSelectedProduct.name}</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                        {currentSelectedProduct.platform}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                      <div className="text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-purple-400" />
                        <span>Ngành hàng:</span>
                        <span className="text-slate-200 font-medium truncate">{currentSelectedProduct.category}</span>
                      </div>
                      <div className="text-slate-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-amber-400" />
                        <span>Hoa hồng:</span>
                        <span className="text-amber-400 font-bold font-mono">
                          {currentSelectedProduct.commissionRate}%
                        </span>
                      </div>
                      <div className="text-slate-400 col-span-2">
                        Giá bán: <span className="text-emerald-400 font-bold font-mono">{Number(currentSelectedProduct.priceVND).toLocaleString('vi-VN')} đ</span>
                        <span className="text-slate-500 ml-1.5">(Ước tính hoa hồng: ~{Number(currentSelectedProduct.estimatedCommissionVND).toLocaleString('vi-VN')} đ)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Target Audience */}
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Đối Tượng Mục Tiêu (Target Audience)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="Ví dụ: Giới trẻ 18-35 tuổi, thích săn deal online, dân văn phòng..."
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Key Features */}
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Đặc Điểm Nổi Bật / USP Của Sản Phẩm (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    placeholder="Ví dụ: Chống nước IPX7, pin trâu 48h, tặng kèm quà 100k..."
                    value={keyFeatures}
                    onChange={(e) => setKeyFeatures(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Tone Selector */}
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Tone Giọng & Phong Cách Thể Hiện
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        'Review chân thực',
                        'Hài hước dí dỏm',
                        'Kể chuyện Drama',
                        'Chuyên gia phân tích'
                      ] as const
                    ).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => setSelectedTone(tone)}
                        className={`p-2 rounded-lg text-left text-xs transition-colors border ${
                          selectedTone === tone
                            ? 'bg-purple-950 text-purple-200 border-purple-600 font-semibold'
                            : 'bg-[#080D16] text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Duration */}
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Thời Lượng Video Dự Kiến
                  </label>
                  <select
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="20s - 30s">20s - 30s (Siêu ngắn, Hook cực mạnh)</option>
                    <option value="35s - 45s">35s - 45s (Chuẩn TikTok Shop đề xuất)</option>
                    <option value="50s - 65s">50s - 65s (Review chuyên sâu, kể chuyện)</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-cyan-200">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quy trình Gemini Edge Function:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    1. Yêu cầu gửi qua Edge Function bảo mật bằng Supabase JWT.<br />
                    2. Gemini tạo tiêu đề, 2 hook A/B, kịch bản phân cảnh và CTA giỏ hàng.<br />
                    3. Backend tự động thử lại an toàn khi máy chủ AI quá tải (503/429).<br />
                    4. Bạn sẽ được xem trước và chỉnh sửa toàn bộ kịch bản trước khi lưu vào bảng <code className="text-cyan-300 font-mono">content_drafts</code>.
                  </p>
                </div>
              </div>
            )}

            {/* Live generating status banner */}
            {isGenerating && (
              <div className="p-3 rounded-xl bg-[#080d16] border border-cyan-500/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span>Gemini đang viết kịch bản... ({elapsedSeconds}s / tối đa 120s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelGeneration}
                    className="px-2 py-0.5 rounded-md bg-red-950/80 text-red-300 hover:bg-red-900 border border-red-800 text-[11px] font-semibold transition-colors"
                  >
                    Dừng & Hủy
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Đang phân tích dữ liệu deal, xây dựng 2 Hook A/B và chi tiết từng cảnh quay. Quá trình xử lý thường mất từ 20 đến 45 giây.
                </p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-300 h-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.max(5, Math.round((elapsedSeconds / 60) * 100)))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 text-xs font-medium transition-colors"
                >
                  Hủy Yêu Cầu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    onClearSelectedProduct();
                    setGenerationError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Đóng
                </button>
              )}
              <button
                type="submit"
                disabled={isGenerating || products.length === 0}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý ({elapsedSeconds}s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Bắt Đầu Gọi Gemini</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Xem Trước & Chỉnh Sửa Kịch Bản AI Trước Khi Lưu */}
      {isPreviewModalOpen && previewScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-[#0D121D] border border-cyan-500/50 p-4 shadow-2xl space-y-4 my-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Xem Trước & Chỉnh Sửa Kịch Bản AI
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kiểm tra nội dung từ Gemini trước khi bấm lưu vào Supabase <code className="text-cyan-300 font-mono">content_drafts</code>.
                </p>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              {/* Tiêu đề */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between">
                  <span>Tiêu Đề Kịch Bản</span>
                  <span className="text-[10px] text-slate-500 font-normal">Chỉnh sửa trực tiếp</span>
                </label>
                <input
                  type="text"
                  value={previewScript.title}
                  onChange={(e) => setPreviewScript({ ...previewScript, title: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-medium focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Hook A & Hook B */}
              <div className="p-3 rounded-xl bg-[#080D16] border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5" />
                    Hook 3 Giây Đầu (Chọn biến thể mặc định)
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewScript({ ...previewScript, activeHook: 'A' })}
                      className={`px-2 py-0.5 rounded font-bold transition-colors ${
                        previewScript.activeHook === 'A' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dùng Hook A
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewScript({ ...previewScript, activeHook: 'B' })}
                      className={`px-2 py-0.5 rounded font-bold transition-colors ${
                        previewScript.activeHook === 'B' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dùng Hook B
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Biến thể A:</span>
                  <textarea
                    rows={2}
                    value={previewScript.hookVariantA}
                    onChange={(e) => setPreviewScript({ ...previewScript, hookVariantA: e.target.value })}
                    className="w-full p-2 rounded bg-[#0D121D] border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Biến thể B:</span>
                  <textarea
                    rows={2}
                    value={previewScript.hookVariantB}
                    onChange={(e) => setPreviewScript({ ...previewScript, hookVariantB: e.target.value })}
                    className="w-full p-2 rounded bg-[#0D121D] border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Thân bài / Câu chuyện */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Tóm Tắt Câu Chuyện / Giải Pháp (Body Story)
                </label>
                <textarea
                  rows={2}
                  value={previewScript.bodyStory}
                  onChange={(e) => setPreviewScript({ ...previewScript, bodyStory: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Phân cảnh chi tiết */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-purple-400" />
                    <span>Phân Cảnh Lời Thoại & Hành Động ({previewScript.voiceoverLines.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddScene}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Thêm cảnh
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {previewScript.voiceoverLines.map((scene, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={scene.timestamp}
                          onChange={(e) => handleUpdateScene(idx, 'timestamp', e.target.value)}
                          className="w-24 p-1 text-[11px] font-mono font-bold bg-[#0D121D] border border-slate-800 rounded text-cyan-400 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveScene(idx)}
                          className="text-slate-500 hover:text-red-400 text-xs p-1"
                          title="Xóa cảnh này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Lời thoại (Voiceover)..."
                          value={scene.speech}
                          onChange={(e) => handleUpdateScene(idx, 'speech', e.target.value)}
                          className="w-full p-1.5 text-xs bg-[#0D121D] border border-slate-800 rounded text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Hành động góc quay (Visual Action)..."
                          value={scene.action}
                          onChange={(e) => handleUpdateScene(idx, 'action', e.target.value)}
                          className="w-full p-1.5 text-[11px] italic bg-[#0D121D] border border-slate-800 rounded text-purple-300 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call to action & Hashtags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    CTA (Kêu gọi giỏ hàng)
                  </label>
                  <input
                    type="text"
                    value={previewScript.callToAction}
                    onChange={(e) => setPreviewScript({ ...previewScript, callToAction: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    Hashtags (phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={previewScript.hashtags.join(', ')}
                    onChange={(e) =>
                      setPreviewScript({
                        ...previewScript,
                        hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean)
                      })
                    }
                    className="w-full p-2.5 rounded-lg bg-[#080D16] border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Unverified Claims & Policy Compliance Warning Box */}
              <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-800/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Lưu Ý Tuân Thủ Chính Sách Quảng Cáo TikTok Shop Việt Nam
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-normal">Chính sách Affiliate</span>
                </div>
                <textarea
                  rows={2}
                  value={previewScript.unverifiedClaimsNotes || ''}
                  onChange={(e) => setPreviewScript({ ...previewScript, unverifiedClaimsNotes: e.target.value })}
                  placeholder="Lưu ý tuân thủ: Không dùng các cam kết 100%, trị dứt điểm, hiệu quả vĩnh viễn..."
                  className="w-full p-2 rounded bg-[#0D121D] border border-amber-800/50 text-amber-100 text-xs focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Quy định kiểm duyệt: Không tự ý bịa đặt thông số kỹ thuật, bảo hành sai lệch hoặc cam kết sai sự thật so với công bố của nhãn hàng.
                </p>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setIsGenerateModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tạo Lại</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSaveToDrafts}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu Supabase...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Lưu Kịch Bản Vào Bản Nháp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
