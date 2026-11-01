import { getSupabaseClient, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase';
import { SystemLog } from '../types';

/**
 * EXACT columns of public.ai_task_logs verified against live database schema:
 * - id: uuid or bigint (generated)
 * - task_type: text (mô tả nhiệm vụ AI)
 * - status: text ('success', 'failed', 'running')
 * - created_at: timestamptz
 *
 * NOTE: The following columns DO NOT EXIST in public.ai_task_logs:
 * agent_name, agent_model, level, source, message, tokens_used, is_demo.
 */

export const mapDBRowToSystemLog = (row: any): SystemLog => ({
  id: String(row.id),
  timestamp: row.created_at ? new Date(row.created_at).toTimeString().split(' ')[0] : 'Vừa xong',
  level: row.status === 'failed' ? 'error' : 'info',
  source: 'Hệ thống',
  message: row.task_type || 'Tác vụ AI',
  isDemo: false
});

export const aiLogService = {
  async fetchAITaskLogs(): Promise<{ data: SystemLog[] | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { data, error } = await client
        .from('ai_task_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      const mapped = (data || []).map(mapDBRowToSystemLog);
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async logAITask(entry: {
    agent_name?: string;
    agent_model?: string;
    level: SystemLog['level'];
    source: SystemLog['source'];
    message: string;
    tokens_used?: number;
  }): Promise<{ data: SystemLog | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      // STRICT: ONLY send columns that actually exist: task_type, status
      const taskSummary = entry.source 
        ? `[${entry.source}] ${entry.message?.slice(0, 150) || 'Task'}`
        : entry.message?.slice(0, 150) || 'AI Task';

      const status = entry.level === 'error' ? 'failed' : 'success';

      const payload = {
        task_type: taskSummary,
        status: status
      };

      const { data, error } = await client
        .from('ai_task_logs')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      return { data: mapDBRowToSystemLog(data), error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  }
};
