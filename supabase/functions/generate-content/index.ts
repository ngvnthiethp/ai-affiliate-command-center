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

Deno.serve(async (req: Request) => {
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
            code: "INVALID_SESSION",
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
        tone = "Review chân thực",
        targetDuration = "35s - 45s",
        keyFeatures = ""
      } = payload;

      systemInstruction = `Bạn là Copywriter AI hàng đầu cho TikTok Shop và Shopee Affiliate tại Việt Nam.
Nhiệm vụ: Viết kịch bản video ngắn (Shortform Video Script) giữ chân người xem cao (Retention Rate) và kích thích ấn vào giỏ hàng màu vàng góc trái màn hình.
Quy tắc bắt buộc:
1. Tiếng Việt tự nhiên 100%, gần gũi với giới trẻ và người tiêu dùng mua sắm trực tuyến Việt Nam.
2. TUÂN THỦ CHÍNH SÁCH TIKTOK SHOP: Tuyệt đối KHÔNG dùng từ cấm (cam kết 100%, khỏi hoàn toàn, trị dứt điểm, duy nhất, tốt nhất thị trường, vĩnh viễn).
3. KHÔNG tự bịa đặt thông số kỹ thuật phi lý hoặc chế độ bảo hành không có thực.
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
  "estimatedViews": "60k - 150k"
}`;

      userPrompt = `Tạo kịch bản bán hàng affiliate cho sản phẩm sau:
- Tên sản phẩm: ${productName}
- Ngành hàng: ${category}
- Nền tảng: ${platform === "tiktok" ? "TikTok Shop Việt Nam" : "Shopee Video/Live"}
- Giá bán: ${Number(priceVND).toLocaleString("vi-VN")} VNĐ
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

    // 7. Gọi Gemini API với Timeout 30s bằng AbortController
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiRequestBody),
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Yêu cầu tới Gemini API bị quá thời gian chờ (30 giây). Vui lòng thử lại.",
            code: "TIMEOUT"
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: `Lỗi kết nối tới Google Gemini API: ${fetchErr?.message || fetchErr}`,
          code: "NETWORK_ERROR"
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 8. Xử lý phản hồi từ Gemini API
    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // Raw text
      }

      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Hạn mức Gemini API đã đạt giới hạn (429 Quota Exceeded). Vui lòng thử lại sau ít phút hoặc nâng hạn mức tại Google AI Studio.",
            code: "RATE_LIMIT_EXCEEDED",
            details: parsedErr?.error?.message || errText
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (geminiResponse.status === 400 || geminiResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Khóa GEMINI_API_KEY không hợp lệ hoặc model được cấu hình không được cấp quyền.",
            code: "API_KEY_INVALID",
            details: parsedErr?.error?.message || errText
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Gemini API trả về mã lỗi HTTP ${geminiResponse.status}.`,
          code: "GEMINI_ERROR",
          details: parsedErr?.error?.message || errText
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Phân tích nội dung kết quả sinh ra từ Gemini
    const geminiData = await geminiResponse.json();
    const candidateText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText || candidateText.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Không nhận được phản hồi nội dung từ Gemini.",
          code: "EMPTY_AI_RESPONSE"
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

    // 10. Ghi log an toàn vào bảng ai_task_logs nếu có thể (KHÔNG chặn phản hồi nếu lỗi)
    if (supabaseClient && authenticatedUser) {
      try {
        const taskDescription = `[Edge Function] ${action.toUpperCase()}: ${
          payload?.productName || payload?.category || action
        }`;
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
