UPDATE public.credit_doc_templates
SET contenido_html = $tpl$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; width: 210mm; min-height: 297mm; padding: 10mm 12mm; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6mm; padding-bottom: 4mm; border-bottom: 1.5pt solid #1a3e6e; }
  .header-logo img { height: 20mm; }
  .header-title { text-align: right; }
  .header-title .empresa { font-size: 12pt; font-weight: bold; color: #1a3e6e; text-transform: uppercase; letter-spacing: 0.6px; }
  .header-title .doc-name { font-size: 10pt; color: #555; margin-top: 2px; }
  .section-title { background-color: #1a3e6e; color: #fff; font-size: 8.5pt; font-weight: bold; text-align: center; padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 5mm; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td { border: 0.4pt solid #b0b8c8; padding: 4px 6px; vertical-align: middle; line-height: 1.5; height: 7mm; }
  table.kv th { background: #dce6f1; color: #1a3e6e; font-weight: bold; white-space: nowrap; width: 28%; font-size: 8pt; }
  table.kv td { color: #1a1a1a; font-size: 9pt; }
  table.grid th { background: #dce6f1; color: #1a3e6e; font-weight: bold; border: 0.4pt solid #b0b8c8; padding: 4px 6px; font-size: 8pt; text-align: center; height: 7mm; }
  table.grid td { border: 0.4pt solid #b0b8c8; padding: 4px 6px; font-size: 9pt; height: 8mm; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 14mm; gap: 24mm; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 0.8pt solid #1a1a1a; margin-bottom: 4px; }
  .sig p { font-size: 7.5pt; color: #444; }
</style>
</head>
<body>
<div class="header">
  <div class="header-logo"><img src="https://fnqeicdqblkhfpyboxre.supabase.co/storage/v1/object/public/logos/lumaggs.png" alt="Logo"></div>
  <div class="header-title">
    <div class="empresa">{{empresa_vendedora_nombre_largo}}</div>
    <div class="doc-name">Solicitud de Crédito</div>
  </div>
</div>
<div class="section-title">Datos Generales</div>
<table class="kv">
  <tr><th>Razón social</th><td colspan="3">{{razon_social}}</td></tr>
  <tr><th>Nombre comercial</th><td>{{nombre_comercial}}</td><th style="width:13%">RFC</th><td style="width:22%">{{rfc}}</td></tr>
  <tr><th>Teléfono(s)</th><td>{{telefono}}</td><th>Correo</th><td>{{correo}}</td></tr>
  <tr><th>Domicilio fiscal</th><td colspan="3">{{domicilio_fiscal}}</td></tr>
  <tr><th>Ciudad / Estado</th><td>{{ciudad}} / {{estado}}</td><th>Antigüedad</th><td>{{antiguedad}}</td></tr>
  <tr><th>Domicilio comercial</th><td colspan="3">{{domicilio_comercial}}</td></tr>
  <tr><th>Ciudad</th><td>{{municipio}}</td><th>Giro comercial</th><td>{{giro_comercial}}</td></tr>
  <tr><th>Monto de crédito</th><td>{{monto_credito}}</td><th>Días de crédito</th><td>{{dias_credito}}</td></tr>
</table>
<div class="section-title">Solo Personas Morales</div>
<table class="grid">
  <thead><tr><th style="width:70%">Nombre accionistas</th><th style="width:30%">No. acciones</th></tr></thead>
  <tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody>
</table>
<table class="kv">
  <tr><th>Escritura constitutiva</th><td>{{fecha_constitucion}}</td><th style="width:18%">Nacionalidad</th><td>{{nacionalidad}}</td></tr>
  <tr><th>Datos de registros</th><td colspan="3">&nbsp;</td></tr>
  <tr><th>Última asamblea ordinaria</th><td colspan="3">&nbsp;</td></tr>
  <tr><th>Administrador / Presidente del Consejo</th><td colspan="3">{{rep_legal_nombre}}</td></tr>
</table>
<div class="section-title">Datos Bancarios para Timbrado</div>
<table class="grid">
  <thead><tr><th style="width:30%">Nombre del banco</th><th style="width:35%">Número de cuenta</th><th style="width:35%">CLABE interbancaria</th></tr></thead>
  <tbody>{{datos_bancarios_html}}<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody>
</table>
<div class="section-title">Referencias Comerciales / Proveedores</div>
<table class="grid">
  <thead><tr><th style="width:35%">Nombre de la empresa</th><th style="width:35%">Nombre del contacto</th><th style="width:30%">Teléfono(s)</th></tr></thead>
  <tbody>{{referencias_comerciales_html}}<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody>
</table>
<div class="section-title">Datos del Aval</div>
<table class="kv">
  <tr><th>Nombre</th><td colspan="3">{{aval_nombre}}</td></tr>
  <tr><th>Dirección</th><td colspan="3">{{aval_direccion}}</td></tr>
  <tr><th>Ciudad</th><td>{{aval_ciudad}}</td><th>Relación con el solicitante</th><td>{{aval_relacion}}</td></tr>
  <tr><th>Régimen conyugal</th><td colspan="3">{{aval_regimen}}</td></tr>
</table>
<div class="signature-row">
  <div class="sig"><div class="line"></div><p>Nombre y firma del solicitante o representante legal</p></div>
  <div class="sig"><div class="line"></div><p>Nombre y firma del aval</p></div>
</div>
</body>
</html>$tpl$,
    header_html = '',
    footer_html = '',
    updated_at = now()
WHERE key = 'solicitud' AND entidad = 'lumaggs';