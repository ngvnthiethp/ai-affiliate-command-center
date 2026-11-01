-- ============================================================================
-- AI ACC Phase 4: Product Hunter & Product Intelligence Engine Migration
-- Non-destructive & additive: Uses ADD COLUMN IF NOT EXISTS.
-- Run this script in Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Bổ sung các cột mở rộng cho bảng public.products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS usp text,
  ADD COLUMN IF NOT EXISTS rating numeric(3, 2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'Manual Input',
  ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_reliability integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS analysis_result jsonb,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'DISCOVERED',
  ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;

-- 2. Indexes để tăng tốc lọc và sắp xếp
CREATE INDEX IF NOT EXISTS idx_products_owner_pipeline 
  ON public.products(owner_id, pipeline_status);

CREATE INDEX IF NOT EXISTS idx_products_potential_score 
  ON public.products(potential_score DESC);

CREATE INDEX IF NOT EXISTS idx_products_platform 
  ON public.products(platform);

CREATE INDEX IF NOT EXISTS idx_products_created_at 
  ON public.products(created_at DESC);

-- 3. Đảm bảo Row Level Security (RLS) bảo vệ sản phẩm riêng tư của từng user
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can view own products or public demo'
  ) THEN
    CREATE POLICY "Users can view own products or public demo" 
      ON public.products 
      FOR SELECT 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can insert own products'
  ) THEN
    CREATE POLICY "Users can insert own products" 
      ON public.products 
      FOR INSERT 
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can update own products'
  ) THEN
    CREATE POLICY "Users can update own products" 
      ON public.products 
      FOR UPDATE 
      USING (auth.uid() = owner_id OR owner_id IS NULL)
      WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Users can delete own products'
  ) THEN
    CREATE POLICY "Users can delete own products" 
      ON public.products 
      FOR DELETE 
      USING (auth.uid() = owner_id OR owner_id IS NULL);
  END IF;
END $$;
