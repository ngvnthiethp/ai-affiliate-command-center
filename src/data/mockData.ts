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
    id: 'scout',
    name: 'Scout AI (Trinh Sát Deal)',
    codeName: 'DEAL-HUNTER-V3',
    role: 'Săn Deal Hot & Phân Tích Trend Thị Trường',
    description: 'Tự động quét thuật toán TikTok Shop & Shopee Việt Nam mỗi 2 giờ để tìm sản phẩm hoa hồng cao (>15%) và điểm lan tỏa > 80.',
    model: 'DeepSeek V3',
    status: 'active',
    tokenUsedToday: 42150,
    tokenLimit: 100000,
    tasksCompleted: 48,
    systemPrompt: `Bạn là Scout AI - Chuyên gia phân tích dữ liệu E-commerce và Affiliate Marketing hàng đầu Việt Nam.
Nhiệm vụ của bạn:
1. Phát hiện các sản phẩm có tốc độ tăng trưởng doanh số đột biến (>30%/ngày) trên TikTok Shop VN và Shopee VN.
2. Sàng lọc sản phẩm có tỷ lệ hoa hồng tối thiểu từ 15% trở lên, uy tín shop tối thiểu 4.7 sao.
3. Chấm điểm Tiềm năng Lan tỏa (Viral Score từ 0-100) dựa trên volume thảo luận mạng xã hội.
4. Xuất danh sách dạng JSON chuẩn để Copywriter AI kế thừa.`,
    lastActive: '3 phút trước',
    avatarIcon: 'Radar',
    colorAccent: '#00F0FF',
    logSummary: 'Vừa quét 420 deal mới trên TikTok Shop, phát hiện 6 sản phẩm đạt tiêu chuẩn Viral.'
  },
  {
    id: 'copywriter',
    name: 'Copywriter AI (Biên Kịch Triệu View)',
    codeName: 'VIRAL-HOOK-GEN',
    role: 'Sản Xuất Kịch Bản Video Ngắn & Hook Giật Tít',
    description: 'Chuyên tạo kịch bản 30-45 giây chuẩn tâm lý mua hàng người Việt, tối ưu hook 3 giây đầu giữ chân người xem và kích thích bấm giỏ hàng.',
    model: 'Gemini 2.5 Flash',
    status: 'active',
    tokenUsedToday: 68400,
    tokenLimit: 150000,
    tasksCompleted: 64,
    systemPrompt: `Bạn là Copywriter AI - Bậc thầy sáng tạo kịch bản TikTok Shorts và Reels bán hàng tại thị trường Việt Nam.
Nguyên tắc vàng:
1. Hook 3 giây đầu phải chạm đúng 'nỗi đau' hoặc 'đập vỡ định kiến' (VD: Đừng mua nếu chưa biết điều này...).
2. Thân bài giải thích ngắn gọn, từ ngữ đời thường, giàu cảm xúc, dẫn chứng cụ thể.
3. Kêu gọi hành động (CTA) dứt khoát: "Nhấp ngay vào giỏ hàng màu vàng góc trái màn hình để săn voucher giảm 50k".
4. Luôn tạo sẵn 2 phương án Hook A và Hook B để thử nghiệm A/B Testing.`,
    lastActive: 'Vừa xong',
    avatarIcon: 'Sparkles',
    colorAccent: '#A855F7',
    logSummary: 'Đã hoàn thành 3 kịch bản video review cho sản phẩm Tai Nghe Baseus Bowie M2s.'
  },
  {
    id: 'visual',
    name: 'Visual AI (Đạo Diễn Hình Ảnh)',
    codeName: 'STORYBOARD-DIRECTOR',
    role: 'Lên Kịch Bản Phân Cảnh & Prompt Video/Ảnh',
    description: 'Tạo hướng dẫn góc quay bằng camera điện thoại, phân cảnh từng giây, gợi ý phụ đề text-on-screen và hiệu ứng chuyển cảnh bắt mắt.',
    model: 'Claude 3.5 Sonnet',
    status: 'active',
    tokenUsedToday: 31200,
    tokenLimit: 80000,
    tasksCompleted: 29,
    systemPrompt: `Bạn là Visual AI - Đạo diễn hình ảnh video ngắn chuyên biệt cho nhà sáng tạo nội dung Affiliate trên smartphone.
Nhiệm vụ:
1. Chia phân cảnh theo từng mốc thời gian: 0-3s, 4-10s, 11-25s, 26-35s.
2. Hướng dẫn góc quay thực tế bằng iPhone (cận cảnh macro, góc nhìn thứ nhất POV, unbox góc 45 độ).
3. Đề xuất text hiệu ứng phụ đề lớn, font chữ không chân, màu vàng/trắng tương phản cao.`,
    lastActive: '12 phút trước',
    avatarIcon: 'Video',
    colorAccent: '#38BDF8',
    logSummary: 'Tạo xong storyboard 4 phân cảnh quay sản phẩm Nồi chiên không dầu Lock&Lock.'
  },
  {
    id: 'ads',
    name: 'Ads & Traffic AI (Tối Ưu Ngân Sách)',
    codeName: 'ROI-OPTIMIZER',
    role: 'Tự Động Phân Bổ Ngân Sách & Tính ROI',
    description: 'Theo dõi chi phí quảng cáo (TikTok Spark Ads / Shopee Ads), tính toán chính xác ROI theo thời gian thực và tự ngắt nếu ROI < 150%.',
    model: 'Gemini 2.5 Flash',
    status: 'idle',
    tokenUsedToday: 18900,
    tokenLimit: 80000,
    tasksCompleted: 18,
    systemPrompt: `Bạn là Ads & Traffic AI - Quản lý ngân sách và tối ưu hóa chiến dịch quảng cáo Affiliate.
Mục tiêu:
1. Bảo vệ lợi nhuận ròng: Nếu chiến dịch có ROI dưới 150% trong 6 giờ liên tiếp, phát tín hiệu tạm dừng.
2. Đề xuất tăng ngân sách 20% cho các video có tỷ lệ chuyển đổi đơn hàng trên 4.5%.
3. Tối ưu chi phí mỗi lượt nhấp (CPC) dưới 600 VNĐ.`,
    lastActive: '25 phút trước',
    avatarIcon: 'TrendingUp',
    colorAccent: '#10B981',
    logSummary: 'Đang giám sát 4 chiến dịch quảng cáo; chi phí CPC trung bình ổn định ở mức 480 VNĐ.'
  },
  {
    id: 'auditor',
    name: 'Auditor AI (Kiểm Soát Rủi Ro & Tuân Thủ)',
    codeName: 'POLICY-SENTINEL',
    role: 'Rà Soát Từ Khóa Cấm & An Toàn Tài Khoản',
    description: 'Kiểm duyệt kịch bản để tránh các từ bị TikTok Shop / Shopee cấm (cam kết 100%, trị dứt điểm, số 1...) tránh bị bóp tương tác hoặc vi phạm.',
    model: 'Claude 3.5 Sonnet',
    status: 'active',
    tokenUsedToday: 24700,
    tokenLimit: 90000,
    tasksCompleted: 42,
    systemPrompt: `Bạn là Auditor AI - Chuyên viên tuân thủ chính sách nền tảng TikTok Shop Việt Nam, Shopee và Meta.
Nhiệm vụ:
1. Quét toàn bộ kịch bản, hashtag và mô tả để phát hiện từ cấm: "100%", "cam kết", "trị mụn dứt điểm", "thần thánh", "hàng auth xách tay không giấy tờ".
2. Đề xuất phương án thay thế an toàn nhưng vẫn giữ được sức thuyết phục cao.
3. Rà soát link affiliate xem có chuyển hướng lỗi (404) hoặc hết mã giảm giá.`,
    lastActive: '6 phút trước',
    avatarIcon: 'ShieldCheck',
    colorAccent: '#F59E0B',
    logSummary: 'Đã phê duyệt 18 kịch bản; yêu cầu chỉnh sửa 1 kịch bản có từ khóa cam kết tuyệt đối.'
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
