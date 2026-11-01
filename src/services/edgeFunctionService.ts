import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { ContentScript } from '../types';

export interface AIScriptOutput {
  title: string;
  hookVariantA: string;
  hookVariantB: string;
  activeHook: 'A' | 'B';
  bodyStory: string;
  voiceoverLines: Array<{
    timestamp: string;
    speech: string;
    action: string;
  }>;
  callToAction: string;
  hashtags: string[];
  targetDuration: string;
  tone: ContentScript['tone'];
  estimatedViews: string;
  unverifiedClaimsNotes?: string;
}

export interface AIProductAnalysis {
  potentialScore: number;
  recommendation: string;
  targetAudience: string;
  keyAngles: string[];
  suggestedCommission: number;
  notes: string;
}

export interface AITrendIdea {
  trends: Array<{
    name: string;
    soundType: string;
    hookTemplate: string;
    retentionTactic: string;
  }>;
}

export interface AIAuditResult {
  complianceScore: number;
  status: 'approved' | 'needs_review';
  violations: string[];
  suggestedFixes: string[];
  summary: string;
}

export interface EdgeFunctionResult<T> {
  success: boolean;
  data: T | null;
  model?: string;
  error?: string | null;
  code?: string;
  details?: string;
  hint?: string;
  attempts?: number;
  requestId?: string;
  durationMs?: number;
}

export interface InvokeOptions {
  signal?: AbortSignal;
}

export const edgeFunctionService = {
  /**
   * Gọi Supabase Edge Function 'generate-content'
   * Đồng bộ deadline: 125s watchdog ở client (cho phép backend 120s hoàn thành hoặc trả mã 504)
   * Backend là nơi duy nhất quản lý retry transient errors.
   */
  async invokeFunction<T>(
    action: 'generate_script' | 'analyze_product' | 'trend_ideas' | 'audit_content' | 'generate_title_description',
    payload: Record<string, any>,
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<T>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        data: null,
        error: 'Chưa cấu hình Supabase URL hoặc Anon Key. Vui lòng kết nối Supabase trước khi gọi AI.',
        code: 'NOT_CONFIGURED'
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        data: null,
        error: 'Không thể khởi tạo client Supabase.',
        code: 'CLIENT_INIT_FAILED'
      };
    }

    // 1. Kiểm tra phiên đăng nhập (JWT Authentication)
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      return {
        success: false,
        data: null,
        error: 'Yêu cầu đăng nhập: Bạn cần đăng nhập tài khoản trước khi thực thi tác vụ AI qua Edge Functions.',
        code: 'UNAUTHORIZED'
      };
    }

    // 2. Kiểm tra nếu người dùng đã hủy trước khi bắt đầu
    if (options?.signal?.aborted) {
      return {
        success: false,
        data: null,
        error: 'Yêu cầu đã bị hủy bởi người dùng.',
        code: 'ABORTED'
      };
    }

    // 3. Tạo client-side watchdog 125s đồng bộ với 120s backend deadline
    const watchdogController = new AbortController();
    const watchdogTimeoutId = setTimeout(() => {
      watchdogController.abort(new DOMException('Client watchdog timeout (125s)', 'TimeoutError'));
    }, 125000);

    const onUserAbort = () => {
      watchdogController.abort(new DOMException('User aborted request', 'AbortError'));
    };
    if (options?.signal) {
      options.signal.addEventListener('abort', onUserAbort, { once: true });
    }

    try {
      // 4. Gửi request duy nhất tới Edge Function với signal kết hợp
      const { data, error } = await (client.functions.invoke as any)('generate-content', {
        body: { action, payload },
        signal: watchdogController.signal
      });

      clearTimeout(watchdogTimeoutId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onUserAbort);
      }

      // Xử lý khi có lỗi HTTP từ Edge Function
      if (error) {
        let errorBody: any = null;
        try {
          const anyErr = error as any;
          if (anyErr?.context && typeof anyErr.context.json === 'function') {
            errorBody = await anyErr.context.json();
          } else if (anyErr?.context?.text) {
            errorBody = JSON.parse(anyErr.context.text);
          }
        } catch {
          // Không parse được body
        }

        const rawMsg = error.message || String(error);

        // Phân loại mã lỗi chuẩn
        let resolvedCode = errorBody?.code;
        let resolvedError = errorBody?.error;
        let resolvedHint = errorBody?.hint;
        let resolvedDetails = errorBody?.details || rawMsg;
        const requestId = errorBody?.requestId;
        const attempts = errorBody?.attempts || 1;
        const durationMs = errorBody?.durationMs;

        // Xử lý hủy do người dùng
        if (options?.signal?.aborted || resolvedCode === 'ABORTED' || rawMsg.includes('aborted')) {
          return {
            success: false,
            data: null,
            error: 'Yêu cầu đã bị hủy bởi người dùng.',
            code: 'ABORTED',
            requestId,
            durationMs
          };
        }

        // 404: Function chưa deploy
        if (rawMsg.includes('404') || rawMsg.includes('Failed to send a request') || rawMsg.includes('FunctionsFetchError')) {
          resolvedCode = 'FUNCTION_NOT_FOUND';
          resolvedError = 'Edge Function "generate-content" chưa được deploy trên Supabase hoặc URL không phản hồi.';
          resolvedHint = 'Vui lòng triển khai function theo tài liệu EDGE_FUNCTION_DEPLOY_GUIDE.md.';
        }
        // 401: Unauthorized
        else if (rawMsg.includes('401') || resolvedCode === 'UNAUTHORIZED') {
          resolvedCode = 'UNAUTHORIZED';
          resolvedError = resolvedError || 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
          resolvedHint = 'Nhấn nút "Đăng Nhập Quản Trị" để đăng nhập lại tài khoản.';
        }
        // 403: API Key Invalid
        else if (rawMsg.includes('403') || resolvedCode === 'API_KEY_INVALID') {
          resolvedCode = 'API_KEY_INVALID';
          resolvedError = resolvedError || 'Khóa GEMINI_API_KEY hoặc quyền truy cập không hợp lệ.';
          resolvedHint = 'Kiểm tra biến môi trường GEMINI_API_KEY trong Supabase Secrets.';
        }
        // 429: Rate Limit
        else if (rawMsg.includes('429') || resolvedCode === 'RATE_LIMIT_EXCEEDED') {
          resolvedCode = 'RATE_LIMIT_EXCEEDED';
          resolvedError = 'Gemini API vượt hạn mức hoặc tốc độ yêu cầu (429 Rate Limit). Vui lòng thử lại sau ít phút hoặc nâng cấp quota.';
          resolvedHint = 'Đợi 1-2 phút hoặc kiểm tra quota tại Google AI Studio.';
        }
        // 503: Service Unavailable (Quá tải) - TUYỆT ĐỐI KHÔNG HIỂN THỊ "Kiểm tra GEMINI_API_KEY"
        else if (rawMsg.includes('503') || rawMsg.includes('high demand') || resolvedCode === 'SERVICE_UNAVAILABLE') {
          resolvedCode = 'SERVICE_UNAVAILABLE';
          resolvedError = 'Gemini hiện đang quá tải. Vui lòng thử lại sau ít phút.';
          resolvedHint = 'Máy chủ AI của Google đang có lượng truy cập đột biến tạm thời (Spikes in demand). Hãy thử lại sau ít phút.';
        }
        // 504: Timeout
        else if (rawMsg.includes('504') || resolvedCode === 'TIMEOUT') {
          resolvedCode = 'TIMEOUT';
          resolvedError = resolvedError || 'Hết thời gian chờ phản hồi từ máy chủ AI (504 Timeout). Vui lòng thử lại.';
          resolvedHint = 'Gemini cần thời gian để tạo kịch bản hoàn chỉnh (thường mất 20-45 giây). Máy chủ đang xử lý chậm hơn bình thường.';
        }
        // 500 / 502: Server Error
        else if (rawMsg.includes('502') || rawMsg.includes('500') || resolvedCode === 'SERVER_ERROR' || resolvedCode === 'BAD_GATEWAY') {
          resolvedCode = resolvedCode || 'SERVER_ERROR';
          resolvedError = resolvedError || 'Lỗi máy chủ tạm thời từ Google Gemini (HTTP 500/502). Vui lòng thử lại sau ít phút.';
          resolvedHint = 'Máy chủ AI đang gặp trục trặc tạm thời.';
        }

        return {
          success: false,
          data: null,
          error: resolvedError || `Lỗi Edge Function: ${rawMsg}`,
          code: resolvedCode || 'FUNCTION_ERROR',
          details: resolvedDetails,
          hint: resolvedHint,
          attempts,
          requestId,
          durationMs
        };
      }

      // Xử lý khi response trả về lỗi trong body (data.success === false)
      if (data && !data.success) {
        const resolvedCode = data.code || 'BACKEND_ERROR';
        const resolvedError = data.error || 'Lỗi không xác định từ backend';
        let resolvedHint = data.hint;

        if (resolvedCode === 'SERVICE_UNAVAILABLE' || resolvedError.includes('503') || resolvedError.includes('quá tải')) {
          resolvedHint = 'Máy chủ AI của Google đang có lượng truy cập cao đột biến. Hãy thử lại sau ít phút.';
        } else if (resolvedCode === 'API_KEY_INVALID' || resolvedCode === 'MISSING_GEMINI_KEY') {
          resolvedHint = 'Kiểm tra biến môi trường GEMINI_API_KEY trong Supabase Secrets.';
        } else if (resolvedCode === 'TIMEOUT') {
          resolvedHint = 'Gemini cần thời gian để hoàn thành kịch bản. Vui lòng thử lại hoặc giảm thời lượng.';
        }

        return {
          success: false,
          data: null,
          error: resolvedError,
          code: resolvedCode,
          details: data.details,
          hint: resolvedHint,
          attempts: data.attempts || 1,
          requestId: data.requestId,
          durationMs: data.durationMs
        };
      }

      // Thành công: Trả về kết quả
      if (data && data.success && data.data) {
        return {
          success: true,
          data: data.data as T,
          model: data.model,
          attempts: data.attempts || 1,
          requestId: data.requestId,
          durationMs: data.durationMs,
          error: null
        };
      }

      // Response không đúng định dạng
      return {
        success: false,
        data: null,
        error: 'Phản hồi từ Edge Function không đúng định dạng.',
        code: 'MALFORMED_RESPONSE',
        attempts: 1
      };
    } catch (err: any) {
      clearTimeout(watchdogTimeoutId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onUserAbort);
      }

      // Kiểm tra nếu là do người dùng hủy
      if (options?.signal?.aborted || err?.name === 'AbortError' && options?.signal?.aborted) {
        return {
          success: false,
          data: null,
          error: 'Yêu cầu đã bị hủy bởi người dùng.',
          code: 'ABORTED'
        };
      }

      // Kiểm tra nếu là client watchdog timeout
      if (err?.name === 'TimeoutError' || err?.message?.includes('watchdog timeout')) {
        return {
          success: false,
          data: null,
          error: 'Hết thời gian chờ phản hồi từ máy chủ AI (504 Timeout). Vui lòng thử lại.',
          code: 'TIMEOUT',
          hint: 'Quá trình xử lý vượt quá 120 giây. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau ít phút.'
        };
      }

      const errMsg = err?.message || String(err);
      return {
        success: false,
        data: null,
        error: `Không thể kết nối Edge Function: ${errMsg}`,
        code: 'NETWORK_EXCEPTION',
        details: errMsg,
        attempts: 1
      };
    }
  },

  /**
   * Content Factory: Generate TikTok / Shopee Affiliate Script
   */
  async generateScript(
    params: {
      productName: string;
      category: string;
      platform: 'tiktok' | 'shopee' | 'lazada';
      priceVND: number;
      commissionRate?: number;
      targetAudience?: string;
      tone: ContentScript['tone'];
      targetDuration: string;
      keyFeatures?: string;
    },
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<AIScriptOutput>> {
    return this.invokeFunction<AIScriptOutput>('generate_script', params, options);
  },

  /**
   * Scout AI: Analyze affiliate deal potential
   */
  async analyzeProduct(
    params: {
      productName: string;
      category: string;
      priceVND: number;
      platform: string;
    },
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<AIProductAnalysis>> {
    return this.invokeFunction<AIProductAnalysis>('analyze_product', params, options);
  },

  /**
   * Trend AI: Catch shortform affiliate trends
   */
  async fetchTrendIdeas(
    params: {
      category: string;
      platform: string;
    },
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<AITrendIdea>> {
    return this.invokeFunction<AITrendIdea>('trend_ideas', params, options);
  },

  /**
   * Auditor AI: Check TikTok Shop compliance & banned words
   */
  async auditContent(
    params: {
      title: string;
      scriptText: string;
    },
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<AIAuditResult>> {
    return this.invokeFunction<AIAuditResult>('audit_content', params, options);
  },

  /**
   * Title & Description Generator for TikTok Affiliate
   */
  async generateTitleDescription(
    params: {
      productName: string;
      category: string;
    },
    options?: InvokeOptions
  ): Promise<EdgeFunctionResult<{ titles: string[]; description: string; hashtags: string[] }>> {
    return this.invokeFunction<{ titles: string[]; description: string; hashtags: string[] }>('generate_title_description', params, options);
  }
};
