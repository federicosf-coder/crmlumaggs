ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS target_role public.app_role,
  ADD COLUMN IF NOT EXISTS excluded_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];