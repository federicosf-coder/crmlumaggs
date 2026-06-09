INSERT INTO public.credit_doc_templates (key, entidad, nombre, contenido_html, header_html, footer_html, pagina_tamano, activo)
VALUES (
  'lfpiorpi',
  'ambas',
  'Recursos de Procedencia Lícita',
  $$<p class="doc-right"><strong>LUGAR Y FECHA:</strong> {{ciudad_firma}}, a {{fecha_firma}}</p>

<p style="text-align:center;margin-top:10pt"><strong>ASUNTO: DECLARACIÓN DE ORIGEN Y LICITUD DE RECURSOS</strong></p>

<p style="margin-top:10pt"><strong>A QUIEN CORRESPONDA:</strong></p>
<p><strong>{{empresa_vendedora_nombre_largo}}</strong><br/>P R E S E N T E.</p>

<p>El que suscribe, <strong>{{rep_legal_nombre}}</strong>, actuando en mi propio nombre o, en su caso, en nombre y representación de <strong>{{razon_social}}</strong> ({{tipo_persona_label}}), y para dar cumplimiento a las disposiciones establecidas en la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI) y su normatividad secundaria, declaro bajo protesta de decir verdad lo siguiente:</p>

<p><strong>PRIMERO.-</strong> Que los recursos, bienes, fondos y/o valores, monetarios o de cualquier otra índole, que entrego, transfiero, deposito o destino en relación con la operación, contrato o servicio celebrado con ustedes, tienen un origen lícito.</p>

<p><strong>SEGUNDO.-</strong> Que dichos recursos provienen directa y exclusivamente del desarrollo de mis actividades económicas y comerciales, las cuales se encuentran dentro del marco legal vigente en los Estados Unidos Mexicanos, y bajo ninguna circunstancia provienen, ni se utilizarán, para financiar, apoyar u ocultar actividades ilícitas de las contempladas en el Código Penal Federal o legislación aplicable.</p>

<p><strong>TERCERO.-</strong> Que los recursos son de mi propiedad exclusiva y no actúo en nombre ni por cuenta de un tercero oculto o no declarado, obligándome a informar de manera inmediata a esta institución en caso de que dicha situación cambie.</p>

<p><strong>CUARTO.-</strong> Autorizo expresamente a <strong>{{empresa_vendedora_nombre_largo}}</strong> para que lleve a cabo las verificaciones, análisis e investigaciones que considere pertinentes para comprobar la veracidad de esta declaración. Asimismo, me comprometo a proporcionar cualquier documentación adicional (estados de cuenta, declaraciones fiscales, facturas, actas constitutivas) que me sea requerida para cumplir con la normatividad de Prevención de Lavado de Dinero (PLD).</p>

<p><strong>QUINTO.-</strong> Asumo la plena responsabilidad jurídica y legal en caso de que esta declaración resulte ser falsa o inexacta, eximiendo a <strong>{{empresa_vendedora_nombre_largo}}</strong> de cualquier responsabilidad civil, penal o administrativa que dicha falsedad pudiera ocasionar.</p>

<p>Manifiesto mi conformidad para que la presente declaración sea del conocimiento de las autoridades competentes (incluyendo a la Secretaría de Hacienda y Crédito Público y la Unidad de Inteligencia Financiera) si así lo requieren en el ejercicio de sus facultades legales.</p>

<p style="margin-top:16pt;text-align:center"><strong>Atentamente,</strong></p>

<div class="signature-row" style="margin-top:20mm">
  <div class="sig">
    <div class="line"></div>
    <p><strong>{{rep_legal_nombre}}</strong></p>
    <p>{{razon_social}}</p>
  </div>
</div>$$,
  '',
  '',
  'letter',
  true
)
ON CONFLICT DO NOTHING;