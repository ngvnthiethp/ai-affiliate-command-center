import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Get keys from Vite env vars or browser storage
const getEffectiveCredentials = () => {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_URL as string | undefined) : undefined;
  const envKey = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) : undefined;

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('acc_supabase_url') : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('acc_supabase_anon_key') : null;

  const url = (storedUrl && storedUrl.trim()) || (envUrl && envUrl.trim()) || '';
  const key = (storedKey && storedKey.trim()) || (envKey && envKey.trim()) || '';

  const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
  const isPlaceholder = url.includes('your-project-id.supabase.co') || key === 'your-anon-key';

  return {
    url,
    key,
    isConfigured: Boolean(url && key && isValidUrl && !isPlaceholder),
    isCustom: Boolean(storedUrl && storedKey)
  };
};

let cachedClient: SupabaseClient | null = null;
let cachedCredentials = getEffectiveCredentials();

export const getSupabaseClient = (): SupabaseClient | null => {
  const creds = getEffectiveCredentials();
  
  if (!creds.isConfigured) {
    return null;
  }

  // Security guardrail: Never allow service_role secret key in frontend
  if (creds.key.toLowerCase().includes('service_role')) {
    console.error('BẢO MẬT: Phát hiện khóa service_role! Frontend chỉ được sử dụng anon/publishable key.');
    return null;
  }

  if (
    !cachedClient ||
    cachedCredentials.url !== creds.url ||
    cachedCredentials.key !== creds.key
  ) {
    cachedClient = createClient(creds.url, creds.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    });
    cachedCredentials = creds;
  }

  return cachedClient;
};

export const isSupabaseConfigured = (): boolean => {
  const creds = getEffectiveCredentials();
  return creds.isConfigured;
};

export const getSupabaseConfig = () => {
  return getEffectiveCredentials();
};

export const saveCustomSupabaseConfig = (url: string, key: string): { success: boolean; error?: string } => {
  const trimmedUrl = url.trim();
  const trimmedKey = key.trim();

  if (!trimmedUrl || !trimmedKey) {
    return { success: false, error: 'Vui lòng nhập đầy đủ URL và Anon Key của Supabase.' };
  }

  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
    return { success: false, error: 'URL dự án phải bắt đầu bằng https://' };
  }

  if (trimmedKey.toLowerCase().includes('service_role')) {
    return { success: false, error: 'LỖI BẢO MẬT: Bạn đang nhập service_role key! Chỉ được dùng anon public key.' };
  }

  try {
    localStorage.setItem('acc_supabase_url', trimmedUrl);
    localStorage.setItem('acc_supabase_anon_key', trimmedKey);
    cachedClient = null; // Reset cache
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Không thể lưu vào bộ nhớ cục bộ' };
  }
};

export const clearCustomSupabaseConfig = () => {
  try {
    localStorage.removeItem('acc_supabase_url');
    localStorage.removeItem('acc_supabase_anon_key');
    cachedClient = null;
  } catch (err) {
    console.error('Lỗi khi xóa cấu hình:', err);
  }
};

export const testSupabaseConnection = async (): Promise<{ ok: boolean; message: string; user?: User | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: 'Chưa cấu hình Supabase URL hoặc Anon Key. Hệ thống đang chạy trên Dữ liệu mô phỏng Sandbox.'
    };
  }

  try {
    // Try pinging auth session
    const { data: { session }, error: sessionErr } = await client.auth.getSession();
    if (sessionErr) {
      return { ok: false, message: `Lỗi kết nối Auth: ${sessionErr.message}` };
    }

    return {
      ok: true,
      message: 'Kết nối Supabase thành công! Phiên Auth sẵn sàng.',
      user: session?.user || null
    };
  } catch (err: any) {
    return { ok: false, message: `Lỗi kết nối mạng Supabase: ${err?.message || 'Không xác định'}` };
  }
};

// ============================================================================
// AUTHENTICATION SERVICES
// ============================================================================

export const authService = {
  async getSession(): Promise<Session | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  },

  async getUser(): Promise<User | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data.user;
  },

  async signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    const client = getSupabaseClient();
    if (!client) {
      return { user: null, session: null, error: 'Chưa kết nối Supabase. Vui lòng cấu hình URL và Anon Key.' };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user, session: data.session, error: null };
  },

  async signUpWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: string | null; confirmationRequired?: boolean }> {
    const client = getSupabaseClient();
    if (!client) {
      return { user: null, session: null, error: 'Chưa kết nối Supabase. Vui lòng cấu hình URL và Anon Key.' };
    }

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    const confirmationRequired = !data.session;
    return { user: data.user, session: data.session, error: null, confirmationRequired };
  },

  async signOut(): Promise<{ error: string | null }> {
    const client = getSupabaseClient();
    if (!client) return { error: null };

    const { error } = await client.auth.signOut();
    return { error: error ? error.message : null };
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const client = getSupabaseClient();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return {
      unsubscribe: () => subscription.unsubscribe()
    };
  }
};

/**
 * Format full Supabase PostgREST error details into a clear, readable multi-line string.
 * Strictly includes error.message, error.code, error.details, error.hint.
 */
export const formatSupabaseError = (err: any): string => {
  if (!err) return 'Không có thông tin lỗi từ Supabase.';
  if (typeof err === 'string') return err;

  const msg = err.message || 'Lỗi thao tác Supabase';
  const code = err.code ? `• Mã lỗi (code): ${err.code}` : null;
  const details = err.details ? `• Chi tiết (details): ${err.details}` : null;
  const hint = err.hint ? `• Gợi ý (hint): ${err.hint}` : null;

  const parts = [
    msg,
    code,
    details,
    hint
  ].filter(Boolean);

  return parts.join('\n');
};

