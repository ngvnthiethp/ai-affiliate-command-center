-- ============================================================================
-- AI ACC Phase 3: Additive Migration & Atomic Quota Hardening
-- Non-destructive: Uses ADD COLUMN IF NOT EXISTS & conditional policies.
-- Run this script in Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Bổ sung các cột theo dõi chi tiết AI Brain (hoàn toàn Additive)
ALTER TABLE public.ai_task_logs 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS agent text,
  ADD COLUMN IF NOT EXISTS requested_agent text,
  ADD COLUMN IF NOT EXISTS executed_agent text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost numeric(12, 4),
  ADD COLUMN IF NOT EXISTS cost_status text DEFAULT 'estimated',
  ADD COLUMN IF NOT EXISTS fallback_reason text,
  ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

-- 2. Đảm bảo request_id là duy nhất (ngăn chặn duplicate logging từ một request)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_task_logs_request_id_unique 
  ON public.ai_task_logs(request_id) 
  WHERE request_id IS NOT NULL;

-- 3. Đánh index hỗ trợ tính toán Quota & Chi phí tốc độ cao
CREATE INDEX IF NOT EXISTS idx_ai_task_logs_owner_created 
  ON public.ai_task_logs(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_task_logs_created_at 
  ON public.ai_task_logs(created_at DESC);

-- 4. Kích hoạt Row Level Security (RLS) bảo vệ dữ liệu cá nhân
ALTER TABLE public.ai_task_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Policy SELECT: User chỉ xem logs của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can view own ai task logs'
  ) THEN
    CREATE POLICY "Users can view own ai task logs" 
      ON public.ai_task_logs 
      FOR SELECT 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  -- Policy INSERT: User chỉ ghi logs của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can insert own ai task logs'
  ) THEN
    CREATE POLICY "Users can insert own ai task logs" 
      ON public.ai_task_logs 
      FOR INSERT 
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  -- Policy UPDATE: Cho phép cập nhật bản ghi đặt chỗ quota (Reservation -> Success/Failed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can update own ai task logs'
  ) THEN
    CREATE POLICY "Users can update own ai task logs" 
      ON public.ai_task_logs 
      FOR UPDATE 
      USING (auth.uid() = owner_id OR owner_id IS NULL)
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;
END $$;

-- 5. HÀM ATOMIC QUOTA RESERVATION (Chống Race Condition Tuyệt Đối)
-- Ngăn chặn hai request gửi đồng thời vượt quá 20 tác vụ/ngày hoặc 300.000 VNĐ ngân sách
CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_owner_id uuid,
  p_request_id text,
  p_daily_limit int DEFAULT 20,
  p_monthly_budget_vnd numeric DEFAULT 300000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_current_daily_count int;
  v_current_monthly_spent numeric;
BEGIN
  -- Khóa mức transaction theo user ID để chặn race condition khi nhiều request đến cùng mili-giây
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_owner_id::text, 'acc_ai_quota_lock')));

  -- Đếm số tác vụ hôm nay: bao gồm tác vụ thành công ('success') và tác vụ đang giữ chỗ ('reserved')
  SELECT COUNT(*)
  INTO v_current_daily_count
  FROM public.ai_task_logs
  WHERE created_at >= v_today_start
    AND (owner_id = p_owner_id OR (owner_id IS NULL AND p_owner_id IS NULL))
    AND status IN ('success', 'running', 'reserved');

  -- Kiểm tra hạn mức ngày (mặc định 20 tác vụ/ngày)
  IF v_current_daily_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'QUOTA_EXCEEDED',
      'error', 'Hạn mức AI hôm nay đã đạt tối đa (' || v_current_daily_count || '/' || p_daily_limit || ' tác vụ). Vui lòng thử lại vào ngày mai.',
      'daily_count', v_current_daily_count,
      'daily_limit', p_daily_limit
    );
  END IF;

  -- Kiểm tra ngân sách tháng (mặc định 300.000 VNĐ)
  SELECT COALESCE(SUM(COALESCE(actual_cost, estimated_cost, 0)), 0)
  INTO v_current_monthly_spent
  FROM public.ai_task_logs
  WHERE created_at >= v_month_start
    AND (owner_id = p_owner_id OR (owner_id IS NULL AND p_owner_id IS NULL))
    AND status = 'success';

  IF v_current_monthly_spent >= p_monthly_budget_vnd THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'BUDGET_EXCEEDED',
      'error', 'Ngân sách AI tháng này đã đạt (' || ROUND(v_current_monthly_spent) || '/' || p_monthly_budget_vnd || ' VNĐ).',
      'monthly_spent', v_current_monthly_spent,
      'monthly_budget', p_monthly_budget_vnd
    );
  END IF;

  -- Ghi nhận giữ chỗ nguyên tử (Atomic Reservation) với request_id duy nhất
  -- Tránh ghi đè nếu request_id đã tồn tại
  IF NOT EXISTS (SELECT 1 FROM public.ai_task_logs WHERE request_id = p_request_id) THEN
    INSERT INTO public.ai_task_logs (
      owner_id,
      request_id,
      task_type,
      status,
      created_at
    ) VALUES (
      p_owner_id,
      p_request_id,
      'Đang giữ chỗ quota (AI Task Reserved)',
      'reserved',
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'daily_count', v_current_daily_count + 1,
    'daily_limit', p_daily_limit,
    'monthly_spent', v_current_monthly_spent,
    'monthly_budget', p_monthly_budget_vnd
  );
END;
$$;
