// Supabase Edge Function: generate-content
// Chạy trên Deno runtime trong môi trường Supabase Edge Functions.
// Đóng vai trò backend bảo mật trung gian giữa AI Affiliate Command Center và Google Gemini API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS Headers cho phép gọi từ Frontend Web / iPhone Safari
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  action: "generate_script" | "analyze_product" | "trend_ideas" | "audit_content" | "generate_title_description";
  payload: Record<string, any>;
}

// Cấu hình Model Gemini: Mặc định dùng gemini-2.5-flash (hoặc cấu hình qua biến GEMINI_MODEL)
const DEFAULT_MODEL = "gemini-2.5-flash";

// Cấu hình cơ chế Retry an toàn cho Gemini API
const MAX_RETRIES = 3; // Tối đa 3 lần thử lại sau lần gọi đầu tiên (tổng cộng tối đa 4 lần)
const BASE_RETRY_DELAY_MS = 1000; // 1 giây ban đầu
const MAX_RETRY_DELAY_MS = 6000; // Tối đa 6 giây cho một khoảng nghỉ
const TOTAL_EXECUTION_TIMEOUT_MS = 45000; // Timeout tổng 45s bảo vệ Edge Function

/**
 * Kiểm tra xem mã trạng thái HTTP có thuộc diện lỗi tạm thời được phép retry hay không.
 * Chỉ retry: 503 (Quá tải), 502 (Bad Gateway), 500 (Internal Server Error), 429 (Rate Limit), 408 (Request Timeout).
 * TUYỆT ĐỐI KHÔNG RETRY: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden / Invalid API Key), 404 (Not Found).
 */
function isTransientError(status: number): boolean {
  return status === 503 || status === 502 || status === 500 || status === 429 || status === 408;
}

/**
 * Đọc header Retry-After (nếu có) từ phản hồi HTTP của Gemini API
 */
function getRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 8000);
  }
  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? Math.min(diff, 8000) : null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. Xử lý preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Kiểm tra phương thức HTTP
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chỉ hỗ trợ phương thức POST.",
          code: "METHOD_NOT_ALLOWED"
        }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Đọc Secrets an toàn từ Deno environment (KHÔNG BAO GIỜ để lộ ở frontend)
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey || geminiApiKey.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets.",
          code: "MISSING_GEMINI_KEY",
          hint: "Vui lòng truy cập Supabase Dashboard > Edge Functions > Secrets và thêm GEMINI_API_KEY từ Google AI Studio."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiModel = Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_MODEL;

    // 4. Xác thực người dùng qua Supabase JWT Token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Yêu cầu chưa đăng nhập. Vui lòng đăng nhập tài khoản trước khi thực hiện tác vụ AI.",
          code: "UNAUTHORIZED"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Thiếu Bearer JWT token trong Authorization header.",
          code: "UNAUTHORIZED"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
            error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            code: "UNAUTHORIZED",
            details: userError?.message
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUser = user;
    }

    // 5. Kiểm tra & Giới hạn dữ liệu đầu vào (Guardrails)
    let body: RequestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payload gửi lên không đúng định dạng JSON.",
          code: "INVALID_JSON"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = body;
    if (!action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Thiếu trường 'action' trong request payload.",
          code: "MISSING_ACTION"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Giới hạn ký tự payload chống lạm dụng chi phí token (tối đa 5,000 ký tự)
    const payloadString = JSON.stringify(payload || {});
    if (payloadString.length > 5000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dữ liệu đầu vào vượt quá giới hạn an toàn (tối đa 5,000 ký tự).",
          code: "PAYLOAD_TOO_LARGE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Xây dựng System Instruction & Prompt tiếng Việt chuẩn TikTok Affiliate
    let systemInstruction = "";
    let userPrompt = "";

    if (action === "generate_script") {
      const {
        productName = "Sản phẩm Hot",
        category = "Tổng hợp",
        platform = "tiktok",
        priceVND = 199000,
        targetAudience = "Khách hàng trẻ, nhân viên văn phòng, học sinh sinh viên",
        tone = "Review chân thực",
        targetDuration = "35s - 45s",
        keyFeatures = ""
      } = payload;

      systemInstruction = `Bạn là Copywriter AI hàng đầu cho TikTok Shop và Shopee Affiliate tại Việt Nam.
Nhiệm vụ: Viết kịch bản video ngắn (Shortform Video Script) giữ chân người xem cao (Retention Rate) và kích thích ấn vào giỏ hàng màu vàng góc trái màn hình.
Quy tắc bắt buộc:
1. Tiếng Việt tự nhiên 100%, gần gũi với giới trẻ và người tiêu dùng mua sắm trực tuyến Việt Nam.
2. TUÂN THỦ CHÍNH SÁCH TIKTOK SHOP: Tuyệt đối KHÔNG dùng từ cấm (cam kết 100%, khỏi hoàn toàn, trị dứt điểm, duy nhất, tốt nhất thị trường, vĩnh viễn).
3. KHÔNG tự bịa đặt thông số kỹ thuật phi lý hoặc chế độ bảo hành không có thực so với thông tin sản phẩm đầu vào.
4. Trả về đúng định dạng JSON hợp lệ (không kèm văn bản ngoài JSON):
{
  "title": "Tiêu đề kịch bản thu hút, chuẩn SEO (dưới 65 ký tự)",
  "hookVariantA": "Câu mở đầu 3s biến thể A: Đánh vào nỗi đau thực tế hoặc gây tò mò bất ngờ",
  "hookVariantB": "Câu mở đầu 3s biến thể B: Góc nhìn tương phản hoặc giải pháp tiết kiệm hời",
  "activeHook": "A",
  "bodyStory": "Tóm tắt diễn biến kịch bản giải quyết vấn đề bằng trải nghiệm sản phẩm",
  "voiceoverLines": [
    {
      "timestamp": "00:00 - 00:04",
      "speech": "Lời thoại ngắn gọn, cuốn hút",
      "action": "Góc máy chi tiết (quay cận cảnh sản phẩm, test thực tế, cử chỉ tay)"
    },
    {
      "timestamp": "00:05 - 00:20",
      "speech": "Lời thoại phân tích điểm mạnh trải nghiệm thực tế",
      "action": "Quay cận cảnh tính năng nổi bật"
    },
    {
      "timestamp": "00:21 - 00:35",
      "speech": "Lời thoại chốt hạ giá trị và voucher trợ giá",
      "action": "Chỉ tay vào giỏ hàng màu vàng góc trái màn hình"
    }
  ],
  "callToAction": "Câu kêu gọi hành động dứt khoát trỏ vào giỏ hàng góc trái màn hình để săn voucher và freeship",
  "hashtags": ["#tiktokshopvietnam", "#review", "#dealhot"],
  "targetDuration": "${targetDuration}",
  "tone": ${JSON.stringify(tone)},
  "estimatedViews": "60k - 150k",
  "unverifiedClaimsNotes": "Lưu ý tuân thủ: Tránh khẳng định tuyệt đối về hiệu quả hoặc cam kết vượt quá công bố của nhà sản xuất."
}`;

      userPrompt = `Tạo kịch bản bán hàng affiliate cho sản phẩm sau:
- Tên sản phẩm: ${productName}
- Ngành hàng: ${category}
- Nền tảng: ${platform === "tiktok" ? "TikTok Shop Việt Nam" : "Shopee Video/Live"}
- Giá bán: ${Number(priceVND).toLocaleString("vi-VN")} VNĐ
- Đối tượng mục tiêu: ${targetAudience}
- Phong cách: ${tone}
- Thời lượng mục tiêu: ${targetDuration}
- Điểm nổi bật / Khách hàng quan tâm: ${keyFeatures || "Trải nghiệm thực tế tốt, giao nhanh, deal giá hời, phù hợp sử dụng hàng ngày"}`;

    } else if (action === "analyze_product") {
      const { productName = "", category = "", priceVND = 0, platform = "tiktok" } = payload;
      systemInstruction = `Bạn là Scout AI - Chuyên gia săn deal affiliate hàng đầu Việt Nam.
Phân tích tiềm năng chuyển đổi và khả năng viral của sản phẩm trên TikTok Shop & Shopee.
Quy tắc: Đánh giá khách quan, trung thực, dựa trên hành vi mua hàng tại thị trường Việt Nam.
Trả về JSON cấu trúc:
{
  "potentialScore": 85,
  "recommendation": "Khuyên dùng đẩy mạnh" | "Cân nhắc thử nghiệm" | "Không tối ưu",
  "targetAudience": "Nhóm đối tượng khách hàng tiềm năng chính (độ tuổi, hành vi mua sắm)",
  "keyAngles": ["Góc tiếp cận 1", "Góc tiếp cận 2", "Góc tiếp cận 3"],
  "suggestedCommission": 18,
  "notes": "Nhận xét phân tích ngắn gọn, súc tích"
}`;

      userPrompt = `Phân tích sản phẩm: ${productName}, Ngành: ${category}, Giá: ${priceVND} VNĐ, Nền tảng: ${platform}.`;

    } else if (action === "trend_ideas") {
      const { category = "Tổng hợp", platform = "tiktok" } = payload;
      systemInstruction = `Bạn là Trend Hunter AI chuyên bắt sóng xu hướng shortform video tại Việt Nam.
Đề xuất các ý tưởng video affiliate đang thịnh hành phù hợp thị hiếu người xem Việt.
Trả về JSON cấu trúc:
{
  "trends": [
    {
      "name": "Tên xu hướng (ví dụ: Thử thách 24h dùng đồ hời)",
      "soundType": "Loại nhạc nền/âm thanh viral thích hợp",
      "hookTemplate": "Mẫu câu hook 3 giây bắt trend",
      "retentionTactic": "Bí quyết giữ chân người xem trên 3 giây đầu"
    }
  ]
}`;

      userPrompt = `Đề xuất 3 xu hướng affiliate video mới nhất cho ngành hàng "${category}" trên nền tảng ${platform}.`;

    } else if (action === "audit_content") {
      const { title = "", scriptText = "" } = payload;
      systemInstruction = `Bạn là Auditor AI - Chuyên gia kiểm duyệt chính sách nội dung của TikTok Shop và Shopee Việt Nam.
Quét từ ngữ nhạy cảm, từ cấm gây bóp tương tác hoặc từ chối duyệt video affiliate.
Trả về JSON cấu trúc:
{
  "complianceScore": 92,
  "status": "approved" | "needs_review",
  "violations": ["Danh sách các từ hoặc câu có nguy cơ vi phạm kèm lý do"],
  "suggestedFixes": ["Gợi ý cách diễn đạt an toàn thay thế"],
  "summary": "Đánh giá tổng quan về tính tuân thủ"
}`;

      userPrompt = `Kiểm duyệt nội dung sau:
Tiêu đề: ${title}
Nội dung: ${scriptText}`;

    } else if (action === "generate_title_description") {
      const { productName = "", category = "" } = payload;
      systemInstruction = `Bạn là Chuyên gia tối ưu tiêu đề và mô tả video TikTok Shop Affiliate chuẩn SEO.
Trả về JSON cấu trúc:
{
  "titles": ["Tiêu đề gợi ý 1", "Tiêu đề gợi ý 2", "Tiêu đề gợi ý 3"],
  "description": "Đoạn mô tả video ngắn kèm lời kêu gọi hành động",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;

      userPrompt = `Tạo tiêu đề và mô tả cho sản phẩm: ${productName}, ngành hàng: ${category}.`;

    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Tác vụ không hợp lệ: ${action}`,
          code: "UNSUPPORTED_ACTION"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Gọi Gemini API với Cơ Chế Retry Tự Động (Exponential Backoff + Jitter)
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const geminiRequestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    };

    let lastResponse: Response | null = null;
    let lastError: any = null;
    let attemptCount = 0; // Số lần đã gọi thực tế

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      attemptCount = retry + 1;

      // Kiểm tra tổng thời gian xử lý còn lại
      const elapsedTotalMs = Date.now() - startTime;
      const remainingTimeMs = TOTAL_EXECUTION_TIMEOUT_MS - elapsedTotalMs;
      if (remainingTimeMs < 4000) {
        // Hết thời gian an toàn cho Edge Function
        break;
      }

      // Đặt timeout cho từng lần gọi đơn lẻ (tối đa 15s hoặc thời gian còn lại)
      const perAttemptTimeoutMs = Math.min(15000, remainingTimeMs - 1000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

      try {
        const response = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiRequestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        lastResponse = response;

        // Nếu thành công (HTTP 200 OK), thoát khỏi vòng lặp retry ngay lập tức
        if (response.ok) {
          break;
        }

        // Nếu gặp lỗi vĩnh viễn (400 Bad Request, 401 Unauthorized, 403 Forbidden / Invalid Key):
        // KHÔNG RETRY, thoát ngay lập tức!
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          break;
        }

        // Nếu là lỗi tạm thời (503 Quá tải, 502 Bad Gateway, 500 Server Error, 429 Rate Limit, 408 Timeout):
        if (isTransientError(response.status)) {
          if (retry < MAX_RETRIES) {
            // Tính toán khoảng thời gian chờ (Exponential backoff: 1s, 2s, 4s + Jitter ngẫu nhiên)
            const retryAfterHeader = response.headers.get("Retry-After");
            const headerDelay = getRetryAfterMs(retryAfterHeader);

            const expBackoff = Math.min(
              MAX_RETRY_DELAY_MS,
              BASE_RETRY_DELAY_MS * Math.pow(2, retry) + Math.floor(Math.random() * 300)
            );
            const waitDelayMs = headerDelay !== null ? Math.max(headerDelay, expBackoff) : expBackoff;

            // Chờ trước khi thực hiện lần retry kế tiếp
            await new Promise((resolve) => setTimeout(resolve, waitDelayMs));
            continue;
          }
        } else {
          // Các mã lỗi không xác định khác, không retry
          break;
        }

      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastError = fetchErr;

        if (fetchErr.name === "AbortError") {
          // Lần thử này bị timeout
          if (retry < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
        } else {
          // Lỗi mạng hoặc kết nối gián đoạn
          if (retry < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 200)));
            continue;
          }
        }
      }
    }

    // 8. Xử lý phản hồi từ Gemini API sau các lượt thử
    if (!lastResponse || !lastResponse.ok) {
      // Xác định mã trạng thái lỗi cuối cùng
      const status = lastResponse ? lastResponse.status : (lastError?.name === "AbortError" ? 504 : 502);
      let errText = "";
      let parsedErr: any = null;

      if (lastResponse) {
        try {
          errText = await lastResponse.text();
          parsedErr = JSON.parse(errText);
        } catch {
          // Raw text
        }
      }

      const rawDetailMessage = parsedErr?.error?.message || errText || lastError?.message || "";

      // Log duy nhất MỘT LẦN vào bảng ai_task_logs nếu thất bại
      if (supabaseClient && authenticatedUser) {
        try {
          const failSummary = `[Edge Function] ${action.toUpperCase()}: Thất bại HTTP ${status} (đã thử ${attemptCount} lần)`;
          await supabaseClient.from("ai_task_logs").insert({
            task_type: failSummary.slice(0, 150),
            status: "failed"
          });
        } catch (_logErr) {
          // Không gián đoạn
        }
      }

      // Phân loại mã lỗi chính xác theo yêu cầu hệ thống
      // 401: Phiên đăng nhập không hợp lệ
      if (status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            code: "UNAUTHORIZED",
            details: rawDetailMessage
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 403: API Key hoặc quyền truy cập không hợp lệ
      if (status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Khóa GEMINI_API_KEY hoặc quyền truy cập không hợp lệ. Vui lòng kiểm tra API Key trong Supabase Secrets.",
            code: "API_KEY_INVALID",
            hint: "Kiểm tra biến môi trường GEMINI_API_KEY trong Supabase Secrets.",
            details: rawDetailMessage
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 429: Vượt hạn mức hoặc tốc độ yêu cầu
      if (status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Gemini API vượt hạn mức hoặc tốc độ yêu cầu (429 Rate Limit). Vui lòng thử lại sau ít phút hoặc nâng cấp quota.",
            code: "RATE_LIMIT_EXCEEDED",
            details: rawDetailMessage,
            attempts: attemptCount
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 503: Gemini đang quá tải (High demand / Service Unavailable)
      // TUYỆT ĐỐI KHÔNG HIỂN THỊ "Kiểm tra GEMINI_API_KEY"
      if (status === 503) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Gemini hiện đang quá tải. Vui lòng thử lại sau ít phút.",
            code: "SERVICE_UNAVAILABLE",
            details: rawDetailMessage || "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
            attempts: attemptCount
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 504: Hết thời gian chờ (Timeout)
      if (status === 504 || lastError?.name === "AbortError") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Hết thời gian chờ phản hồi từ Google Gemini API (504 Gateway Timeout). Vui lòng thử lại.",
            code: "TIMEOUT",
            details: rawDetailMessage,
            attempts: attemptCount
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 500 / 502: Lỗi máy chủ tạm thời
      return new Response(
        JSON.stringify({
          success: false,
          error: `Lỗi máy chủ tạm thời từ dịch vụ Google Gemini (HTTP ${status}). Vui lòng thử lại sau ít phút.`,
          code: status === 502 ? "BAD_GATEWAY" : "SERVER_ERROR",
          details: rawDetailMessage,
          attempts: attemptCount
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Phân tích nội dung kết quả sinh ra từ Gemini
    const geminiData = await lastResponse.json();
    const candidateText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText || candidateText.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Không nhận được phản hồi nội dung từ Gemini.",
          code: "EMPTY_AI_RESPONSE",
          attempts: attemptCount
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Làm sạch chuỗi JSON nếu Gemini bao bọc trong markdown code fence ```json ... ```
    let cleanedText = candidateText.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(cleanedText);
    } catch {
      // Nếu không parse được JSON hoàn chỉnh, đóng gói dưới dạng rawText
      parsedResult = { rawText: candidateText };
    }

    // 10. Ghi log duy nhất MỘT LẦN an toàn vào bảng ai_task_logs nếu thành công
    if (supabaseClient && authenticatedUser) {
      try {
        const taskDescription = `[Edge Function] ${action.toUpperCase()}: ${
          payload?.productName || payload?.category || action
        } (Thành công qua ${attemptCount} lần thử)`;
        await supabaseClient.from("ai_task_logs").insert({
          task_type: taskDescription.slice(0, 150),
          status: "success"
        });
      } catch (_logErr) {
        // Bỏ qua lỗi log database để đảm bảo phản hồi 200 cho người dùng
      }
    }

    // 11. Trả về kết quả hoàn chỉnh cho Frontend
    return new Response(
      JSON.stringify({
        success: true,
        action,
        model: geminiModel,
        data: parsedResult,
        attempts: attemptCount,
        usage: geminiData?.usageMetadata || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Đã xảy ra sự cố không xác định trên Supabase Edge Function.",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
