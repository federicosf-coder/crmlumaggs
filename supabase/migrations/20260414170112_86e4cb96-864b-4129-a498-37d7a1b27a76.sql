
ALTER TABLE public.crm_activities
ADD COLUMN activity_date timestamp with time zone NOT NULL DEFAULT now();

-- Backfill existing rows
UPDATE public.crm_activities SET activity_date = created_at;
