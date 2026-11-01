import { ProductItem, ProductOpportunityScore, ProductAIAnalysis, ProductCompetitor, PlatformType, ScoreBreakdownCriterion } from '../types';
import { edgeFunctionService } from './edgeFunctionService';

export interface CompetitorComparisonSummary {
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  productPrice: number;
  pricePosition: 'lowest' | 'competitive' | 'average' | 'premium';
  priceDifferencePct: number;
  competitorsCount: number;
  keyDifferentiators: string[];
  risks: string[];
}

export interface CSVParseResult {
  headers: string[];
  rows: Partial<ProductItem>[];
  missingFieldsWarnings: string[];
  errors: string[];
}

// In-memory cache for product AI analyses to save Edge Function and AI Quota
const aiAnalysisCache = new Map<string, { analysis: ProductAIAnalysis; score: ProductOpportunityScore; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const productIntelligenceService = {
  /**
   * Thuật toán chấm điểm cơ hội sản phẩm (Opportunity Scoring 0 - 100)
   * Trọng số 6 tiêu chí:
   * 1. Affiliate Commission: 20đ
   * 2. Market Demand: 20đ
   * 3. TikTok Content Potential: 20đ
   * 4. Competition: 15đ
   * 5. Price & Conversion Potential: 15đ
   * 6. Data Reliability: 10đ
   * Chú thích: "AI-generated assessment, not guaranteed sales performance."
   */
  calculateOpportunityScore(product: Partial<ProductItem>): ProductOpportunityScore {
    const price = Number(product.priceVND) || 0;
    const rate = Number(product.commissionRate) || 0;
    const estimatedComm = Math.round((price * rate) / 100);
    const sold = Number(product.soldCount7D) || 0;
    const hasUsp = Boolean(product.usp && product.usp.trim().length > 5);
    const hasDescription = Boolean(product.description && product.description.trim().length > 10);
    const hasSourceUrl = Boolean(product.sourceUrl || product.affiliateUrl);

    // 1. Data Reliability (Tối đa 10đ)
    let reliabilityScore = 0;
    let reliabilityNotes: string[] = [];

    if (price > 0) {
      reliabilityScore += 3;
      reliabilityNotes.push('Có giá bán xác định');
    } else {
      reliabilityNotes.push('Thiếu giá bán');
    }

    if (rate > 0) {
      reliabilityScore += 2;
      reliabilityNotes.push(`Tỷ lệ hoa hồng ${rate}%`);
    } else {
      reliabilityNotes.push('Thiếu tỷ lệ hoa hồng');
    }

    if (hasUsp || hasDescription) {
      reliabilityScore += 3;
      reliabilityNotes.push('Có mô tả / USP chi tiết');
    } else {
      reliabilityNotes.push('Chưa có mô tả/USP');
    }

    if (hasSourceUrl) {
      reliabilityScore += 2;
      reliabilityNotes.push('Có link nguồn kiểm chứng');
    }

    reliabilityScore = Math.min(10, Math.max(3, reliabilityScore));
    const reliabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
      reliabilityScore >= 8 ? 'HIGH' : reliabilityScore >= 5 ? 'MEDIUM' : 'LOW';

    // 2. Affiliate Commission (Tối đa 20đ)
    let commScore = 5;
    let commExp = '';
    if (rate >= 25) {
      commScore = 20;
      commExp = `Tỷ lệ hoa hồng vượt trội ${rate}% (>25%), tối đa lợi nhuận creator.`;
    } else if (rate >= 20) {
      commScore = 18;
      commExp = `Hoa hồng hấp dẫn ${rate}% (20-24%), biên lợi nhuận cao cho Affiliate.`;
    } else if (rate >= 15) {
      commScore = 15;
      commExp = `Hoa hồng tiêu chuẩn ${rate}% (15-19%), thích hợp đẩy số lượng lớn.`;
    } else if (rate >= 10) {
      commScore = 10;
      commExp = `Hoa hồng trung bình ${rate}% (10-14%), cần volume đơn cao để bù chi phí.`;
    } else {
      commScore = 6;
      commExp = `Hoa hồng thấp ${rate}% (<10%), cân nhắc nếu sản phẩm có giá trị cao.`;
    }

    // Điều chỉnh theo giá trị tiền hoa hồng thực nhận trên mỗi đơn
    if (estimatedComm >= 100000) {
      commScore = Math.min(20, commScore + 2);
      commExp += ` Nhận ${estimatedComm.toLocaleString()}đ/đơn (Giá trị hoa hồng tiền mặt rất tốt).`;
    } else if (estimatedComm < 20000 && price > 0) {
      commScore = Math.max(4, commScore - 2);
      commExp += ` Chỉ nhận ${estimatedComm.toLocaleString()}đ/đơn, biên lãi mỏng.`;
    }

    // 3. Market Demand (Tối đa 20đ)
    let demandScore = 12; // Baseline
    let demandExp = '';
    if (sold >= 1000) {
      demandScore = 19;
      demandExp = `Sức mua cực mạnh với ${sold.toLocaleString()} đơn đã bán trong 7 ngày gần nhất.`;
    } else if (sold >= 300) {
      demandScore = 16;
      demandExp = `Lực cầu tốt (${sold.toLocaleString()} đơn/7 ngày), thị trường đang tiếp nhận mạnh.`;
    } else if (sold > 0) {
      demandScore = 13;
      demandExp = `Sản phẩm có phát sinh doanh số thực tế (${sold} đơn), đang trong giai đoạn tăng trưởng.`;
    } else {
      // Chuẩn hóa theo ngành hàng nếu chưa có số liệu bán (không tự động gán 0)
      const cat = product.category || 'Công nghệ';
      if (cat === 'Làm đẹp & Chăm sóc' || cat === 'Gia dụng thông minh') {
        demandScore = 14;
        demandExp = `Chưa có số bán verified; ngành hàng ${cat} có nhu cầu tìm kiếm cao quanh năm trên TikTok Shop.`;
      } else {
        demandScore = 12;
        demandExp = `Chưa có số bán verified; ước lượng theo nhu cầu trung bình của ngành hàng ${cat}.`;
      }
    }

    // 4. TikTok Content Potential (Tối đa 20đ)
    let contentScore = 14;
    let contentExp = '';
    const cat = product.category || '';
    if (cat === 'Làm đẹp & Chăm sóc' || cat === 'Gia dụng thông minh') {
      contentScore = 18;
      contentExp = `Rất dễ làm video review trước/sau (before/after), trực quan hóa công dụng và tạo viral hook.`;
    } else if (cat === 'Công nghệ') {
      contentScore = 16;
      contentExp = `Thuận lợi quay video unbox, test tính năng công nghệ, đọ thông số và trải nghiệm thực tế.`;
    } else if (cat === 'Ẩm thực') {
      contentScore = 17;
      contentExp = `Hiệu ứng thị giác và âm thanh ASMR kích thích vị giác chuyển đổi mua ngay cực tốt.`;
    } else {
      contentScore = 13;
      contentExp = `Phù hợp làm video phối đồ hoặc lifestyle, cần kịch bản sáng tạo để tạo độ giữ chân người xem.`;
    }

    // 5. Competition (Tối đa 15đ)
    let compScore = 11;
    let compExp = '';
    if (hasUsp) {
      compScore = 14;
      compExp = `Có USP nổi trội giúp phân biệt với các shop đối thủ, giảm áp lực cạnh tranh về giá.`;
    } else {
      compScore = 10;
      compExp = `Mức độ cạnh tranh trung bình; cần bổ sung USP độc đáo hoặc chính sách quà tặng kèm khi lên video.`;
    }

    // 6. Price & Conversion Potential (Tối đa 15đ)
    // Sweet spot cho TikTok Shop Việt Nam: 120.000đ - 450.000đ (thanh toán cảm xúc không đắn đo)
    let priceScore = 10;
    let priceExp = '';
    if (price >= 120000 && price <= 450000) {
      priceScore = 15;
      priceExp = `Mức giá ${price.toLocaleString()}đ nằm trúng điểm rơi thanh toán cảm xúc (impulse buy) tốt nhất trên TikTok Shop.`;
    } else if (price > 450000 && price <= 850000) {
      priceScore = 12;
      priceExp = `Giá ${price.toLocaleString()}đ phù hợp phân khúc trung cấp, cần video chứng minh giá trị xứng đáng.`;
    } else if (price > 850000 && price <= 1800000) {
      priceScore = 9;
      priceExp = `Giá ${price.toLocaleString()}đ đòi hỏi người xem cân nhắc kỹ hơn, thời gian ra quyết định dài hơn.`;
    } else if (price > 1800000) {
      priceScore = 7;
      priceExp = `Phân khúc giá cao (>1.8tr VNĐ), tỷ lệ chuyển đổi trực tiếp trên video ngắn sẽ chậm hơn.`;
    } else if (price > 0) {
      priceScore = 11;
      priceExp = `Mức giá hạt dẻ dưới 120.000đ, chốt đơn rất nhanh nhưng tiền hoa hồng trên đơn khiêm tốn.`;
    } else {
      priceScore = 8;
      priceExp = `Chưa có thông tin giá niêm yết cụ thể.`;
    }

    const totalScore = Math.min(100, Math.max(10, Math.round(
      commScore + demandScore + contentScore + compScore + priceScore + reliabilityScore
    )));

    let tier: ProductOpportunityScore['tier'] = 'NEEDS RESEARCH';
    if (totalScore >= 80) tier = 'HIGH OPPORTUNITY';
    else if (totalScore >= 65) tier = 'POTENTIAL';
    else if (totalScore >= 50) tier = 'NEEDS RESEARCH';
    else tier = 'LOW PRIORITY';

    return {
      totalScore,
      tier,
      breakdown: {
        affiliateCommission: {
          score: commScore,
          maxScore: 20,
          explanation: commExp,
          reliability: rate > 0 ? 'HIGH' : 'LOW'
        },
        marketDemand: {
          score: demandScore,
          maxScore: 20,
          explanation: demandExp,
          reliability: sold > 0 ? 'HIGH' : 'MEDIUM'
        },
        tiktokContentPotential: {
          score: contentScore,
          maxScore: 20,
          explanation: contentExp,
          reliability: 'HIGH'
        },
        competition: {
          score: compScore,
          maxScore: 15,
          explanation: compExp,
          reliability: hasUsp ? 'HIGH' : 'MEDIUM'
        },
        priceConversion: {
          score: priceScore,
          maxScore: 15,
          explanation: priceExp,
          reliability: price > 0 ? 'HIGH' : 'LOW'
        },
        dataReliability: {
          score: reliabilityScore,
          maxScore: 10,
          explanation: `Độ tin cậy dữ liệu: ${reliabilityNotes.join(' · ')}.`,
          reliability: reliabilityLevel
        }
      },
      disclaimer: 'AI-generated assessment, not guaranteed sales performance.',
      evaluatedAt: new Date().toISOString()
    };
  },

  /**
   * Phân tích sản phẩm bằng AI Brain Phase 3 (Gemini / Smart Fallback)
   * Có cơ chế Cache thông minh theo Product ID và thông số quan trọng
   */
  async analyzeProductWithAI(
    product: ProductItem,
    options?: { forceRefresh?: boolean; signal?: AbortSignal }
  ): Promise<{
    success: boolean;
    analysis: ProductAIAnalysis | null;
    score: ProductOpportunityScore;
    fromCache: boolean;
    modelUsed?: string;
    providerUsed?: string;
    error?: string;
  }> {
    const cacheKey = `ai_prod_acc_${product.id}_${product.priceVND}_${product.commissionRate}`;
    
    // Kiểm tra cache nếu không ép refresh
    if (!options?.forceRefresh) {
      const cached = aiAnalysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return {
          success: true,
          analysis: cached.analysis,
          score: cached.score,
          fromCache: true,
          modelUsed: cached.analysis.modelUsed,
          providerUsed: cached.analysis.providerUsed
        };
      }

      // Kiểm tra trong đối tượng sản phẩm nếu đã từng phân tích
      if (product.aiAnalysis && product.opportunityScore) {
        return {
          success: true,
          analysis: product.aiAnalysis,
          score: product.opportunityScore,
          fromCache: true,
          modelUsed: product.aiAnalysis.modelUsed,
          providerUsed: product.aiAnalysis.providerUsed
        };
      }
    }

    try {
      const res = await edgeFunctionService.invokeFunction<any>(
        'analyze_product_intelligence',
        {
          productName: product.name,
          category: product.category,
          priceVND: product.priceVND,
          originalPriceVND: product.originalPriceVND || 0,
          commissionRate: product.commissionRate,
          platform: product.platform,
          description: product.description || '',
          usp: product.usp || '',
          soldCount: product.soldCount7D || 0,
          rating: product.rating || 5.0,
          competitors: product.competitors || []
        },
        { signal: options?.signal }
      );

      if (!res.success || !res.data) {
        // Fallback sang tính toán cục bộ nếu Edge Function lỗi tạm thời
        const fallbackScore = this.calculateOpportunityScore(product);
        return {
          success: false,
          analysis: null,
          score: fallbackScore,
          fromCache: false,
          error: res.error || 'Không nhận được phân tích từ AI Brain.'
        };
      }

      const raw = res.data;
      const expectedCommission = Math.round((product.priceVND * product.commissionRate) / 100);

      // Chuẩn hóa cấu trúc AI Product Analysis
      const parsedAnalysis: ProductAIAnalysis = {
        targetAudience: raw.targetAudience || 'Khách hàng quan tâm trên TikTok Shop',
        solvedNeeds: raw.solvedNeeds || 'Giải quyết nhu cầu sử dụng thực tế hàng ngày.',
        extractedUSPs: Array.isArray(raw.extractedUSPs) ? raw.extractedUSPs : (product.usp ? [product.usp] : ['Tiện lợi', 'Chính hãng']),
        pros: Array.isArray(raw.pros) ? raw.pros : ['Giá cả cạnh tranh', 'Nhu cầu phổ biến'],
        cons: Array.isArray(raw.cons) ? raw.cons : ['Cần video minh chứng chất lượng'],
        risks: Array.isArray(raw.risks) ? raw.risks : ['Tránh phóng đại cam kết trên video'],
        contentAngles: Array.isArray(raw.contentAngles) ? raw.contentAngles : ['Review thực tế', 'So sánh giá và tính năng'],
        commissionAnalysis: {
          expectedCommissionVND: raw.commissionAnalysis?.expectedCommissionVND || expectedCommission,
          discountPct: raw.commissionAnalysis?.discountPct || (product.originalPriceVND ? Math.round(((product.originalPriceVND - product.priceVND) / product.originalPriceVND) * 100) : 0),
          commissionRate: product.commissionRate,
          marginNote: raw.commissionAnalysis?.marginNote || `Thu nhập hoa hồng ước tính: ${expectedCommission.toLocaleString()} VNĐ/đơn (Không phải doanh thu GMV).`
        },
        marketAnalysis: {
          demandLevel: raw.marketAnalysis?.demandLevel || 'Trung bình cao',
          seasonality: raw.marketAnalysis?.seasonality || 'Quanh năm',
          competitionLevel: raw.marketAnalysis?.competitionLevel || 'Trung bình',
          targetSegment: raw.marketAnalysis?.targetSegment || 'Khách hàng mua hàng qua video ngắn'
        },
        rawResponse: typeof raw === 'string' ? raw : JSON.stringify(raw),
        modelUsed: res.model || 'gemini-2.5-flash',
        providerUsed: res.provider || 'Google Gemini',
        analyzedAt: new Date().toISOString(),
        inferenceType: 'AI_INFERENCE'
      };

      // Xây dựng hoặc sử dụng Opportunity Score trả về từ AI
      let evaluatedScore: ProductOpportunityScore;
      if (raw.scoreBreakdown && typeof raw.opportunityScore === 'number') {
        evaluatedScore = {
          totalScore: Math.min(100, Math.max(0, Math.round(raw.opportunityScore))),
          tier: raw.tier || (raw.opportunityScore >= 80 ? 'HIGH OPPORTUNITY' : raw.opportunityScore >= 65 ? 'POTENTIAL' : 'NEEDS RESEARCH'),
          breakdown: {
            affiliateCommission: {
              score: raw.scoreBreakdown.affiliateCommission?.score || 15,
              maxScore: 20,
              explanation: raw.scoreBreakdown.affiliateCommission?.explanation || 'Tỷ lệ hoa hồng và thu nhập mỗi đơn.',
              reliability: raw.scoreBreakdown.affiliateCommission?.reliability || 'HIGH'
            },
            marketDemand: {
              score: raw.scoreBreakdown.marketDemand?.score || 15,
              maxScore: 20,
              explanation: raw.scoreBreakdown.marketDemand?.explanation || 'Nhu cầu thị trường.',
              reliability: raw.scoreBreakdown.marketDemand?.reliability || 'MEDIUM'
            },
            tiktokContentPotential: {
              score: raw.scoreBreakdown.tiktokContentPotential?.score || 16,
              maxScore: 20,
              explanation: raw.scoreBreakdown.tiktokContentPotential?.explanation || 'Tiềm năng video ngắn viral.',
              reliability: raw.scoreBreakdown.tiktokContentPotential?.reliability || 'HIGH'
            },
            competition: {
              score: raw.scoreBreakdown.competition?.score || 12,
              maxScore: 15,
              explanation: raw.scoreBreakdown.competition?.explanation || 'Mức độ cạnh tranh trong ngách.',
              reliability: raw.scoreBreakdown.competition?.reliability || 'MEDIUM'
            },
            priceConversion: {
              score: raw.scoreBreakdown.priceConversion?.score || 12,
              maxScore: 15,
              explanation: raw.scoreBreakdown.priceConversion?.explanation || 'Khả năng chốt đơn theo tầm giá.',
              reliability: raw.scoreBreakdown.priceConversion?.reliability || 'HIGH'
            },
            dataReliability: {
              score: raw.scoreBreakdown.dataReliability?.score || 7,
              maxScore: 10,
              explanation: raw.scoreBreakdown.dataReliability?.explanation || 'Độ hoàn thiện dữ liệu xác thực.',
              reliability: raw.scoreBreakdown.dataReliability?.reliability || 'MEDIUM'
            }
          },
          disclaimer: 'AI-generated assessment, not guaranteed sales performance.',
          evaluatedAt: new Date().toISOString()
        };
      } else {
        evaluatedScore = this.calculateOpportunityScore({
          ...product,
          usp: parsedAnalysis.extractedUSPs.join(', ')
        });
      }

      // Lưu Cache
      aiAnalysisCache.set(cacheKey, {
        analysis: parsedAnalysis,
        score: evaluatedScore,
        timestamp: Date.now()
      });

      return {
        success: true,
        analysis: parsedAnalysis,
        score: evaluatedScore,
        fromCache: false,
        modelUsed: res.model,
        providerUsed: res.provider
      };
    } catch (err: any) {
      const fallbackScore = this.calculateOpportunityScore(product);
      return {
        success: false,
        analysis: null,
        score: fallbackScore,
        fromCache: false,
        error: err?.message || 'Lỗi ngoại lệ khi phân tích sản phẩm.'
      };
    }
  },

  /**
   * So sánh sản phẩm với danh sách đối thủ cạnh tranh
   */
  compareCompetitors(product: ProductItem, competitors: ProductCompetitor[]): CompetitorComparisonSummary {
    const pPrice = product.priceVND || 0;
    if (!competitors || competitors.length === 0) {
      return {
        lowestPrice: pPrice,
        highestPrice: pPrice,
        averagePrice: pPrice,
        productPrice: pPrice,
        pricePosition: 'competitive',
        priceDifferencePct: 0,
        competitorsCount: 0,
        keyDifferentiators: [product.usp || 'Chưa nhập thông tin đối thủ để so sánh.'],
        risks: ['Nên bổ sung ít nhất 1-2 sản phẩm đối thủ để định giá tối ưu.']
      };
    }

    const prices = competitors.map((c) => c.priceVND).filter((p) => p > 0);
    const allPrices = [pPrice, ...prices];
    const lowest = Math.min(...allPrices);
    const highest = Math.max(...allPrices);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = prices.length > 0 ? Math.round(sum / prices.length) : pPrice;

    const diffPct = avg > 0 ? Math.round(((pPrice - avg) / avg) * 100) : 0;

    let position: CompetitorComparisonSummary['pricePosition'] = 'competitive';
    if (pPrice <= lowest) position = 'lowest';
    else if (pPrice >= highest) position = 'premium';
    else if (Math.abs(diffPct) <= 10) position = 'competitive';
    else position = 'average';

    const diffs: string[] = [];
    if (diffPct < -10) {
      diffs.push(`Giá rẻ hơn ${Math.abs(diffPct)}% so với trung bình đối thủ (${avg.toLocaleString()}đ) - Lợi thế chuyển đổi lớn.`);
    } else if (diffPct > 15) {
      diffs.push(`Giá cao hơn ${diffPct}% so với đối thủ - Cần kịch bản nhấn mạnh USP & chất lượng cao cấp.`);
    } else {
      diffs.push(`Mức giá tương đương đối thủ (${pPrice.toLocaleString()}đ so với TB ${avg.toLocaleString()}đ).`);
    }

    if (product.usp) {
      diffs.push(`USP nổi bật: ${product.usp}`);
    }

    const risks: string[] = [];
    if (competitors.some((c) => (c.commissionRate || 0) > product.commissionRate)) {
      risks.push('Có đối thủ chiết khấu hoa hồng cao hơn cho nhà sáng tạo.');
    }
    if (position === 'premium' && !product.usp) {
      risks.push('Giá cao hơn đối thủ nhưng chưa có USP thuyết phục.');
    }

    return {
      lowestPrice: lowest,
      highestPrice: highest,
      averagePrice: avg,
      productPrice: pPrice,
      pricePosition: position,
      priceDifferencePct: diffPct,
      competitorsCount: competitors.length,
      keyDifferentiators: diffs,
      risks: risks.length > 0 ? risks : ['Chưa ghi nhận rủi ro đáng kể.']
    };
  },

  /**
   * Parser CSV chuẩn RFC 4180
   * Hỗ trợ UTF-8, dấu phẩy, dấu ngoặc kép, ký tự xuống dòng
   */
  parseCSV(csvText: string): CSVParseResult {
    const errors: string[] = [];
    const missingWarnings: string[] = [];
    const lines: string[][] = [];

    // Parse CSV handling quoted fields and newlines
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
      const c = csvText[i];
      const nextC = csvText[i + 1];

      if (inQuotes) {
        if (c === '"') {
          if (nextC === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(field.trim());
          field = '';
        } else if (c === '\r' && nextC === '\n') {
          row.push(field.trim());
          lines.push(row);
          row = [];
          field = '';
          i += 2;
          continue;
        } else if (c === '\n' || c === '\r') {
          row.push(field.trim());
          lines.push(row);
          row = [];
          field = '';
        } else {
          field += c;
        }
      }
      i++;
    }

    if (field || row.length > 0) {
      row.push(field.trim());
      lines.push(row);
    }

    if (lines.length < 2) {
      return {
        headers: [],
        rows: [],
        missingFieldsWarnings: [],
        errors: ['File CSV trống hoặc chỉ chứa dòng tiêu đề. Vui lòng kiểm tra lại file.']
      };
    }

    const headers = lines[0].map((h) => h.toLowerCase().trim());
    
    // Header Mapping Dictionary (hỗ trợ cả tiếng Việt và tiếng Anh)
    const findIndex = (patterns: string[]) => {
      return headers.findIndex((h) => patterns.some((p) => h.includes(p)));
    };

    const nameIdx = findIndex(['tên', 'name', 'title', 'sản phẩm']);
    const priceIdx = findIndex(['giá bán', 'price', 'giá', 'cost']);
    const origPriceIdx = findIndex(['giá gốc', 'original', 'niêm yết']);
    const commIdx = findIndex(['hoa hồng', 'commission', 'rate', '%']);
    const catIdx = findIndex(['danh mục', 'category', 'ngành']);
    const platIdx = findIndex(['nền tảng', 'platform', 'sàn']);
    const affUrlIdx = findIndex(['affiliate', 'link affiliate', 'url affiliate']);
    const srcUrlIdx = findIndex(['link gốc', 'source url', 'product url', 'link']);
    const uspIdx = findIndex(['usp', 'điểm mạnh', 'đặc điểm']);
    const descIdx = findIndex(['mô tả', 'description', 'chi tiết']);
    const soldIdx = findIndex(['đã bán', 'sold', 'lượt bán']);
    const ratingIdx = findIndex(['đánh giá', 'rating', 'sao']);

    if (nameIdx === -1) {
      errors.push('Không tìm thấy cột Tên sản phẩm (Cần có header: "Tên sản phẩm", "Name", "Title").');
      return { headers, rows: [], missingFieldsWarnings: [], errors };
    }

    const parsedRows: Partial<ProductItem>[] = [];

    for (let r = 1; r < lines.length; r++) {
      const line = lines[r];
      if (line.length === 0 || (line.length === 1 && !line[0])) continue;

      const rawName = line[nameIdx] || '';
      if (!rawName.trim()) {
        missingWarnings.push(`Dòng ${r + 1}: Bỏ qua vì thiếu tên sản phẩm.`);
        continue;
      }

      // Parse price
      let price = 0;
      if (priceIdx !== -1 && line[priceIdx]) {
        price = parseInt(line[priceIdx].replace(/[^\d]/g, ''), 10) || 0;
      }

      let origPrice = 0;
      if (origPriceIdx !== -1 && line[origPriceIdx]) {
        origPrice = parseInt(line[origPriceIdx].replace(/[^\d]/g, ''), 10) || 0;
      }

      // Parse commission
      let commissionRate = 15; // Mặc định nếu không nhập
      if (commIdx !== -1 && line[commIdx]) {
        const parsedRate = parseFloat(line[commIdx].replace(/[^\d.]/g, ''));
        if (!isNaN(parsedRate) && parsedRate > 0) commissionRate = parsedRate;
      }

      // Parse category
      let category: ProductItem['category'] = 'Công nghệ';
      if (catIdx !== -1 && line[catIdx]) {
        const catText = line[catIdx].toLowerCase();
        if (catText.includes('đẹp') || catText.includes('mỹ phẩm') || catText.includes('chăm sóc')) {
          category = 'Làm đẹp & Chăm sóc';
        } else if (catText.includes('gia dụng') || catText.includes('nhà')) {
          category = 'Gia dụng thông minh';
        } else if (catText.includes('thời trang') || catText.includes('quần') || catText.includes('áo')) {
          category = 'Thời trang & Phụ kiện';
        } else if (catText.includes('ăn') || catText.includes('thực') || catText.includes('bánh')) {
          category = 'Ẩm thực';
        }
      }

      // Parse platform
      let platform: PlatformType = 'tiktok';
      if (platIdx !== -1 && line[platIdx]) {
        const pText = line[platIdx].toLowerCase();
        if (pText.includes('shopee')) platform = 'shopee';
        else if (pText.includes('lazada')) platform = 'lazada';
      }

      const affiliateUrl = affUrlIdx !== -1 ? line[affUrlIdx] : '';
      const sourceUrl = srcUrlIdx !== -1 ? line[srcUrlIdx] : '';
      const usp = uspIdx !== -1 ? line[uspIdx] : '';
      const description = descIdx !== -1 ? line[descIdx] : '';
      const soldCount = soldIdx !== -1 ? parseInt(line[soldIdx].replace(/[^\d]/g, ''), 10) || 0 : 0;
      const rating = ratingIdx !== -1 ? parseFloat(line[ratingIdx].replace(/[^\d.]/g, '')) || 5.0 : 5.0;

      const item: Partial<ProductItem> = {
        name: rawName.trim(),
        category,
        platform,
        priceVND: price,
        originalPriceVND: origPrice > 0 ? origPrice : undefined,
        commissionRate,
        estimatedCommissionVND: Math.round((price * commissionRate) / 100),
        affiliateUrl: affiliateUrl.trim(),
        sourceUrl: sourceUrl.trim(),
        usp: usp.trim(),
        description: description.trim(),
        soldCount7D: soldCount,
        rating,
        sourceType: 'csv',
        dataSource: 'CSV Import',
        collectedAt: new Date().toISOString(),
        inStock: true,
        commissionStatus: 'stable',
        pipelineStatus: 'DISCOVERED'
      };

      // Tự động tính điểm cơ hội ban đầu
      const score = this.calculateOpportunityScore(item);
      item.opportunityScore = score;
      item.viralScore = score.totalScore;
      item.dataReliability = score.breakdown.dataReliability.score * 10;

      parsedRows.push(item);
    }

    return {
      headers,
      rows: parsedRows,
      missingFieldsWarnings: missingWarnings,
      errors
    };
  },

  /**
   * Phát hiện sản phẩm trùng lặp giữa file nhập và database hiện có
   */
  detectDuplicates(
    newItems: Partial<ProductItem>[],
    existingItems: ProductItem[]
  ): {
    unique: Partial<ProductItem>[];
    duplicates: Array<{ newItem: Partial<ProductItem>; existingItem: ProductItem }>;
  } {
    const unique: Partial<ProductItem>[] = [];
    const duplicates: Array<{ newItem: Partial<ProductItem>; existingItem: ProductItem }> = [];

    const normalize = (str: string) => str.toLowerCase().replace(/[\s\-_.,]/g, '').trim();

    for (const newItem of newItems) {
      const newNameNorm = normalize(newItem.name || '');
      const newAffUrl = (newItem.affiliateUrl || '').trim();
      const newSrcUrl = (newItem.sourceUrl || '').trim();

      const matched = existingItems.find((ext) => {
        if (newNameNorm && normalize(ext.name) === newNameNorm) return true;
        if (newAffUrl && ext.affiliateUrl && ext.affiliateUrl.trim() === newAffUrl) return true;
        if (newSrcUrl && ext.sourceUrl && ext.sourceUrl.trim() === newSrcUrl) return true;
        return false;
      });

      if (matched) {
        duplicates.push({ newItem, existingItem: matched });
      } else {
        unique.push(newItem);
      }
    }

    return { unique, duplicates };
  },

  /**
   * Phân tích và làm sạch URL sản phẩm
   * Không bypass bot/CAPTCHA, tuân thủ đạo đức dữ liệu
   */
  parseProductURL(rawUrl: string): {
    valid: boolean;
    platform: PlatformType;
    canonicalUrl: string;
    productTitleHint?: string;
    error?: string;
  } {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return {
        valid: false,
        platform: 'tiktok',
        canonicalUrl: trimmed,
        error: 'URL không hợp lệ. Vui lòng bắt đầu bằng https://'
      };
    }

    try {
      const urlObj = new URL(trimmed);
      const host = urlObj.hostname.toLowerCase();

      let platform: PlatformType = 'tiktok';
      let titleHint = '';

      if (host.includes('tiktok.com') || host.includes('douyin')) {
        platform = 'tiktok';
      } else if (host.includes('shopee.vn') || host.includes('shp.ee')) {
        platform = 'shopee';
        // Extract slug from Shopee url path e.g. /Tai-nghe-bluetooth-i.12345.6789
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0].includes('-i.')) {
          titleHint = decodeURIComponent(pathParts[0].split('-i.')[0].replace(/-/g, ' '));
        }
      } else if (host.includes('lazada.vn') || host.includes('lazada.com')) {
        platform = 'lazada';
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0].endsWith('.html')) {
          titleHint = decodeURIComponent(pathParts[0].replace('.html', '').replace(/-/g, ' '));
        }
      } else {
        return {
          valid: false,
          platform: 'tiktok',
          canonicalUrl: trimmed,
          error: `Tên miền "${host}" chưa được hỗ trợ. Hệ thống chỉ hỗ trợ TikTok Shop, Shopee và Lazada.`
        };
      }

      // Làm sạch các query params rác (tracking tokens)
      const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

      return {
        valid: true,
        platform,
        canonicalUrl: cleanUrl,
        productTitleHint: titleHint || undefined
      };
    } catch {
      return {
        valid: false,
        platform: 'tiktok',
        canonicalUrl: trimmed,
        error: 'Định dạng URL bị lỗi hoặc không thể phân giải.'
      };
    }
  }
};
