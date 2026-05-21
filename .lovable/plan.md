## Objetivo

Reescribir `src/pages/credito/CreditoPortal.tsx` para que el cliente vea exactamente la misma estructura, pestañas, sub-secciones y estilo que la vista interna `CreditoDetail`, pero sirviendo los datos a través del edge function `credito-portal` (sin requerir login). La URL `/portal/credito/{token}` no cambia.

## Estructura objetivo

Replicar las pestañas y sub-pestañas de `CreditoDetail`, ocultando solo las 3 internas:

```text
Header (folio, estado, progresos: Formulario / Documentos / Firmas)

┌───────────────────────────────────────────────────────────┐
│ [Documentos] [Formulario] [Formatos y firmas]             │
└───────────────────────────────────────────────────────────┘

Formulario → sub-tabs:
  [Empresa] [Representación] [Financiero]
    Empresa:
      - Datos generales (razón social, comercial, RFC, contacto, giro, antigüedad…)
      - Domicilio fiscal
      - Domicilio comercial
      - Persona moral (escritura, datos de registro, asamblea, administrador, accionistas)
    Representación:
      - Representante legal (nombre, CURP, RFC, tipo y número de ID, fecha y país de nacimiento)
      - Aval / Obligado solidario (incluyendo flujo "aval distinto")
      - Beneficiario Controlador (wizard 3 pasos: existe / RL es BC / datos del BC)
    Financiero:
      - Monto y plazo
      - Datos bancarios para timbrado
      - Referencias comerciales / proveedores

Documentos:
  - Bloque CSF autocompletar (ya existe, se mantiene)
  - Lista de tipos de documento con paleta de iconos por categoría (igual que internal)
  - Filtrado por tipo de persona y "aval distinto" (ya existe)
  - Subir / abrir / eliminar archivos del cliente

Formatos y firmas:
  - Tarjetas por firma (Solicitud, Buró, Confidencialidad, Subsistencia, LFPIORPI)
  - Botón "Firmar" con captura de nombre
  - Indicador "Firmado por … el …"
```

Se omiten del portal: pestañas internas (Seguimiento, Análisis, Comentarios), edición de empresa/contacto del CRM, cambios manuales de estado, asignación de ejecutivo.

## Cambios

### 1. `supabase/functions/credito-portal/index.ts`

Ampliar para soportar la réplica completa sin exponer datos internos:

- **`FORM_FIELDS`**: agregar campos requeridos por las nuevas secciones que aún no están en la lista:
  - `bc_data` (json), `bc_es_representante_legal`, `bc_confirmacion_no_existe`, `bc_tipo_persona`
  - `ciudad_comercial`, `estado_comercial`
- **Acción `get`**: incluir `empresa_vendedora`, `solicita_lumaggs`, `solicita_galsa`, `monto_solicitado_lumaggs`, `monto_solicitado_galsa` en el SELECT (ya viene `*`, así que basta con seguir devolviendo el row completo — verificar que no devuelve columnas sensibles como notas internas; si las hay, hacer whitelist explícita antes de retornar).

### 2. `src/pages/credito/CreditoPortal.tsx` (reescritura)

- Mantener el patrón actual: `callPortal('get'|'update_form'|'sign'|'upload_doc'|...)` sobre el token.
- Reemplazar el JSX por la estructura visual de `CreditoDetail`:
  - Header con tarjeta de progreso (folio, estado, 3 progress bars).
  - `Tabs` principal con 3 valores (`docs`, `datos`, `firmas`) usando el mismo estilo de gradientes y colores que la interna.
  - Dentro de `datos`, sub-`Tabs` con `empresa`, `representacion`, `financiero` reutilizando los mismos componentes auxiliares (`Section`, `Field`).
  - Pestaña `docs`: aplicar la `DOC_PALETTE` por tipo de documento (icono, colores), igual que internal, y conservar el bloque CSF autocompletar.
  - Pestaña `firmas`: tarjetas por firma con badge "Firmado" / "Pendiente" y botón Firmar.
- Para Beneficiario Controlador, portar el componente `BeneficiarioControladorSteps` o una versión adaptada que en lugar de `supabase.from(...)` use `callPortal('update_form', ...)`.
- Reutilizar (copiar y adaptar) los sub-componentes `Section`, `Field`, `BcStepHeader` de `CreditoDetail`.

### 3. Validación

Tras la implementación verificar en navegador:
1. Abrir `/portal/credito/{token}` y comparar visualmente con `/credito/{id}`: header, gradientes de tabs, sub-tabs, paleta de iconos de documentos, tarjetas de firmas.
2. Editar campos en cada sub-sección (empresa, representación, financiero) y guardar → recargar para confirmar persistencia.
3. Subir y eliminar un documento.
4. Firmar uno de los formatos.
5. Probar el wizard de Beneficiario Controlador (Sí / No / RL es BC / otra persona).

## Notas técnicas

- No se cambia la URL ni el mecanismo de token: la seguridad del portal sigue intacta.
- No se exponen `companies` (CRM), historial interno, comentarios, ni el listado de cambios de estado.
- Los componentes `CompanyFormDialog` y `ContactFormDialog` (CRM interno) **no** se incluyen en el portal.
- Archivos a tocar:
  - `supabase/functions/credito-portal/index.ts` (extensión menor)
  - `src/pages/credito/CreditoPortal.tsx` (reescritura grande, ~700–900 líneas)
- No requiere migración de base de datos.
