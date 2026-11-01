import React from 'react';
import { Smartphone, Monitor, Power, RefreshCw, Cpu, User, Lock, Database } from 'lucide-react';
import { AuthUser } from '../../types';

interface HeaderProps {
  viewMode: 'iphone' | 'fullscreen';
  setViewMode: (mode: 'iphone' | 'fullscreen') => void;
  isKillSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  onSync: () => void;
  currentUser: AuthUser | null;
  onOpenAuthModal: () => void;
  dataSourceFilter: 'all' | 'real_only' | 'demo_only';
  setDataSourceFilter: (mode: 'all' | 'real_only' | 'demo_only') => void;
  isConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  isKillSwitchActive,
  onToggleKillSwitch,
  onSync,
  currentUser,
  onOpenAuthModal,
  dataSourceFilter,
  setDataSourceFilter,
  isConfigured
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#07090E]/95 backdrop-blur-md border-b border-slate-800/80">
      {/* Top Banner: Supabase status & Sandbox disclaimer */}
      <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-purple-950/70 px-3 py-1 border-b border-cyan-500/20 text-center flex items-center justify-between gap-2 text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-cyan-300">
          <Database className="w-3 h-3 text-cyan-400" />
          <span>{isConfigured ? 'Supabase DB: Đã kết nối' : 'Sandbox Demo: Độc lập'}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-300 hidden sm:inline">Không bịa doanh thu thật</span>
        </div>

        {/* Source Mode Filter Segmented Bar */}
        <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-md border border-slate-800 text-[10px]">
          <button
            onClick={() => setDataSourceFilter('all')}
            className={`px-2 py-0.5 rounded transition-colors ${
              dataSourceFilter === 'all'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setDataSourceFilter('real_only')}
            className={`px-2 py-0.5 rounded transition-colors ${
              dataSourceFilter === 'real_only'
                ? 'bg-emerald-500 text-black font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Số liệu thật
          </button>
          <button
            onClick={() => setDataSourceFilter('demo_only')}
            className={`px-2 py-0.5 rounded transition-colors ${
              dataSourceFilter === 'demo_only'
                ? 'bg-purple-600 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Demo
          </button>
        </div>
      </div>

      {/* Main Top Bar */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Brand Zone */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">AI ACC</span>
              <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1 rounded">VN</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isKillSwitchActive ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
              <span>{isKillSwitchActive ? 'ĐÃ NGẮT BOT' : '24/7 AUTO'}</span>
            </div>
          </div>
        </div>

        {/* Actions Zone */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* User Auth Button */}
          <button
            onClick={onOpenAuthModal}
            title={currentUser ? `Đang đăng nhập: ${currentUser.email}` : 'Đăng nhập quản trị Supabase'}
            className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              currentUser
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70 hover:bg-emerald-900/60'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {currentUser ? (
              <>
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[80px] sm:max-w-[120px] truncate">{currentUser.email.split('@')[0]}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Đăng nhập</span>
              </>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={onSync}
            title="Đồng bộ dữ liệu"
            className="min-h-[36px] px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline text-[11px]">Đồng bộ</span>
          </button>

          {/* Desktop Frame Switcher Toggle */}
          <div className="hidden md:flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('iphone')}
              className={`min-h-[30px] px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                viewMode === 'iphone'
                  ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Xem giao diện chuẩn iPhone (390px)"
            >
              <Smartphone className="w-3 h-3" />
              <span>iPhone</span>
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className={`min-h-[30px] px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                viewMode === 'fullscreen'
                  ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Xem giao diện toàn màn hình Dashboard"
            >
              <Monitor className="w-3 h-3" />
              <span>Toàn cảnh</span>
            </button>
          </div>

          {/* Kill Switch Button */}
          <button
            onClick={onToggleKillSwitch}
            title={isKillSwitchActive ? 'Bật lại hệ thống AI 24/7' : 'Ngắt khẩn cấp toàn bộ AI 24/7'}
            className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all active:scale-95 border ${
              isKillSwitchActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-900/40 animate-pulse'
                : 'bg-slate-900 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border-slate-800 hover:border-rose-800/60'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="font-semibold text-[11px]">{isKillSwitchActive ? 'Bật lại' : 'Ngắt AI'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
