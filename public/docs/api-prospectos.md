# API pública de Prospectos (Leads) — Lumaggs / Galsa

Endpoint para enviar prospectos desde landing pages, sitios web y (próximamente) Facebook Lead Ads.

## Endpoint

```
POST https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/lead-intake
Content-Type: application/json
x-api-key: <CLAVE_DE_TU_SITIO>
```

La clave se genera en el CRM: **Bandeja de Prospectos → Fuentes y API**. Se muestra una sola vez.
También se acepta `?api_key=...` como parámetro de query (útil para integraciones que no permiten headers).

## Campos

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `nombre` | string | Sí | Nombre del prospecto (2–120 caracteres) |
| `apellido` | string | No | Se concatena al nombre |
| `email` | string | Sí* | Formato válido |
| `telefono` | string | Sí* | Se normaliza a E.164 (México por defecto) |
| `empresa` | string | No | Si viene, se crea/vincula la empresa |
| `mensaje` | string | No | Máx. 2000 caracteres |
| `interes` | string | No | Producto o servicio de interés |
| `ciudad` / `estado` | string | No | Ubicación |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | string | No | Atribución de marketing |
| `page_url` | string | No | URL del formulario |
| `_hp` | string | No | Campo trampa anti-spam: si viene con valor, el envío se ignora silenciosamente |

\* Se requiere al menos uno de `email` o `telefono`.

## Respuestas

Éxito (200):
```json
{ "ok": true, "lead_id": "uuid", "contact_id": "uuid", "company_id": "uuid" }
```

Duplicado (mismo correo/teléfono sin atender en las últimas 24 h):
```json
{ "ok": true, "lead_id": "uuid", "duplicated": true }
```

Errores:
- `401` clave faltante o inválida / fuente desactivada
- `403` dominio no permitido (si la fuente tiene dominio configurado)
- `400` datos inválidos: `{ "error": "Datos invalidos", "fields": { ... } }`

## Ejemplo (JavaScript)

```html
<form id="form-contacto">
  <input name="nombre" required />
  <input name="email" type="email" />
  <input name="telefono" />
  <input name="empresa" />
  <textarea name="mensaje"></textarea>
  <input name="_hp" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById("form-contacto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const params = new URLSearchParams(location.search);
  const res = await fetch("https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/lead-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "TU_CLAVE" },
    body: JSON.stringify({
      ...fd,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      page_url: location.href,
    }),
  });
  const data = await res.json();
  if (data.ok) alert("¡Gracias! Te contactaremos en breve.");
  else alert("No pudimos enviar tu solicitud.");
});
</script>
```

## Ejemplo (cURL)

```bash
curl -X POST "https://fnqeicdqblkhfpyboxre.supabase.co/functions/v1/lead-intake" \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_CLAVE" \
  -d '{"nombre":"Juan Perez","email":"juan@ejemplo.com","telefono":"6861234567","empresa":"Transportes Demo","mensaje":"Cotizacion Delo 400","utm_source":"google","utm_campaign":"verano"}'
```

## Facebook Lead Ads

El endpoint acepta el mismo formato desde un middleware (Zapier / Make / n8n): mapear
`full_name → nombre`, `email → email`, `phone_number → telefono`, `company_name → empresa`,
y enviar `utm_source: "facebook"` más `utm_campaign` con el nombre del anuncio.

## Reglas de negocio

- Contacto existente (mismo correo o teléfono): no se duplica; se registra un nuevo prospecto ligado a ese contacto.
- Empresa: solo se crea cuando el formulario envía el dato.
- Los prospectos llegan **sin asignar** a la bandeja común del CRM.
- Semáforo de atención: 0–15 min "Nuevo", >15 min "Pendiente de atención", >1 h "Alerta",
  >24 h "Lead frío", >72 h "Recuperación". La revisión corre automáticamente cada 15 minutos
  y envía avisos por WhatsApp al número configurado en la fuente.
