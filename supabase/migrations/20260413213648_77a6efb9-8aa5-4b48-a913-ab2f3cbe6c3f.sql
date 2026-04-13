
-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow anyone authenticated to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow anyone to view logos (public)
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

-- Allow authenticated users to update/delete logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos');

-- Table to track logo assignments
CREATE TABLE public.brand_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, -- e.g. 'lumaggs', 'phillips66', 'galsa'
  label text NOT NULL,
  storage_path text, -- path in logos bucket
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brand_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read logos"
ON public.brand_logos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can manage logos"
ON public.brand_logos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default entries
INSERT INTO public.brand_logos (key, label) VALUES
('lumaggs', 'Lumaggs (Chevron)'),
('phillips66', 'Phillips 66'),
('galsa', 'Galsa');
