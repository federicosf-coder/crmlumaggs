UPDATE public.credit_doc_templates
SET contenido_html = $TPL$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: letter; margin: 6mm 6mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #1a1a1a; background: #fff; padding: 0; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2mm; padding-bottom: 1.5mm; border-bottom: 1.2pt solid #1a3e6e; }
  .header-logo img { height: 14mm; }
  .header-title { text-align: right; }
  .header-title .empresa { font-size: 11pt; font-weight: bold; color: #1a3e6e; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-title .doc-name { font-size: 9pt; color: #555; margin-top: 1px; }
  .section-title { background-color: #1a3e6e; color: #fff; font-size: 8pt; font-weight: bold; text-align: center; padding: 2px 5px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td { border: 0.4pt solid #b0b8c8; padding: 2px 5px; vertical-align: middle; line-height: 1.25; height: 5.2mm; }
  table.kv th { background: #dce6f1; color: #1a3e6e; font-weight: bold; white-space: nowrap; width: 22%; font-size: 7.5pt; text-align: left; }
  table.kv td { color: #1a1a1a; font-size: 8pt; }
  table.grid { table-layout: fixed; }
  table.grid th { background: #dce6f1; color: #1a3e6e; font-weight: bold; border: 0.4pt solid #b0b8c8; padding: 2px 5px; font-size: 7.5pt; text-align: center; height: 5.2mm; }
  table.grid td { border: 0.4pt solid #b0b8c8; padding: 2px 5px; font-size: 8pt; height: 5.6mm; word-wrap: break-word; overflow-wrap: break-word; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 8mm; gap: 14mm; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 0.8pt solid #1a1a1a; margin-bottom: 2px; height: 7mm; }
  .sig p { font-size: 7pt; color: #444; }
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
  <tr><th>Nombre comercial</th><td>{{nombre_comercial}}</td><th style="width:11%">RFC</th><td style="width:22%">{{rfc}}</td></tr>
  <tr><th>Teléfono(s)</th><td>{{telefono}}</td><th>Correo</th><td>{{correo}}</td></tr>
  <tr><th>Domicilio fiscal</th><td colspan="3">{{domicilio_fiscal}}</td></tr>
  <tr><th>Ciudad / Estado</th><td>{{ciudad}} / {{estado}}</td><th>Antigüedad</th><td>{{antiguedad}}</td></tr>
  <tr><th>Domicilio comercial</th><td colspan="3">{{domicilio_comercial}}</td></tr>
  <tr><th>Ciudad</th><td>{{municipio}}</td><th>Giro comercial</th><td>{{giro_comercial}}</td></tr>
  <tr><th>Monto de crédito</th><td>{{monto_credito}}</td><th>Días de crédito</th><td>{{dias_credito}}</td></tr>
</table>
<div class="section-title">Solo Personas Morales</div>
<table class="grid">
  <colgroup><col style="width:70%"><col style="width:30%"></colgroup>
  <thead><tr><th>Nombre accionistas</th><th>No. acciones</th></tr></thead>
  <tbody>{{accionistas_html}}</tbody>
</table>
<table class="kv">
  <tr><th>Escritura constitutiva</th><td colspan="3">{{escritura_constitutiva}}</td></tr>
  <tr><th>Datos de registros</th><td colspan="3">{{datos_registro}}</td></tr>
  <tr><th>Última asamblea ordinaria</th><td colspan="3">{{ultima_asamblea}}</td></tr>
  <tr><th>Administrador / Presidente del Consejo</th><td colspan="3">{{administrador_presidente}}</td></tr>
</table>
<div class="section-title">Datos Bancarios para Timbrado</div>
<table class="grid">
  <colgroup><col style="width:30%"><col style="width:35%"><col style="width:35%"></colgroup>
  <thead><tr><th>Nombre del banco</th><th>Número de cuenta</th><th>CLABE interbancaria</th></tr></thead>
  <tbody>{{datos_bancarios_html}}</tbody>
</table>
<div class="section-title">Referencias Comerciales / Proveedores</div>
<table class="grid">
  <colgroup><col style="width:35%"><col style="width:35%"><col style="width:30%"></colgroup>
  <thead><tr><th>Nombre de la empresa</th><th>Nombre del contacto</th><th>Teléfono(s)</th></tr></thead>
  <tbody>{{referencias_comerciales_html}}</tbody>
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
</html>$TPL$,
    header_html = '',
    footer_html = '',
    updated_at = now()
WHERE key = 'solicitud' AND entidad = 'lumaggs';