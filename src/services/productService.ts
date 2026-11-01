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
    commissionRate: commissionRate,
    estimatedCommissionVND: estimatedCommission,
    viralScore: Number(row.potential_score) || 75,
    soldCount7D: 0,
    rating: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
    affiliateUrl: row.affiliate_url || '',
    shortUrl: row.affiliate_url || '',
    trendReason: row.notes || 'Sản phẩm theo dõi bởi Scout AI',
    inStock: true,
    commissionStatus: row.status || 'stable',
    isDemo: false, // Items retrieved from Supabase are strictly real user data
    createdAt: row.created_at
  };
};

/**
 * ONLY map and return columns that ACTUALLY EXIST in public.products table.
 */
export const mapProductToDBRow = (item: Partial<ProductItem>): Partial<DBProductRow> => {
  const row: Partial<DBProductRow> = {};
  if (item.name !== undefined) row.name = item.name.trim();
  if (item.category !== undefined) row.category = item.category;
  if (item.platform !== undefined) row.platform = item.platform;
  if (item.priceVND !== undefined) row.price = Number(item.priceVND) || 0;
  if (item.commissionRate !== undefined) row.commission_rate = Number(item.commissionRate) || 0;
  if (item.viralScore !== undefined) row.potential_score = Number(item.viralScore) || 75;
  if (item.affiliateUrl !== undefined) row.affiliate_url = item.affiliateUrl.trim();
  if (item.trendReason !== undefined) row.notes = item.trendReason;
  // Map commissionStatus or existing status into database column 'status'
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
      // STRICT: ONLY send columns that actually exist in the DB schema
      const row = mapProductToDBRow(item);

      const { data, error } = await client
        .from('products')
        .insert(row)
        .select()
        .single();

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
      // STRICT: ONLY send columns that actually exist in the DB schema
      const dbUpdates = mapProductToDBRow(updates);

      const { error } = await client
        .from('products')
        .update(dbUpdates)
        .eq('id', id);

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
