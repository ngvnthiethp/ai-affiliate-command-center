import { getSupabaseClient, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase';
import { ContentScript, ScriptStatus } from '../types';

/**
 * EXACT columns of public.content_drafts verified against live database schema:
 * - id: uuid or bigint (generated)
 * - product_id: uuid (foreign key, nullable)
 * - title: text
 * - script: text (contains the full structured script JSON or text)
 * - hashtags: text[] or text (tags list)
 * - status: text ('draft', 'approved', 'rejected')
 * - created_at: timestamptz
 * - updated_at: timestamptz
 *
 * NOTE: The following columns DO NOT EXIST in public.content_drafts:
 * product_name, platform, target_duration, hook_variant_a, hook_variant_b,
 * active_hook, body_story, voiceover_lines, call_to_action, tone, estimated_views, is_demo.
 */

const isValidUUID = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export const mapDBRowToContentScript = (row: any): ContentScript => {
  let parsedContent: Record<string, any> = {};
  if (typeof row.script === 'string') {
    const trimmed = row.script.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsedContent = JSON.parse(trimmed);
      } catch {
        parsedContent = { bodyStory: row.script };
      }
    } else {
      parsedContent = { bodyStory: row.script };
    }
  }

  let hashtags: string[] = [];
  if (Array.isArray(row.hashtags)) {
    hashtags = row.hashtags;
  } else if (typeof row.hashtags === 'string') {
    const trimmed = row.hashtags.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        hashtags = JSON.parse(trimmed);
      } catch {
        hashtags = row.hashtags.split(/[\s,]+/).filter(Boolean);
      }
    } else {
      hashtags = row.hashtags.split(/[\s,]+/).filter(Boolean);
    }
  }

  return {
    id: String(row.id),
    productId: row.product_id ? String(row.product_id) : '',
    productName: parsedContent.productName || 'Sản phẩm liên kết',
    platform: parsedContent.platform || 'tiktok',
    title: row.title || 'Kịch bản chưa đặt tên',
    targetDuration: parsedContent.targetDuration || '35s - 45s',
    hookVariantA: parsedContent.hookVariantA || '',
    hookVariantB: parsedContent.hookVariantB || '',
    activeHook: parsedContent.activeHook === 'B' ? 'B' : 'A',
    bodyStory: parsedContent.bodyStory || (typeof row.script === 'string' ? row.script : ''),
    voiceoverLines: Array.isArray(parsedContent.voiceoverLines) ? parsedContent.voiceoverLines : [],
    callToAction: parsedContent.callToAction || '',
    hashtags: hashtags.length > 0 ? hashtags : (parsedContent.hashtags || ['#tiktokshop', '#review']),
    status: (row.status as ScriptStatus) || 'draft',
    tone: parsedContent.tone || 'Review chân thực',
    createdAt: row.created_at || 'Mới tạo',
    estimatedViews: parsedContent.estimatedViews || '50k - 100k',
    unverifiedClaimsNotes: parsedContent.unverifiedClaimsNotes || '',
    isDemo: false
  };
};

/**
 * ONLY map and return columns that ACTUALLY EXIST in public.content_drafts.
 * All rich structured script details are securely serialized into the 'script' column.
 */
export const mapContentScriptToDBRow = (script: Partial<ContentScript>): Record<string, any> => {
  const row: Record<string, any> = {};

  if (script.title !== undefined) row.title = script.title;
  if (script.status !== undefined) row.status = script.status;

  // Only assign product_id if it is a valid UUID, otherwise null to prevent UUID parse error
  if (script.productId !== undefined) {
    row.product_id = isValidUUID(script.productId) ? script.productId : null;
  }

  // Serialize rich structured script data into existing 'script' column
  const scriptContent = {
    productName: script.productName || '',
    platform: script.platform || 'tiktok',
    targetDuration: script.targetDuration || '35s - 45s',
    hookVariantA: script.hookVariantA || '',
    hookVariantB: script.hookVariantB || '',
    activeHook: script.activeHook || 'A',
    bodyStory: script.bodyStory || '',
    voiceoverLines: script.voiceoverLines || [],
    callToAction: script.callToAction || '',
    tone: script.tone || 'Review chân thực',
    estimatedViews: script.estimatedViews || '50k - 100k',
    unverifiedClaimsNotes: script.unverifiedClaimsNotes || ''
  };
  row.script = JSON.stringify(scriptContent);

  if (script.hashtags !== undefined) {
    row.hashtags = Array.isArray(script.hashtags) ? script.hashtags : [];
  }

  return row;
};

export const contentService = {
  async fetchContentDrafts(): Promise<{ data: ContentScript[] | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { data, error } = await client
        .from('content_drafts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      const mapped = (data || []).map(mapDBRowToContentScript);
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async createContentDraft(script: Omit<ContentScript, 'id'>): Promise<{ data: ContentScript | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Không thể khởi tạo client Supabase' };

    try {
      // STRICT: ONLY send columns that actually exist in the DB schema
      const row = mapContentScriptToDBRow(script);

      const { data, error } = await client
        .from('content_drafts')
        .insert(row)
        .select()
        .single();

      if (error) {
        return { data: null, error: formatSupabaseError(error) };
      }

      return { data: mapDBRowToContentScript(data), error: null };
    } catch (err: any) {
      return { data: null, error: formatSupabaseError(err) };
    }
  },

  async updateContentDraft(id: string, updates: Partial<ContentScript>): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      // STRICT: ONLY send columns that actually exist in the DB schema
      const dbUpdates: Record<string, any> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.hashtags !== undefined) dbUpdates.hashtags = updates.hashtags;
      
      // If any script body fields are updated, update the script column
      if (
        updates.bodyStory !== undefined ||
        updates.hookVariantA !== undefined ||
        updates.hookVariantB !== undefined ||
        updates.activeHook !== undefined ||
        updates.voiceoverLines !== undefined ||
        updates.callToAction !== undefined ||
        updates.unverifiedClaimsNotes !== undefined
      ) {
        dbUpdates.script = JSON.stringify({
          productName: updates.productName || '',
          platform: updates.platform || 'tiktok',
          targetDuration: updates.targetDuration || '35s - 45s',
          hookVariantA: updates.hookVariantA || '',
          hookVariantB: updates.hookVariantB || '',
          activeHook: updates.activeHook || 'A',
          bodyStory: updates.bodyStory || '',
          voiceoverLines: updates.voiceoverLines || [],
          callToAction: updates.callToAction || '',
          tone: updates.tone || 'Review chân thực',
          estimatedViews: updates.estimatedViews || '50k - 100k',
          unverifiedClaimsNotes: updates.unverifiedClaimsNotes || ''
        });
      }

      const { error } = await client
        .from('content_drafts')
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

  async deleteContentDraft(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Chưa kết nối Supabase' };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Không thể khởi tạo client Supabase' };

    try {
      const { error } = await client
        .from('content_drafts')
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
