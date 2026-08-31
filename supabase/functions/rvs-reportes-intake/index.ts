import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const BUCKET = 'rvs-reportes';
const BUZON = 'reporteventassistema@correo.lumaggs.com.mx';

const PROMPT = `Este PDF es un "Reporte de Ventas por Sucursal y Agente" del sistema interno. Contiene:
1) Un encabezado con el período, siempre en el formato "Desde 01-MM-YYYY hasta DD-MM-YYYY" (acumulado del mes a la fecha).
2) Una tabla "Resumen por Sucursal" con columnas: Sucursal, Unidades, Venta, Costo, Utilidad, Margen.
3) Una tabla "Detalle por Agente" con columnas: Agente (formato "APELLIDOS NOMBRE - CLAVE"), Unidades, Venta, Costo, Utilidad, Margen.

Extrae SOLO este JSON, sin markdown ni texto adicional:
{"periodo_desde":"YYYY-MM-DD o null","periodo_hasta":"YYYY-MM-DD o null","anio_mes":"YYYY-MM o null","fecha_correo_original":"YYYY-MM-DDTHH:MM:SS o null","sucursales":[{"sucursal":"string","unidades":0,"venta":0,"costo":0,"utilidad":0,"margen":0}],"agentes":[{"nombre_agente":"string","unidades":0,"venta":0,"costo":0,"utilidad":0,"margen":0}]}

Reglas:
- "anio_mes" se deriva del período (año y mes de "Desde").
- Copia el nombre del agente TAL CUAL aparece en el PDF, incluyendo la clave (ej. "PEREZ LOPEZ JUAN - 123"). Incluye también filas especiales como "(Ninguno)" o las que empiezan con "CASA".
- Los importes son numéricos sin símbolos ni comas. El margen es porcentaje numérico (ej. 18.5).
- NO incluyas filas de totales generales ("TOTAL", "GRAN TOTAL") en ninguna de las dos listas.
- Si el PDF incluye una línea de encabezado de correo con el patrón 'Fecha: DD/MM/YYYY, HH:MM a.m./p.m.' o similar (fecha y hora de envío del correo original), extráela en "fecha_correo_original" en formato ISO 8601 completo (YYYY-MM-DDTHH:MM:SS). Si no aparece, usa null.
- Si una tabla no existe, devuelve su arreglo vacío. No inventes datos.`;

function extraerEmail(from: string): string {
  const m = from?.match(/<([^>]+)>/);
  return (m ? m[1] : from || '').trim().toLowerCase();
}

const asText = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
};

const asNum = (v: unknown) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** unaccent + upper + espacios colapsados (igual que rvs_personas.nombre_normalizado) */
function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detecta la marca por el asunto del correo (tolera prefijos tipo [EXTERNO]) */
function detectarMarca(subject: string | null): 'galsa' | 'lumaggs' | null {
  const s = normalizar(subject || '').replace(/^\[[^\]]*\]\s*/g, '');
  if (s.includes('GALSA')) return 'galsa';
  if (s.includes('LUMAGGS')) return 'lumaggs';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonRes = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET_RVS');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!WEBHOOK_SECRET) {
      console.error('RESEND_WEBHOOK_SECRET_RVS no configurado');
      return jsonRes({ error: 'RESEND_WEBHOOK_SECRET_RVS no configurado' }, 500);
    }

    const rawBody = await req.text();

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('headers svix faltantes en rvs-reportes-intake');
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    let firmaOk = false;
    try {
      const secretB64 = WEBHOOK_SECRET.replace(/^whsec_/, '');
      const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mensaje = `${svixId}.${svixTimestamp}.${rawBody}`;
      const firmaBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mensaje));
      const firmaBytes = new Uint8Array(firmaBuf);
      let firmaBin = '';
      for (let i = 0; i < firmaBytes.length; i++) firmaBin += String.fromCharCode(firmaBytes[i]);
      const esperada = btoa(firmaBin);

      const iguales = (a: string, b: string) => {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
      };

      for (const parte of svixSignature.split(' ')) {
        const [version, firma] = parte.split(',');
        if (version === 'v1' && firma && iguales(esperada, firma)) {
          firmaOk = true;
          break;
        }
      }
    } catch (e) {
      console.error('error verificando firma en rvs-reportes-intake:', (e as Error).message);
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    if (!firmaOk) {
      console.error('firma invalida en rvs-reportes-intake');
      return jsonRes({ error: 'firma_invalida' }, 401);
    }

    let evt: any;
    try {
      evt = JSON.parse(rawBody);
    } catch {
      return jsonRes({ error: 'payload_invalido' }, 400);
    }

    if (evt?.type !== 'email.received') return jsonRes({ ok: true, ignorado: evt?.type ?? null });

    const data = evt.data ?? {};
    const destinatarios: string[] = Array.isArray(data.to)
      ? data.to.map((t: unknown) => extraerEmail(String(t ?? '')))
      : [extraerEmail(String(data.to ?? ''))];

    if (!destinatarios.some((d) => d.includes(BUZON))) {
      return jsonRes({ ok: true, ignorado: 'destinatario_no_coincide' });
    }

    const emailId: string = String(data.email_id ?? data.id ?? '');
    const from = extraerEmail(String(data.from ?? ''));
    const subject: string | null = asText(data.subject);
    const attachments: Array<any> = Array.isArray(data.attachments) ? data.attachments : [];
    if (!emailId) return jsonRes({ error: 'email_id_faltante' }, 400);

    const marca = detectarMarca(subject);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const pdfs = attachments.filter((a) => String(a?.content_type ?? '').toLowerCase() === 'application/pdf');

    // Listado de adjuntos vía gateway (download_url)
    let listado: Array<any> = [];
    if (pdfs.length > 0 && LOVABLE_API_KEY && RESEND_API_KEY) {
      try {
        const attRes = await fetch(
          `https://connector-gateway.lovable.dev/resend/emails/receiving/${emailId}/attachments`,
          { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': RESEND_API_KEY } },
        );
        if (!attRes.ok) {
          console.error('error listando adjuntos:', attRes.status, await attRes.text());
        } else {
          const attJson = await attRes.json();
          listado = attJson?.data ?? attJson ?? [];
          if (!Array.isArray(listado)) listado = [];
        }
      } catch (e) {
        console.error('error listando adjuntos:', (e as Error).message);
      }
    }

    // ---- Roster de personas (matching) ----
    const { data: personasRaw } = await admin
      .from('rvs_personas')
      .select('id, nombre_reporte, nombre_normalizado, aliases, plaza_id');
    const personas = personasRaw ?? [];

    const buscarPersona = async (nombreAgente: string): Promise<{ id: string; plaza_id: string | null } | null> => {
      const exacto = personas.find((p: any) => (p.nombre_reporte || '') === nombreAgente);
      if (exacto) return { id: exacto.id, plaza_id: exacto.plaza_id ?? null };

      const norm = normalizar(nombreAgente);
      const porNorm = personas.find(
        (p: any) =>
          normalizar(p.nombre_normalizado || '') === norm ||
          normalizar(p.nombre_reporte || '') === norm ||
          (Array.isArray(p.aliases) && p.aliases.some((a: string) => normalizar(a) === norm)),
      );
      if (porNorm) return { id: porNorm.id, plaza_id: porNorm.plaza_id ?? null };

      const { data: creada, error: insErr } = await admin
        .from('rvs_personas')
        .insert({
          nombre_reporte: nombreAgente,
          nombre_normalizado: norm,
          nombre_mostrar: nombreAgente.replace(/\s*-\s*[A-Za-z0-9]{1,6}\s*$/, '').trim() || nombreAgente,
          sin_clasificar: true,
          empresa_grupo_id: null,
          puesto_id: null,
          plaza_id: null,
          user_id: null,
        })
        .select('id, nombre_reporte, nombre_normalizado, aliases, plaza_id')
        .single();
      if (insErr || !creada) {
        console.error('no se pudo crear persona:', insErr?.message);
        return null;
      }
      personas.push(creada);
      return { id: creada.id, plaza_id: null };
    };

    // ---- Plazas para el resumen por sucursal ----
    const { data: plazasRaw } = await admin.from('plazas').select('id, nombre');
    const plazas = plazasRaw ?? [];
    const buscarPlaza = (sucursal: string): string | null => {
      const s = normalizar(sucursal);
      const exacta = plazas.find((p: any) => normalizar(p.nombre) === s);
      if (exacta) return exacta.id;
      const parcial = plazas.find((p: any) => s.includes(normalizar(p.nombre)));
      return parcial ? parcial.id : null;
    };

    const procesarPdf = async (att: any) => {
      // 1) Registrar el intake
      const meta = listado.find((l: any) => String(l?.id) === String(att.id)) ?? null;
      const nombreOriginal = att.filename || 'reporte.pdf';
      const sanitizado = String(nombreOriginal).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
      const storagePath = `email-intake/${emailId}/${att.id}-${sanitizado}`;

      const { data: intakeRow, error: intakeErr } = await admin
        .from('rvs_reportes_intake')
        .insert({
          marca,
          storage_path: storagePath,
          mime_type: 'application/pdf',
          remitente_email: from || null,
          asunto_email: subject,
          resend_email_id: emailId,
          estatus: 'pendiente',
        })
        .select('id')
        .single();
      if (intakeErr || !intakeRow) throw new Error(`insert_intake_failed: ${intakeErr?.message}`);

      const marcarError = async (msg: string) => {
        await admin
          .from('rvs_reportes_intake')
          .update({ estatus: 'error', error_message: msg.slice(0, 1000) })
          .eq('id', intakeRow.id);
      };

      try {
        if (!marca) throw new Error(`marca_no_detectada: ${subject ?? ''}`);
        const downloadUrl = meta?.download_url ?? meta?.downloadUrl;
        if (!downloadUrl) throw new Error(`sin_download_url para adjunto ${att.id}`);

        const dl = await fetch(downloadUrl);
        if (!dl.ok) throw new Error(`descarga_fallida_${dl.status}`);
        const bytes = new Uint8Array(await dl.arrayBuffer());

        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

        // 2) Extracción con IA
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const dataUrl = `data:application/pdf;base64,${btoa(bin)}`;

        const res = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: PROMPT },
                  { type: 'file', file: { filename: sanitizado || 'reporte.pdf', file_data: dataUrl } },
                ],
              },
            ],
            max_tokens: 8000,
          }),
        });
        if (res.status === 429) throw new Error('rate_limit');
        if (res.status === 402) throw new Error('credits_exhausted');
        if (!res.ok) throw new Error(`gateway_${res.status}: ${(await res.text()).slice(0, 300)}`);

        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content || '';
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('json_not_found');
        const extraido = JSON.parse(m[0]);

        // 3) Derivar año-mes
        let anioMes = asText(extraido?.anio_mes);
        if (!anioMes) {
          const desde = asText(extraido?.periodo_desde) || asText(extraido?.periodo_hasta);
          if (desde && /^\d{4}-\d{2}/.test(desde)) anioMes = desde.slice(0, 7);
        }
        if (!anioMes || !/^\d{4}-\d{2}$/.test(anioMes)) throw new Error('anio_mes_no_detectado');

        // 3b) Fecha de referencia del reporte original (orden temporal)
        const parseFecha = (v: unknown): Date | null => {
          const s = asText(v);
          if (!s) return null;
          const d = new Date(s);
          return Number.isNaN(d.getTime()) ? null : d;
        };
        let notaFechaFallback: string | null = null;
        let fechaReporteOriginal: Date | null =
          parseFecha(extraido?.fecha_correo_original) ?? parseFecha(data?.created_at);
        if (!fechaReporteOriginal) {
          fechaReporteOriginal = new Date();
          notaFechaFallback = '(sin fecha original detectada, se usó hora de proceso)';
        }

        await admin
          .from('rvs_reportes_intake')
          .update({
            anio_mes: anioMes,
            payload_extraido: extraido,
            fecha_reporte_original: fechaReporteOriginal.toISOString(),
          })
          .eq('id', intakeRow.id);

        // 4) Upsert agentes (snapshot: reemplaza, nunca suma)
        // Guarda temporal: un reporte más viejo nunca sobrescribe uno más reciente
        const agentes: any[] = Array.isArray(extraido?.agentes) ? extraido.agentes : [];
        let agentesOk = 0;
        let agentesOmitidosPorFechaVieja = 0;
        for (const a of agentes) {
          const nombre = asText(a?.nombre_agente);
          if (!nombre) continue;
          if (/^(gran\s+)?total/i.test(nombre)) continue;
          const persona = await buscarPersona(nombre);
          if (!persona) continue;

          const { data: existente } = await admin
            .from('rvs_ventas_mes')
            .select('fecha_reporte_original')
            .eq('persona_id', persona.id)
            .eq('anio_mes', anioMes)
            .eq('marca', marca)
            .limit(1);
          const fechaExistente = parseFecha(existente?.[0]?.fecha_reporte_original);
          if (fechaExistente && fechaExistente.getTime() > fechaReporteOriginal.getTime()) {
            agentesOmitidosPorFechaVieja++;
            continue;
          }

          const { error: upsertErr } = await admin.from('rvs_ventas_mes').upsert(
            {
              persona_id: persona.id,
              anio_mes: anioMes,
              marca,
              unidades: asNum(a?.unidades),
              venta: asNum(a?.venta),
              costo: asNum(a?.costo),
              utilidad: asNum(a?.utilidad),
              margen: a?.margen == null ? null : asNum(a?.margen),
              plaza_id: persona.plaza_id,
              fecha_reporte_original: fechaReporteOriginal.toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'persona_id,anio_mes,marca' },
          );
          if (upsertErr) console.error('upsert agente fallo:', nombre, upsertErr.message);
          else agentesOk++;
        }

        // 5) Upsert resumen por sucursal
        // Guarda temporal: un reporte más viejo nunca sobrescribe uno más reciente
        const sucursales: any[] = Array.isArray(extraido?.sucursales) ? extraido.sucursales : [];
        let sucursalesOk = 0;
        let sucursalesOmitidasPorFechaVieja = 0;
        for (const s of sucursales) {
          const nombre = asText(s?.sucursal);
          if (!nombre) continue;
          if (/^(gran\s+)?total/i.test(nombre)) continue;
          const plazaId = buscarPlaza(nombre);
          const fila = {
            plaza_id: plazaId,
            sucursal_reporte: nombre,
            anio_mes: anioMes,
            marca,
            unidades: asNum(s?.unidades),
            venta: asNum(s?.venta),
            costo: asNum(s?.costo),
            utilidad: asNum(s?.utilidad),
            margen: s?.margen == null ? null : asNum(s?.margen),
            fecha_reporte_original: fechaReporteOriginal.toISOString(),
            updated_at: new Date().toISOString(),
          };
          let errMsg: string | null = null;
          if (plazaId) {
            const { data: existente } = await admin
              .from('rvs_ventas_mes_plaza')
              .select('fecha_reporte_original')
              .eq('plaza_id', plazaId)
              .eq('anio_mes', anioMes)
              .eq('marca', marca)
              .limit(1);
            const fechaExistente = parseFecha(existente?.[0]?.fecha_reporte_original);
            if (fechaExistente && fechaExistente.getTime() > fechaReporteOriginal.getTime()) {
              sucursalesOmitidasPorFechaVieja++;
              continue;
            }
            const { error } = await admin
              .from('rvs_ventas_mes_plaza')
              .upsert(fila, { onConflict: 'plaza_id,anio_mes,marca' });
            errMsg = error?.message ?? null;
          } else {
            // Sin plaza asociada: no aplica el índice único, se reemplaza manualmente
            const { data: existente } = await admin
              .from('rvs_ventas_mes_plaza')
              .select('id, fecha_reporte_original')
              .is('plaza_id', null)
              .eq('sucursal_reporte', nombre)
              .eq('anio_mes', anioMes)
              .eq('marca', marca)
              .limit(1);
            const fechaExistente = parseFecha(existente?.[0]?.fecha_reporte_original);
            if (fechaExistente && fechaExistente.getTime() > fechaReporteOriginal.getTime()) {
              sucursalesOmitidasPorFechaVieja++;
              continue;
            }
            if (existente && existente.length > 0) {
              const { error } = await admin.from('rvs_ventas_mes_plaza').update(fila).eq('id', existente[0].id);
              errMsg = error?.message ?? null;
            } else {
              const { error } = await admin.from('rvs_ventas_mes_plaza').insert(fila);
              errMsg = error?.message ?? null;
            }
          }
          if (errMsg) console.error('upsert sucursal fallo:', nombre, errMsg);
          else sucursalesOk++;
        }

        await admin
          .from('rvs_reportes_intake')
          .update({ estatus: 'procesado', error_message: null })
          .eq('id', intakeRow.id);

        return { agentes: agentesOk, sucursales: sucursalesOk };
      } catch (e) {
        const msg = (e as Error).message || 'error_desconocido';
        console.error('rvs procesamiento fallo:', msg);
        await marcarError(msg);
        return { agentes: 0, sucursales: 0, error: msg };
      }
    };

    if (pdfs.length === 0) {
      await admin.from('rvs_reportes_intake').insert({
        marca,
        remitente_email: from || null,
        asunto_email: subject,
        resend_email_id: emailId,
        estatus: 'error',
        error_message: 'correo_sin_pdf_adjunto',
      });
      return jsonRes({ ok: true, procesados: 0, motivo: 'sin_pdf' });
    }

    const resultados = [];
    for (const att of pdfs) {
      try {
        resultados.push(await procesarPdf(att));
      } catch (e) {
        console.error(`adjunto ${att?.id} fallo:`, (e as Error).message);
      }
    }

    return jsonRes({ ok: true, marca, resultados });
  } catch (e) {
    console.error('rvs-reportes-intake error:', e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
});
