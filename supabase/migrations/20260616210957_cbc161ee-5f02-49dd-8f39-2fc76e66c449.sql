
-- Permitir a usuarios autenticados leer/escribir en los buckets de inventario
CREATE POLICY "Auth can read inventario-pedidos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inventario-pedidos');
CREATE POLICY "Auth can write inventario-pedidos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventario-pedidos');
CREATE POLICY "Auth can update inventario-pedidos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inventario-pedidos');
CREATE POLICY "Auth can delete inventario-pedidos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inventario-pedidos');

CREATE POLICY "Auth can read inventario-reclamos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inventario-reclamos');
CREATE POLICY "Auth can write inventario-reclamos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventario-reclamos');
CREATE POLICY "Auth can update inventario-reclamos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inventario-reclamos');
CREATE POLICY "Auth can delete inventario-reclamos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inventario-reclamos');
