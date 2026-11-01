import { getSupabaseClient, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase';
import { Campaign, CampaignStatus } from '../types';

/**
 * EXACT columns of public.campaigns verified against live database schema:
 * - id: uuid or bigint (generated)
 * - name: text
 * - platform: text (e.g. 'TikTok Ads', 'Facebook Ads', 'Shopee Ads')
 * - budget: numeric
 * - status: text ('running', 'paused', 'completed')
 * - start_date: date/text
 * - end_date: date/text
 * - created_at: timestamptz
 *
 * NOTE: The following columns DO NOT EXIST in public.campaigns:
 * channel, product_name, budget_vnd, spent_vnd, views, clicks, orders,
 * commission_earned_vnd, roi_percentage, is_demo.
 */

export const mapDBRowToCampaign = (row: any): Campaign => ({
  id: String(row.id),
  name: row.name || 'Chiến dịch chưa đặt tên',
  channel: row.platform || 'TikTok Ads Boost',
  productName: '',
  budgetVND: Number(row.budget) || 0,
  spentVND: 0,
  views: 0,
  clicks: 0,
  orders: 0,
  commissionEarnedVND: 0,
  roiPercentage: 0,
  status: (row.status as CampaignStatus) || 'running',
  startDate: row.start_date || '',
  endDate: row.end_date || '',
  isDemo: false
});

/**
 * ONLY send columns that actually exist in public.campaigns.
 */
export const mapCampaignToDBRow = (c: Partial<Campaign>): Record<string, any> => {
  const row: Record<string, any> = {};
  if (c.name !== undefined) row.name = c.name;
  if (c.channel !== undefined) row.platform = c.channel;
  if (c.budgetVND !== undefined) row.budget = Number(c.budgetVND) || 0;
  if (c.status !== undefined) row.status = c.status;
  if (c.startDate !== undefined) row.start_date = c.startDate || null;
  if (c.endDate !== undefined) row.end_date = c.endDate || null;
  return row;
};

export const campaignService = {
  async fetchCampaigns(): Promise<{ data: Campaign[] | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { data, error } = await client
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      const mapped = (data || []).map(mapDBRowToCampaign);
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async createCampaign(campaign: Omit<Campaign, 'id'>): Promise<{ data: Campaign | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      // STRICT: ONLY send columns that exist in DB
      const row = mapCampaignToDBRow(campaign);

      const { data, error } = await client
        .from('campaigns')
        .insert(row)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      return { data: mapDBRowToCampaign(data), error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      const dbUpdates = mapCampaignToDBRow(updates);

      const { error } = await client
        .from('campaigns')
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

  async deleteCampaign(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { error } = await client
        .from('campaigns')
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
