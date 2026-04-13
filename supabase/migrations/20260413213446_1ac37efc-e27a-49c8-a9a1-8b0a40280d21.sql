ALTER TABLE public.product_option_values 
ADD COLUMN parent_id uuid REFERENCES public.product_option_values(id) ON DELETE SET NULL;