
-- 1) Templates table
CREATE TABLE IF NOT EXISTS public.credit_doc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  entidad text NOT NULL DEFAULT 'ambas' CHECK (entidad IN ('lumaggs','galsa','ambas')),
  nombre text NOT NULL,
  contenido_html text NOT NULL DEFAULT '',
  header_html text DEFAULT '',
  footer_html text DEFAULT '',
  pagina_tamano text NOT NULL DEFAULT 'letter',
  margenes jsonb NOT NULL DEFAULT '{"top":"18mm","right":"15mm","bottom":"18mm","left":"15mm"}'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, entidad)
);

ALTER TABLE public.credit_doc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager ven templates"
ON public.credit_doc_templates FOR SELECT
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Admin/manager modifican templates"
ON public.credit_doc_templates FOR ALL
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER credit_doc_templates_set_updated_at
BEFORE UPDATE ON public.credit_doc_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add doc_id columns to credit_requests for each firma
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS firma_solicitud_doc_id uuid REFERENCES public.credit_request_docs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS firma_buro_doc_id uuid REFERENCES public.credit_request_docs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS firma_confidencialidad_doc_id uuid REFERENCES public.credit_request_docs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS firma_subsistencia_doc_id uuid REFERENCES public.credit_request_docs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS firma_lfpiorpi_doc_id uuid REFERENCES public.credit_request_docs(id) ON DELETE SET NULL;

-- 3) Seed the 6 base templates (only if not already present)
INSERT INTO public.credit_doc_templates (key, entidad, nombre, contenido_html) VALUES
('solicitud','ambas','Solicitud de crédito',
'<h1 class="doc-title">Solicitud de Crédito</h1>
<p class="doc-subtitle">{{empresa_vendedora_nombre_largo}}</p>
<h2>Datos generales</h2>
<table class="kv">
  <tr><th>Razón social</th><td>{{razon_social}}</td></tr>
  <tr><th>Nombre comercial</th><td>{{nombre_comercial}}</td></tr>
  <tr><th>RFC</th><td>{{rfc}}</td></tr>
  <tr><th>Teléfono(s)</th><td>{{telefono}}</td></tr>
  <tr><th>Correo</th><td>{{correo}}</td></tr>
  <tr><th>Domicilio fiscal</th><td>{{domicilio_fiscal}}</td></tr>
  <tr><th>Ciudad / Estado</th><td>{{ciudad}} / {{estado}}</td></tr>
  <tr><th>Antigüedad</th><td>{{antiguedad}}</td></tr>
  <tr><th>Domicilio comercial</th><td>{{domicilio_comercial}}</td></tr>
  <tr><th>Giro comercial</th><td>{{giro_comercial}}</td></tr>
  <tr><th>Monto de crédito</th><td>{{monto_credito}}</td></tr>
  <tr><th>Días de crédito</th><td>{{dias_credito}}</td></tr>
</table>
<h2>Datos bancarios para timbrado</h2>
<table class="kv">
  <tr><th>Banco</th><td>{{banco_nombre}}</td></tr>
  <tr><th>Número de cuenta</th><td>{{banco_cuenta}}</td></tr>
  <tr><th>CLABE interbancaria</th><td>{{banco_clabe}}</td></tr>
</table>
<h2>Referencias comerciales</h2>
{{referencias_comerciales_html}}
<h2>Datos del aval</h2>
<table class="kv">
  <tr><th>Nombre</th><td>{{aval_nombre}}</td></tr>
  <tr><th>Dirección</th><td>{{aval_direccion}}</td></tr>
  <tr><th>Ciudad</th><td>{{aval_ciudad}}</td></tr>
  <tr><th>Relación con el solicitante</th><td>{{aval_relacion}}</td></tr>
  <tr><th>Régimen conyugal</th><td>{{aval_regimen}}</td></tr>
</table>
<div class="signature-row">
  <div class="sig"><div class="line"></div><p>Nombre y firma del solicitante o representante legal</p></div>
  <div class="sig"><div class="line"></div><p>Nombre y firma del aval</p></div>
</div>'),
('confidencialidad','ambas','Contrato de confidencialidad',
'<h1 class="doc-title">Contrato de Confidencialidad</h1>
<p>Contrato de confidencialidad de información que celebran por una parte la sociedad mercantil <strong>{{empresa_vendedora_nombre_largo}}</strong>, en adelante "LA EMPRESA", y por la otra parte <strong>{{razon_social}}</strong>, en adelante "EL CLIENTE".</p>
<h2>Cláusula única</h2>
<p>Ambas partes reconocen que toda la información, sin limitación alguna, será utilizada con estricto apego a la ley y a los términos del presente instrumento. Toda información intercambiada con motivo de la presente relación comercial será considerada confidencial y no podrá ser divulgada a terceros sin consentimiento por escrito de la parte propietaria.</p>
<p>El presente contrato se firma el día <strong>{{fecha_firma}}</strong> en la ciudad de <strong>{{ciudad_firma}}</strong>.</p>
<div class="signature-row">
  <div class="sig"><div class="line"></div><p>{{empresa_vendedora_nombre_largo}}</p></div>
  <div class="sig"><div class="line"></div><p>{{rep_legal_nombre}}<br/>Representante legal de {{razon_social}}</p></div>
</div>'),
('buro','ambas','Autorización Buró de Crédito',
'<h1 class="doc-title">Autorización para solicitar Reportes de Crédito</h1>
<p class="doc-subtitle">Personas Físicas / Personas Morales</p>
<p>Por este conducto autorizo expresamente a <strong>{{empresa_vendedora_nombre_largo}}</strong>, para que por sus funcionarios facultados lleve a cabo investigaciones sobre mi comportamiento crediticio o el de la empresa que represento.</p>
<table class="kv">
  <tr><th>Tipo</th><td>{{tipo_persona_label}}</td></tr>
  <tr><th>Nombre del solicitante / Razón social</th><td>{{razon_social}}</td></tr>
  <tr><th>Representante legal</th><td>{{rep_legal_nombre}}</td></tr>
  <tr><th>RFC</th><td>{{rfc}}</td></tr>
  <tr><th>Domicilio</th><td>{{domicilio_fiscal}}</td></tr>
  <tr><th>Municipio</th><td>{{municipio}}</td></tr>
  <tr><th>Estado</th><td>{{estado}}</td></tr>
  <tr><th>Fecha de la autorización</th><td>{{fecha_firma}}</td></tr>
</table>
<p>Estoy consciente y acepto que este documento quede bajo propiedad de {{empresa_vendedora_nombre_largo}} para efectos de control y cumplimiento del artículo 28 de la Ley para Regular las Sociedades de Información Crediticia.</p>
<div class="signature-row centered">
  <div class="sig"><div class="line"></div><p>Nombre y firma del solicitante / representante legal</p></div>
</div>'),
('subsistencia','ambas','Carta de Subsistencia de Poderes',
'<h1 class="doc-title">Carta de Subsistencia de Poderes</h1>
<p class="doc-right">Fecha: <strong>{{fecha_firma}}</strong></p>
<p><strong>{{empresa_vendedora_nombre_largo}}</strong><br/>P R E S E N T E</p>
<p>Con relación a las escrituras correspondientes a nuestra representada <strong>{{razon_social}}</strong>, y que en copia simple obran en su poder, por medio de la presente manifestamos bajo protesta de decir verdad que los poderes otorgados al(los) representante(s) legal(es) que en ellas se mencionan subsisten en sus términos a la fecha del presente documento y no han sido revocados, modificados ni limitados en forma alguna.</p>
<p>Sin otro particular a tratar por el momento, quedamos de usted para cualquier aclaración o comentario.</p>
<p>Atentamente,</p>
<div class="signature-row centered">
  <div class="sig"><div class="line"></div><p>{{rep_legal_nombre}}<br/>Representante Legal de {{razon_social}}</p></div>
</div>'),
('bc_si','ambas','Beneficiario Controlador — Sí existe',
'<h1 class="doc-title">Datos de Identificación de Clientes conforme a la LFPIORPI</h1>
<p>Datos del cliente y del Beneficiario Controlador, conforme a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.</p>
<h2>Datos del cliente</h2>
<table class="kv">
  <tr><th>Nombre / Razón social</th><td>{{razon_social}}</td></tr>
  <tr><th>Fecha de constitución</th><td>{{fecha_constitucion}}</td></tr>
  <tr><th>Nacionalidad</th><td>{{nacionalidad}}</td></tr>
  <tr><th>Actividad</th><td>{{giro_comercial}}</td></tr>
  <tr><th>Teléfono</th><td>{{telefono}}</td></tr>
  <tr><th>Correo</th><td>{{correo}}</td></tr>
  <tr><th>RFC</th><td>{{rfc}}</td></tr>
  <tr><th>Domicilio</th><td>{{domicilio_fiscal}}</td></tr>
</table>
<h2>Datos del representante legal</h2>
<table class="kv">
  <tr><th>Nombre</th><td>{{rep_legal_nombre}}</td></tr>
  <tr><th>Fecha de nacimiento</th><td>{{rep_legal_fecha_nac}}</td></tr>
  <tr><th>País de nacimiento</th><td>{{rep_legal_pais_nac}}</td></tr>
  <tr><th>CURP</th><td>{{rep_legal_curp}}</td></tr>
  <tr><th>RFC</th><td>{{rep_legal_rfc}}</td></tr>
  <tr><th>Identificación</th><td>{{rep_legal_id_tipo}} — {{rep_legal_id_num}}</td></tr>
</table>
<h2>Declaración del Beneficiario Controlador</h2>
<p>El que suscribe declara bajo protesta de decir verdad que <strong>SÍ</strong> existe(n) persona(s) física(s) que ejerce(n) el control efectivo, obtienen el beneficio derivado de las operaciones y/o mantienen la titularidad de los derechos correspondientes en la siguiente forma:</p>
<table class="kv">
  <tr><th>Nombre del Beneficiario Controlador</th><td>{{bc_nombre}}</td></tr>
  <tr><th>% de participación</th><td>{{bc_porcentaje}}</td></tr>
</table>
<div class="signature-row">
  <div class="sig"><div class="line"></div><p>{{razon_social}}</p></div>
  <div class="sig"><div class="line"></div><p>{{rep_legal_nombre}}<br/>Representante legal</p></div>
</div>
<p class="doc-right">Lugar y fecha: <strong>{{ciudad_firma}}, {{fecha_firma}}</strong></p>'),
('bc_no','ambas','Beneficiario Controlador — No existe',
'<h1 class="doc-title">Cuestionario para identificación de Beneficiario Controlador</h1>
<p>En términos de la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.</p>
<p>El que suscribe, en mi carácter de representante legal de <strong>{{razon_social}}</strong>, declaro bajo protesta de decir verdad que <strong>NO</strong> existe persona física o grupo de personas que, por sí mismo o a través de terceros, ejerza el control efectivo, obtenga el beneficio derivado o mantenga la titularidad de los derechos a que se refiere el artículo 3, fracción III de la citada Ley.</p>
<p>Lo anterior se manifiesta para los efectos legales a que haya lugar.</p>
<div class="signature-row centered">
  <div class="sig"><div class="line"></div><p>{{razon_social}}</p></div>
  <div class="sig"><div class="line"></div><p>{{rep_legal_nombre}}<br/>Representante legal</p></div>
</div>
<p class="doc-right">Lugar y fecha: <strong>{{ciudad_firma}}, {{fecha_firma}}</strong></p>')
ON CONFLICT (key, entidad) DO NOTHING;
