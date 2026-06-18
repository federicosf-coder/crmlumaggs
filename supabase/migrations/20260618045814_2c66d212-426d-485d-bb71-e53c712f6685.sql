CREATE POLICY "inv_archivos_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'inventario-archivos');
CREATE POLICY "inv_archivos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inventario-archivos');
CREATE POLICY "inv_archivos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'inventario-archivos');
CREATE POLICY "inv_archivos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'inventario-archivos');