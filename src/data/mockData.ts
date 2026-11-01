import {
  AIAgent,
  Campaign,
  ContentScript,
  CronTask,
  DailyPerformance,
  DashboardMetric,
  PlatformShare,
  ProductItem,
  SystemLog
} from '../types';

export const initialMetrics: DashboardMetric = {
  revenueVND: 184500000, // 184.5 triệu VNĐ
  commissionVND: 28920000, // 28.92 triệu VNĐ
  totalOrders: 642,
  clicks: 14850,
  conversionRate: 4.32, // 4.32%
  activeCampaignsCount: 6,
  activeAgentsCount: 5,
  todayEstimatedCommission: 3840000 // 3.84 triệu VNĐ
};

export const sevenDayPerformance: DailyPerformance[] = [
  { date: '25/10', revenue: 19.4, commission: 3.1, orders: 74, clicks: 1820, isDemo: true },
  { date: '26/10', revenue: 22.8, commission: 3.6, orders: 88, clicks: 1950, isDemo: true },
  { date: '27/10', revenue: 26.5, commission: 4.2, orders: 96, clicks: 2100, isDemo: true },
  { date: '28/10', revenue: 24.1, commission: 3.8, orders: 85, clicks: 2040, isDemo: true },
  { date: '29/10', revenue: 31.2, commission: 4.9, orders: 112, clicks: 2450, isDemo: true },
  { date: '30/10', revenue: 28.7, commission: 4.4, orders: 98, clicks: 2190, isDemo: true },
  { date: '31/10 (Demo)', revenue: 31.8, commission: 4.92, orders: 89, clicks: 2300, isDemo: true }
];

export const platformDistribution: PlatformShare[] = [
  { name: 'TikTok Shop VN', share: 62, revenue: 114.4, color: '#00F0FF' },
  { name: 'Shopee Affiliate', share: 31, revenue: 57.2, color: '#A855F7' },
  { name: 'Lazada VN', share: 7, revenue: 12.9, color: '#3B82F6' }
];

export const initialAgents: AIAgent[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT (Chiến Lược & Điều Hành)',
    codeName: 'AGENT-1-STRATEGY',
    role: 'Operations & Strategy (Điều Hành & Chiến Lược)',
    tasks: [
      'Phân tích yêu cầu và bài toán affiliate',
      'Lập kế hoạch phân bổ tài nguyên chiến dịch',
      'Tổng hợp kết quả từ các Agent chuyên biệt',
      'Đưa ra báo cáo tổng kết và đề xuất hành động tối ưu'
    ],
    description: 'Bộ não tổng chỉ huy: tiếp nhận yêu cầu, phân bổ công việc cho các Agent, tổng hợp báo cáo và hoạch định lộ trình tăng trưởng doanh thu.',
    provider: 'OpenAI',
    providerId: 'openai',
    model: 'gpt-4o-mini',
    connectionStatus: 'NOT_CONFIGURED',
    status: 'active',
    tokenUsedToday: 0,
    tokenLimit: 120000,
    tasksCompleted: 0,
    estimatedCostVND: 0,
    systemPrompt: `Bạn là AGENT 1 - ChatGPT (Operations & Strategy Lead) thuộc hệ thống AI Affiliate Command Center Việt Nam.
Nhiệm vụ:
1. Phân tích yêu cầu và bài toán affiliate tổng thể của người dùng.
2. Lập kế hoạch phân bổ công việc cho các Agent vệ tinh (Gemini, Grok, Claude, DeepSeek).
3. Tổng hợp kết quả đầu ra thành báo cáo chiến lược rõ ràng, ngắn gọn và có tính hành động cao.`,
    lastActive: 'Chờ kết nối API Key',
    avatarIcon: 'Bot',
    colorAccent: '#10B981',
    logSummary: 'Chờ cấu hình OPENAI_API_KEY trong Supabase Secrets.'
  },
  {
    id: 'gemini',
    name: 'Gemini (Nghiên Cứu Deal & Nội Dung)',
    codeName: 'AGENT-2-CONTENT-INTEL',
    role: 'Market Research & Content Intelligence (Deal & Kịch Bản)',
    tasks: [
      'Phân tích tiềm năng sản phẩm affiliate',
      'Nghiên cứu thông tin và trích xuất USP sản phẩm',
      'Sản xuất kịch bản video TikTok/Shopee chuyển đổi cao',
      'Phân tích dữ liệu đầu vào và tối ưu Hook 3s'
    ],
    description: 'Chuyên gia cốt lõi (Provider chính): phân tích sâu thông số deal, trích xuất điểm bán hàng độc nhất và tự động sáng tạo kịch bản video ngắn đa biến thể.',
    provider: 'Google Gemini',
    providerId: 'gemini',
    model: 'gemini-2.5-flash',
    connectionStatus: 'CONNECTED',
    status: 'active',
    tokenUsedToday: 52400,
    tokenLimit: 200000,
    tasksCompleted: 42,
    estimatedCostVND: 14200,
    systemPrompt: `Bạn là AGENT 2 - Gemini (Market Research & Content Intelligence) thuộc AI Affiliate Command Center Việt Nam.
Nhiệm vụ:
1. Nghiên cứu sâu thông số sản phẩm, hoa hồng, giá bán và đặc điểm USP.
2. Sáng tạo kịch bản video ngắn TikTok Shop/Shopee Affiliate chuẩn tâm lý mua hàng người Việt.
3. Luôn tạo 2 biến thể Hook A/B giật tít, phân cảnh thời gian chi tiết và lời kêu gọi hành động dứt khoát.`,
    lastActive: 'Vừa xong',
    avatarIcon: 'Sparkles',
    colorAccent: '#00F0FF',
    logSummary: 'Đã sẵn sàng qua Edge Function với model gemini-2.5-flash.'
  },
  {
    id: 'grok',
    name: 'Grok (Đón Đầu Xu Hướng & Trend)',
    codeName: 'AGENT-3-TREND-RADAR',
    role: 'Trend Intelligence (Trí Tuệ Xu Hướng)',
    tasks: [
      'Phân tích xu hướng thảo luận mạng xã hội',
      'Đánh giá ý tưởng nội dung theo độ lan tỏa',
      'Đề xuất chủ đề video đón đầu làn sóng thị trường',
      'Phân tích tín hiệu âm thanh và hashtag thịnh hành'
    ],
    description: 'Trinh sát xu hướng: quét tín hiệu mạng xã hội theo thời gian thực để bắt trọn âm thanh thịnh hành, góc nhìn giật tít và chủ đề nóng sốt.',
    provider: 'xAI Grok',
    providerId: 'grok',
    model: 'grok-beta',
    connectionStatus: 'NOT_CONFIGURED',
    status: 'active',
    tokenUsedToday: 0,
    tokenLimit: 100000,
    tasksCompleted: 0,
    estimatedCostVND: 0,
    systemPrompt: `Bạn là AGENT 3 - Grok (Trend Intelligence Specialist) thuộc AI Affiliate Command Center.
Nhiệm vụ:
1. Bắt trọn xu hướng thảo luận nóng nhất trên mạng xã hội Việt Nam.
2. Đánh giá tính mới lạ, độc đáo và khả năng lan tỏa (virality) của các ý tưởng video.
3. Đề xuất góc nhìn ngược số đông hoặc hài hước châm biếm phù hợp thị hiếu giới trẻ.`,
    lastActive: 'Chờ kết nối API Key',
    avatarIcon: 'Radar',
    colorAccent: '#F59E0B',
    logSummary: 'Chờ cấu hình GROK_API_KEY trong Supabase Secrets.'
  },
  {
    id: 'claude',
    name: 'Claude (Chất Lượng & Tuân Thủ)',
    codeName: 'AGENT-4-COMPLIANCE',
    role: 'Content Quality & Compliance (Kiểm Định & Tuân Thủ)',
    tasks: [
      'Đánh giá chất lượng và logic kịch bản',
      'Rà soát tuyên bố thiếu căn cứ và từ ngữ cấm',
      'Đánh giá độ tự nhiên và khả năng giữ chân người xem',
      'Đề xuất giải pháp sửa câu từ an toàn tài khoản'
    ],
    description: 'Thẩm định viên nội dung: rà soát từ ngữ nhạy cảm theo chính sách TikTok Shop/Shopee, đảm bảo văn phong tự nhiên, bảo vệ an toàn kênh.',
    provider: 'Anthropic Claude',
    providerId: 'claude',
    model: 'claude-3-5-sonnet',
    connectionStatus: 'NOT_CONFIGURED',
    status: 'active',
    tokenUsedToday: 0,
    tokenLimit: 90000,
    tasksCompleted: 0,
    estimatedCostVND: 0,
    systemPrompt: `Bạn là AGENT 4 - Claude (Content Quality & Compliance Sentinel) thuộc AI Affiliate Command Center.
Nhiệm vụ:
1. Rà soát nghiêm ngặt các từ ngữ bị cấm hoặc hạn chế trên TikTok Shop và Shopee Việt Nam (cam kết 100%, dứt điểm, số 1...).
2. Đánh giá tính mạch lạc, cảm xúc chân thực và sự tinh tế trong lời thoại.
3. Đưa ra phương án thay thế thông minh giúp giữ vững thông điệp mà tuyệt đối an toàn chính sách.`,
    lastActive: 'Chờ kết nối API Key',
    avatarIcon: 'ShieldCheck',
    colorAccent: '#A855F7',
    logSummary: 'Chờ cấu hình ANTHROPIC_API_KEY trong Supabase Secrets.'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek (Kỹ Thuật & Phân Tích Dữ Liệu)',
    codeName: 'AGENT-5-DATA-TECH',
    role: 'Technical & Data Analysis (Phân Tích Dữ Liệu & Kỹ Thuật)',
    tasks: [
      'Phân tích dữ liệu hiệu suất và chuyển đổi',
      'Hỗ trợ tính toán ngưỡng sinh lời ROI/ROAS',
      'Phân tích chi phí quảng cáo và hiệu quả phân phối',
      'Xử lý logic kỹ thuật và mô hình hóa dữ liệu'
    ],
    description: 'Chuyên gia tính toán (Provider dự phòng): bóc tách dữ liệu chuyển đổi, tính toán ngưỡng sinh lời ROI, tối ưu hóa ngân sách và xử lý logic phức tạp.',
    provider: 'DeepSeek',
    providerId: 'deepseek',
    model: 'deepseek-chat',
    connectionStatus: 'NOT_CONFIGURED',
    status: 'active',
    tokenUsedToday: 0,
    tokenLimit: 150000,
    tasksCompleted: 0,
    estimatedCostVND: 0,
    systemPrompt: `Bạn là AGENT 5 - DeepSeek (Technical & Data Analysis Engine) thuộc AI Affiliate Command Center.
Nhiệm vụ:
1. Phân tích định lượng số liệu traffic, click, đơn hàng và doanh số affiliate.
2. Tính toán chính xác ngưỡng hòa vốn, ROI kỳ vọng dựa trên tỷ lệ hoa hồng thực tế.
3. Đóng vai trò Provider tính toán dự phòng tin cậy cho toàn bộ hệ thống.`,
    lastActive: 'Chờ kết nối API Key',
    avatarIcon: 'TrendingUp',
    colorAccent: '#38BDF8',
    logSummary: 'Chờ cấu hình DEEPSEEK_API_KEY trong Supabase Secrets.'
  }
];

export const initialProducts: ProductItem[] = [
  {
    id: 'prod-01',
    name: 'Bàn phím cơ không dây Monsgeek M1W V3 - Switch Piano Pro',
    category: 'Công nghệ',
    platform: 'tiktok',
    priceVND: 1450000,
    commissionRate: 18,
    estimatedCommissionVND: 261000,
    viralScore: 94,
    soldCount7D: 1420,
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://vt.tiktok.com/ZS2k9xLM1/?utm_source=ai_acc&utm_medium=affiliate',
    shortUrl: 'https://acc.link/kb-m1w',
    trendReason: 'Trend setup góc làm việc tối giản trên TikTok đang viral mạnh; tỷ lệ chuyển đổi cao trong giới văn phòng.',
    inStock: true,
    commissionStatus: 'stable',
    isDemo: true
  },
  {
    id: 'prod-02',
    name: 'Tai nghe chống ồn chủ động Baseus Bowie M2s ANC - Pin 30H',
    category: 'Công nghệ',
    platform: 'tiktok',
    priceVND: 650000,
    commissionRate: 22,
    estimatedCommissionVND: 143000,
    viralScore: 91,
    soldCount7D: 3180,
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://vt.tiktok.com/ZS2k87AB/?utm_source=ai_acc&utm_medium=affiliate',
    shortUrl: 'https://acc.link/baseus-m2s',
    trendReason: 'Âm thanh hay so với tầm giá dưới 700k; học sinh sinh viên tìm mua nhiều cho mùa thi.',
    inStock: true,
    commissionStatus: 'increased',
    isDemo: true
  },
  {
    id: 'prod-03',
    name: 'Serum Chống Nắng La Roche-Posay Anthelios Oil Correct 50ml',
    category: 'Làm đẹp & Chăm sóc',
    platform: 'shopee',
    priceVND: 490000,
    commissionRate: 16,
    estimatedCommissionVND: 78400,
    viralScore: 88,
    soldCount7D: 2450,
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1608248597359-548325492211?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://shope.ee/8AB12cd9?utm_source=ai_acc_vn',
    shortUrl: 'https://acc.link/lrp-anthelios',
    trendReason: 'Thời tiết nắng nóng gay gắt tại các thành phố lớn; nhu cầu kem chống nắng kiềm dầu tăng vọt.',
    inStock: true,
    commissionStatus: 'stable',
    isDemo: true
  },
  {
    id: 'prod-04',
    name: 'Nồi Chiên Không Dầu Điện Tử Lock&Lock 5.2L EJF284BLK',
    category: 'Gia dụng thông minh',
    platform: 'shopee',
    priceVND: 1890000,
    commissionRate: 15,
    estimatedCommissionVND: 283500,
    viralScore: 86,
    soldCount7D: 890,
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://shope.ee/9EF78gh2?utm_source=ai_acc_vn',
    shortUrl: 'https://acc.link/lock-airfryer',
    trendReason: 'Hàng chính hãng sale sâu; các kênh mẹ và bé review đồ ăn dặm đang lan tỏa công thức nấu.',
    inStock: true,
    commissionStatus: 'decreased',
    isDemo: true
  },
  {
    id: 'prod-05',
    name: 'Set 5 Đôi Tất Cổ Cao Vintage Thể Thao Unisex Cotton Khử Mùi',
    category: 'Thời trang & Phụ kiện',
    platform: 'tiktok',
    priceVND: 89000,
    commissionRate: 25,
    estimatedCommissionVND: 22250,
    viralScore: 85,
    soldCount7D: 7200,
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1582966772680-860e372bb558?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://vt.tiktok.com/ZS2k909ZZ/?utm_source=ai_acc&utm_medium=affiliate',
    shortUrl: 'https://acc.link/tat-vintage',
    trendReason: 'Giá rẻ, mua kèm đơn dễ dàng, tỷ lệ chốt đơn (CR) trên 9% khi gắn vào livestream hoặc video ngắn.',
    inStock: true,
    commissionStatus: 'stable',
    isDemo: true
  },
  {
    id: 'prod-06',
    name: 'Khô Bò Sợi Cháy Tỏi Cay Tè Thượng Hạng Hũ 500g',
    category: 'Ẩm thực',
    platform: 'tiktok',
    priceVND: 165000,
    commissionRate: 20,
    estimatedCommissionVND: 33000,
    viralScore: 89,
    soldCount7D: 4300,
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: 'https://vt.tiktok.com/ZS2k812KB/?utm_source=ai_acc&utm_medium=affiliate',
    shortUrl: 'https://acc.link/kho-bo-toi',
    trendReason: 'Đồ ăn vặt văn phòng bán chạy nhất buổi chiều; video ASMR ăn uống nhai giòn rụm thu hút triệu view.',
    inStock: true,
    commissionStatus: 'stable',
    isDemo: true
  }
];

export const initialScripts: ContentScript[] = [
  {
    id: 'script-01',
    productId: 'prod-01',
    productName: 'Bàn phím cơ không dây Monsgeek M1W',
    platform: 'tiktok',
    title: 'Kịch bản Test Âm Gõ Bàn Phím Đập Tan Tiếng Ồn Văn Phòng',
    targetDuration: '38 giây',
    hookVariantA: 'Đừng bao giờ mua bàn phím cơ dưới 2 triệu nếu như bạn chưa từng nghe thử con phím nhôm nguyên khối này...',
    hookVariantB: 'Sếp tôi vừa khen phòng làm việc dạo này êm ru, tất cả là nhờ tôi đổi sang con switch Piano Pro này!',
    activeHook: 'A',
    bodyStory: 'Test âm thanh gõ trực tiếp trên mặt bàn gỗ không cần lót pad. Trọng lượng đầm chắc 2kg nhôm CNC. Kết nối cùng lúc 3 thiết bị Bluetooth, Mac hay Win chuyển trong 1 giây.',
    voiceoverLines: [
      { timestamp: '00:00 - 00:03', speech: 'Đừng mua phím cơ dưới 2 triệu nếu chưa test âm con này!', action: 'Quay cận cảnh tay gõ phím, tiếng đanh chắc trầm ấm' },
      { timestamp: '00:04 - 00:14', speech: 'Nhôm CNC nguyên khối nặng gần 2 cân, gõ đầm tay như phím custom 5 củ.', action: 'Nhấc bàn phím gõ nhẹ vỏ kim loại chứng minh độ dày' },
      { timestamp: '00:15 - 00:26', speech: 'Switch Piano Pro lót sẵn 5 lớp foam tiêu âm, nửa đêm cày deadline không sợ gấu cằn nhằn.', action: 'Bật đèn RGB và test kết nối với iPad' },
      { timestamp: '00:27 - 00:38', speech: 'Deal hôm nay đang trợ giá hoa hồng cực tốt, bấm giỏ hàng góc trái săn voucher giảm 150k nhé!', action: 'Mũi tên chỉ thẳng vào góc trái màn hình nơi gắn giỏ hàng' }
    ],
    callToAction: 'Chỉ còn đúng 20 suất trợ giá voucher 150k hôm nay, bấm giỏ hàng góc trái hốt liền tay!',
    hashtags: ['#monsgeekm1w', '#banphimco', '#goclamviec', '#reviewcongnghe', '#tiktokshopvietnam'],
    status: 'approved',
    tone: 'Review chân thực',
    createdAt: 'Hôm nay, 14:20',
    estimatedViews: '120k - 250k',
    isDemo: true
  },
  {
    id: 'script-02',
    productId: 'prod-02',
    productName: 'Tai nghe Baseus Bowie M2s ANC',
    platform: 'tiktok',
    title: 'Thử Thách Đeo Tai Nghe 600k Ra Ngã Tư Đèn Đỏ Hà Nội',
    targetDuration: '42 giây',
    hookVariantA: 'Ai bảo tai nghe chống ồn dưới 700k là đồ mã? Ra ngã tư đứng thử một phát biết tay nhau ngay!',
    hookVariantB: 'Chiếc tai nghe đã cứu rỗi cuộc đời sinh viên của tôi trong phòng trọ ồn ào suốt 6 tháng qua.',
    activeHook: 'A',
    bodyStory: 'Mở chế độ ANC khử tiếng ồn động cơ xe máy 48dB. Chuyển sang chế độ Xuyên Âm khi cần nói chuyện với bạn bè mà không cần tháo tai nghe.',
    voiceoverLines: [
      { timestamp: '00:00 - 00:03', speech: 'Ai bảo tai nghe 600 cành không chống ồn được? Thử luôn nhé!', action: 'Đứng góc phố xe cộ đông đúc, đeo tai nghe vào tai' },
      { timestamp: '00:04 - 00:15', speech: 'Bật chế độ ANC một cái là không gian im phăng phắc như phòng thu.', action: 'Hiệu ứng âm thanh ngắt tiếng ồn lập tức trên video' },
      { timestamp: '00:16 - 00:28', speech: 'Pin trâu nghe liên tục 7 tiếng, hộp sạc thêm 30 tiếng nữa, cả tuần sạc một lần.', action: 'Mở hộp sạc kiểm tra đèn LED pin màu xanh neon' },
      { timestamp: '00:29 - 00:42', speech: 'Link chính hãng Baseus Mall mình ghim dưới giỏ hàng góc trái, có bảo hành 12 tháng đổi mới!', action: 'Chỉ tay vào giỏ hàng và vẫy tay chào' }
    ],
    callToAction: 'Bấm ngay giỏ hàng góc trái để nhận ưu đãi freeship và bảo hành chính hãng 1 đổi 1!',
    hashtags: ['#tainghebluetooth', '#baseusbowiem2s', '#tainghechongon', '#sinhvien', '#tiktokmademebuyit'],
    status: 'pending',
    tone: 'Hài hước dí dỏm',
    createdAt: 'Hôm nay, 11:05',
    estimatedViews: '80k - 180k',
    isDemo: true
  },
  {
    id: 'script-03',
    productId: 'prod-03',
    productName: 'Serum Chống Nắng La Roche-Posay',
    platform: 'shopee',
    title: 'Bí Quyết Da Dầu Mụn Đi Nắng 40 Độ Không Đổ Dầu Bóng Nhẫy',
    targetDuration: '35 giây',
    hookVariantA: 'Nếu da bạn cứ bôi kem chống nắng là lên mụn ẩn với đổ dầu như chảo mỡ, hãy dừng lại xem hết video này.',
    hookVariantB: 'Chân ái chống nắng cho hội da mụn mùa hè được các bác sĩ da liễu khuyên dùng suốt 5 năm qua.',
    activeHook: 'A',
    bodyStory: 'Chất serum mỏng nhẹ thấm trong 10 giây, màng lọc UV quang phổ rộng bảo vệ da toàn diện, kiềm dầu đến 12 tiếng.',
    voiceoverLines: [
      { timestamp: '00:00 - 00:04', speech: 'Da cứ bôi kem chống nắng là bí tắc lên mụn ẩn? Bạn đang dùng sai loại rồi!', action: 'Zoom cận da mặt sạch thoáng không dầu' },
      { timestamp: '00:05 - 00:18', speech: 'Chất kem lỏng như nước, thoa lên tiệp vào da chỉ sau 10 giây, không vệt trắng, không dính khẩu trang.', action: 'Thoa một lượng nhỏ lên mu bàn tay và dùng giấy thấm dầu test' },
      { timestamp: '00:19 - 00:35', speech: 'Mall đang có mã voucher giảm 40k kèm quà tặng sữa rửa mặt mini, lưu link trên bio hoặc mô tả nha!', action: 'Hiện banner quà tặng và hướng dẫn lưu mã Shopee' }
    ],
    callToAction: 'Nhấp ngay link dưới mô tả để nhận combo quà tặng La Roche-Posay chính hãng số lượng có hạn!',
    hashtags: ['#chamsocda', '#kemchongnang', '#larocheposay', '#reviewlamdep', '#shopeehaul'],
    status: 'draft',
    tone: 'Chuyên gia phân tích',
    createdAt: 'Hôm qua, 18:30',
    estimatedViews: '50k - 120k',
    isDemo: true
  }
];

export const initialCampaigns: Campaign[] = [
  {
    id: 'camp-01',
    name: 'Chiến dịch Setup Bàn Phím Cơ - Mùa Tựu Trường & Văn Phòng',
    channel: 'TikTok Ads Boost',
    productName: 'Monsgeek M1W V3',
    budgetVND: 5000000, // 5 triệu VNĐ
    spentVND: 3420000,
    views: 312000,
    clicks: 7420,
    orders: 148,
    commissionEarnedVND: 12840000,
    roiPercentage: 275.4, // ROI = (12.84 - 3.42) / 3.42 * 100% or Commission / Spent = 375%
    status: 'running',
    startDate: '25/10/2026',
    endDate: '05/11/2026',
    isDemo: true
  },
  {
    id: 'camp-02',
    name: 'Flash Sale Tai Nghe Chống Ồn Sinh Viên Siêu Rẻ',
    channel: 'TikTok Ads Boost',
    productName: 'Baseus Bowie M2s',
    budgetVND: 3000000,
    spentVND: 2150000,
    views: 185000,
    clicks: 4890,
    orders: 95,
    commissionEarnedVND: 6790000,
    roiPercentage: 215.8,
    status: 'running',
    startDate: '27/10/2026',
    endDate: '02/11/2026',
    isDemo: true
  },
  {
    id: 'camp-03',
    name: 'Seeding Khô Bò Cay Ăn Vặt Giờ Chiều Công Sở',
    channel: 'KOC Shortform Combo',
    productName: 'Khô Bò Sợi Cháy Tỏi',
    budgetVND: 2000000,
    spentVND: 1800000,
    views: 94000,
    clicks: 1980,
    orders: 164,
    commissionEarnedVND: 5412000,
    roiPercentage: 200.7,
    status: 'running',
    startDate: '28/10/2026',
    endDate: '04/11/2026',
    isDemo: true
  },
  {
    id: 'camp-04',
    name: 'Shopee Live Affiliate - Nồi Chiên Không Dầu Mùa Lạnh',
    channel: 'Shopee Affiliate Post',
    productName: 'Lock&Lock EJF284BLK',
    budgetVND: 1500000,
    spentVND: 950000,
    views: 45000,
    clicks: 720,
    orders: 18,
    commissionEarnedVND: 3870000,
    roiPercentage: 307.4,
    status: 'paused',
    startDate: '26/10/2026',
    endDate: '31/10/2026',
    isDemo: true
  }
];

export const initialCronTasks: CronTask[] = [
  {
    id: 'cron-01',
    name: 'Quét Deal Xu Hướng TikTok Shop & Shopee',
    scheduleTime: 'Mỗi 2 giờ (06:00, 08:00, 10:00...)',
    targetAgent: 'Scout AI (DeepSeek V3)',
    actionDescription: 'Tự động cào dữ liệu top 500 sản phẩm đang tăng trưởng doanh số, lọc hoa hồng >= 15%.',
    status: 'active',
    lastRunStatus: 'success',
    lastRunTime: '08:00 (Thành công)'
  },
  {
    id: 'cron-02',
    name: 'Tạo Kịch Bản Video Ngắn Cho Top 3 Deal Hot',
    scheduleTime: 'Hàng ngày lúc 09:30 & 15:30',
    targetAgent: 'Copywriter AI (Gemini 2.5 Flash)',
    actionDescription: 'Viết tự động 3 biến thể kịch bản Hook 3s + lời thoại phân cảnh gửi vào Xưởng Nội Dung.',
    status: 'active',
    lastRunStatus: 'success',
    lastRunTime: '09:30 (Thành công)'
  },
  {
    id: 'cron-03',
    name: 'Rà Soát Link Hết Hạn & Từ Khóa Vi Phạm Chính Sách',
    scheduleTime: 'Mỗi 4 giờ (02:00, 06:00, 10:00...)',
    targetAgent: 'Auditor AI (Claude 3.5 Sonnet)',
    actionDescription: 'Kiểm tra trạng thái link affiliate, phát hiện sản phẩm hết hàng hoặc bị giảm hoa hồng đột ngột.',
    status: 'active',
    lastRunStatus: 'success',
    lastRunTime: '10:00 (Thành công)'
  },
  {
    id: 'cron-04',
    name: 'Cân Đối Ngân Sách Ads & Tự Động Ngắt Chiến Dịch ROI Thấp',
    scheduleTime: 'Mỗi 1 giờ (Chạy ngầm 24/7)',
    targetAgent: 'Ads & Traffic AI (Gemini 2.5)',
    actionDescription: 'Nếu chiến dịch quảng cáo có CPC > 800đ hoặc ROI < 150% thì tự động gửi cảnh báo và tạm dừng.',
    status: 'active',
    lastRunStatus: 'success',
    lastRunTime: '11:00 (Thành công)'
  }
];

export const initialSystemLogs: SystemLog[] = [
  {
    id: 'log-01',
    timestamp: '11:15:22',
    level: 'info',
    source: 'Hệ thống',
    message: 'Khởi tạo phiên giám sát 24/7 AI Command Center trên thiết bị di động.',
    isDemo: true
  },
  {
    id: 'log-02',
    timestamp: '11:12:04',
    level: 'success',
    source: 'Scout AI',
    message: 'Tìm thấy 3 deal tiềm năng mới: Bàn phím cơ Monsgeek M1W (Hoa hồng 18%, Viral Score 94).',
    isDemo: true
  },
  {
    id: 'log-03',
    timestamp: '11:08:45',
    level: 'success',
    source: 'Copywriter AI',
    message: 'Sinh thành công 2 biến thể kịch bản Hook A/B cho tai nghe Baseus Bowie M2s.',
    isDemo: true
  },
  {
    id: 'log-04',
    timestamp: '11:02:18',
    level: 'warn',
    source: 'Auditor AI',
    message: 'Cảnh báo kịch bản mã #SCR-92 chứa từ khóa "cam kết trị mụn 100%". Đã tự động đổi sang "hỗ trợ cải thiện mụn sau 7 ngày".',
    isDemo: true
  },
  {
    id: 'log-05',
    timestamp: '10:45:00',
    level: 'info',
    source: 'Ads AI',
    message: 'Cập nhật ROI chiến dịch Setup Bàn Phím Cơ đạt 275.4%. Duy trì ngân sách hiện tại.',
    isDemo: true
  },
  {
    id: 'log-06',
    timestamp: '10:30:12',
    level: 'success',
    source: 'Hệ thống',
    message: 'Đồng bộ hóa 89 đơn hàng mới từ TikTok Shop Affiliate API. Doanh thu tăng +4.920.000 VNĐ.',
    isDemo: true
  }
];
