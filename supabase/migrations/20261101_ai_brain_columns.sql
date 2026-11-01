-- AI ACC Phase 3: Additive Migration for AI Brain & Multi-Agent Orchestration
-- This migration is completely non-destructive (ADD COLUMN IF NOT EXISTS).
-- Run this in your Supabase Dashboard > SQL Editor if you want separate columns for AI Agent tracking.

ALTER TABLE public.ai_task_logs 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS agent text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost numeric(12, 4),
  ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Indexing for fast quota & cost checking
CREATE INDEX IF NOT EXISTS idx_ai_task_logs_owner_created 
  ON public.ai_task_logs(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_task_logs_created_at 
  ON public.ai_task_logs(created_at DESC);

-- Ensure RLS is active and allows users to read/insert their own task logs
ALTER TABLE public.ai_task_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can view own ai task logs'
  ) THEN
    CREATE POLICY "Users can view own ai task logs" 
      ON public.ai_task_logs 
      FOR SELECT 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_task_logs' AND policyname = 'Users can insert own ai task logs'
  ) THEN
    CREATE POLICY "Users can insert own ai task logs" 
      ON public.ai_task_logs 
      FOR INSERT 
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;
END $$;
