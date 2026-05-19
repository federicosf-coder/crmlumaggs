## Objetivo
Permitir que una solicitud de crédito aplique a **Lumaggs** y/o **Galsa** (las dos), cada una con su propio monto, y generar un formato de "Solicitud de crédito" imprimible por cada empresa, activado/desactivado según corresponda.

## Cambios en base de datos
Agregar a `credit_requests`:
- `solicita_lumaggs boolean DEFAULT false`
- `solicita_galsa boolean DEFAULT false`
- `monto_solicitado_lumaggs numeric`
- `monto_solicitado_galsa numeric`
- Firmas por empresa (para no perder la firma actual cuando se solicitan ambas):
  - `firma_solicitud_lumaggs_fecha timestamptz`, `firma_solicitud_lumaggs_nombre text`, `firma_solicitud_lumaggs_doc_id uuid`
  - `firma_solicitud_galsa_fecha timestamptz`, `firma_solicitud_galsa_nombre text`, `firma_solicitud_galsa_doc_id uuid`

Backfill: activar `solicita_lumaggs`/`solicita_galsa` según la `empresa_vendedora` de la `company` vinculada (Lumaggs/Chevron → lumaggs; Galsa/Phillips 66 → galsa). Copiar `monto_solicitado` al monto de la empresa correspondiente. La firma existente (`firma_solicitud_*`) se conserva como compatibilidad y se interpreta como la empresa actualmente activa.

## Cambios en UI (CreditoDetail.tsx)
En la sección de datos comerciales, reemplazar el campo único **"Monto solicitado"** por un bloque **"Crédito solicitado por empresa"** con dos filas:
- Switch **Lumaggs (Chevron)** + Input de monto (deshabilitado si el switch está apagado)
- Switch **Galsa (Phillips 66)** + Input de monto (deshabilitado si el switch está apagado)

Validación: al menos una empresa debe estar activa.

## Cambios en pestaña Firmas
Reemplazar la fila única "Solicitud de crédito" por una fila por cada empresa activa:
- "Solicitud de crédito · Lumaggs" (solo si `solicita_lumaggs`)
- "Solicitud de crédito · Galsa" (solo si `solicita_galsa`)

Cada fila genera su propio PDF, sube/limpia su propio archivo firmado, y guarda en las columnas específicas de cada empresa.

## Cambios en impresión (CreditoImprimir + templates)
- `openFirmaPdf` enviará la entidad en la URL: `/credito/:id/imprimir/solicitud-lumaggs` o `/credito/:id/imprimir/solicitud-galsa`.
- `CreditoImprimir` parsea el sufijo, determina la entidad (en lugar de deducirla de `empresa_vendedora`) y elige la plantilla `credit_doc_templates` correspondiente.
- Los tokens del template (`monto_solicitado`, etc.) se calculan con el monto de la empresa elegida.
- Las otras firmas (buró, confidencialidad, etc.) siguen igual.

## Archivos afectados
- Nueva migración SQL
- `src/lib/credito.ts` (helper para listar firmas dinámicamente por entidad)
- `src/pages/credito/CreditoDetail.tsx` (UI monto + pestaña Firmas)
- `src/pages/credito/CreditoImprimir.tsx` (entidad por URL + monto por empresa)
- `src/lib/creditoTemplates.ts` (token de monto por entidad)
