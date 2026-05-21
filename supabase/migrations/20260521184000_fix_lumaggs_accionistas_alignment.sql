UPDATE public.credit_doc_templates
SET contenido_html = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        contenido_html,
        '<table class="grid" style="table-layout:fixed !important;width:100% !important;border-collapse:separate !important;border-spacing:0 !important;">\s*<colgroup><col style="width:70%"><col style="width:30%"></colgroup>\s*<thead><tr><th style="width:70% !important;text-align:left !important">Nombre accionistas</th><th style="width:30% !important;text-align:right !important">No\. acciones</th></tr></thead>\s*<tbody>\{\{accionistas_html\}\}</tbody>\s*</table>',
        '<table class="grid accionistas-grid" style="display:table !important;table-layout:fixed !important;width:100% !important;border-collapse:separate !important;border-spacing:0 !important;">
  <colgroup><col style="width:70% !important"><col style="width:30% !important"></colgroup>
  <thead style="display:table-header-group !important"><tr style="display:table-row !important"><th class="accionista-nombre" style="display:table-cell !important;width:70% !important;text-align:left !important">Nombre accionistas</th><th class="accionista-acciones" style="display:table-cell !important;width:30% !important;text-align:right !important">No. acciones</th></tr></thead>
  <tbody style="display:table-row-group !important">{{accionistas_html}}</tbody>
</table>',
        'g'
      ),
      'table\.grid \{ table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; \}',
      'table.grid { display: table !important; table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }\n  table.grid thead { display: table-header-group !important; }\n  table.grid tbody { display: table-row-group !important; }\n  table.grid tr { display: table-row !important; }\n  table.grid th, table.grid td { display: table-cell !important; }\n  table.accionistas-grid col:first-child { width: 70% !important; }\n  table.accionistas-grid col:nth-child(2) { width: 30% !important; }\n  table.accionistas-grid th:first-child, table.accionistas-grid td:first-child { width: 70% !important; text-align: left !important; }\n  table.accionistas-grid th:nth-child(2), table.accionistas-grid td:nth-child(2) { width: 30% !important; text-align: right !important; }',
      'g'
    ),
    'table\.grid \{ table-layout:fixed; width:100%; border-collapse: separate; border-spacing:0; \}',
    'table.grid { display: table !important; table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0; }\n  table.grid thead { display: table-header-group !important; }\n  table.grid tbody { display: table-row-group !important; }\n  table.grid tr { display: table-row !important; }\n  table.grid th, table.grid td { display: table-cell !important; }\n  table.accionistas-grid col:first-child { width: 70% !important; }\n  table.accionistas-grid col:nth-child(2) { width: 30% !important; }\n  table.accionistas-grid th:first-child, table.accionistas-grid td:first-child { width: 70% !important; text-align: left !important; }\n  table.accionistas-grid th:nth-child(2), table.accionistas-grid td:nth-child(2) { width: 30% !important; text-align: right !important; }',
    'g'
  ),
  '<table class="grid" style="table-layout:fixed !important;width:100% !important;border-collapse:separate !important;border-spacing:0 !important;">\s*<colgroup><col style="width:70%"><col style="width:30%"></colgroup>\s*<thead><tr><th style="width:70%;text-align:left">Nombre accionistas</th><th style="width:30%;text-align:right">No\. acciones</th></tr></thead>\s*<tbody>\{\{accionistas_html\}\}</tbody>\s*</table>',
  '<table class="grid accionistas-grid" style="display:table !important;table-layout:fixed !important;width:100% !important;border-collapse:separate !important;border-spacing:0 !important;">
  <colgroup><col style="width:70% !important"><col style="width:30% !important"></colgroup>
  <thead style="display:table-header-group !important"><tr style="display:table-row !important"><th class="accionista-nombre" style="display:table-cell !important;width:70% !important;text-align:left !important">Nombre accionistas</th><th class="accionista-acciones" style="display:table-cell !important;width:30% !important;text-align:right !important">No. acciones</th></tr></thead>
  <tbody style="display:table-row-group !important">{{accionistas_html}}</tbody>
</table>',
  'g'
),
updated_at = now()
WHERE key = 'solicitud' AND entidad = 'lumaggs';
