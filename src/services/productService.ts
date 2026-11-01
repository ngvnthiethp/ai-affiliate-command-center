import { getSupabaseClient, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase';
import { ProductItem } from '../types';

/**
 * EXACT columns of public.products verified against live database schema:
 * - id: uuid or bigint (generated)
 * - name: text
 * - category: text
 * - platform: text
 * - price: numeric
 * - commission_rate: numeric
 * - potential_score: numeric
 * - affiliate_url: text
 * - notes: text
 * - status: text
 * - created_at: timestamptz
 *
 * NOTE: The following columns DO NOT EXIST in public.products:
 * commission_status, price_vnd, estimated_commission_vnd, viral_score,
 * sold_count_7d, rating, image_url, short_url, trend_reason, in_stock, is_demo.
 */
export interface DBProductRow {
  id?: string;
  name: string;
  category: string;
  platform: string;
  price: number;
  commission_rate: number;
  potential_score: number;
  affiliate_url: string;
  notes: string;
  status: string;
  created_at?: string;

  // Phase 4 Additive columns
  original_price?: number;
  description?: string;
  usp?: string;
  rating?: number;
  review_count?: number;
  sold_count?: number;
  source_type?: string;
  source_url?: string;
  data_source?: string;
  collected_at?: string;
  data_reliability?: number;
  analysis_result?: any;
  score_breakdown?: any;
  competitors?: any;
  is_favorite?: boolean;
  pipeline_status?: string;
  last_analyzed_at?: string;
}

export const mapDBRowToProduct = (row: any): ProductItem => {
  const price = Number(row.price) || 0;
  const commissionRate = Number(row.commission_rate) || 0;
  const estimatedCommission = Math.round((price * commissionRate) / 100);

  return {
    id: String(row.id),
    name: row.name || 'Sản phẩm chưa đặt tên',
    category: row.category || 'Công nghệ',
    platform: row.platform || 'tiktok',
    priceVND: price,
    originalPriceVND: row.original_price ? Number(row.original_price) : undefined,
    commissionRate: commissionRate,
    estimatedCommissionVND: estimatedCommission,
    viralScore: Number(row.potential_score) || 75,
    soldCount7D: Number(row.sold_count) || 0,
    rating: Number(row.rating) || 5.0,
    reviewCount: row.review_count ? Number(row.review_count) : undefined,
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: row.affiliate_url || '',
    shortUrl: row.affiliate_url || '',
    trendReason: row.notes || 'Sản phẩm theo dõi bởi Scout AI',
    inStock: true,
    commissionStatus: row.status || 'stable',
    isDemo: false, // Items retrieved from Supabase are strictly real user data
    createdAt: row.created_at,

    // Phase 4 fields
    description: row.description || undefined,
    usp: row.usp || undefined,
    sourceType: (row.source_type as any) || 'manual',
    sourceUrl: row.source_url || undefined,
    dataSource: row.data_source || 'Manual Input',
    collectedAt: row.collected_at || undefined,
    dataReliability: row.data_reliability ? Number(row.data_reliability) : 80,
    opportunityScore: row.score_breakdown || undefined,
    aiAnalysis: row.analysis_result || undefined,
    competitors: Array.isArray(row.competitors) ? row.competitors : [],
    isFavorite: Boolean(row.is_favorite),
    pipelineStatus: row.pipeline_status || 'DISCOVERED',
    lastAnalyzedAt: row.last_analyzed_at || undefined
  };
};

/**
 * Maps full Phase 4 product row
 */
export const mapProductToFullDBRow = (item: Partial<ProductItem>): Partial<DBProductRow> => {
  const row: Partial<DBProductRow> = {};
  if (item.name !== undefined) row.name = item.name.trim();
  if (item.category !== undefined) row.category = item.category;
  if (item.platform !== undefined) row.platform = item.platform;
  if (item.priceVND !== undefined) row.price = Number(item.priceVND) || 0;
  if (item.originalPriceVND !== undefined) row.original_price = Number(item.originalPriceVND) || 0;
  if (item.commissionRate !== undefined) row.commission_rate = Number(item.commissionRate) || 0;
  if (item.viralScore !== undefined) row.potential_score = Number(item.viralScore) || 75;
  if (item.affiliateUrl !== undefined) row.affiliate_url = item.affiliateUrl.trim();
  if (item.trendReason !== undefined) row.notes = item.trendReason;
  if (item.commissionStatus !== undefined) row.status = item.commissionStatus;

  // Phase 4 fields
  if (item.description !== undefined) row.description = item.description;
  if (item.usp !== undefined) row.usp = item.usp;
  if (item.rating !== undefined) row.rating = Number(item.rating);
  if (item.reviewCount !== undefined) row.review_count = Number(item.reviewCount);
  if (item.soldCount7D !== undefined) row.sold_count = Number(item.soldCount7D);
  if (item.sourceType !== undefined) row.source_type = item.sourceType;
  if (item.sourceUrl !== undefined) row.source_url = item.sourceUrl.trim();
  if (item.dataSource !== undefined) row.data_source = item.dataSource;
  if (item.collectedAt !== undefined) row.collected_at = item.collectedAt;
  if (item.dataReliability !== undefined) row.data_reliability = Number(item.dataReliability);
  if (item.aiAnalysis !== undefined) row.analysis_result = item.aiAnalysis;
  if (item.opportunityScore !== undefined) row.score_breakdown = item.opportunityScore;
  if (item.competitors !== undefined) row.competitors = item.competitors;
  if (item.isFavorite !== undefined) row.is_favorite = Boolean(item.isFavorite);
  if (item.pipelineStatus !== undefined) row.pipeline_status = item.pipelineStatus;
  if (item.lastAnalyzedAt !== undefined) row.last_analyzed_at = item.lastAnalyzedAt;

  return row;
};

/**
 * Fallback to only CORE columns in case Phase 4 migration is pending
 */
export const mapProductToCoreDBRow = (item: Partial<ProductItem>): Partial<DBProductRow> => {
  const row: Partial<DBProductRow> = {};
  if (item.name !== undefined) row.name = item.name.trim();
  if (item.category !== undefined) row.category = item.category;
  if (item.platform !== undefined) row.platform = item.platform;
  if (item.priceVND !== undefined) row.price = Number(item.priceVND) || 0;
  if (item.commissionRate !== undefined) row.commission_rate = Number(item.commissionRate) || 0;
  if (item.viralScore !== undefined) row.potential_score = Number(item.viralScore) || 75;
  if (item.affiliateUrl !== undefined) row.affiliate_url = item.affiliateUrl.trim();
  if (item.trendReason !== undefined) row.notes = item.trendReason;
  if (item.commissionStatus !== undefined) row.status = item.commissionStatus;
  return row;
};

export const productService = {
  async fetchProducts(): Promise<{ data: ProductItem[] | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      const mapped = (data || []).map(mapDBRowToProduct);
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async createProduct(item: Omit<ProductItem, 'id'>): Promise<{ data: ProductItem | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      // 1. Try full Phase 4 row
      const fullRow = mapProductToFullDBRow(item);
      let { data, error } = await client
        .from('products')
        .insert(fullRow)
        .select()
        .single();

      // 2. If column not found error, graceful fallback to core schema
      if (error && (error.message?.includes('column') || error.code === 'PGRST204')) {
        console.warn('Phase 4 columns not yet migrated. Falling back to core columns:', error.message);
        const coreRow = mapProductToCoreDBRow(item);
        const retryResult = await client
          .from('products')
          .insert(coreRow)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      return { data: mapDBRowToProduct(data), error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async updateProduct(id: string, updates: Partial<ProductItem>): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      // 1. Try full Phase 4 updates
      const fullUpdates = mapProductToFullDBRow(updates);
      let { error } = await client
        .from('products')
        .update(fullUpdates)
        .eq('id', id);

      // 2. Graceful fallback to core updates if missing columns
      if (error && (error.message?.includes('column') || error.code === 'PGRST204')) {
        console.warn('Phase 4 columns not yet migrated on update. Falling back to core columns:', error.message);
        const coreUpdates = mapProductToCoreDBRow(updates);
        const retryResult = await client
          .from('products')
          .update(coreUpdates)
          .eq('id', id);
        error = retryResult.error;
      }

      if (error) {
        return { success: false, error: formatSupabaseError(error) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  async deleteProduct(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { error } = await client
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: formatSupabaseError(error) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  }
};
