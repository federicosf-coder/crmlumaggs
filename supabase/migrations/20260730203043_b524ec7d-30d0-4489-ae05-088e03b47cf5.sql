DO $$
DECLARE r RECORD; v TEXT; i INT; nb TEXT; vars TEXT[];
BEGIN
  FOR r IN SELECT id, body FROM whatsapp_templates
           WHERE body ~ '\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}' LOOP
    vars := ARRAY(SELECT DISTINCT m[1] FROM regexp_matches(r.body, '\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}', 'g') m);
    nb := r.body; i := 0;
    FOREACH v IN ARRAY vars LOOP
      i := i + 1;
      nb := regexp_replace(nb, '\{\{\s*' || v || '\s*\}\}', '{{' || i || '}}', 'g');
    END LOOP;
    UPDATE whatsapp_templates
      SET body = nb, variable_map = to_jsonb(vars)
      WHERE id = r.id;
  END LOOP;
END $$;