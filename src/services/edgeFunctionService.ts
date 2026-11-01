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
}

export const edgeFunctionService = {
  /**
   * Helper to invoke 'generate-content' edge function with JWT authentication
   */
  async invokeFunction<T>(
    action: 'generate_script' | 'analyze_product' | 'trend_ideas' | 'audit_content' | 'generate_title_description',
    payload: Record<string, any>
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

    // Check user session
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      return {
        success: false,
        data: null,
        error: 'Yêu cầu đăng nhập: Bạn cần đăng nhập tài khoản trước khi thực thi tác vụ AI thông qua Edge Functions.',
        code: 'UNAUTHORIZED'
      };
    }

    try {
      const { data, error } = await client.functions.invoke('generate-content', {
        body: { action, payload }
      });

      if (error) {
        let errorBody: any = null;
        try {
          // Supabase JS FunctionsHttpError provides context containing the Response object
          const anyErr = error as any;
          if (anyErr?.context && typeof anyErr.context.json === 'function') {
            errorBody = await anyErr.context.json();
          } else if (anyErr?.context?.text) {
            errorBody = JSON.parse(anyErr.context.text);
          }
        } catch {
          // Keep raw error
        }

        if (errorBody && errorBody.error) {
          return {
            success: false,
            data: null,
            error: errorBody.error + (errorBody.hint ? `\n👉 Gợi ý: ${errorBody.hint}` : ''),
            code: errorBody.code || 'FUNCTION_ERROR',
            details: errorBody.details
          };
        }

        const errMsg = error.message || String(error);

        // Edge function not deployed yet
        if (errMsg.includes('404') || errMsg.includes('Failed to send a request') || errMsg.includes('FunctionsFetchError')) {
          return {
            success: false,
            data: null,
            error: 'Edge Function "generate-content" chưa được deploy trên Supabase hoặc URL không phản hồi. Vui lòng deploy function trên Supabase Dashboard hoặc CLI.',
            code: 'FUNCTION_NOT_FOUND',
            details: errMsg
          };
        }

        // 401 Unauthorized
        if (errMsg.includes('401') || errMsg.includes('UNAUTHORIZED') || errMsg.includes('INVALID_SESSION')) {
          return {
            success: false,
            data: null,
            error: 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
            code: 'UNAUTHORIZED',
            details: errMsg
          };
        }

        // Rate limit 429
        if (errMsg.includes('429') || errMsg.includes('RATE_LIMIT_EXCEEDED')) {
          return {
            success: false,
            data: null,
            error: 'Hạn mức Gemini API đã chạm giới hạn (429 Quota Exceeded). Vui lòng thử lại sau ít phút hoặc nâng cấp quota.',
            code: 'RATE_LIMIT_EXCEEDED',
            details: errMsg
          };
        }

        return {
          success: false,
          data: null,
          error: `Lỗi Edge Function: ${errMsg}`,
          code: 'FUNCTION_ERROR',
          details: errMsg
        };
      }

      // If backend returned error payload in response body
      if (data && !data.success && data.error) {
        return {
          success: false,
          data: null,
          error: data.error,
          code: data.code || 'BACKEND_ERROR',
          details: data.details
        };
      }

      if (data && data.success && data.data) {
        return {
          success: true,
          data: data.data as T,
          model: data.model,
          error: null
        };
      }

      return {
        success: false,
        data: null,
        error: 'Phản hồi từ Edge Function không đúng định dạng',
        code: 'MALFORMED_RESPONSE'
      };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: `Không thể kết nối Edge Function: ${err?.message || err}`,
        code: 'NETWORK_EXCEPTION'
      };
    }
  },

  /**
   * Content Factory: Generate TikTok / Shopee Affiliate Script
   */
  async generateScript(params: {
    productName: string;
    category: string;
    platform: 'tiktok' | 'shopee' | 'lazada';
    priceVND: number;
    tone: ContentScript['tone'];
    targetDuration: string;
    keyFeatures?: string;
  }): Promise<EdgeFunctionResult<AIScriptOutput>> {
    return this.invokeFunction<AIScriptOutput>('generate_script', params);
  },

  /**
   * Scout AI: Analyze affiliate deal potential
   */
  async analyzeProduct(params: {
    productName: string;
    category: string;
    priceVND: number;
    platform: string;
  }): Promise<EdgeFunctionResult<AIProductAnalysis>> {
    return this.invokeFunction<AIProductAnalysis>('analyze_product', params);
  },

  /**
   * Trend AI: Catch shortform affiliate trends
   */
  async fetchTrendIdeas(params: {
    category: string;
    platform: string;
  }): Promise<EdgeFunctionResult<AITrendIdea>> {
    return this.invokeFunction<AITrendIdea>('trend_ideas', params);
  },

  /**
   * Auditor AI: Check TikTok Shop compliance & banned words
   */
  async auditContent(params: {
    title: string;
    scriptText: string;
  }): Promise<EdgeFunctionResult<AIAuditResult>> {
    return this.invokeFunction<AIAuditResult>('audit_content', params);
  },

  /**
   * Title & Description Generator for TikTok Affiliate
   */
  async generateTitleDescription(params: {
    productName: string;
    category: string;
  }): Promise<EdgeFunctionResult<{ titles: string[]; description: string; hashtags: string[] }>> {
    return this.invokeFunction<{ titles: string[]; description: string; hashtags: string[] }>('generate_title_description', params);
  }
};
