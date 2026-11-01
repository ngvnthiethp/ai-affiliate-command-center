import React, { useState } from 'react';
import { CronTask, SystemLog } from '../../types';
import {
  Sliders,
  Power,
  Server,
  Database,
  Globe,
  Cpu,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  Download,
  Lock,
  Radio,
  FileCode
} from 'lucide-react';

interface SystemControlModuleProps {
  isKillSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  cronTasks: CronTask[];
  onRunCronTask: (taskId: string) => void;
  systemLogs: SystemLog[];
  onClearLogs: () => void;
  onCopyText: (text: string, label: string) => void;
}

export const SystemControlModule: React.FC<SystemControlModuleProps> = ({
  isKillSwitchActive,
  onToggleKillSwitch,
  cronTasks,
  onRunCronTask,
  systemLogs,
  onClearLogs,
  onCopyText
}) => {
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'success' | 'info'>('all');
  const [tokenBudgetLimit, setTokenBudgetLimit] = useState<number>(500000);

  const filteredLogs = systemLogs.filter((log) => {
    if (logFilter !== 'all' && log.level !== logFilter) return false;
    return true;
  });

  const handleExportLogs = () => {
    const text = systemLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}]: ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-logs-${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-cyan-400" />
          System Control (Điều Hành Hệ Thống 24/7)
        </h2>
        <p className="text-[11px] text-slate-400">
          Giám sát kiến trúc hạ tầng & bộ điều phối tự động hóa
        </p>
      </div>

      {/* Emergency Kill Switch Banner Card */}
      <div
        className={`rounded-2xl p-4 border transition-all ${
          isKillSwitchActive
            ? 'bg-[#220B11] border-rose-500/50 shadow-xl shadow-rose-950/40'
            : 'bg-[#0D121D] border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isKillSwitchActive
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <Power className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {isKillSwitchActive ? 'Chế Độ Ngắt Khẩn Cấp (Đang Tắt)' : 'Hệ Thống Tự Động Hóa 24/7'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isKillSwitchActive
                  ? 'Toàn bộ 5 AI Agent và cron job đã bị ngắt tạm thời để bảo vệ tài khoản.'
                  : 'Đang vận hành tự động liên tục trên iPhone và Cloudflare Edge.'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleKillSwitch}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 shadow-lg border ${
              isKillSwitchActive
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-emerald-500/20'
                : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
            }`}
          >
            {isKillSwitchActive ? 'Khôi Phục 24/7' : 'Ngắt Khẩn Cấp'}
          </button>
        </div>
      </div>

      {/* Infrastructure Status Grid (Planned Architecture Architecture Overview) */}
      <div className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-bold text-white flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            Kiến Trúc Hạ Tầng (Cloudflare Workers + Supabase)
          </h3>
          <span className="text-[10px] text-cyan-400 font-mono">Dự kiến Backend</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="font-bold text-white text-[11px]">Cloudflare Edge</div>
                <div className="text-[10px] text-slate-400">Worker 24/7 Gateway</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Hoạt động" />
          </div>

          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-bold text-white text-[11px]">Supabase DB</div>
                <div className="text-[10px] text-slate-400">PostgreSQL Schema</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Sẵn sàng" />
          </div>

          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="font-bold text-white text-[11px]">Gemini & Claude</div>
                <div className="text-[10px] text-slate-400">AI Inference API</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Kết nối" />
          </div>

          <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-bold text-white text-[11px]">TikTok Affiliate</div>
                <div className="text-[10px] text-slate-400">Webhook Poller</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Sẵn sàng" />
          </div>
        </div>

        <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
          <Info className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>Giai đoạn MVP hoạt động độc lập trên Frontend với dữ liệu mô phỏng chuẩn xác.</span>
        </div>
      </div>

      {/* Automated Cron Tasks Scheduler */}
      <div className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Lịch Trình Tác Vụ Tự Động (Cron 24/7)
          </h3>
          <span className="text-[10px] text-purple-300 font-mono">4 Lịch Trình</span>
        </div>

        <div className="space-y-2">
          {cronTasks.map((task) => (
            <div
              key={task.id}
              className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800/80 hover:border-slate-700 transition-colors space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">{task.name}</div>
                  <div className="text-[10px] text-cyan-400 font-mono">{task.scheduleTime}</div>
                </div>

                <button
                  onClick={() => onRunCronTask(task.id)}
                  className="min-h-[28px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-cyan-500 hover:text-black text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Chạy Ngay</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                {task.actionDescription}
              </p>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-800/40">
                <span>Agent phụ trách: {task.targetAgent}</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {task.lastRunTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Token Budget Limit Config */}
      <div className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white">Giới Hạn Chi Tiêu Token Hàng Ngày:</span>
          <span className="font-mono text-cyan-400 font-bold">{tokenBudgetLimit.toLocaleString()} Tokens</span>
        </div>
        <input
          type="range"
          min="100000"
          max="2000000"
          step="50000"
          value={tokenBudgetLimit}
          onChange={(e) => setTokenBudgetLimit(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>100k Token (~10.000 VNĐ)</span>
          <span>1 Triệu Token (~100.000 VNĐ)</span>
          <span>2 Triệu Token</span>
        </div>
      </div>

      {/* Live System Logs Console */}
      <div className="rounded-2xl bg-[#0D121D] p-3.5 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-bold text-white">Nhật Ký Hệ Thống (Real-time Logs)</h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExportLogs}
              title="Xuất file log"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Xuất</span>
            </button>
            <button
              onClick={onClearLogs}
              title="Xóa log hiển thị"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-[10px] font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa</span>
            </button>
          </div>
        </div>

        {/* Filter Pills for Logs */}
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] py-0.5">
          {(['all', 'info', 'success', 'warn', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLogFilter(lvl)}
              className={`px-2 py-0.5 rounded capitalize transition-colors ${
                logFilter === lvl
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl === 'all' ? 'Tất cả' : lvl}
            </button>
          ))}
        </div>

        {/* Console Log Stream */}
        <div className="bg-[#05070B] rounded-xl p-3 border border-slate-800/90 font-mono text-[11px] max-h-56 overflow-y-auto space-y-1.5 selection:bg-cyan-500/30">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 text-center py-4">Chưa có nhật ký nào ghi nhận</div>
          ) : (
            filteredLogs.map((log) => {
              const isErr = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isSuccess = log.level === 'success';

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 font-medium">[{log.timestamp}]</span>
                  {log.isDemo ? (
                    <span className="font-semibold shrink-0 text-[9px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      DEMO
                    </span>
                  ) : (
                    <span className="font-semibold shrink-0 text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      SUPABASE
                    </span>
                  )}
                  <span
                    className={`font-semibold shrink-0 uppercase text-[10px] px-1 rounded ${
                      isErr
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : isWarn
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : isSuccess
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {log.source}
                  </span>
                  <span
                    className={`flex-1 break-words ${
                      isErr
                        ? 'text-rose-300 font-medium'
                        : isWarn
                        ? 'text-amber-200'
                        : isSuccess
                        ? 'text-cyan-200'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
