export type ModuleType = 
  | 'dashboard' 
  | 'ai-manager' 
  | 'product-hunter' 
  | 'content-factory' 
  | 'campaign-center' 
  | 'system-control';

export interface DashboardMetric {
  revenueVND: number;
  commissionVND: number;
  totalOrders: number;
  clicks: number;
  conversionRate: number;
  activeCampaignsCount: number;
  activeAgentsCount: number;
  todayEstimatedCommission: number;
}

export interface DailyPerformance {
  date: string;
  revenue: number; // Triệu VNĐ
  commission: number; // Triệu VNĐ
  orders: number;
  clicks: number;
  isDemo?: boolean;
}

export interface PlatformShare {
  name: string;
  share: number; // %
  revenue: number; // Triệu VNĐ
  color: string;
}

export type AIProviderId = 'gemini' | 'deepseek' | 'openai' | 'grok' | 'claude';

export type AIConnectionStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';

export type AIAgentId = 
  | 'chatgpt' 
  | 'gemini' 
  | 'grok' 
  | 'claude' 
  | 'deepseek'
  // Backward compatibility aliases
  | 'scout' 
  | 'copywriter' 
  | 'visual' 
  | 'ads' 
  | 'auditor';

export interface AIAgent {
  id: AIAgentId;
  name: string;
  codeName: string;
  role: string;
  tasks?: string[];
  description: string;
  provider?: string;
  providerId?: AIProviderId;
  model: string;
  connectionStatus?: AIConnectionStatus;
  status: 'active' | 'idle' | 'paused' | 'error';
  tokenUsedToday: number;
  tokenLimit: number;
  tasksCompleted: number;
  estimatedCostVND?: number;
  systemPrompt: string;
  lastActive: string;
  avatarIcon: string;
  colorAccent: string;
  logSummary: string;
}

export interface AgentStatusReport {
  agentId?: string;
  agentName?: string;
  providerId: AIProviderId;
  providerName: string;
  configured: boolean;
  status: AIConnectionStatus;
  activeModel?: string;
  model?: string;
  role?: string;
  isPrimary?: boolean;
  isBackup?: boolean;
  latencyMs?: number;
  message?: string;
}

export interface CostQuotaStatus {
  dailyTaskCount: number;
  dailyTaskLimit: number;
  monthlySpentVND: number;
  monthlyBudgetVND: number;
  isDailyQuotaExceeded: boolean;
  isMonthlyBudgetExceeded: boolean;
}

export type PlatformType = 'tiktok' | 'shopee' | 'lazada';

export type PipelineStatus = 
  | 'DISCOVERED' 
  | 'ANALYZING' 
  | 'SHORTLISTED' 
  | 'APPROVED' 
  | 'CONTENT_CREATED' 
  | 'PUBLISHED' 
  | 'REJECTED';

export interface ProductCompetitor {
  id: string;
  name: string;
  url?: string;
  priceVND: number;
  commissionRate?: number;
  notes?: string;
  isDirect?: boolean;
}

export interface ScoreBreakdownCriterion {
  score: number;
  maxScore: number;
  explanation: string;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProductOpportunityScore {
  totalScore: number; // 0 - 100
  tier: 'HIGH OPPORTUNITY' | 'POTENTIAL' | 'NEEDS RESEARCH' | 'LOW PRIORITY';
  breakdown: {
    affiliateCommission: ScoreBreakdownCriterion; // Max 20
    marketDemand: ScoreBreakdownCriterion;        // Max 20
    tiktokContentPotential: ScoreBreakdownCriterion; // Max 20
    competition: ScoreBreakdownCriterion;         // Max 15
    priceConversion: ScoreBreakdownCriterion;     // Max 15
    dataReliability: ScoreBreakdownCriterion;     // Max 10
  };
  disclaimer: string;
  evaluatedAt: string;
}

export interface ProductAIAnalysis {
  targetAudience: string;
  solvedNeeds: string;
  extractedUSPs: string[];
  pros: string[];
  cons: string[];
  risks: string[];
  contentAngles: string[];
  commissionAnalysis: {
    expectedCommissionVND: number;
    discountPct?: number;
    commissionRate: number;
    marginNote: string;
  };
  marketAnalysis: {
    demandLevel: string;
    seasonality: string;
    competitionLevel: string;
    targetSegment: string;
  };
  rawResponse?: string;
  modelUsed?: string;
  providerUsed?: string;
  analyzedAt?: string;
  inferenceType: 'AI_INFERENCE' | 'VERIFIED_DATA';
}

export interface ProductItem {
  id: string;
  name: string;
  category: 'Công nghệ' | 'Làm đẹp & Chăm sóc' | 'Gia dụng thông minh' | 'Thời trang & Phụ kiện' | 'Ẩm thực';
  platform: PlatformType;
  priceVND: number;
  originalPriceVND?: number;
  commissionRate: number; // e.g., 18%
  estimatedCommissionVND: number;
  viralScore: number; // 0 - 100 (Legacy alias for Opportunity Score)
  soldCount7D: number;
  rating: number;
  reviewCount?: number;
  imageUrl: string;
  affiliateUrl: string;
  shortUrl: string;
  trendReason: string;
  inStock: boolean;
  commissionStatus: 'stable' | 'increased' | 'decreased';
  isDemo?: boolean;
  createdAt?: string;

  // Phase 4 Extensions
  description?: string;
  usp?: string;
  sourceType?: 'manual' | 'csv' | 'url_import';
  sourceUrl?: string;
  dataSource?: string;
  collectedAt?: string;
  dataReliability?: number; // 0 - 100
  opportunityScore?: ProductOpportunityScore;
  aiAnalysis?: ProductAIAnalysis;
  competitors?: ProductCompetitor[];
  pipelineStatus?: PipelineStatus;
  isFavorite?: boolean;
  lastAnalyzedAt?: string;
}

export type ScriptStatus = 'draft' | 'pending' | 'approved' | 'published';

export interface ContentScript {
  id: string;
  productId: string;
  productName: string;
  platform: PlatformType;
  title: string;
  targetDuration: string; // e.g. "35s - 45s"
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
  status: ScriptStatus;
  tone: 'Hài hước dí dỏm' | 'Review chân thực' | 'Kể chuyện Drama' | 'Chuyên gia phân tích';
  createdAt: string;
  estimatedViews: string;
  unverifiedClaimsNotes?: string;
  isDemo?: boolean;
}

export type CampaignStatus = 'running' | 'scheduled' | 'paused' | 'ended';

export interface Campaign {
  id: string;
  name: string;
  channel: 'TikTok Ads Boost' | 'Shopee Affiliate Post' | 'KOC Shortform Combo' | 'Reels Seeding';
  productName: string;
  budgetVND: number;
  spentVND: number;
  views: number;
  clicks: number;
  orders: number;
  commissionEarnedVND: number;
  roiPercentage: number;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  isDemo?: boolean;
}

export interface CronTask {
  id: string;
  name: string;
  scheduleTime: string;
  targetAgent: string;
  actionDescription: string;
  status: 'active' | 'paused';
  lastRunStatus: 'success' | 'warning' | 'pending';
  lastRunTime: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  source: 'Hệ thống' | 'ChatGPT' | 'Gemini' | 'Grok' | 'Claude' | 'DeepSeek' | 'Scout AI' | 'Copywriter AI' | 'Visual AI' | 'Ads AI' | 'Auditor AI';
  message: string;
  isDemo?: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  lastSignInAt?: string;
}

export type ConnectionMode = 'supabase' | 'demo';

export interface DailyMetricRecord {
  id: string;
  metric_date: string;
  revenue_vnd: number;
  commission_vnd: number;
  total_orders: number;
  clicks: number;
  conversion_rate: number;
  note?: string;
  is_demo: boolean;
  created_at?: string;
}

