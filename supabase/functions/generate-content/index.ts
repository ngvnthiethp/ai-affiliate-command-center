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

// Cấu hình deadline tổng: 120s (an toàn dưới 150s idle gateway timeout của Supabase)
const TOTAL_EXECUTION_TIMEOUT_MS = 120000;
const BASE_RETRY_DELAY_MS = 1500; // 1.5 giây ban đầu
const MAX_RETRY_DELAY_MS = 5000; // Tối đa 5 giây cho một khoảng nghỉ

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
    return Math.min(seconds * 1000, 6000);
  }
  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? Math.min(diff, 6000) : null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  // Khởi tạo Request ID cho chẩn đoán log
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

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
          code: "METHOD_NOT_ALLOWED",
          requestId
        }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Đọc Secrets an toàn từ Deno environment (KHÔNG BAO GIỜ để lộ ở frontend)
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey || geminiApiKey.trim() === "") {
      console.error(`[${requestId}] [CONFIG_ERROR] Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets.`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets.",
          code: "MISSING_GEMINI_KEY",
          hint: "Vui lòng truy cập Supabase Dashboard > Edge Functions > Secrets và thêm GEMINI_API_KEY từ Google AI Studio.",
          requestId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiModel = Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_MODEL;

    // 4. Xác thực người dùng qua Supabase JWT Token
    const authStartMs = Date.now();
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
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Thiếu Bearer JWT token trong Authorization header.",
          code: "UNAUTHORIZED",
          requestId
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
        console.warn(`[${requestId}] [AUTH_FAIL] JWT không hợp lệ: ${userError?.message}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            code: "UNAUTHORIZED",
            details: userError?.message,
            requestId
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUser = user;
    }
    const authDurationMs = Date.now() - authStartMs;

    // 5. Kiểm tra & Giới hạn dữ liệu đầu vào (Guardrails)
    let body: RequestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payload gửi lên không đúng định dạng JSON.",
          code: "INVALID_JSON",
          requestId
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
          code: "MISSING_ACTION",
          requestId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] [START] Action: ${action}, Model: ${geminiModel}, AuthTime: ${authDurationMs}ms`);

    // Giới hạn ký tự payload chống lạm dụng chi phí token (tối đa 5,000 ký tự)
    const payloadString = JSON.stringify(payload || {});
    if (payloadString.length > 5000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dữ liệu đầu vào vượt quá giới hạn an toàn (tối đa 5,000 ký tự).",
          code: "PAYLOAD_TOO_LARGE",
          requestId
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
  "recommendation": "Khuyến nghị góc tiếp cận ngắn gọn",
  "targetAudience": "Đối tượng người mua tiềm năng nhất",
  "keyAngles": ["Góc quay 1", "Góc tiếp cận 2", "Góc so sánh 3"],
  "suggestedCommission": 18,
  "notes": "Lưu ý về nguồn hàng, đối thủ cạnh tranh"
}`;

      userPrompt = `Phân tích sản phẩm: ${productName}, ngành hàng: ${category}, nền tảng: ${platform}, giá bán: ${Number(priceVND).toLocaleString("vi-VN")} VNĐ.`;

    } else if (action === "trend_ideas") {
      const { category = "Tổng hợp", platform = "tiktok" } = payload;
      systemInstruction = `Bạn là Trend Hunter AI chuyên bắt sóng xu hướng shortform video Việt Nam.
Trả về JSON cấu trúc:
{
  "trends": [
    {
      "name": "Tên trend",
      "soundType": "Loại âm thanh/nhạc nền",
      "hookTemplate": "Mẫu câu mở đầu giữ chân người xem",
      "retentionTactic": "Mẹo kéo dài thời gian xem trung bình"
    }
  ]
}`;

      userPrompt = `Đề xuất 3 xu hướng video ngắn chuyển đổi cao cho ngành hàng: ${category} trên ${platform}.`;

    } else if (action === "audit_content") {
      const { title = "", scriptText = "" } = payload;
      systemInstruction = `Bạn là Auditor AI - Chuyên gia kiểm duyệt chính sách quảng cáo TikTok Shop và Shopee Việt Nam.
Kiểm tra nghiêm ngặt từ cấm, cam kết sai sự thật, từ ngữ nhạy cảm y tế, bảo hành giả.
Trả về JSON cấu trúc:
{
  "complianceScore": 90,
  "status": "approved",
  "violations": ["Danh sách các lỗi nếu có"],
  "suggestedFixes": ["Cách sửa văn phong tuân thủ"],
  "summary": "Đánh giá tổng quan an toàn tài khoản"
}`;

      userPrompt = `Kiểm duyệt kịch bản sau:
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
          code: "UNSUPPORTED_ACTION",
          requestId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Cấu Hình Đồng Bộ Timeout & Retry Tối Ưu
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    // Tối ưu hóa request payload: giới hạn maxOutputTokens vừa đủ chất lượng, tránh sinh lặp vô hạn
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
        responseMimeType: "application/json",
        maxOutputTokens: 2500
      }
    };

    // Quy tắc Timeout & Retry đồng bộ:
    // - generate_script cần 15-40s để sinh JSON hoàn chỉnh. Cấp ngân sách 55s cho mỗi lần gọi đơn lẻ.
    // - Tối đa 1 lần retry (tổng 2 lần gọi) cho kịch bản dài nếu còn đủ tối thiểu 40s trước deadline tổng 120s.
    // - Các tác vụ ngắn (analyze, audit, titles): 25s mỗi lượt, tối đa 2 lần retry.
    const isLongTask = action === "generate_script";
    const maxAllowedRetries = isLongTask ? 1 : 2;
    const SINGLE_CALL_TIMEOUT_MS = isLongTask ? 55000 : 25000;
    const MIN_TIME_FOR_RETRY_MS = isLongTask ? 40000 : 15000;

    let lastResponse: Response | null = null;
    let lastError: any = null;
    let attemptCount = 0;

    for (let retry = 0; retry <= maxAllowedRetries; retry++) {
      attemptCount = retry + 1;

      // 1. Kiểm tra nếu client (người dùng) đã chủ động ngắt kết nối
      if (req.signal.aborted) {
        console.log(`[${requestId}] [CLIENT_ABORT] Client đã ngắt kết nối trước lượt gọi ${attemptCount}`);
        lastError = new DOMException("Client request aborted by user", "AbortError");
        break;
      }

      // 2. Kiểm tra thời gian còn lại trước deadline tổng (120 giây)
      const elapsedTotalMs = Date.now() - startTime;
      const remainingTotalMs = TOTAL_EXECUTION_TIMEOUT_MS - elapsedTotalMs;

      // Nếu lần retry này không đủ thời gian an toàn cho Gemini hoàn thành, dừng retry và trả lỗi lượt trước
      if (retry > 0 && remainingTotalMs < MIN_TIME_FOR_RETRY_MS) {
        console.log(`[${requestId}] [RETRY_SKIP] Thời gian còn lại ${remainingTotalMs}ms < ${MIN_TIME_FOR_RETRY_MS}ms. Dừng retry để tránh vượt deadline.`);
        break;
      }

      // 3. Đặt timeout cho từng lần gọi đơn lẻ: 55s (không vượt quá thời gian còn lại trước deadline)
      const perAttemptTimeoutMs = Math.min(SINGLE_CALL_TIMEOUT_MS, Math.max(5000, remainingTotalMs - 2000));
      const attemptController = new AbortController();
      const timeoutId = setTimeout(() => {
        attemptController.abort(new DOMException(`Gemini call timed out after ${perAttemptTimeoutMs}ms`, "TimeoutError"));
      }, perAttemptTimeoutMs);

      // Nếu người dùng hủy kết nối HTTP trong khi đang chờ Gemini, chuyển tiếp abort sang attemptController
      const onClientAbort = () => {
        attemptController.abort(new DOMException("Client aborted request", "AbortError"));
      };
      req.signal.addEventListener("abort", onClientAbort, { once: true });

      const callStartMs = Date.now();
      console.log(`[${requestId}] [CALL_START] Lượt ${attemptCount}/${maxAllowedRetries + 1}, Budget: ${perAttemptTimeoutMs}ms, Tổng đã chạy: ${elapsedTotalMs}ms`);

      try {
        const response = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiRequestBody),
          signal: attemptController.signal
        });

        clearTimeout(timeoutId);
        req.signal.removeEventListener("abort", onClientAbort);

        const callDurationMs = Date.now() - callStartMs;
        lastResponse = response;
        console.log(`[${requestId}] [CALL_RESP] Lượt ${attemptCount}: HTTP ${response.status} trong ${callDurationMs}ms`);

        // Thành công: thoát vòng lặp ngay
        if (response.ok) {
          break;
        }

        // Lỗi vĩnh viễn (400, 401, 403, 404): KHÔNG RETRY
        if (!isTransientError(response.status)) {
          console.warn(`[${requestId}] [PERMANENT_ERROR] HTTP ${response.status} không thuộc diện retry.`);
          break;
        }

        // Lỗi tạm thời (503, 429, 502, 500, 408): kiểm tra điều kiện retry
        if (retry < maxAllowedRetries) {
          const timeLeftAfterCall = TOTAL_EXECUTION_TIMEOUT_MS - (Date.now() - startTime);
          if (timeLeftAfterCall < MIN_TIME_FOR_RETRY_MS) {
            console.log(`[${requestId}] [RETRY_SKIP] Thời gian còn lại ${timeLeftAfterCall}ms không đủ cho lượt retry tiếp theo.`);
            break;
          }

          const retryAfterHeader = response.headers.get("Retry-After");
          const headerDelay = getRetryAfterMs(retryAfterHeader);
          const expBackoff = Math.min(
            MAX_RETRY_DELAY_MS,
            BASE_RETRY_DELAY_MS * Math.pow(2, retry) + Math.floor(Math.random() * 400)
          );
          const waitDelayMs = headerDelay !== null ? Math.min(headerDelay, 6000) : expBackoff;

          console.log(`[${requestId}] [RETRY_WAIT] Chờ ${waitDelayMs}ms trước khi thử lại... (Lý do: HTTP ${response.status})`);
          await new Promise((resolve) => setTimeout(resolve, waitDelayMs));
          continue;
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        req.signal.removeEventListener("abort", onClientAbort);
        lastError = fetchErr;
        const callDurationMs = Date.now() - callStartMs;

        const isClientAbort = req.signal.aborted || fetchErr?.message?.includes("Client aborted");
        if (isClientAbort) {
          console.log(`[${requestId}] [CLIENT_ABORT] Người dùng đã chủ động hủy sau ${callDurationMs}ms.`);
          break; // Không retry khi người dùng chủ động hủy
        }

        console.warn(`[${requestId}] [CALL_ERROR] Lượt ${attemptCount} gặp lỗi (${fetchErr.name}: ${fetchErr.message}) sau ${callDurationMs}ms.`);

        if (retry < maxAllowedRetries) {
          const timeLeftAfterErr = TOTAL_EXECUTION_TIMEOUT_MS - (Date.now() - startTime);
          if (timeLeftAfterErr < MIN_TIME_FOR_RETRY_MS) {
            console.log(`[${requestId}] [RETRY_SKIP] Không đủ thời gian còn lại (${timeLeftAfterErr}ms) sau lỗi mạng.`);
            break;
          }

          const waitDelayMs = 1500 + Math.floor(Math.random() * 500);
          console.log(`[${requestId}] [RETRY_WAIT] Chờ ${waitDelayMs}ms sau lỗi kết nối...`);
          await new Promise((resolve) => setTimeout(resolve, waitDelayMs));
          continue;
        }
      }
    }

    // 8. Xử lý phản hồi từ Gemini API sau các lượt thử
    const totalElapsedMs = Date.now() - startTime;

    if (!lastResponse || !lastResponse.ok) {
      const isClientAbort = req.signal.aborted || lastError?.message?.includes("Client aborted");
      const isTimeout = lastError?.name === "TimeoutError" || (lastError?.name === "AbortError" && !isClientAbort);
      const status = lastResponse ? lastResponse.status : (isTimeout ? 504 : isClientAbort ? 499 : 502);

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
      console.error(`[${requestId}] [FAILURE] Status: ${status}, Lượt gọi: ${attemptCount}, Tổng thời gian: ${totalElapsedMs}ms, Detail: ${rawDetailMessage}`);

      // Ghi log duy nhất MỘT LẦN vào bảng ai_task_logs nếu thất bại (trừ trường hợp người dùng chủ động hủy)
      if (supabaseClient && authenticatedUser && !isClientAbort) {
        try {
          const failSummary = `[Edge Function] ${action.toUpperCase()}: Thất bại HTTP ${status} (đã thử ${attemptCount} lượt, ${Math.round(totalElapsedMs / 1000)}s)`;
          await supabaseClient.from("ai_task_logs").insert({
            task_type: failSummary.slice(0, 150),
            status: "failed"
          });
        } catch (_logErr) {
          // Không gián đoạn
        }
      }

      // Xử lý hủy do người dùng
      if (isClientAbort) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Yêu cầu đã bị hủy bởi người dùng.",
            code: "ABORTED",
            requestId,
            attempts: attemptCount,
            durationMs: totalElapsedMs
          }),
          { status: 499, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Phân loại mã lỗi chính xác
      // 401: Phiên đăng nhập không hợp lệ
      if (status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            code: "UNAUTHORIZED",
            details: rawDetailMessage,
            requestId
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
            details: rawDetailMessage,
            requestId
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
            attempts: attemptCount,
            requestId,
            durationMs: totalElapsedMs
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 503: Gemini đang quá tải (High demand / Service Unavailable)
      if (status === 503) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Gemini hiện đang quá tải. Vui lòng thử lại sau ít phút.",
            code: "SERVICE_UNAVAILABLE",
            details: rawDetailMessage || "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
            attempts: attemptCount,
            requestId,
            durationMs: totalElapsedMs
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 504: Hết thời gian chờ (Timeout)
      if (status === 504 || isTimeout) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Hết thời gian chờ phản hồi từ máy chủ AI (504 Gateway Timeout). Gemini đang xử lý chậm hơn bình thường. Vui lòng thử lại sau ít phút.",
            code: "TIMEOUT",
            details: `Xử lý vượt quá thời gian cho phép sau ${attemptCount} lượt thử (${Math.round(totalElapsedMs / 1000)}s).`,
            attempts: attemptCount,
            requestId,
            durationMs: totalElapsedMs
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
          attempts: attemptCount,
          requestId,
          durationMs: totalElapsedMs
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Phân tích nội dung kết quả sinh ra từ Gemini
    const geminiData = await lastResponse.json();
    const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText || candidateText.trim() === "") {
      console.warn(`[${requestId}] [EMPTY_RESPONSE] Phản hồi từ Gemini không có text.`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Không nhận được phản hồi nội dung từ Gemini.",
          code: "EMPTY_AI_RESPONSE",
          attempts: attemptCount,
          requestId
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
      parsedResult = { rawText: candidateText };
    }

    // 10. Ghi log duy nhất MỘT LẦN an toàn vào bảng ai_task_logs nếu thành công
    if (supabaseClient && authenticatedUser) {
      try {
        const taskDescription = `[Edge Function] ${action.toUpperCase()}: ${
          payload?.productName || payload?.category || action
        } (Thành công qua ${attemptCount} lượt, ${Math.round(totalElapsedMs / 1000)}s)`;
        await supabaseClient.from("ai_task_logs").insert({
          task_type: taskDescription.slice(0, 150),
          status: "success"
        });
      } catch (_logErr) {
        // Bỏ qua lỗi log database để đảm bảo phản hồi 200 cho người dùng
      }
    }

    console.log(`[${requestId}] [SUCCESS] Hoàn thành ${action} qua ${attemptCount} lượt trong ${totalElapsedMs}ms.`);

    // 11. Trả về kết quả hoàn chỉnh cho Frontend
    return new Response(
      JSON.stringify({
        success: true,
        action,
        model: geminiModel,
        data: parsedResult,
        attempts: attemptCount,
        requestId,
        durationMs: totalElapsedMs,
        usage: geminiData?.usageMetadata || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error(`[${requestId}] [UNCAUGHT_EXCEPTION]`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Đã xảy ra sự cố không xác định trên Supabase Edge Function.",
        code: "INTERNAL_ERROR",
        requestId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
