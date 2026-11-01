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

// ============================================================================
// BẢNG GIÁ & METADATA CHÍNH THỨC CỦA TỪNG PROVIDER
// Nguồn: Tài liệu chính thức Google AI Studio, OpenAI, DeepSeek, Anthropic, xAI
// Ngày cập nhật kiểm định: 01/11/2025
// ============================================================================
const PRICING_METADATA = {
  version: "2025-Q4-AUDITED",
  updatedDate: "2025-11-01",
  currency: "VND",
  usdToVndRate: 25400 // Tỷ giá quy đổi tham chiếu
};

const PROVIDER_CONFIGS = {
  gemini: {
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    pricingSource: "Google AI Studio Official Pricing (gemini-2.5-flash)",
    costPer1MPromptUSD: 0.075,
    costPer1MCompletionUSD: 0.30
  },
  deepseek: {
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    pricingSource: "DeepSeek API Official Pricing (deepseek-chat V3)",
    costPer1MPromptUSD: 0.14,
    costPer1MCompletionUSD: 0.28
  },
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    pricingSource: "OpenAI Pricing (gpt-4o-mini)",
    costPer1MPromptUSD: 0.15,
    costPer1MCompletionUSD: 0.60
  },
  grok: {
    name: "xAI Grok",
    defaultModel: "grok-beta",
    envKey: "GROK_API_KEY",
    modelEnv: "GROK_MODEL",
    pricingSource: "xAI Developer Pricing (grok-beta)",
    costPer1MPromptUSD: 5.00,
    costPer1MCompletionUSD: 15.00
  },
  claude: {
    name: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-20241022",
    envKey: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    pricingSource: "Anthropic Pricing (claude-3-5-sonnet)",
    costPer1MPromptUSD: 3.00,
    costPer1MCompletionUSD: 15.00
  }
};

// Giới hạn an toàn & Deadline hệ thống
const TOTAL_EXECUTION_TIMEOUT_MS = 120000; // 120s (dưới 150s gateway timeout)
const MAX_PAYLOAD_LENGTH = 5000;
const MAX_OUTPUT_TOKENS_LIMIT = 10000;

// Giới hạn ngân sách mặc định (Server-side enforced)
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
  costStatus: "actual" | "estimated" | "unknown";
  actualCostVND: number | null;
  estimatedCostVND: number;
  durationMs: number;
  httpStatus: number;
  error?: string;
  code?: string;
}

function isTransientError(status: number): boolean {
  return status === 503 || status === 502 || status === 500 || status === 429 || status === 408;
}

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "";
  // Xóa sạch API keys, Bearer tokens, URL credentials khỏi nội dung lỗi
  return msg
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/gi, "[REDACTED_API_KEY]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/gi, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer [REDACTED_TOKEN]")
    .slice(0, 250);
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

/**
 * Tính toán chi phí chính xác theo bảng giá chính thức và tỷ giá quy đổi
 */
function calculateCost(
  provider: keyof typeof PROVIDER_CONFIGS, 
  promptTokens: number, 
  completionTokens: number,
  isExactUsage: boolean
): { costStatus: "actual" | "estimated" | "unknown"; actualCostVND: number | null; estimatedCostVND: number } {
  const cfg = PROVIDER_CONFIGS[provider];
  if (!cfg || promptTokens <= 0 && completionTokens <= 0) {
    return { costStatus: "unknown", actualCostVND: null, estimatedCostVND: 0 };
  }

  const promptCostUSD = (promptTokens / 1000000) * cfg.costPer1MPromptUSD;
  const completionCostUSD = (completionTokens / 1000000) * cfg.costPer1MCompletionUSD;
  const totalCostUSD = promptCostUSD + completionCostUSD;
  const costVND = Math.max(1, Math.round(totalCostUSD * PRICING_METADATA.usdToVndRate));

  if (isExactUsage) {
    return {
      costStatus: "actual",
      actualCostVND: costVND,
      estimatedCostVND: costVND
    };
  } else {
    return {
      costStatus: "estimated",
      actualCostVND: null, // Không ghi estimated thành actual
      estimatedCostVND: costVND
    };
  }
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
    const rawMsg = parsedErr?.error?.message || errText || "Lỗi khi gọi Gemini API";
    return {
      success: false,
      provider: "Google Gemini",
      model,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costStatus: "unknown",
      actualCostVND: null,
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: sanitizeErrorMessage(rawMsg),
      code: response.status === 429 ? "RATE_LIMIT_EXCEEDED" : response.status === 503 ? "SERVICE_UNAVAILABLE" : "GEMINI_ERROR"
    };
  }

  const data = await response.json();
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usageMeta = data?.usageMetadata || {};

  const isExactUsage = Boolean(usageMeta.promptTokenCount && usageMeta.candidatesTokenCount);
  const promptTokens = usageMeta.promptTokenCount || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usageMeta.candidatesTokenCount || Math.ceil(candidateText.length / 4);
  const totalTokens = usageMeta.totalTokenCount || (promptTokens + completionTokens);

  let cleaned = candidateText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: candidateText }; }

  const costResult = calculateCost("gemini", promptTokens, completionTokens, isExactUsage);

  return {
    success: true,
    provider: "Google Gemini",
    model,
    text: candidateText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    costStatus: costResult.costStatus,
    actualCostVND: costResult.actualCostVND,
    estimatedCostVND: costResult.estimatedCostVND,
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
    const rawMsg = parsedErr?.error?.message || errText || `Lỗi từ ${provider.toUpperCase()}`;
    return {
      success: false,
      provider: PROVIDER_CONFIGS[provider].name,
      model: defaultModel,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costStatus: "unknown",
      actualCostVND: null,
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: sanitizeErrorMessage(rawMsg),
      code: `${provider.toUpperCase()}_ERROR`
    };
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};
  const isExactUsage = Boolean(usage.prompt_tokens && usage.completion_tokens);
  const promptTokens = usage.prompt_tokens || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usage.completion_tokens || Math.ceil(rawText.length / 4);
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: rawText }; }

  const costResult = calculateCost(provider, promptTokens, completionTokens, isExactUsage);

  return {
    success: true,
    provider: PROVIDER_CONFIGS[provider].name,
    model: defaultModel,
    text: rawText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    costStatus: costResult.costStatus,
    actualCostVND: costResult.actualCostVND,
    estimatedCostVND: costResult.estimatedCostVND,
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
    const rawMsg = parsedErr?.error?.message || errText || "Lỗi từ Anthropic Claude";
    return {
      success: false,
      provider: "Anthropic Claude",
      model,
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costStatus: "unknown",
      actualCostVND: null,
      estimatedCostVND: 0,
      durationMs,
      httpStatus: response.status,
      error: sanitizeErrorMessage(rawMsg),
      code: "CLAUDE_ERROR"
    };
  }

  const data = await response.json();
  const rawText = data?.content?.[0]?.text || "";
  const usage = data?.usage || {};
  const isExactUsage = Boolean(usage.input_tokens && usage.output_tokens);
  const promptTokens = usage.input_tokens || Math.ceil((userPrompt.length + systemInstruction.length) / 4);
  const completionTokens = usage.output_tokens || Math.ceil(rawText.length / 4);
  const totalTokens = promptTokens + completionTokens;

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  let parsedJson: any = null;
  try { parsedJson = JSON.parse(cleaned); } catch { parsedJson = { text: rawText }; }

  const costResult = calculateCost("claude", promptTokens, completionTokens, isExactUsage);

  return {
    success: true,
    provider: "Anthropic Claude",
    model,
    text: rawText,
    parsedJson,
    usage: { promptTokens, completionTokens, totalTokens },
    costStatus: costResult.costStatus,
    actualCostVND: costResult.actualCostVND,
    estimatedCostVND: costResult.estimatedCostVND,
    durationMs,
    httpStatus: 200
  };
}

// ============================================================================
// MAIN Deno.serve HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

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

    // 3. Phân tích Payload JSON
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

      let todayTaskCount = 0;
      let monthSpentVND = 0;

      if (supabaseClient && authenticatedUser) {
        try {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const { count } = await supabaseClient
            .from("ai_task_logs")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", authenticatedUser.id)
            .gte("created_at", startOfToday.toISOString())
            .in("status", ["success", "running", "reserved"]);

          todayTaskCount = count || 0;

          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { data: monthRows } = await supabaseClient
            .from("ai_task_logs")
            .select("actual_cost, estimated_cost")
            .eq("owner_id", authenticatedUser.id)
            .eq("status", "success")
            .gte("created_at", startOfMonth.toISOString());

          if (monthRows && monthRows.length > 0) {
            monthSpentVND = monthRows.reduce((acc: number, r: any) => {
              const cost = Number(r.actual_cost ?? r.estimated_cost ?? 0);
              return acc + (isNaN(cost) ? 0 : cost);
            }, 0);
          }
        } catch (_countErr) {}
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
          pricingMetadata: PRICING_METADATA,
          agents: agentsStatus,
          quota: {
            dailyTaskCount: todayTaskCount,
            dailyTaskLimit: DEFAULT_DAILY_TASK_LIMIT,
            monthlySpentVND: Math.round(monthSpentVND),
            monthlyBudgetVND: DEFAULT_MONTHLY_BUDGET_VND,
            isDailyQuotaExceeded: todayTaskCount >= DEFAULT_DAILY_TASK_LIMIT,
            isMonthlyBudgetExceeded: monthSpentVND >= DEFAULT_MONTHLY_BUDGET_VND
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 4. ATOMIC QUOTA RESERVATION (CHỐNG RACE CONDITION SERVER-SIDE)
    // ========================================================================
    let hasAtomicReservation = false;

    if (supabaseClient && authenticatedUser) {
      try {
        // Cố gắng gọi hàm PostgreSQL RPC 'reserve_ai_quota' nguyên tử có xact lock
        const { data: rpcResult, error: rpcError } = await supabaseClient.rpc("reserve_ai_quota", {
          p_owner_id: authenticatedUser.id,
          p_request_id: requestId,
          p_daily_limit: DEFAULT_DAILY_TASK_LIMIT,
          p_monthly_budget_vnd: DEFAULT_MONTHLY_BUDGET_VND
        });

        if (!rpcError && rpcResult) {
          if (!rpcResult.allowed) {
            console.warn(`[${requestId}] [RPC_QUOTA_BLOCKED] ${rpcResult.code}: ${rpcResult.error}`);
            return new Response(
              JSON.stringify({
                success: false,
                error: rpcResult.error || "Hạn mức tác vụ hoặc ngân sách đã đạt giới hạn.",
                code: rpcResult.code || "QUOTA_EXCEEDED",
                requestId
              }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          hasAtomicReservation = true;
          console.log(`[${requestId}] [ATOMIC_RESERVED] Giữ chỗ thành công qua RPC. Task hôm nay: ${rpcResult.daily_count}/${DEFAULT_DAILY_TASK_LIMIT}`);
        } else {
          // Fallback nếu function RPC chưa được chạy migration trong DB
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const { count } = await supabaseClient
            .from("ai_task_logs")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", authenticatedUser.id)
            .gte("created_at", startOfToday.toISOString())
            .in("status", ["success", "running", "reserved"]);

          const currentTodayCount = count || 0;
          if (currentTodayCount >= DEFAULT_DAILY_TASK_LIMIT) {
            console.warn(`[${requestId}] [FALLBACK_QUOTA_BLOCKED] Hạn mức ngày: ${currentTodayCount}/${DEFAULT_DAILY_TASK_LIMIT}`);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Hạn mức AI hôm nay đã đạt (${currentTodayCount}/${DEFAULT_DAILY_TASK_LIMIT} tác vụ). Hệ thống tự động chặn để bảo vệ ngân sách chi phí.`,
                code: "QUOTA_EXCEEDED",
                requestId
              }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (_reserveErr) {
        // Cho phép xử lý tiếp nếu lỗi kết nối DB tạm thời
      }
    }

    // ========================================================================
    // 5. XÁC ĐỊNH SYSTEM INSTRUCTION & USER PROMPT
    // ========================================================================
    let systemInstruction = "";
    let userPrompt = "";
    let mappedTaskType = body.taskType || "content_creation";
    const requestedAgent: "chatgpt" | "gemini" | "grok" | "claude" | "deepseek" = body.preferredAgent || "gemini";
    let targetAgent = requestedAgent;
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
        systemInstruction = "Bạn là AI Assistant thuộc AI Affiliate Command Center. Trả về JSON.";
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
    } else if (action === "analyze_product" || action === "analyze_product_intelligence") {
      targetAgent = "gemini";
      mappedTaskType = "market_research";
      const {
        productName = "Sản phẩm Affiliate",
        category = "Công nghệ",
        priceVND = 350000,
        originalPriceVND = 0,
        commissionRate = 15,
        platform = "tiktok",
        description = "",
        usp = "",
        soldCount = 0,
        rating = 5.0,
        competitors = []
      } = payload;

      systemInstruction = `Bạn là Senior AI Product Intelligence Specialist & Affiliate Strategist tại thị trường Việt Nam (thuộc AI Affiliate Command Center).
Nhiệm vụ: Phân tích khách quan sản phẩm affiliate dựa trên dữ liệu thật đầu vào.
QUY TẮC BẮT BUỘC:
1. KHÔNG tự tạo ra số liệu bán giả, rating giả hoặc doanh thu giả.
2. Dữ liệu suy luận phải được gán "inferenceType": "AI_INFERENCE".
3. Phân biệt rõ doanh thu bán hàng (GMV) với thu nhập hoa hồng thực nhận của Affiliate.
4. Chấm điểm cơ hội sản phẩm từ 0-100 với 6 tiêu chí trọng số:
   - affiliateCommission (Tối đa 20 điểm)
   - marketDemand (Tối đa 20 điểm)
   - tiktokContentPotential (Tối đa 20 điểm)
   - competition (Tối đa 15 điểm)
   - priceConversion (Tối đa 15 điểm)
   - dataReliability (Tối đa 10 điểm)
5. Phân loại tier:
   - 80-100: "HIGH OPPORTUNITY"
   - 65-79: "POTENTIAL"
   - 50-64: "NEEDS RESEARCH"
   - 0-49: "LOW PRIORITY"
6. Bắt buộc có chú thích: "AI-generated assessment, not guaranteed sales performance."

Trả về ĐÚNG định dạng JSON sau:
{
  "opportunityScore": 85,
  "tier": "HIGH OPPORTUNITY",
  "scoreBreakdown": {
    "affiliateCommission": { "score": 18, "maxScore": 20, "explanation": "Lý do điểm...", "reliability": "HIGH" },
    "marketDemand": { "score": 17, "maxScore": 20, "explanation": "Lý do điểm...", "reliability": "MEDIUM" },
    "tiktokContentPotential": { "score": 18, "maxScore": 20, "explanation": "Lý do điểm...", "reliability": "HIGH" },
    "competition": { "score": 12, "maxScore": 15, "explanation": "Lý do điểm...", "reliability": "MEDIUM" },
    "priceConversion": { "score": 14, "maxScore": 15, "explanation": "Lý do điểm...", "reliability": "HIGH" },
    "dataReliability": { "score": 6, "maxScore": 10, "explanation": "Lý do điểm...", "reliability": "MEDIUM" }
  },
  "targetAudience": "Mô tả chi tiết nhóm đối tượng khách hàng mục tiêu",
  "solvedNeeds": "Vấn đề hoặc nhu cầu thực tế sản phẩm giải quyết",
  "extractedUSPs": ["USP 1", "USP 2", "USP 3"],
  "pros": ["Ưu điểm 1", "Ưu điểm 2"],
  "cons": ["Nhược điểm 1", "Nhược điểm 2"],
  "risks": ["Rủi ro 1", "Rủi ro 2"],
  "contentAngles": ["Góc tiếp cận 1", "Góc tiếp cận 2", "Góc tiếp cận 3"],
  "commissionAnalysis": {
    "expectedCommissionVND": 52500,
    "discountPct": 15,
    "commissionRate": 15,
    "marginNote": "Thu nhập hoa hồng ước tính trên mỗi đơn hàng."
  },
  "marketAnalysis": {
    "demandLevel": "Cao / Trung bình / Ngách",
    "seasonality": "Quanh năm hoặc thời vụ",
    "competitionLevel": "Thấp / Trung bình / Cao",
    "targetSegment": "Phân khúc khách hàng mục tiêu"
  },
  "disclaimer": "AI-generated assessment, not guaranteed sales performance.",
  "inferenceType": "AI_INFERENCE"
}`;

      userPrompt = `Sản phẩm: ${productName}
Ngành hàng: ${category}
Nền tảng: ${platform.toUpperCase()}
Giá bán: ${Number(priceVND).toLocaleString()} VNĐ
${originalPriceVND ? `Giá gốc niêm yết: ${Number(originalPriceVND).toLocaleString()} VNĐ` : ""}
Hoa hồng: ${commissionRate}%
${description ? `Mô tả sản phẩm: ${description}` : ""}
${usp ? `USP người bán cung cấp: ${usp}` : ""}
${soldCount ? `Số lượng đã bán ghi nhận: ${soldCount}` : "Số lượng bán: Chưa có số liệu xác minh"}
${rating ? `Điểm đánh giá: ${rating}/5` : ""}
${Array.isArray(competitors) && competitors.length > 0 ? `Đối thủ cạnh tranh đã nhập: ${JSON.stringify(competitors)}` : ""}`;
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
    // 6. AI TASK ROUTER & SMART FALLBACK
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
        // Cập nhật trạng thái reservation nếu có sang failed trước khi trả về
        if (supabaseClient && authenticatedUser && hasAtomicReservation) {
          try {
            await supabaseClient.from("ai_task_logs").update({
              status: "failed",
              error_message: "NOT_CONFIGURED: Missing API keys in Supabase Secrets"
            }).eq("request_id", requestId);
          } catch (_e) {}
        }

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
    // 7. THỰC THI GỌI PROVIDER VỚI DEADLINE & RETRY TỰ ĐỘNG
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
        console.log(`[${requestId}] [CLIENT_ABORT] Người dùng đã ngắt kết nối trước lần gọi ${attempts}.`);
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

        // Lỗi vĩnh viễn (400, 401, 403, 404): không retry
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
    // 8. XỬ LÝ KẾT QUẢ & CẬP NHẬT ATOMIC LOG VÀO AI_TASK_LOGS
    // ========================================================================
    if (!finalResult || !finalResult.success) {
      const isClientAbort = req.signal.aborted;
      const status = finalResult ? finalResult.httpStatus : (isClientAbort ? 499 : 504);
      const errMsg = finalResult?.error || (isClientAbort ? "Yêu cầu đã bị hủy bởi người dùng." : "Hết thời gian chờ phản hồi AI (Timeout).");

      // Cập nhật trạng thái vào Supabase ai_task_logs
      if (supabaseClient && authenticatedUser) {
        try {
          const failSummary = fallbackReason
            ? `[${requestedAgent.toUpperCase()} -> ${actualAgentUsed.toUpperCase()} Fallback] ${action.toUpperCase()}: Thất bại HTTP ${status}`
            : `[${actualAgentUsed.toUpperCase()}] ${action.toUpperCase()}: Thất bại HTTP ${status}`;

          const logPayload = {
            task_type: failSummary.slice(0, 150),
            status: isClientAbort ? "aborted" : "failed",
            owner_id: authenticatedUser.id,
            request_id: requestId,
            agent: actualAgentUsed,
            requested_agent: requestedAgent,
            executed_agent: actualAgentUsed,
            provider: PROVIDER_CONFIGS[selectedProvider]?.name || selectedProvider,
            model: finalResult?.model || PROVIDER_CONFIGS[selectedProvider]?.defaultModel,
            fallback_reason: fallbackReason,
            cost_status: "unknown",
            actual_cost: null,
            estimated_cost: 0,
            duration_ms: totalDurationMs,
            error_message: sanitizeErrorMessage(errMsg)
          };

          if (hasAtomicReservation) {
            // Update reservation row
            const { error: updateErr } = await supabaseClient
              .from("ai_task_logs")
              .update(logPayload)
              .eq("request_id", requestId);

            if (updateErr) {
              await supabaseClient.from("ai_task_logs").update({
                task_type: failSummary.slice(0, 150),
                status: isClientAbort ? "aborted" : "failed"
              }).eq("request_id", requestId);
            }
          } else {
            // Insert new log if no reservation existed
            const { error: insertErr } = await supabaseClient.from("ai_task_logs").insert(logPayload);
            if (insertErr) {
              await supabaseClient.from("ai_task_logs").insert({
                task_type: failSummary.slice(0, 150),
                status: isClientAbort ? "aborted" : "failed"
              });
            }
          }
        } catch (_logErr) {}
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: sanitizeErrorMessage(errMsg),
          code: finalResult?.code || (isClientAbort ? "ABORTED" : "TIMEOUT"),
          attempts,
          requestId,
          durationMs: totalDurationMs,
          requestedAgent,
          executedAgent: actualAgentUsed,
          fallbackReason
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // THÀNH CÔNG: Cập nhật bản ghi log duy nhất
    if (supabaseClient && authenticatedUser) {
      try {
        const successSummary = fallbackReason
          ? `[${requestedAgent.toUpperCase()} -> ${actualAgentUsed.toUpperCase()} Fallback] ${action.toUpperCase()}: Thành công qua ${finalResult.model}`
          : `[${actualAgentUsed.toUpperCase()}] ${action.toUpperCase()}: Thành công qua ${finalResult.model}`;

        const logPayload = {
          task_type: successSummary.slice(0, 150),
          status: "success",
          owner_id: authenticatedUser.id,
          request_id: requestId,
          agent: actualAgentUsed,
          requested_agent: requestedAgent,
          executed_agent: actualAgentUsed,
          provider: finalResult.provider,
          model: finalResult.model,
          input_tokens: finalResult.usage.promptTokens,
          output_tokens: finalResult.usage.completionTokens,
          cost_status: finalResult.costStatus,
          actual_cost: finalResult.actualCostVND,
          estimated_cost: finalResult.estimatedCostVND,
          fallback_reason: fallbackReason,
          duration_ms: totalDurationMs,
          error_message: null
        };

        if (hasAtomicReservation) {
          const { error: updateErr } = await supabaseClient
            .from("ai_task_logs")
            .update(logPayload)
            .eq("request_id", requestId);

          if (updateErr) {
            await supabaseClient.from("ai_task_logs").update({
              task_type: successSummary.slice(0, 150),
              status: "success"
            }).eq("request_id", requestId);
          }
        } else {
          const { error: insertErr } = await supabaseClient.from("ai_task_logs").insert(logPayload);
          if (insertErr) {
            await supabaseClient.from("ai_task_logs").insert({
              task_type: `${successSummary} (${finalResult.usage.totalTokens} tokens, ~${finalResult.estimatedCostVND}đ)`.slice(0, 150),
              status: "success"
            });
          }
        }
      } catch (_logErr) {}
    }

    console.log(`[${requestId}] [SUCCESS] Hoàn thành bởi ${actualAgentUsed} (Yêu cầu: ${requestedAgent}, Model: ${finalResult.model}) trong ${totalDurationMs}ms.`);

    // 9. TRẢ VỀ KẾT QUẢ ĐÃ CHUẨN HÓA CHO FRONTEND
    return new Response(
      JSON.stringify({
        success: true,
        action,
        requestedAgent,
        executedAgent: actualAgentUsed,
        provider: finalResult.provider,
        model: finalResult.model,
        data: finalResult.parsedJson || { text: finalResult.text },
        usage: finalResult.usage,
        costStatus: finalResult.costStatus,
        actualCostVND: finalResult.actualCostVND,
        estimatedCostVND: finalResult.estimatedCostVND,
        pricingMetadata: PRICING_METADATA,
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
        error: sanitizeErrorMessage(err?.message || "Đã xảy ra lỗi nội bộ trên AI Brain Edge Function."),
        code: "INTERNAL_SERVER_ERROR",
        requestId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
