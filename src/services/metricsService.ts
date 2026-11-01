import { getSupabaseClient, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase';
import { DailyMetricRecord, DashboardMetric, DailyPerformance } from '../types';

/**
 * EXACT columns of public.daily_metrics verified against live database schema:
 * - id: uuid or bigint (generated)
 * - metric_date: date (YYYY-MM-DD)
 * - gmv: numeric (doanh thu GMV)
 * - commission: numeric (hoa hồng)
 * - orders: numeric/int (số đơn)
 * - clicks: numeric/int (lượt click)
 * - is_demo: boolean
 * - created_at: timestamptz
 *
 * NOTE: The following columns DO NOT EXIST in public.daily_metrics:
 * revenue_vnd, commission_vnd, total_orders, conversion_rate, note.
 */

export const mapDBRowToDailyMetric = (row: any): DailyMetricRecord => {
  const gmv = Number(row.gmv) || 0;
  const commission = Number(row.commission) || 0;
  const orders = Number(row.orders) || 0;
  const clicks = Number(row.clicks) || 0;
  const cr = clicks > 0 ? Number(((orders / clicks) * 100).toFixed(2)) : 0;

  return {
    id: String(row.id),
    metric_date: row.metric_date || new Date().toISOString().split('T')[0],
    revenue_vnd: gmv,
    commission_vnd: commission,
    total_orders: orders,
    clicks: clicks,
    conversion_rate: cr,
    note: '',
    is_demo: Boolean(row.is_demo),
    created_at: row.created_at
  };
};

export const metricsService = {
  async fetchDailyMetrics(): Promise<{ data: DailyMetricRecord[] | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { data, error } = await client
        .from('daily_metrics')
        .select('*')
        .order('metric_date', { ascending: false });

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      const mapped = (data || []).map(mapDBRowToDailyMetric);
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async addDailyMetric(entry: {
    metric_date: string;
    revenue_vnd: number;
    commission_vnd: number;
    total_orders: number;
    clicks: number;
    conversion_rate?: number;
    note?: string;
  }): Promise<{ data: DailyMetricRecord | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      // STRICT: ONLY send columns that actually exist in daily_metrics:
      // metric_date, gmv, commission, orders, clicks, is_demo
      const payload = {
        metric_date: entry.metric_date,
        gmv: Number(entry.revenue_vnd) || 0,
        commission: Number(entry.commission_vnd) || 0,
        orders: Number(entry.total_orders) || 0,
        clicks: Number(entry.clicks) || 0,
        is_demo: false // Manual user entries are always real data
      };

      const { data, error } = await client
        .from('daily_metrics')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      return { data: mapDBRowToDailyMetric(data), error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async deleteDailyMetric(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { error } = await client
        .from('daily_metrics')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: formatSupabaseError(error) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  },

  // Compute strictly from REAL metrics, never blending demo figures
  computeRealDashboardSummary(records: DailyMetricRecord[]): {
    metrics: DashboardMetric;
    performance7D: DailyPerformance[];
  } {
    const realRecords = records.filter((r) => !r.is_demo);

    if (realRecords.length === 0) {
      return {
        metrics: {
          revenueVND: 0,
          commissionVND: 0,
          totalOrders: 0,
          clicks: 0,
          conversionRate: 0,
          activeCampaignsCount: 0,
          activeAgentsCount: 5,
          todayEstimatedCommission: 0
        },
        performance7D: []
      };
    }

    const totalRevenue = realRecords.reduce((sum, r) => sum + Number(r.revenue_vnd || 0), 0);
    const totalCommission = realRecords.reduce((sum, r) => sum + Number(r.commission_vnd || 0), 0);
    const totalOrders = realRecords.reduce((sum, r) => sum + Number(r.total_orders || 0), 0);
    const totalClicks = realRecords.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
    const avgCr = totalClicks > 0 ? Number(((totalOrders / totalClicks) * 100).toFixed(2)) : 0;

    // Sort by date ascending for chart
    const sorted = [...realRecords].sort((a, b) => a.metric_date.localeCompare(b.metric_date)).slice(-7);
    const performance7D: DailyPerformance[] = sorted.map((r) => ({
      date: r.metric_date,
      revenue: Number((Number(r.revenue_vnd) / 1000000).toFixed(2)),
      commission: Number((Number(r.commission_vnd) / 1000000).toFixed(2)),
      orders: Number(r.total_orders),
      clicks: Number(r.clicks),
      isDemo: false
    }));

    const latest = sorted[sorted.length - 1];
    const todayEst = latest ? Number(latest.commission_vnd) : 0;

    return {
      metrics: {
        revenueVND: totalRevenue,
        commissionVND: totalCommission,
        totalOrders,
        clicks: totalClicks,
        conversionRate: avgCr,
        activeCampaignsCount: 0,
        activeAgentsCount: 5,
        todayEstimatedCommission: todayEst
      },
      performance7D
    };
  }
};
