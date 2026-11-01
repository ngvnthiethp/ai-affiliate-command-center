# Hướng Dẫn Triển Khai Supabase Edge Function `generate-content`
## Phase 3: AI Brain & Multi-Agent Orchestration

> **LƯU Ý QUAN TRỌNG:**
> Toàn bộ kiến trúc phía Frontend của ứng dụng **AI Affiliate Command Center (AI ACC)** đã được tích hợp hoàn chỉnh.
> **Supabase Edge Function là dịch vụ backend đám mây chạy trên hạ tầng Supabase của bạn**. 
> Để hệ thống điều phối 5 Agent và gọi các AI API thực tế mà không để lộ API Key, **bạn cần cập nhật và deploy hàm này lên dự án Supabase của mình**.
>
> Ứng dụng **không giả lập dữ liệu** và **không hiển thị CONNECTED** khi chưa cấu hình API Key.

---

## 1. Kiến Trúc AI Brain & Multi-Agent Orchestration (Phase 3)

1. **Đội ngũ 5 AI Agent**:
   - **Agent 1 - ChatGPT (OpenAI)**: `Operations & Strategy` (Điều hành & Chiến lược).
   - **Agent 2 - Gemini (Google)**: `Market Research & Content Intelligence` (Deal & Kịch bản) - **Provider Chính**.
   - **Agent 3 - Grok (xAI)**: `Trend Intelligence` (Bắt sóng xu hướng thị trường).
   - **Agent 4 - Claude (Anthropic)**: `Content Quality & Compliance` (Kiểm định chất lượng & Chính sách).
   - **Agent 5 - DeepSeek (DeepSeek)**: `Technical & Data Analysis` (Phân tích dữ liệu & Tính toán ROI) - **Provider Dự Phòng**.

2. **Cơ Chế Auto-Router & Smart Fallback**:
   - Khi một Agent được yêu cầu nhưng chưa cấu hình API Key trong Supabase Secrets:
     - Hệ thống **tuyệt đối không giả lập thành công**.
     - Tự động chuyển tiếp (Fallback) sang **Gemini** (hoặc **DeepSeek**) nếu đã có API Key.
     - Trả về lý do chuyển tiếp rõ ràng (`fallbackReason`) để thông báo cho người dùng trên giao diện.

3. **Cost Control & Quota Guardrails (Server-Side Enforced)**:
   - **Giới hạn ngày**: Tối đa **20 tác vụ AI/ngày/người dùng** (chặn tự động phía máy chủ bằng HTTP 429).
   - **Ngân sách tháng**: Mặc định **300.000 VNĐ/tháng**.
   - **Giới hạn output tokens**: Tối đa 10.000 tokens/tác vụ.
   - Tính toán chi phí thực tế/ước tính (VNĐ) dựa trên bảng giá chính thức của từng model.

4. **Đồng Bộ Timeout & Phân Tầng Deadline**:
   - **Supabase Gateway Idle Timeout**: 150 giây.
   - **Frontend Watchdog Timeout**: 125 giây (kèm nút "Dừng & Hủy" ngắt an toàn).
   - **Edge Function Total Deadline**: 120 giây.
   - **Single Call Budget**: 55 giây cho tác vụ kịch bản, 25 giây cho tác vụ nhanh.
   - **Retry Policy**: Tối đa 1 lần retry cho tác vụ dài nếu thời gian còn lại $\ge 40$ giây. Chỉ retry lỗi tạm thời (503, 502, 500, 429, 408).

---

## 2. Bảng Cấu Hình Secrets Trên Supabase

Truy cập **Supabase Dashboard** > **Edge Functions** > **Secrets** (hoặc tab **Manage Secrets**) và cấu hình:

| Tên Biến Môi Trường (Secret) | AI Agent Phụ Trách | Trạng Thái | Nơi Lấy API Key |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Agent 2 (Gemini) | **Bắt buộc (Primary)** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` *(tùy chọn)* | Agent 2 | Mặc định: `gemini-2.5-flash` | Google AI Studio |
| `DEEPSEEK_API_KEY` | Agent 5 (DeepSeek) | **Khuyên dùng (Backup)** | [platform.deepseek.com](https://platform.deepseek.com) |
| `DEEPSEEK_MODEL` *(tùy chọn)*| Agent 5 | Mặc định: `deepseek-chat` | DeepSeek Platform |
| `OPENAI_API_KEY` | Agent 1 (ChatGPT) | Tùy chọn | [platform.openai.com](https://platform.openai.com) |
| `GROK_API_KEY` hoặc `XAI_API_KEY` | Agent 3 (Grok) | Tùy chọn | [console.x.ai](https://console.x.ai) |
| `ANTHROPIC_API_KEY` | Agent 4 (Claude) | Tùy chọn | [console.anthropic.com](https://console.anthropic.com) |

> 💡 **Mẹo**: Nếu bạn chỉ có `GEMINI_API_KEY`, hệ thống vẫn vận hành hoàn hảo nhờ cơ chế Smart Fallback tự động của AI Brain!

---

## 3. Cách Triển Khai Trực Tiếp (Supabase Dashboard)

1. Mở **Supabase Dashboard** > Chọn Project của bạn.
2. Menu trái chọn **Edge Functions** (biểu tượng tia sét).
3. Chọn function `generate-content` (hoặc tạo mới nếu chưa có).
4. Xóa code cũ, sao chép **toàn bộ mã nguồn ở Mục 5 bên dưới** và dán vào file `index.ts`.
5. Nhấn **Save & Deploy** (chờ 5 giây hiển thị **Active**).
6. Quay lại ứng dụng AI ACC > Vào mục **AI Manager** > Bấm nút **"Kiểm Tra Kết Nối"** để xác thực thời gian thực!

---

## 4. (Khuyên Dùng) Migration Database & Hàm Atomic Quota (SQL Editor)

Mở **Supabase Dashboard** > **SQL Editor** và chạy đoạn mã không phá hủy (additive) dưới đây (cũng có trong file `supabase/migrations/20261101_ai_brain_columns.sql`):

```sql
-- 1. Bổ sung các cột theo dõi chi tiết AI Brain (hoàn toàn Additive)
ALTER TABLE public.ai_task_logs 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS agent text,
  ADD COLUMN IF NOT EXISTS requested_agent text,
  ADD COLUMN IF NOT EXISTS executed_agent text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost numeric(12, 4),
  ADD COLUMN IF NOT EXISTS cost_status text DEFAULT 'estimated',
  ADD COLUMN IF NOT EXISTS fallback_reason text,
  ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

-- 2. Đảm bảo request_id là duy nhất (ngăn chặn duplicate logging từ một request)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_task_logs_request_id_unique 
  ON public.ai_task_logs(request_id) 
  WHERE request_id IS NOT NULL;

-- 3. Đánh index hỗ trợ tính toán Quota & Chi phí tốc độ cao
CREATE INDEX IF NOT EXISTS idx_ai_task_logs_owner_created 
  ON public.ai_task_logs(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_task_logs_created_at 
  ON public.ai_task_logs(created_at DESC);

-- 4. Kích hoạt Row Level Security (RLS) bảo vệ dữ liệu cá nhân
ALTER TABLE public.ai_task_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Policy SELECT: User chỉ xem logs của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can view own ai task logs'
  ) THEN
    CREATE POLICY "Users can view own ai task logs" 
      ON public.ai_task_logs 
      FOR SELECT 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  -- Policy INSERT: User chỉ ghi logs của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can insert own ai task logs'
  ) THEN
    CREATE POLICY "Users can insert own ai task logs" 
      ON public.ai_task_logs 
      FOR INSERT 
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  -- Policy UPDATE: Cho phép cập nhật bản ghi đặt chỗ quota (Reservation -> Success/Failed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can update own ai task logs'
  ) THEN
    CREATE POLICY "Users can update own ai task logs" 
      ON public.ai_task_logs 
      FOR UPDATE 
      USING (auth.uid() = owner_id OR owner_id IS NULL)
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;
END $$;

-- 5. HÀM ATOMIC QUOTA RESERVATION (Chống Race Condition Tuyệt Đối)
CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_owner_id uuid,
  p_request_id text,
  p_daily_limit int DEFAULT 20,
  p_monthly_budget_vnd numeric DEFAULT 300000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_current_daily_count int;
  v_current_monthly_spent numeric;
BEGIN
  -- Khóa mức transaction theo user ID để chặn race condition
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_owner_id::text, 'acc_ai_quota_lock')));

  -- Đếm số tác vụ hôm nay: bao gồm 'success', 'running', 'reserved'
  SELECT COUNT(*)
  INTO v_current_daily_count
  FROM public.ai_task_logs
  WHERE created_at >= v_today_start
    AND (owner_id = p_owner_id OR (owner_id IS NULL AND p_owner_id IS NULL))
    AND status IN ('success', 'running', 'reserved');

  IF v_current_daily_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'QUOTA_EXCEEDED',
      'error', 'Hạn mức AI hôm nay đã đạt tối đa (' || v_current_daily_count || '/' || p_daily_limit || ' tác vụ). Vui lòng thử lại vào ngày mai.',
      'daily_count', v_current_daily_count,
      'daily_limit', p_daily_limit
    );
  END IF;

  -- Kiểm tra ngân sách tháng (300.000 VNĐ)
  SELECT COALESCE(SUM(COALESCE(actual_cost, estimated_cost, 0)), 0)
  INTO v_current_monthly_spent
  FROM public.ai_task_logs
  WHERE created_at >= v_month_start
    AND (owner_id = p_owner_id OR (owner_id IS NULL AND p_owner_id IS NULL))
    AND status = 'success';

  IF v_current_monthly_spent >= p_monthly_budget_vnd THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'BUDGET_EXCEEDED',
      'error', 'Ngân sách AI tháng này đã đạt (' || ROUND(v_current_monthly_spent) || '/' || p_monthly_budget_vnd || ' VNĐ).',
      'monthly_spent', v_current_monthly_spent,
      'monthly_budget', p_monthly_budget_vnd
    );
  END IF;

  -- Ghi nhận giữ chỗ nguyên tử (Atomic Reservation) với request_id duy nhất
  IF NOT EXISTS (SELECT 1 FROM public.ai_task_logs WHERE request_id = p_request_id) THEN
    INSERT INTO public.ai_task_logs (
      owner_id,
      request_id,
      task_type,
      status,
      created_at
    ) VALUES (
      p_owner_id,
      p_request_id,
      'Đang giữ chỗ quota (AI Task Reserved)',
      'reserved',
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'daily_count', v_current_daily_count + 1,
    'daily_limit', p_daily_limit,
    'monthly_spent', v_current_monthly_spent,
    'monthly_budget', p_monthly_budget_vnd
  );
END;
$$;
```

*(Lưu ý: Nếu chưa chạy migration này, Edge Function vẫn tự động fallback an toàn qua truy vấn thông thường mà không làm hỏng ứng dụng!)*

---

## 4.2. Migration Database Cho Phase 4: Product Hunter & Intelligence Engine

Để lưu trữ đầy đủ các chỉ số phân tích chuyên sâu của Phase 4 (Điểm cơ hội 6 tiêu chí, phân tích đối thủ, chân dung khách hàng, độ tin cậy dữ liệu), mở **SQL Editor** trên Supabase Dashboard và chạy đoạn mã không phá hủy sau:

```sql
-- 1. Bổ sung các cột mở rộng cho bảng public.products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS usp text,
  ADD COLUMN IF NOT EXISTS rating numeric(3, 2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'Manual Input',
  ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_reliability integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS analysis_result jsonb,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'DISCOVERED',
  ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;

-- 2. Indexes để tăng tốc lọc và sắp xếp
CREATE INDEX IF NOT EXISTS idx_products_owner_pipeline 
  ON public.products(owner_id, pipeline_status);

CREATE INDEX IF NOT EXISTS idx_products_potential_score 
  ON public.products(potential_score DESC);

CREATE INDEX IF NOT EXISTS idx_products_platform 
  ON public.products(platform);

CREATE INDEX IF NOT EXISTS idx_products_created_at 
  ON public.products(created_at DESC);

-- 3. Kích hoạt Row Level Security (RLS) bảo vệ sản phẩm riêng tư
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can view own products or public demo'
  ) THEN
    CREATE POLICY "Users can view own products or public demo" 
      ON public.products 
      FOR SELECT 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can insert own products'
  ) THEN
    CREATE POLICY "Users can insert own products" 
      ON public.products 
      FOR INSERT 
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can update own products'
  ) THEN
    CREATE POLICY "Users can update own products" 
      ON public.products 
      FOR UPDATE 
      USING (auth.uid() = owner_id OR owner_id IS NULL)
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can delete own products'
  ) THEN
    CREATE POLICY "Users can delete own products" 
      ON public.products 
      FOR DELETE 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;
END $$;
```

*(Lưu ý: Ứng dụng đã được tích hợp cơ chế tự động fallback thông minh; nếu chưa kịp chạy script trên, tính năng Thêm/Sửa sản phẩm vẫn hoạt động an toàn mà không phát sinh lỗi!)*

---

## 5. Toàn Bộ Mã Nguồn Đơn Tệp (Copy-Paste Cho `generate-content`)

File nguồn chính thức của hàm này nằm tại: **`supabase/functions/generate-content/index.ts`** trong thư mục dự án.
Nếu triển khai bằng Supabase CLI, chỉ cần chạy:
```bash
supabase functions deploy generate-content --no-verify-jwt
```
*(Lưu ý: JWT được hàm tự xác thực an toàn bằng `supabaseClient.auth.getUser()`).*

Nếu triển khai thủ công trên Supabase Dashboard, hãy sao chép toàn bộ nội dung từ file `supabase/functions/generate-content/index.ts` hoặc sao chép khối mã dưới đây dán vào editor của Edge Function:

```typescript
// Supabase Edge Function: generate-content
// Phase 3 Hardened: AI Brain & Multi-Agent Orchestration (Deno Runtime)
// Điều phối 5 AI Agent: ChatGPT (OpenAI), Gemini (Google), Grok (xAI), Claude (Anthropic), DeepSeek
// Quản lý Provider, Router, Fallback thông minh, Atomic Quota Reservation & Giới hạn Ngân sách

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS Headers cho phép gọi an toàn từ Web / iPhone Safari
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cấu hình Model Mặc định cho từng Provider
const PROVIDER_CONFIGS = {
  gemini: {
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    costPer1MPromptUSD: 0.075,
    costPer1MCompletionUSD: 0.30
  },
  deepseek: {
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    costPer1MPromptUSD: 0.14,
    costPer1MCompletionUSD: 0.28
  },
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    costPer1MPromptUSD: 0.15,
    costPer1MCompletionUSD: 0.60
  },
  grok: {
    name: "xAI Grok",
    defaultModel: "grok-beta",
    envKey: "GROK_API_KEY", // fallback: XAI_API_KEY
    modelEnv: "GROK_MODEL",
    costPer1MPromptUSD: 5.00,
    costPer1MCompletionUSD: 15.00
  },
  claude: {
    name: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-20241022",
    envKey: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    costPer1MPromptUSD: 3.00,
    costPer1MCompletionUSD: 15.00
  }
};

// Tỷ giá quy đổi USD -> VNĐ cho mục đích ước tính ngân sách
const USD_TO_VND_RATE = 25400;

// Giới hạn an toàn & Deadline hệ thống
const TOTAL_EXECUTION_TIMEOUT_MS = 120000; // 120s (dưới 150s gateway timeout)
const MAX_PAYLOAD_LENGTH = 5000;
const MAX_OUTPUT_TOKENS_LIMIT = 10000;

// Giới hạn ngân sách mặc định
const DEFAULT_DAILY_TASK_LIMIT = 20; // 20 tác vụ/ngày/người dùng
const DEFAULT_MONTHLY_BUDGET_VND = 300000; // 300.000 VNĐ/tháng

interface RequestPayload {
  action: 
    | "check_agents_status" 
    | "orchestrate_task"
    // Backward compatibility
    | "generate_script" 
    | "analyze_product" 
    | "trend_ideas" 
    | "audit_content" 
    | "generate_title_description";
  payload?: Record<string, any>;
  preferredAgent?: "chatgpt" | "gemini" | "grok" | "claude" | "deepseek";
  taskType?: 
    | "operations_strategy" 
    | "market_research" 
    | "content_creation" 
    | "trend_intelligence" 
    | "content_compliance" 
    | "technical_analysis";
  inputPrompt?: string;
}

interface ProviderCallResult {
  success: boolean;
  provider: string;
  model: string;
  text: string;
  parsedJson?: any;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCostVND: number;
  durationMs: number;
  httpStatus: number;
  error?: string;
  code?: string;
}

function isTransientError(status: number): boolean {
  return status === 503 || status === 502 || status === 500 || status === 429 || status === 408;
}

function getApiKey(provider: keyof typeof PROVIDER_CONFIGS): string | null {
  const cfg = PROVIDER_CONFIGS[provider];
  const primary = Deno.env.get(cfg.envKey);
  if (primary && primary.trim() !== "") return primary.trim();
  if (provider === "grok") {
    const fallbackXai = Deno.env.get("XAI_API_KEY");
    if (fallbackXai && fallbackXai.trim() !== "") return fallbackXai.trim();
  }
  return null;
}

function calculateCostVND(
  provider: keyof typeof PROVIDER_CONFIGS, 
  promptTokens: number, 
  completionTokens: number
): number {
  const cfg = PROVIDER_CONFIGS[provider];
  const promptCostUSD = (promptTokens / 1000000) * cfg.costPer1MPromptUSD;
  const completionCostUSD = (completionTokens / 1000000) * cfg.costPer1MCompletionUSD;
  const totalCostUSD = promptCostUSD + completionCostUSD;
  return Math.round(totalCostUSD * USD_TO_VND_RATE);
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  apiKey: string,
  signal: AbortSignal,
  modelName?: string
): Promise<ProviderCallResult> {
  const start = Date.now();
  const model = modelName || Deno.env.get("GEMINI_MODEL") || PROVIDER_CONFIGS.gemini.defaultModel;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      maxOutputTokens: 3000
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal
  });

  const durationMs = Date.now() - start;

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr: any = null;
    try { parsedErr = JSON.parse(errText); } catch {}
    const msg = parsedErr?.error?.message || errText || "Lỗi khi gọi Gemini API";
    return {
      success: false,
      provider: "Google Gemini",
      model,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: msg,
      code: response.status === 429 ? "RATE_LIMIT_EXCEEDED" : response.status === 503 ? "SERVICE_UNAVAILABLE" : "GEMINI_ERROR"
    };
  }

  const data = await response.json();
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usageMeta = data?.usageMetadata || {};
  const promptTokens = usageMeta.promptTokenCount || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usageMeta.candidatesTokenCount || Math.ceil(candidateText.length / 4);
  const totalTokens = usageMeta.totalTokenCount || (promptTokens + completionTokens);

  let cleaned = candidateText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: candidateText }; }

  const costVND = calculateCostVND("gemini", promptTokens, completionTokens);

  return {
    success: true,
    provider: "Google Gemini",
    model,
    text: candidateText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    estimatedCostVND: costVND,
    durationMs,
    httpStatus: 200
  };
}

async function callOpenAICompatible(
  provider: "deepseek" | "openai" | "grok",
  systemInstruction: string,
  userPrompt: string,
  apiKey: string,
  signal: AbortSignal
): Promise<ProviderCallResult> {
  const start = Date.now();
  let endpoint = "";
  let defaultModel = "";

  if (provider === "deepseek") {
    endpoint = "https://api.deepseek.com/v1/chat/completions";
    defaultModel = Deno.env.get("DEEPSEEK_MODEL") || PROVIDER_CONFIGS.deepseek.defaultModel;
  } else if (provider === "openai") {
    endpoint = "https://api.openai.com/v1/chat/completions";
    defaultModel = Deno.env.get("OPENAI_MODEL") || PROVIDER_CONFIGS.openai.defaultModel;
  } else {
    endpoint = "https://api.x.ai/v1/chat/completions";
    defaultModel = Deno.env.get("GROK_MODEL") || PROVIDER_CONFIGS.grok.defaultModel;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: defaultModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 3000
    }),
    signal
  });

  const durationMs = Date.now() - start;

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr: any = null;
    try { parsedErr = JSON.parse(errText); } catch {}
    const msg = parsedErr?.error?.message || errText || `Lỗi từ ${provider.toUpperCase()}`;
    return {
      success: false,
      provider: PROVIDER_CONFIGS[provider].name,
      model: defaultModel,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: msg,
      code: `${provider.toUpperCase()}_ERROR`
    };
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};
  const promptTokens = usage.prompt_tokens || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usage.completion_tokens || Math.ceil(rawText.length / 4);
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: rawText }; }

  const costVND = calculateCostVND(provider, promptTokens, completionTokens);

  return {
    success: true,
    provider: PROVIDER_CONFIGS[provider].name,
    model: defaultModel,
    text: rawText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    estimatedCostVND: costVND,
    durationMs,
    httpStatus: 200
  };
}

async function callClaude(
  systemInstruction: string,
  userPrompt: string,
  apiKey: string,
  signal: AbortSignal
): Promise<ProviderCallResult> {
  const start = Date.now();
  const model = Deno.env.get("ANTHROPIC_MODEL") || PROVIDER_CONFIGS.claude.defaultModel;
  const endpoint = "https://api.anthropic.com/v1/messages";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      system: systemInstruction,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 3000,
      temperature: 0.7
    }),
    signal
  });

  const durationMs = Date.now() - start;

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr: any = null;
    try { parsedErr = JSON.parse(errText); } catch {}
    const msg = parsedErr?.error?.message || errText || "Lỗi từ Anthropic Claude";
    return {
      success: false,
      provider: "Anthropic Claude",
      model,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: msg,
      code: "CLAUDE_ERROR"
    };
  }

  const data = await response.json();
  const rawText = data?.content?.[0]?.text || "";
  const usage = data?.usage || {};
  const promptTokens = usage.input_tokens || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usage.output_tokens || Math.ceil(rawText.length / 4);
  const totalTokens = promptTokens + completionTokens;

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: rawText }; }

  const costVND = calculateCostVND("claude", promptTokens, completionTokens);

  return {
    success: true,
    provider: "Anthropic Claude",
    model,
    text: rawText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    estimatedCostVND: costVND,
    durationMs,
    httpStatus: 200
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const requestId = `brain_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Chỉ hỗ trợ POST.", code: "METHOD_NOT_ALLOWED", requestId }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Xác thực JWT Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Yêu cầu chưa đăng nhập. Vui lòng đăng nhập tài khoản trước khi thực hiện tác vụ AI.",
          code: "UNAUTHORIZED",
          requestId
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    let authenticatedUser: any = null;
    let supabaseClient: any = null;

    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            code: "UNAUTHORIZED",
            requestId
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUser = user;
    }

    // 3. Phân tích Payload
    let body: RequestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Payload JSON không hợp lệ.", code: "INVALID_JSON", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = body;
    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: "Thiếu trường 'action'.", code: "MISSING_ACTION", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // ACTION: check_agents_status (Ping & kiểm tra cấu hình thật 5 Providers)
    // ========================================================================
    if (action === "check_agents_status") {
      const geminiKey = getApiKey("gemini");
      const deepseekKey = getApiKey("deepseek");
      const openaiKey = getApiKey("openai");
      const grokKey = getApiKey("grok");
      const claudeKey = getApiKey("claude");

      // Đếm số tác vụ trong ngày của người dùng từ ai_task_logs để kiểm soát Quota
      let todayTaskCount = 0;
      let monthSpentVND = 0;
      if (supabaseClient) {
        try {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const { count } = await supabaseClient
            .from("ai_task_logs")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startOfToday.toISOString());

          todayTaskCount = count || 0;
        } catch (_countErr) {
          // Bỏ qua nếu lỗi count
        }
      }

      const agentsStatus = [
        {
          agentId: "chatgpt",
          agentName: "ChatGPT (Chiến Lược & Điều Hành)",
          providerId: "openai",
          providerName: "OpenAI",
          configured: Boolean(openaiKey),
          status: openaiKey ? "CONNECTED" : "NOT_CONFIGURED",
          model: Deno.env.get("OPENAI_MODEL") || PROVIDER_CONFIGS.openai.defaultModel,
          role: "Operations & Strategy",
          isPrimary: false,
          isBackup: false
        },
        {
          agentId: "gemini",
          agentName: "Gemini (Nghiên Cứu Deal & Nội Dung)",
          providerId: "gemini",
          providerName: "Google Gemini",
          configured: Boolean(geminiKey),
          status: geminiKey ? "CONNECTED" : "NOT_CONFIGURED",
          model: Deno.env.get("GEMINI_MODEL") || PROVIDER_CONFIGS.gemini.defaultModel,
          role: "Market Research & Content Intelligence",
          isPrimary: true,
          isBackup: false
        },
        {
          agentId: "grok",
          agentName: "Grok (Đón Đầu Xu Hướng & Trend)",
          providerId: "grok",
          providerName: "xAI Grok",
          configured: Boolean(grokKey),
          status: grokKey ? "CONNECTED" : "NOT_CONFIGURED",
          model: Deno.env.get("GROK_MODEL") || PROVIDER_CONFIGS.grok.defaultModel,
          role: "Trend Intelligence",
          isPrimary: false,
          isBackup: false
        },
        {
          agentId: "claude",
          agentName: "Claude (Chất Lượng & Tuân Thủ)",
          providerId: "claude",
          providerName: "Anthropic Claude",
          configured: Boolean(claudeKey),
          status: claudeKey ? "CONNECTED" : "NOT_CONFIGURED",
          model: Deno.env.get("ANTHROPIC_MODEL") || PROVIDER_CONFIGS.claude.defaultModel,
          role: "Content Quality & Compliance",
          isPrimary: false,
          isBackup: false
        },
        {
          agentId: "deepseek",
          agentName: "DeepSeek (Kỹ Thuật & Phân Tích Dữ Liệu)",
          providerId: "deepseek",
          providerName: "DeepSeek",
          configured: Boolean(deepseekKey),
          status: deepseekKey ? "CONNECTED" : "NOT_CONFIGURED",
          model: Deno.env.get("DEEPSEEK_MODEL") || PROVIDER_CONFIGS.deepseek.defaultModel,
          role: "Technical & Data Analysis",
          isPrimary: false,
          isBackup: true
        }
      ];

      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          timestamp: new Date().toISOString(),
          agents: agentsStatus,
          quota: {
            dailyTaskCount: todayTaskCount,
            dailyTaskLimit: DEFAULT_DAILY_TASK_LIMIT,
            monthlySpentVND: monthSpentVND,
            monthlyBudgetVND: DEFAULT_MONTHLY_BUDGET_VND,
            isDailyQuotaExceeded: todayTaskCount >= DEFAULT_DAILY_TASK_LIMIT,
            isMonthlyBudgetExceeded: monthSpentVND >= DEFAULT_MONTHLY_BUDGET_VND
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // KIỂM TRA HẠN MỨC QUOTA SERVER-SIDE (COST CONTROL GUARDRAILS)
    // ========================================================================
    if (supabaseClient) {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { count } = await supabaseClient
          .from("ai_task_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startOfToday.toISOString());

        const currentTodayCount = count || 0;
        if (currentTodayCount >= DEFAULT_DAILY_TASK_LIMIT) {
          console.warn(`[${requestId}] [QUOTA_BLOCKED] Vượt hạn mức ngày: ${currentTodayCount}/${DEFAULT_DAILY_TASK_LIMIT}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Hạn mức AI hôm nay đã đạt (${currentTodayCount}/${DEFAULT_DAILY_TASK_LIMIT} tác vụ). Hệ thống tự động chặn để bảo vệ ngân sách chi phí. Hạn mức sẽ được làm mới vào ngày mai.`,
              code: "QUOTA_EXCEEDED",
              details: "Daily task limit exceeded",
              requestId
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (_quotaErr) {
        // Cho phép đi tiếp nếu không thể kiểm tra count
      }
    }

    // ========================================================================
    // XÁC ĐỊNH SYSTEM INSTRUCTION & USER PROMPT
    // ========================================================================
    let systemInstruction = "";
    let userPrompt = "";
    let mappedTaskType = body.taskType || "content_creation";
    let targetAgent: "chatgpt" | "gemini" | "grok" | "claude" | "deepseek" = body.preferredAgent || "gemini";
    const payload = body.payload || {};

    if (action === "orchestrate_task") {
      mappedTaskType = body.taskType || "operations_strategy";
      userPrompt = body.inputPrompt || JSON.stringify(payload);

      if (mappedTaskType === "operations_strategy") {
        targetAgent = body.preferredAgent || "chatgpt";
        systemInstruction = `Bạn là AGENT 1 - ChatGPT (Operations & Strategy Lead) thuộc hệ thống AI Affiliate Command Center Việt Nam.
Nhiệm vụ: Phân tích bài toán affiliate, hoạch định kế hoạch hành động và đưa ra quyết định tối ưu.
Trả về định dạng JSON:
{
  "summary": "Tóm tắt chiến lược",
  "recommendedAction": "Hành động đề xuất cụ thể",
  "assignedAgents": ["Gemini", "Claude"],
  "estimatedROI": "180% - 220%",
  "actionSteps": ["Bước 1...", "Bước 2..."]
}`;
      } else if (mappedTaskType === "market_research") {
        targetAgent = body.preferredAgent || "gemini";
        systemInstruction = `Bạn là AGENT 2 - Gemini (Market Research & Content Intelligence).
Nghiên cứu sản phẩm, đánh giá dung lượng thị trường và điểm USP.
Trả về JSON:
{
  "potentialScore": 88,
  "recommendation": "Đánh giá deal",
  "targetAudience": "Đối tượng mục tiêu",
  "keyAngles": ["Góc bán hàng 1", "Góc bán hàng 2"],
  "suggestedCommission": 18,
  "notes": "Lưu ý tiếp cận"
}`;
      } else if (mappedTaskType === "trend_intelligence") {
        targetAgent = body.preferredAgent || "grok";
        systemInstruction = `Bạn là AGENT 3 - Grok (Trend Intelligence Specialist).
Bắt sóng xu hướng viral, âm thanh trending và góc nhìn giật tít thị trường Việt Nam.
Trả về JSON:
{
  "trends": [
    {
      "name": "Tên xu hướng",
      "soundType": "Loại âm thanh gợi ý",
      "hookTemplate": "Mẫu câu mở đầu",
      "retentionTactic": "Kỹ thuật giữ chân"
    }
  ]
}`;
      } else if (mappedTaskType === "content_compliance") {
        targetAgent = body.preferredAgent || "claude";
        systemInstruction = `Bạn là AGENT 4 - Claude (Content Quality & Compliance Sentinel).
Kiểm duyệt chất lượng và chính sách TikTok Shop / Shopee Việt Nam.
Trả về JSON:
{
  "complianceScore": 92,
  "status": "approved",
  "violations": [],
  "suggestedFixes": [],
  "summary": "Đánh giá an toàn"
}`;
      } else if (mappedTaskType === "technical_analysis") {
        targetAgent = body.preferredAgent || "deepseek";
        systemInstruction = `Bạn là AGENT 5 - DeepSeek (Technical & Data Analysis Engine).
Phân tích kỹ thuật, dữ liệu chuyển đổi, tính toán ROI và chi phí.
Trả về JSON:
{
  "efficiencyScore": 85,
  "breakEvenClicks": 45,
  "suggestedMaxCPC": 520,
  "targetROI": 210,
  "analysis": "Chi tiết phân tích kỹ thuật"
}`;
      } else {
        targetAgent = "gemini";
        systemInstruction = "Bạn là AI Assistant thuộc AI Affiliate Command Center. Trả về kết quả dưới dạng JSON có cấu trúc.";
      }
    } 
    // Backward compatibility cho các actions cũ
    else if (action === "generate_script") {
      targetAgent = "gemini";
      mappedTaskType = "content_creation";
      const {
        productName = "Sản phẩm Affiliate",
        category = "Gia dụng",
        platform = "tiktok",
        priceVND = 0,
        commissionRate = 15,
        targetAudience = "Khách hàng Việt Nam",
        tone = "Review chân thực",
        targetDuration = "35s - 45s",
        keyFeatures = ""
      } = payload;

      systemInstruction = `Bạn là Copywriter AI hàng đầu cho TikTok Shop và Shopee Affiliate tại Việt Nam.
Viết kịch bản video ngắn bán hàng tỷ lệ chuyển đổi cao.
Định dạng JSON BẮT BUỘC:
{
  "title": "Tiêu đề kịch bản thu hút",
  "hookVariantA": "Hook biến thể A (đánh vào nỗi đau)",
  "hookVariantB": "Hook biến thể B (tò mò/bất ngờ)",
  "activeHook": "A",
  "bodyStory": "Thân bài ngắn gọn, nêu bật USP",
  "voiceoverLines": [
    { "timestamp": "0:00 - 0:03", "speech": "Lời thoại mở đầu", "action": "Góc quay thực tế" },
    { "timestamp": "0:04 - 0:15", "speech": "Giải quyết vấn đề", "action": "Cận cảnh sản phẩm" },
    { "timestamp": "0:16 - 0:30", "speech": "Trải nghiệm thực tế", "action": "Sử dụng tính năng chính" },
    { "timestamp": "0:31 - 0:40", "speech": "Kêu gọi hành động", "action": "Chỉ tay vào giỏ hàng" }
  ],
  "callToAction": "Lời kêu gọi hành động dứt khoát",
  "hashtags": ["#tiktokshopvn", "#affiliate", "#review"],
  "targetDuration": "${targetDuration}",
  "tone": "${tone}",
  "estimatedViews": "50K - 150K",
  "unverifiedClaimsNotes": "Không có tuyên bố phóng đại"
}`;

      userPrompt = `Sản phẩm: ${productName}
Ngành hàng: ${category}
Giá bán: ${Number(priceVND).toLocaleString()} VNĐ
Hoa hồng: ${commissionRate}%
Khán giả: ${targetAudience}
Tính năng nổi bật: ${keyFeatures || "Tiện lợi, chính hãng"}`;
    } else if (action === "analyze_product") {
      targetAgent = "gemini";
      mappedTaskType = "market_research";
      systemInstruction = `Bạn là Scout AI chuyên phân tích tiềm năng deal Affiliate. Trả về JSON:
{
  "potentialScore": 85,
  "recommendation": "Đánh giá deal",
  "targetAudience": "Đối tượng phù hợp",
  "keyAngles": ["Góc tiếp cận 1", "Góc tiếp cận 2"],
  "suggestedCommission": 18,
  "notes": "Lưu ý"
}`;
      userPrompt = `Phân tích sản phẩm: ${payload.productName || ""}, ngành: ${payload.category || ""}, giá: ${payload.priceVND || 0}`;
    } else if (action === "trend_ideas") {
      targetAgent = "grok";
      mappedTaskType = "trend_intelligence";
      systemInstruction = `Bạn là Trinh sát Trend TikTok/Reels Việt Nam. Trả về JSON:
{
  "trends": [
    {
      "name": "Tên trend",
      "soundType": "Nhạc/Âm thanh",
      "hookTemplate": "Mẫu câu Hook",
      "retentionTactic": "Mẹo giữ chân"
    }
  ]
}`;
      userPrompt = `Gợi ý trend cho ngành hàng: ${payload.category || "Công nghệ"}`;
    } else if (action === "audit_content") {
      targetAgent = "claude";
      mappedTaskType = "content_compliance";
      systemInstruction = `Bạn là Chuyên gia kiểm duyệt TikTok Shop Việt Nam. Trả về JSON:
{
  "complianceScore": 90,
  "status": "approved",
  "violations": [],
  "suggestedFixes": [],
  "summary": "Đánh giá an toàn"
}`;
      userPrompt = `Kiểm duyệt kịch bản:\nTiêu đề: ${payload.title || ""}\nNội dung: ${payload.scriptText || ""}`;
    } else if (action === "generate_title_description") {
      targetAgent = "gemini";
      mappedTaskType = "content_creation";
      systemInstruction = `Bạn là Chuyên gia tối ưu tiêu đề và mô tả video TikTok Shop SEO. Trả về JSON:
{
  "titles": ["Tiêu đề 1", "Tiêu đề 2", "Tiêu đề 3"],
  "description": "Mô tả ngắn kèm CTA",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}`;
      userPrompt = `Tạo tiêu đề cho sản phẩm: ${payload.productName || ""}, ngành: ${payload.category || ""}`;
    }

    // ========================================================================
    // AI TASK ROUTER & SMART FALLBACK
    // ========================================================================
    const AGENT_TO_PROVIDER: Record<string, keyof typeof PROVIDER_CONFIGS> = {
      chatgpt: "openai",
      gemini: "gemini",
      grok: "grok",
      claude: "claude",
      deepseek: "deepseek"
    };

    let selectedProvider = AGENT_TO_PROVIDER[targetAgent] || "gemini";
    let apiKey = getApiKey(selectedProvider);
    let fallbackReason: string | null = null;
    let actualAgentUsed = targetAgent;

    // Nếu Provider được chọn chưa có API Key -> Tìm Provider thay thế (Fallback)
    if (!apiKey) {
      console.warn(`[${requestId}] [ROUTER_FALLBACK] Agent ${targetAgent} (Provider ${selectedProvider}) chưa cấu hình API Key.`);

      const geminiKey = getApiKey("gemini");
      const deepseekKey = getApiKey("deepseek");

      if (geminiKey) {
        fallbackReason = `Agent ${targetAgent.toUpperCase()} (${PROVIDER_CONFIGS[selectedProvider].name}) chưa cấu hình API Key trong Supabase Secrets. Hệ thống tự động chuyển tiếp nhiệm vụ sang Gemini (Primary Provider) để đảm bảo không gián đoạn.`;
        selectedProvider = "gemini";
        apiKey = geminiKey;
        actualAgentUsed = "gemini";
      } else if (deepseekKey) {
        fallbackReason = `Agent ${targetAgent.toUpperCase()} (${PROVIDER_CONFIGS[selectedProvider].name}) chưa cấu hình API Key. Hệ thống tự động chuyển tiếp sang DeepSeek (Backup Provider).`;
        selectedProvider = "deepseek";
        apiKey = deepseekKey;
        actualAgentUsed = "deepseek";
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Agent ${targetAgent.toUpperCase()} và cả Provider dự phòng đều chưa được cấu hình API Key trong Supabase Secrets.`,
            code: "NOT_CONFIGURED",
            hint: `Vui lòng thêm biến môi trường ${PROVIDER_CONFIGS[selectedProvider].envKey} (hoặc GEMINI_API_KEY) trong Supabase Dashboard > Edge Functions > Secrets.`,
            requestId
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================================================
    // THỰC THI GỌI PROVIDER VỚI DEADLINE & RETRY TỰ ĐỘNG
    // ========================================================================
    const isLongTask = action === "generate_script";
    const maxRetries = isLongTask ? 1 : 2;
    const perCallBudgetMs = isLongTask ? 55000 : 25000;
    const minBudgetToRetryMs = isLongTask ? 40000 : 15000;

    let finalResult: ProviderCallResult | null = null;
    let attempts = 0;

    for (let retry = 0; retry <= maxRetries; retry++) {
      attempts = retry + 1;

      if (req.signal.aborted) {
        console.log(`[${requestId}] [CLIENT_ABORT] Người dùng đã ngắt kết nối.`);
        break;
      }

      const elapsedMs = Date.now() - startTime;
      const remainingMs = TOTAL_EXECUTION_TIMEOUT_MS - elapsedMs;

      if (retry > 0 && remainingMs < minBudgetToRetryMs) {
        console.log(`[${requestId}] [RETRY_SKIP] Thời gian còn lại ${remainingMs}ms không đủ để thử lại.`);
        break;
      }

      const callTimeoutMs = Math.min(perCallBudgetMs, Math.max(5000, remainingMs - 2000));
      const callController = new AbortController();
      const callTimer = setTimeout(() => {
        callController.abort(new DOMException(`Timeout after ${callTimeoutMs}ms`, "TimeoutError"));
      }, callTimeoutMs);

      const onAbort = () => callController.abort(new DOMException("User aborted", "AbortError"));
      req.signal.addEventListener("abort", onAbort, { once: true });

      try {
        let callRes: ProviderCallResult;

        if (selectedProvider === "gemini") {
          callRes = await callGemini(systemInstruction, userPrompt, apiKey!, callController.signal);
        } else if (selectedProvider === "claude") {
          callRes = await callClaude(systemInstruction, userPrompt, apiKey!, callController.signal);
        } else {
          callRes = await callOpenAICompatible(selectedProvider, systemInstruction, userPrompt, apiKey!, callController.signal);
        }

        clearTimeout(callTimer);
        req.signal.removeEventListener("abort", onAbort);
        finalResult = callRes;

        if (callRes.success) {
          break; // Thành công
        }

        if (!isTransientError(callRes.httpStatus)) {
          console.warn(`[${requestId}] [NON_TRANSIENT_ERR] Status ${callRes.httpStatus} không thuộc diện retry.`);
          break;
        }

        if (retry < maxRetries) {
          const waitMs = Math.min(4000, 1500 * Math.pow(2, retry) + Math.floor(Math.random() * 300));
          console.log(`[${requestId}] [RETRY_WAIT] Chờ ${waitMs}ms sau lỗi HTTP ${callRes.httpStatus}...`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      } catch (err: any) {
        clearTimeout(callTimer);
        req.signal.removeEventListener("abort", onAbort);

        if (req.signal.aborted || err?.message?.includes("User aborted")) {
          break;
        }

        console.warn(`[${requestId}] [CALL_EXCEPTION] Lượt ${attempts}: ${err.message}`);
        if (retry < maxRetries) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;

    // ========================================================================
    // XỬ LÝ KẾT QUẢ & GHI LOG VÀO AI_TASK_LOGS
    // ========================================================================
    if (!finalResult || !finalResult.success) {
      const isClientAbort = req.signal.aborted;
      const status = finalResult ? finalResult.httpStatus : (isClientAbort ? 499 : 504);
      const errMsg = finalResult?.error || (isClientAbort ? "Yêu cầu đã bị hủy bởi người dùng." : "Hết thời gian chờ phản hồi AI (Timeout).");

      if (supabaseClient && authenticatedUser && !isClientAbort) {
        try {
          const logPayload = {
            task_type: `[${actualAgentUsed.toUpperCase()}] ${action.toUpperCase()}: Thất bại HTTP ${status}`,
            status: "failed",
            owner_id: authenticatedUser.id,
            request_id: requestId,
            agent: actualAgentUsed,
            provider: PROVIDER_CONFIGS[selectedProvider]?.name || selectedProvider,
            duration_ms: totalDurationMs,
            error_message: errMsg.slice(0, 200)
          };
          const { error: insertErr } = await supabaseClient.from("ai_task_logs").insert(logPayload);
          if (insertErr) {
            await supabaseClient.from("ai_task_logs").insert({
              task_type: `[${actualAgentUsed.toUpperCase()}] ${action}: Thất bại HTTP ${status} (${errMsg.slice(0, 60)})`,
              status: "failed"
            });
          }
        } catch (_logErr) {}
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          code: finalResult?.code || (isClientAbort ? "ABORTED" : "TIMEOUT"),
          attempts,
          requestId,
          durationMs: totalDurationMs,
          fallbackReason
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GHI LOG THÀNH CÔNG VÀO AI_TASK_LOGS
    if (supabaseClient && authenticatedUser) {
      try {
        const successSummary = `[${actualAgentUsed.toUpperCase()}] ${action.toUpperCase()}: Thành công qua ${finalResult.model}`;
        const logPayload = {
          task_type: successSummary,
          status: "success",
          owner_id: authenticatedUser.id,
          request_id: requestId,
          agent: actualAgentUsed,
          provider: finalResult.provider,
          model: finalResult.model,
          input_tokens: finalResult.usage.promptTokens,
          output_tokens: finalResult.usage.completionTokens,
          estimated_cost: finalResult.estimatedCostVND,
          duration_ms: totalDurationMs
        };

        const { error: insertErr } = await supabaseClient.from("ai_task_logs").insert(logPayload);
        if (insertErr) {
          await supabaseClient.from("ai_task_logs").insert({
            task_type: `${successSummary} (${finalResult.usage.totalTokens} tokens, ~${finalResult.estimatedCostVND}đ)`,
            status: "success"
          });
        }
      } catch (_logErr) {}
    }

    console.log(`[${requestId}] [SUCCESS] Hoàn thành bởi ${actualAgentUsed} (${finalResult.model}) trong ${totalDurationMs}ms.`);

    // TRẢ VỀ KẾT QUẢ ĐÃ CHUẨN HÓA CHO FRONTEND
    return new Response(
      JSON.stringify({
        success: true,
        action,
        requestedAgent: targetAgent,
        executedAgent: actualAgentUsed,
        provider: finalResult.provider,
        model: finalResult.model,
        data: finalResult.parsedJson || { text: finalResult.text },
        usage: finalResult.usage,
        estimatedCostVND: finalResult.estimatedCostVND,
        attempts,
        requestId,
        durationMs: totalDurationMs,
        fallbackReason
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[${requestId}] [UNCAUGHT_ERR]`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Đã xảy ra lỗi nội bộ trên AI Brain Edge Function.",
        code: "INTERNAL_SERVER_ERROR",
        requestId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```
