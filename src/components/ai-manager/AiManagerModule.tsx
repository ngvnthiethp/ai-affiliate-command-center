import React, { useState, useEffect, useRef } from 'react';
import { AIAgent, AIAgentId, AuthUser, ContentScript, ProductItem, SystemLog, AgentStatusReport, CostQuotaStatus } from '../../types';
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
  Clock,
  RefreshCw,
  Key,
  HelpCircle,
  Layers,
  ArrowRight,
  X,
  AlertTriangle,
  Coins
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
  // Local agent state with live connectionStatus from Edge Function
  const [localAgents, setLocalAgents] = useState<AIAgent[]>(agents);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Chưa kiểm tra');

  // Quota & Cost tracking state (server-side synced)
  const [quotaStatus, setQuotaStatus] = useState<CostQuotaStatus>({
    dailyTaskCount: 3,
    dailyTaskLimit: 20,
    monthlySpentVND: 14200,
    monthlyBudgetVND: 300000,
    isDailyQuotaExceeded: false,
    isMonthlyBudgetExceeded: false
  });

  // Modal: Secret Configuration Guide
  const [isSecretGuideOpen, setIsSecretGuideOpen] = useState<boolean>(false);
  const [selectedSecretAgent, setSelectedSecretAgent] = useState<AIAgent | null>(null);

  // Modal: Edit Prompt
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [promptDraft, setPromptDraft] = useState<string>('');

  // Interactive Task Runner state
  const [runnerTaskType, setRunnerTaskType] = useState<
    'operations_strategy' | 'market_research' | 'trend_intelligence' | 'content_compliance' | 'technical_analysis'
  >('operations_strategy');
  const [runnerAgentId, setRunnerAgentId] = useState<AIAgentId>('chatgpt');
  const [runnerPrompt, setRunnerPrompt] = useState<string>('');
  const [isExecutingTask, setIsExecutingTask] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Result Modal State
  const [testResult, setTestResult] = useState<{
    agentName: string;
    action: string;
    model: string;
    provider?: string;
    success: boolean;
    data: any;
    error?: string;
    fallbackReason?: string | null;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    estimatedCostVND?: number;
    durationMs?: number;
  } | null>(null);

  // Sync props to local state if external agents update
  useEffect(() => {
    setLocalAgents((prev) =>
      agents.map((ag) => {
        const existing = prev.find((p) => p.id === ag.id);
        return existing ? { ...ag, connectionStatus: existing.connectionStatus ?? ag.connectionStatus } : ag;
      })
    );
  }, [agents]);

  // Cleanup abort and timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Icon selector
  const getAgentIcon = (id: AIAgentId) => {
    switch (id) {
      case 'chatgpt':
        return Cpu;
      case 'gemini':
      case 'copywriter':
        return Sparkles;
      case 'grok':
      case 'scout':
        return Radar;
      case 'claude':
      case 'auditor':
        return ShieldCheck;
      case 'deepseek':
      case 'ads':
        return TrendingUp;
      default:
        return Bot;
    }
  };

  // CHECK AGENTS STATUS (Ping Edge Function)
  const handleCheckConnectionStatus = async () => {
    if (!currentUser) {
      if (addToast) addToast('Vui lòng đăng nhập Supabase trước khi kiểm tra kết nối với Edge Function!', 'warning');
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setIsCheckingStatus(true);
    try {
      const res = await edgeFunctionService.checkAgentsStatus();
      setIsCheckingStatus(false);

      if (res.success && res.agents) {
        setLastCheckTime(new Date().toTimeString().split(' ')[0]);

        // Cập nhật trạng thái kết nối thật cho 5 agents
        setLocalAgents((prev) =>
          prev.map((ag) => {
            const report = res.agents?.find((r) => r.agentId === ag.id || r.providerId === ag.providerId);
            if (report) {
              return {
                ...ag,
                connectionStatus: report.status,
                model: report.activeModel || ag.model,
                lastActive: report.status === 'CONNECTED' ? 'Đã kết nối' : 'Chưa cấu hình API Key'
              };
            }
            return ag;
          })
        );

        if (res.quota) {
          setQuotaStatus(res.quota);
        }

        if (addToast) {
          const connectedCount = res.agents.filter((a) => a.status === 'CONNECTED').length;
          addToast(`Kiểm tra hoàn tất: ${connectedCount}/5 Provider đã kết nối API Key.`, 'success');
        }

        if (addSystemLog) {
          await addSystemLog('info', 'Hệ thống', `Kiểm tra kết nối 5 AI Agent: Xác thực trạng thái từ Supabase Secrets.`);
        }
      } else {
        if (addToast) addToast(`Không thể kiểm tra kết nối: ${res.error || 'Lỗi không xác định'}`, 'error');
      }
    } catch (err: any) {
      setIsCheckingStatus(false);
      if (addToast) addToast(`Lỗi kiểm tra kết nối: ${err?.message || 'Lỗi mạng'}`, 'error');
    }
  };

  // Execute Task via Orchestrator
  const handleExecuteOrchestratorTask = async () => {
    if (!currentUser) {
      if (addToast) addToast('Vui lòng đăng nhập Supabase trước khi kích hoạt tác vụ AI!', 'warning');
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    if (quotaStatus.isDailyQuotaExceeded) {
      if (addToast) addToast('Đã đạt hạn mức 20 tác vụ/ngày! Vui lòng thử lại vào ngày mai để bảo vệ ngân sách.', 'error');
      return;
    }

    const targetAgent = localAgents.find((a) => a.id === runnerAgentId) || localAgents[0];

    // Default prompt if empty
    let finalPrompt = runnerPrompt.trim();
    if (!finalPrompt) {
      if (runnerTaskType === 'operations_strategy') {
        finalPrompt = 'Lập kế hoạch phân bổ tài nguyên cho chiến dịch đẩy mạnh doanh số TikTok Shop tuần này.';
      } else if (runnerTaskType === 'market_research') {
        const prod = products[0];
        finalPrompt = prod
          ? `Phân tích tiềm năng và USP của deal: ${prod.name}, hoa hồng ${prod.commissionRate}%, giá ${prod.priceVND.toLocaleString()}đ`
          : 'Phân tích deal Tai nghe chống ồn Bluetooth ANC 350.000 VNĐ, hoa hồng 18%.';
      } else if (runnerTaskType === 'trend_intelligence') {
        finalPrompt = 'Bắt trọn 3 trend video ngắn thịnh hành nhất ngành Công nghệ & Đồ gia dụng hiện nay.';
      } else if (runnerTaskType === 'content_compliance') {
        const sc = scripts[0];
        finalPrompt = sc
          ? `Kiểm duyệt kịch bản "${sc.title}": ${sc.bodyStory}`
          : 'Kiểm duyệt kịch bản cam kết hoàn tiền 100%, bảo hành trọn đời, số 1 thị trường.';
      } else {
        finalPrompt = 'Phân tích số liệu ROI và ngưỡng hòa vốn cho ngân sách quảng cáo TikTok Spark Ads 2.000.000 VNĐ.';
      }
    }

    setIsExecutingTask(true);
    setElapsedSeconds(0);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const res = await edgeFunctionService.orchestrateTask(
        {
          taskType: runnerTaskType,
          preferredAgent: runnerAgentId,
          inputPrompt: finalPrompt,
          payload: { prompt: finalPrompt }
        },
        { signal: controller.signal }
      );

      if (timerRef.current) clearInterval(timerRef.current);
      setIsExecutingTask(false);

      if (res.success && res.data) {
        setTestResult({
          agentName: targetAgent.name,
          action: `Thực thi tác vụ: ${runnerTaskType}`,
          model: res.model || targetAgent.model,
          provider: res.provider || targetAgent.provider,
          success: true,
          data: res.data,
          fallbackReason: res.fallbackReason,
          usage: res.usage,
          estimatedCostVND: res.estimatedCostVND,
          durationMs: res.durationMs
        });

        // Cập nhật số token và chi phí local
        const tokensAdded = res.usage?.totalTokens || 650;
        const costAdded = res.estimatedCostVND || 85;

        setLocalAgents((prev) =>
          prev.map((a) => {
            if (a.id === runnerAgentId || (res.executedAgent && a.id === res.executedAgent)) {
              return {
                ...a,
                tokenUsedToday: a.tokenUsedToday + tokensAdded,
                tasksCompleted: a.tasksCompleted + 1,
                estimatedCostVND: (a.estimatedCostVND || 0) + costAdded,
                lastActive: 'Vừa xong'
              };
            }
            return a;
          })
        );

        setQuotaStatus((prev) => ({
          ...prev,
          dailyTaskCount: prev.dailyTaskCount + 1,
          monthlySpentVND: prev.monthlySpentVND + costAdded,
          isDailyQuotaExceeded: prev.dailyTaskCount + 1 >= prev.dailyTaskLimit
        }));

        onTestRun(runnerAgentId, tokensAdded, true);

        if (addToast) {
          if (res.fallbackReason) {
            addToast(`Tác vụ hoàn thành qua Fallback: ${res.executedAgent?.toUpperCase()} (~${costAdded}đ)`, 'info');
          } else {
            addToast(`Tác vụ hoàn thành thành công bởi ${targetAgent.name} (~${costAdded}đ)`, 'success');
          }
        }
      } else {
        if (res.code === 'ABORTED') {
          if (addToast) addToast('Đã dừng tác vụ theo yêu cầu.', 'info');
          return;
        }

        setTestResult({
          agentName: targetAgent.name,
          action: `Thực thi tác vụ: ${runnerTaskType}`,
          model: targetAgent.model,
          provider: targetAgent.provider,
          success: false,
          data: null,
          error: res.error || 'Lỗi khi gọi AI Brain',
          fallbackReason: res.fallbackReason,
          durationMs: res.durationMs
        });

        if (addToast) addToast(`Lỗi tác vụ: ${res.error?.slice(0, 80) || 'Lỗi kết nối'}`, 'error');
      }
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsExecutingTask(false);

      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        if (addToast) addToast('Đã dừng tác vụ.', 'info');
        return;
      }

      setTestResult({
        agentName: targetAgent.name,
        action: `Thực thi tác vụ`,
        model: targetAgent.model,
        success: false,
        data: null,
        error: err?.message || 'Lỗi không xác định'
      });
    }
  };

  const handleCancelExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsExecutingTask(false);
  };

  const handleOpenPromptModal = (agent: AIAgent) => {
    setEditingAgent(agent);
    setPromptDraft(agent.systemPrompt);
  };

  const handleSavePrompt = () => {
    if (!editingAgent) return;
    onUpdatePrompt(editingAgent.id, promptDraft);
    setLocalAgents((prev) =>
      prev.map((a) => (a.id === editingAgent.id ? { ...a, systemPrompt: promptDraft } : a))
    );
    setEditingAgent(null);
  };

  const totalTokensUsed = localAgents.reduce((acc, a) => acc + a.tokenUsedToday, 0);
  const totalTokenLimit = localAgents.reduce((acc, a) => acc + a.tokenLimit, 0);
  const tokenPercentage = Math.min(100, Math.round((totalTokensUsed / totalTokenLimit) * 100));

  const dailyQuotaPct = Math.min(100, Math.round((quotaStatus.dailyTaskCount / quotaStatus.dailyTaskLimit) * 100));
  const monthlyBudgetPct = Math.min(100, Math.round((quotaStatus.monthlySpentVND / quotaStatus.monthlyBudgetVND) * 100));

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header & AI Brain Banner */}
      <div className="rounded-2xl bg-[#0D121D] p-4 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                AI Brain & Multi-Agent Orchestration
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Bộ não điều phối 5 Agent chuyên biệt qua Supabase Edge Functions & Quota Guardrails
            </p>
          </div>

          <button
            onClick={handleCheckConnectionStatus}
            disabled={isCheckingStatus}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
            title="Kiểm tra trạng thái cấu hình API Key trong Supabase Secrets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            <span>{isCheckingStatus ? 'Đang ping...' : 'Kiểm Tra Kết Nối'}</span>
          </button>
        </div>

        {/* Auth prompt if guest */}
        {!currentUser && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Đăng nhập tài khoản để kích hoạt điều phối thật qua Supabase Edge Functions.
            </span>
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="px-2.5 py-1 rounded bg-amber-400 text-black text-[11px] font-bold shrink-0 hover:bg-amber-300 transition-colors"
              >
                Đăng nhập
              </button>
            )}
          </div>
        )}

        {/* Cost & Quota Controller Widget (Server-Side Enforced) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
          {/* Hạn Mức Tác Vụ Ngày */}
          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800/80 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Hạn mức ngày:
              </span>
              <span className={`font-mono font-bold ${dailyQuotaPct >= 100 ? 'text-rose-400' : 'text-cyan-400'}`}>
                {quotaStatus.dailyTaskCount} / {quotaStatus.dailyTaskLimit} ({dailyQuotaPct}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  dailyQuotaPct >= 100 ? 'bg-rose-500' : dailyQuotaPct > 80 ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${dailyQuotaPct}%` }}
              />
            </div>
          </div>

          {/* Ngân Sách Tháng */}
          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800/80 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Coins className="w-3 h-3 text-purple-400" />
                Ngân sách tháng:
              </span>
              <span className="font-mono font-bold text-purple-300">
                {quotaStatus.monthlySpentVND.toLocaleString()}đ / {(quotaStatus.monthlyBudgetVND / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${monthlyBudgetPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Kiểm tra gần nhất: {lastCheckTime}</span>
          <button
            onClick={() => setIsSecretGuideOpen(true)}
            className="text-cyan-400 hover:underline flex items-center gap-1"
          >
            <Key className="w-3 h-3" />
            Hướng dẫn nạp Secrets cho 5 AI
          </button>
        </div>
      </div>

      {/* 2. Interactive Task Runner Console (Điều Phối Nhiệm Vụ) */}
      <div className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Bàn Điều Khiển AI Task Orchestrator
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/60 font-mono">
            Auto-Router + Fallback
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Chọn loại nhiệm vụ */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">1. Loại Nhiệm Vụ:</label>
            <select
              value={runnerTaskType}
              onChange={(e) => {
                const val = e.target.value as any;
                setRunnerTaskType(val);
                if (val === 'operations_strategy') setRunnerAgentId('chatgpt');
                else if (val === 'market_research') setRunnerAgentId('gemini');
                else if (val === 'trend_intelligence') setRunnerAgentId('grok');
                else if (val === 'content_compliance') setRunnerAgentId('claude');
                else if (val === 'technical_analysis') setRunnerAgentId('deepseek');
              }}
              className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="operations_strategy">1. Chiến Lược & Điều Hành (ChatGPT)</option>
              <option value="market_research">2. Nghiên Cứu Deal & USP (Gemini)</option>
              <option value="trend_intelligence">3. Bắt Sóng Trend Video (Grok)</option>
              <option value="content_compliance">4. Kiểm Định & Tuân Thủ (Claude)</option>
              <option value="technical_analysis">5. Phân Tích Dữ Liệu & ROI (DeepSeek)</option>
            </select>
          </div>

          {/* Chọn Agent ưu tiên */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">2. Agent Phụ Trách (Ưu Tiên):</label>
            <select
              value={runnerAgentId}
              onChange={(e) => setRunnerAgentId(e.target.value as AIAgentId)}
              className="w-full p-2 rounded-xl bg-[#080D16] border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
            >
              {localAgents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.model})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input prompt */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">3. Yêu Cầu Đầu Vào (Tùy chọn):</label>
          <input
            type="text"
            value={runnerPrompt}
            onChange={(e) => setRunnerPrompt(e.target.value)}
            placeholder="Nhập yêu cầu hoặc để trống để chạy tác vụ mẫu..."
            className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-slate-100 text-xs focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
          />
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleExecuteOrchestratorTask}
            disabled={isExecutingTask}
            className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {isExecutingTask ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Đang điều phối... ({elapsedSeconds}s / tối đa 120s)</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Kích Hoạt Điều Phối AI</span>
              </>
            )}
          </button>

          {isExecutingTask && (
            <button
              onClick={handleCancelExecution}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors"
            >
              Dừng & Hủy
            </button>
          )}
        </div>
      </div>

      {/* 3. Danh Sách 5 AI Agent Chuyên Trách */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1">
          <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            Đội Ngũ 5 AI Agent Hệ Thống
          </h3>
          <span className="text-[11px] text-slate-400">
            {localAgents.filter((a) => a.connectionStatus === 'CONNECTED').length}/5 Đã Kết Nối
          </span>
        </div>

        {localAgents.map((agent) => {
          const Icon = getAgentIcon(agent.id);
          const isPaused = agent.status === 'paused';
          const isConnected = agent.connectionStatus === 'CONNECTED';
          const agentTokenPct = Math.min(100, Math.round((agent.tokenUsedToday / agent.tokenLimit) * 100));

          return (
            <div
              key={agent.id}
              className={`rounded-2xl bg-[#0D121D] p-3.5 border transition-all shadow-md space-y-3 ${
                isPaused
                  ? 'border-slate-800/60 opacity-70'
                  : isConnected
                  ? 'border-slate-800 hover:border-cyan-500/40'
                  : 'border-slate-800/80'
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-white">{agent.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {agent.codeName}
                      </span>
                    </div>

                    {/* Connection Status Badge (Real-time check) */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {isConnected ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ĐÃ KẾT NỐI (CONNECTED)
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSecretAgent(agent);
                            setIsSecretGuideOpen(true);
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800/50 text-amber-300 hover:bg-amber-900/50 flex items-center gap-1 transition-colors"
                          title="Nhấn để xem hướng dẫn thêm Secret trong Supabase"
                        >
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          CHƯA CẤU HÌNH (NOT CONFIGURED)
                        </button>
                      )}
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

              {/* Role & Description */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-400" />
                  {agent.role}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {agent.description}
                </p>
              </div>

              {/* Tasks List */}
              {agent.tasks && agent.tasks.length > 0 && (
                <div className="p-2 rounded-xl bg-[#080D16] border border-slate-800/70 space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Nhiệm vụ chính:
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-0.5 pl-3 list-disc">
                    {agent.tasks.slice(0, 3).map((t, idx) => (
                      <li key={idx} className="leading-tight">{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs & Performance bar */}
              <div className="bg-[#080D16] p-2.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Provider & Model</div>
                    <div className="text-[11px] font-bold text-white font-mono truncate">
                      {agent.model}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Tokens đã dùng</div>
                    <div className="text-[11px] font-bold text-cyan-300 font-mono">
                      {agent.tokenUsedToday.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Chi phí ước tính</div>
                    <div className="text-[11px] font-bold text-purple-300 font-mono">
                      ~{(agent.estimatedCostVND || 0).toLocaleString()}đ
                    </div>
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

              {/* Action Buttons: Chạy Thử Nghiệm & Sửa Prompt */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => {
                    setRunnerAgentId(agent.id);
                    if (agent.id === 'chatgpt') setRunnerTaskType('operations_strategy');
                    else if (agent.id === 'gemini') setRunnerTaskType('market_research');
                    else if (agent.id === 'grok') setRunnerTaskType('trend_intelligence');
                    else if (agent.id === 'claude') setRunnerTaskType('content_compliance');
                    else if (agent.id === 'deepseek') setRunnerTaskType('technical_analysis');
                    handleExecuteOrchestratorTask();
                  }}
                  disabled={isPaused || isExecutingTask}
                  className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Chạy Thử Nghiệm</span>
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

      {/* MODAL: Kết quả thực thi AI Orchestrator */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Kết Quả Thực Thi: {testResult.agentName}
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {testResult.model}
              </span>
            </div>

            {/* Fallback Notice Banner */}
            {testResult.fallbackReason && (
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <div className="font-bold text-amber-200">Kích Hoạt Fallback Tự Động:</div>
                  {testResult.fallbackReason}
                </div>
              </div>
            )}

            {testResult.success ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Đã nhận phản hồi thành công qua {testResult.provider || 'AI Provider'}!</span>
                  </span>
                  {testResult.estimatedCostVND !== undefined && (
                    <span className="font-mono font-bold text-cyan-300">
                      ~{testResult.estimatedCostVND}đ
                    </span>
                  )}
                </div>

                {/* Token Usage Stats */}
                {testResult.usage && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs p-2 bg-[#080D16] rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400">Input Tokens</span>
                      <div className="font-mono font-bold text-white">{testResult.usage.promptTokens}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Output Tokens</span>
                      <div className="font-mono font-bold text-white">{testResult.usage.completionTokens}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Tổng Tokens</span>
                      <div className="font-mono font-bold text-cyan-400">{testResult.usage.totalTokens}</div>
                    </div>
                  </div>
                )}

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
                  <span>Thực thi không thành công</span>
                </div>
                <p className="text-slate-300 text-[11px]">{testResult.error}</p>
                <div className="p-2 bg-black/40 rounded text-[10px] text-slate-400 space-y-1">
                  <div>Hướng dẫn xử lý:</div>
                  <div>• Kiểm tra Secret trong Supabase Dashboard &gt; Edge Functions &gt; Secrets.</div>
                  <div>• Đảm bảo đã deploy code mới nhất theo <code className="text-cyan-300">EDGE_FUNCTION_DEPLOY_GUIDE.md</code>.</div>
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

      {/* MODAL: Hướng Dẫn Cấu Hình Secrets Cho 5 AI */}
      {isSecretGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1420] border border-cyan-500/40 p-4 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Cấu Hình API Key Cho 5 AI Agent (Supabase Secrets)
                </h3>
              </div>
              <button onClick={() => setIsSecretGuideOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              Toàn bộ API Key được bảo mật an toàn phía máy chủ (Supabase Edge Function Secrets), 
              <strong> không bao giờ lộ ở frontend</strong>. Bạn chỉ cần thêm các biến môi trường sau:
            </p>

            <div className="space-y-2.5">
              {/* Gemini */}
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-cyan-300">1. GEMINI_API_KEY (Provider Chính)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Bắt buộc</span>
                </div>
                <p className="text-[10px] text-slate-400">Dùng cho Agent 2 (Gemini). Lấy miễn phí tại Google AI Studio.</p>
                <code className="block p-1.5 rounded bg-black text-[10px] font-mono text-cyan-400">GEMINI_API_KEY=AIzaSy...</code>
              </div>

              {/* DeepSeek */}
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-300">2. DEEPSEEK_API_KEY (Provider Dự Phòng)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Khuyên dùng</span>
                </div>
                <p className="text-[10px] text-slate-400">Dùng cho Agent 5 (DeepSeek). Lấy tại platform.deepseek.com.</p>
                <code className="block p-1.5 rounded bg-black text-[10px] font-mono text-blue-300">DEEPSEEK_API_KEY=sk-...</code>
              </div>

              {/* OpenAI */}
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-300">3. OPENAI_API_KEY (Chiến Lược)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tùy chọn</span>
                </div>
                <p className="text-[10px] text-slate-400">Dùng cho Agent 1 (ChatGPT). Lấy tại platform.openai.com.</p>
                <code className="block p-1.5 rounded bg-black text-[10px] font-mono text-emerald-300">OPENAI_API_KEY=sk-proj-...</code>
              </div>

              {/* Grok */}
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-300">4. GROK_API_KEY / XAI_API_KEY (Trend)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tùy chọn</span>
                </div>
                <p className="text-[10px] text-slate-400">Dùng cho Agent 3 (Grok). Lấy tại console.x.ai.</p>
                <code className="block p-1.5 rounded bg-black text-[10px] font-mono text-amber-300">GROK_API_KEY=xai-...</code>
              </div>

              {/* Claude */}
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-300">5. ANTHROPIC_API_KEY (Tuân Thủ)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tùy chọn</span>
                </div>
                <p className="text-[10px] text-slate-400">Dùng cho Agent 4 (Claude). Lấy tại console.anthropic.com.</p>
                <code className="block p-1.5 rounded bg-black text-[10px] font-mono text-purple-300">ANTHROPIC_API_KEY=sk-ant-...</code>
              </div>
            </div>

            <div className="p-2 bg-cyan-950/40 border border-cyan-800/40 rounded-xl text-[11px] text-cyan-200">
              💡 <strong>Cơ chế Fallback thông minh</strong>: Nếu bạn chưa có key của Grok, Claude hoặc ChatGPT, 
              hệ thống sẽ tự động định tuyến nhiệm vụ sang Gemini hoặc DeepSeek mà không gây gián đoạn quy trình.
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsSecretGuideOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sửa System Prompt */}
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
              Chỉnh sửa chỉ dẫn hệ thống để định hướng hành vi, giọng văn và thuật toán của Agent này.
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
