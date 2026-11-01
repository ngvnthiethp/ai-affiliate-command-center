import React, { useState } from 'react';
import { AIAgent, AIAgentId, AuthUser, ContentScript, ProductItem, SystemLog } from '../../types';
import {
  Bot,
  Sparkles,
  Radar,
  Video,
  TrendingUp,
  ShieldCheck,
  Play,
  Pause,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Cpu,
  RotateCcw,
  LogIn,
  Check,
  Zap,
  Clock
} from 'lucide-react';
import { edgeFunctionService } from '../../services/edgeFunctionService';
import { aiLogService } from '../../services/aiLogService';

interface AiManagerModuleProps {
  agents: AIAgent[];
  products?: ProductItem[];
  scripts?: ContentScript[];
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
  addToast?: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  addSystemLog?: (level: SystemLog['level'], source: SystemLog['source'], message: string) => Promise<{ error: string | null }>;
  onToggleStatus: (agentId: AIAgentId) => void;
  onUpdatePrompt: (agentId: AIAgentId, newPrompt: string) => void;
  onTestRun: (agentId: AIAgentId, actualTokens?: number, skipSecondaryLog?: boolean) => void;
}

export const AiManagerModule: React.FC<AiManagerModuleProps> = ({
  agents,
  products = [],
  scripts = [],
  currentUser,
  onOpenAuthModal,
  addToast,
  addSystemLog,
  onToggleStatus,
  onUpdatePrompt,
  onTestRun
}) => {
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [promptDraft, setPromptDraft] = useState<string>('');

  // Test Run Result Modal State
  const [runningAgentId, setRunningAgentId] = useState<AIAgentId | null>(null);
  const [testResult, setTestResult] = useState<{
    agentName: string;
    action: string;
    model: string;
    success: boolean;
    data: any;
    error?: string;
  } | null>(null);

  const getAgentIcon = (id: AIAgentId) => {
    switch (id) {
      case 'scout':
        return Radar;
      case 'copywriter':
        return Sparkles;
      case 'visual':
        return Video;
      case 'ads':
        return TrendingUp;
      case 'auditor':
        return ShieldCheck;
      default:
        return Bot;
    }
  };

  const handleOpenPromptModal = (agent: AIAgent) => {
    setEditingAgent(agent);
    setPromptDraft(agent.systemPrompt);
  };

  const handleSavePrompt = () => {
    if (!editingAgent) return;
    onUpdatePrompt(editingAgent.id, promptDraft);
    setEditingAgent(null);
  };

  // Execute Agent Test Run with Edge Function & Gemini
  const handleExecuteAgentTest = async (agent: AIAgent) => {
    if (!currentUser) {
      if (addToast) addToast('Vui lòng đăng nhập Supabase trước khi kích hoạt Agent với Gemini Edge Function!', 'warning');
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setRunningAgentId(agent.id);

    try {
      let res: any;
      let actionLabel = '';

      if (agent.id === 'scout') {
        actionLabel = 'Phân tích tiềm năng Deal Affiliate';
        const sampleProduct = products[0] || {
          name: 'Tai nghe Bluetooth True Wireless ANC',
          category: 'Công nghệ',
          priceVND: 350000,
          platform: 'tiktok'
        };
        res = await edgeFunctionService.analyzeProduct({
          productName: sampleProduct.name,
          category: sampleProduct.category,
          priceVND: sampleProduct.priceVND,
          platform: sampleProduct.platform
        });
      } else if (agent.id === 'auditor') {
        actionLabel = 'Kiểm duyệt chính sách TikTok Shop & Shopee';
        const sampleScript = scripts[0] || {
          title: 'Review sản phẩm siêu phẩm trị dứt điểm mọi vấn đề',
          bodyStory: 'Cam kết 100% hiệu quả ngay lần đầu, số 1 thị trường'
        };
        res = await edgeFunctionService.auditContent({
          title: sampleScript.title,
          scriptText: sampleScript.bodyStory
        });
      } else if (agent.id === 'copywriter') {
        actionLabel = 'Viết kịch bản mẫu Shortform';
        res = await edgeFunctionService.generateScript({
          productName: products[0]?.name || 'Nồi chiên không dầu 6L',
          category: 'Gia dụng thông minh',
          platform: 'tiktok',
          priceVND: 890000,
          tone: 'Review chân thực',
          targetDuration: '35s - 45s'
        });
      } else {
        // visual or ads
        actionLabel = 'Bắt Trend & Chiến Lược Video Ngắn';
        res = await edgeFunctionService.fetchTrendIdeas({
          category: 'Công nghệ',
          platform: 'tiktok'
        });
      }

      setRunningAgentId(null);

      if (res.success && res.data) {
        setTestResult({
          agentName: agent.name,
          action: actionLabel,
          model: res.model || 'gemini-3.8-flash',
          success: true,
          data: res.data
        });

        // Ghi log vào bảng ai_task_logs
        await aiLogService.logAITask({
          level: 'info',
          source: agent.name as SystemLog['source'],
          message: `Thực thi ${actionLabel} hoàn tất qua Gemini (${res.model || 'Gemini Flash'}).`
        });

        onTestRun(agent.id, 650, true);
      } else {
        setTestResult({
          agentName: agent.name,
          action: actionLabel,
          model: 'Gemini Edge Function',
          success: false,
          data: null,
          error: res.error || 'Lỗi khi gọi Edge Function'
        });

        await aiLogService.logAITask({
          level: 'error',
          source: agent.name as SystemLog['source'],
          message: `Thử nghiệm thất bại: ${res.error?.slice(0, 80) || 'Lỗi kết nối'}`
        });
      }
    } catch (err: any) {
      setRunningAgentId(null);
      setTestResult({
        agentName: agent.name,
        action: 'Thử nghiệm tác vụ',
        model: 'Gemini Edge Function',
        success: false,
        data: null,
        error: err?.message || 'Lỗi không xác định'
      });
    }
  };

  const totalTokensUsed = agents.reduce((acc, a) => acc + a.tokenUsedToday, 0);
  const totalTokenLimit = agents.reduce((acc, a) => acc + a.tokenLimit, 0);
  const tokenPercentage = Math.round((totalTokensUsed / totalTokenLimit) * 100);

  return (
    <div className="space-y-4 pb-4">
      {/* Top Banner: Đội Ngũ AI & Tài Nguyên Token */}
      <div className="rounded-2xl bg-[#0D121D] p-4 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Đội Ngũ 5 AI Agent Chuyên Trách
            </h2>
            <p className="text-[11px] text-slate-400">
              Vận hành bán tự động 24/7 thông qua Supabase Edge Functions & Gemini API
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            5 Hoạt Động
          </span>
        </div>

        {/* Auth prompt if guest */}
        {!currentUser && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Đăng nhập tài khoản để Agent chạy thật qua Supabase Edge Functions.
            </span>
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="px-2 py-0.5 rounded bg-amber-400 text-black text-[11px] font-bold shrink-0 hover:bg-amber-300 transition-colors"
              >
                Đăng nhập
              </button>
            )}
          </div>
        )}

        {/* Token Budget Gauge */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Hạn mức Token tiêu thụ hôm nay:</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {totalTokensUsed.toLocaleString()} / {totalTokenLimit.toLocaleString()} ({tokenPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                tokenPercentage > 85 ? 'bg-amber-400' : 'bg-gradient-to-r from-cyan-500 to-purple-500'
              }`}
              style={{ width: `${tokenPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Danh sách 5 AI Agent */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const Icon = getAgentIcon(agent.id);
          const isPaused = agent.status === 'paused';
          const isRunning = runningAgentId === agent.id;
          const agentTokenPct = Math.round((agent.tokenUsedToday / agent.tokenLimit) * 100);

          return (
            <div
              key={agent.id}
              className={`rounded-2xl bg-[#0D121D] p-3.5 border transition-all shadow-md space-y-3 ${
                isPaused ? 'border-slate-800/60 opacity-70' : 'border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              {/* Header: Icon, Tên, Trạng thái, Toggle Switch */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md shrink-0"
                    style={{
                      backgroundColor: `${agent.colorAccent}15`,
                      color: agent.colorAccent,
                      border: `1px solid ${agent.colorAccent}35`
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white">{agent.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {agent.codeName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {agent.role}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Switch */}
                <button
                  onClick={() => onToggleStatus(agent.id)}
                  title={isPaused ? 'Kích hoạt Agent' : 'Tạm dừng Agent'}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                    isPaused ? 'bg-slate-700' : 'bg-cyan-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transition-transform ${
                      isPaused ? 'translate-x-0' : 'translate-x-4'
                    }`}
                  />
                </button>
              </div>

              {/* Description & Model badge */}
              <p className="text-xs text-slate-300 leading-relaxed">
                {agent.description}
              </p>

              {/* Specs & Performance bar */}
              <div className="bg-[#080D16] p-2.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">Model AI</div>
                    <div className="text-xs font-bold text-white font-mono truncate">
                      {agent.id === 'copywriter' || agent.id === 'scout' ? 'Gemini 3.8 Flash' : agent.model}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Tokens dùng</div>
                    <div className="text-xs font-bold text-cyan-300 font-mono">
                      {agent.tokenUsedToday.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Hoạt động gần nhất</div>
                    <div className="text-xs font-bold text-purple-300 truncate">{agent.lastActive}</div>
                  </div>
                </div>

                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${agentTokenPct}%` }}
                  />
                </div>

                <div className="text-[10px] text-slate-400 italic truncate">
                  ⚡ {agent.logSummary}
                </div>
              </div>

              {/* Action Buttons: Chạy Thử & Sửa Prompt */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => handleExecuteAgentTest(agent)}
                  disabled={isPaused || isRunning}
                  className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isRunning ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>Đang gọi Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Chạy Thử Nghiệm</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenPromptModal(agent)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sửa Prompt</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Kết quả thử nghiệm AI Agent */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Kết Quả Thử Nghiệm: {testResult.agentName}
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {testResult.model}
              </span>
            </div>

            <div className="text-xs text-slate-300">
              Tác vụ: <span className="font-semibold text-white">{testResult.action}</span>
            </div>

            {testResult.success ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Đã nhận phản hồi thành công từ Google Gemini qua Supabase Edge Function!</span>
                </div>

                <div className="bg-[#080D16] p-3 rounded-xl border border-slate-800 max-h-64 overflow-y-auto">
                  <pre className="text-[11px] font-mono text-cyan-300 whitespace-pre-wrap break-words">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Thử nghiệm không thành công</span>
                </div>
                <p className="text-slate-300 text-[11px]">{testResult.error}</p>
                <div className="p-2 bg-black/40 rounded text-[10px] text-slate-400 space-y-1">
                  <div>Hướng dẫn xử lý:</div>
                  <div>• Cần deploy Edge Function: <code className="text-cyan-300">supabase functions deploy generate-content</code></div>
                  <div>• Cần cấu hình Secret: <code className="text-cyan-300">supabase secrets set GEMINI_API_KEY=your_key</code></div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setTestResult(null)}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa System Prompt */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Cấu Hình System Prompt: {editingAgent.name}
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                {editingAgent.model}
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              Chỉnh sửa chỉ dẫn hệ thống để định hướng hành vi, giọng văn và thuật toán sàng lọc của Agent này.
            </p>

            <textarea
              rows={8}
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#080D16] border border-slate-800 text-slate-100 text-xs font-mono leading-relaxed focus:border-cyan-500 focus:outline-none resize-none"
              placeholder="Nhập System Prompt cho Agent..."
            />

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPromptDraft(editingAgent.systemPrompt)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Khôi phục ban đầu
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingAgent(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Đóng
                </button>
                <button
                  onClick={handleSavePrompt}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
