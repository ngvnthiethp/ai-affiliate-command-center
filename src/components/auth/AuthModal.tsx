import React, { useState } from 'react';
import { AuthUser } from '../../types';
import {
  authService,
  isSupabaseConfigured,
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection
} from '../../lib/supabase';
import {
  Lock,
  Mail,
  Key,
  LogOut,
  UserCheck,
  Database,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  X,
  ShieldAlert
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser) => void;
  onSignOut: () => void;
  onAddToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onSignOut,
  onAddToast
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'config'>(
    currentUser ? 'config' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Config tab state
  const config = getSupabaseConfig();
  const [customUrl, setCustomUrl] = useState(config.url || '');
  const [customKey, setCustomKey] = useState(config.key || '');
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage('Chưa kết nối Supabase. Vui lòng mở tab "Cấu hình Supabase" để kết nối URL và Anon Key.');
      return;
    }

    setIsLoading(true);
    const { user, error } = await authService.signInWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
      onAddToast(`Đăng nhập thất bại: ${error}`, 'error');
    } else if (user) {
      onAuthSuccess({
        id: user.id,
        email: user.email || email,
        role: user.role,
        lastSignInAt: user.last_sign_in_at
      });
      onAddToast(`Đăng nhập thành công! Chào mừng ${user.email}`, 'success');
      onClose();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage('Chưa kết nối Supabase. Vui lòng mở tab "Cấu hình Supabase" để kết nối URL và Anon Key.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);
    const { user, error, confirmationRequired } = await authService.signUpWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
      onAddToast(`Đăng ký thất bại: ${error}`, 'error');
    } else if (user) {
      if (confirmationRequired) {
        onAddToast('Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.', 'info');
        setActiveTab('signin');
      } else {
        onAuthSuccess({
          id: user.id,
          email: user.email || email,
          role: user.role
        });
        onAddToast(`Đăng ký và kích hoạt phiên thành công!`, 'success');
        onClose();
      }
    }
  };

  const handleSignOutClick = async () => {
    setIsLoading(true);
    await authService.signOut();
    setIsLoading(false);
    onSignOut();
    onAddToast('Đã đăng xuất khỏi phiên làm việc Supabase.', 'info');
    onClose();
  };

  const handleSaveConfig = () => {
    const res = saveCustomSupabaseConfig(customUrl, customKey);
    if (!res.success) {
      onAddToast(res.error || 'Lỗi lưu cấu hình', 'error');
      setErrorMessage(res.error || null);
    } else {
      onAddToast('Đã lưu thông số Supabase vào bộ nhớ an toàn!', 'success');
      setErrorMessage(null);
      handleTestConnection();
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult('Đang kiểm tra kết nối tới máy chủ Supabase...');
    const result = await testSupabaseConnection();
    setIsLoading(false);
    setTestResult(result.message);
    if (result.ok) {
      onAddToast(result.message, 'success');
    } else {
      onAddToast(result.message, 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl bg-[#0F1420] border border-cyan-500/30 p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Xác Thực & Quản Trị Supabase
              </h3>
              <p className="text-[10px] text-slate-400">
                {currentUser ? `Đang đăng nhập: ${currentUser.email}` : 'Bảo vệ quyền truy cập Command Center'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#080D16] rounded-xl border border-slate-800/80 text-xs">
          {!currentUser ? (
            <>
              <button
                onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'signin'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Đăng Nhập
              </button>
              <button
                onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'signup'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tạo Tài Khoản
              </button>
            </>
          ) : (
            <div className="flex-1 py-1.5 px-3 text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Phiên Quản Trị Đang Hoạt Động</span>
            </div>
          )}

          <button
            onClick={() => { setActiveTab('config'); setErrorMessage(null); }}
            className={`py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
              activeTab === 'config'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Kết Nối DB</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Logged in state display */}
        {currentUser && activeTab !== 'config' && (
          <div className="space-y-3 bg-[#080D16] p-4 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tài khoản quản trị:</span>
              <span className="font-mono text-cyan-300 font-bold">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mã User UID:</span>
              <span className="font-mono text-slate-400 text-[10px] truncate max-w-[200px]">{currentUser.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quyền hạn (Role):</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] font-bold">
                {currentUser.role || 'authenticated'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end">
              <button
                onClick={handleSignOutClick}
                disabled={isLoading}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng Xuất Khỏi Thiết Bị</span>
              </button>
            </div>
          </div>
        )}

        {/* Sign In Form */}
        {!currentUser && activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Email quản trị viên *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@affiliate.vn"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Mật khẩu *</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[42px] py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Đăng Nhập Quản Trị</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {!currentUser && activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Email quản trị viên mới *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@affiliate.vn"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Mật khẩu (tối thiểu 6 ký tự) *</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[42px] py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Đăng Ký Tài Khoản Supabase</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Supabase Connection Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#080D16] border border-slate-800 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Database className="w-3.5 h-3.5" /> Trạng Thái Kết Nối:
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isSupabaseConfigured() ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isSupabaseConfigured() ? 'Đã Cấu Hình' : 'Chưa Kết Nối'}
                </span>
              </div>
              <p className="text-slate-400 text-[10px]">
                Hệ thống tự động đọc từ biến môi trường <code className="text-cyan-300">VITE_SUPABASE_URL</code> và <code className="text-cyan-300">VITE_SUPABASE_ANON_KEY</code>, hoặc bạn có thể nhập thủ công bên dưới.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Supabase Project URL</label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">
                Supabase Anon / Public Key (KHÔNG dùng service_role)
              </label>
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveConfig}
                className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors"
              >
                Lưu Cấu Hình
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isLoading}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors disabled:opacity-50"
              >
                Kiểm Tra Ping
              </button>
            </div>

            {testResult && (
              <div className="p-2.5 rounded-xl bg-[#080D16] border border-slate-800 text-[11px] text-cyan-300 font-mono">
                {testResult}
              </div>
            )}

            <div className="text-[10px] text-amber-300/80 p-2 rounded-lg bg-amber-950/20 border border-amber-900/40 flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Tuyệt đối không nhập khóa <code className="text-amber-200">service_role</code> vào frontend! Mọi thao tác đều tuân thủ chính sách bảo mật RLS của Supabase.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
