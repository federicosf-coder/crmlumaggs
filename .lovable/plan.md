
# Módulo Biblioteca de Archivos

Un repositorio central de archivos (listas de precio, fichas técnicas, contratos, manuales, materiales comerciales) con organización por carpetas/categorías, versionado, permisos por rol, búsqueda y la opción de enlazar archivos de Google Drive.

Inspirado en cómo lo hacen Pipedrive (Files por entidad), HubSpot (Files & Templates), Monday (Docs/Files), ClickUp (Docs/Hub), Dropbox/Drive (versionado + share links).

---

## 1. Estructura conceptual

```text
Biblioteca
├── Categorías (configurables)
│   ├── Listas de Precio (Chevron, Phillips 66)
│   ├── Fichas Técnicas
│   ├── Contratos
│   ├── Materiales de Marketing
│   ├── Manuales / Procedimientos
│   └── ...
├── Carpetas anidadas (opcional)
└── Archivos
    ├── Versiones (v1, v2, v3 — la última es "vigente")
    ├── Metadatos (marca, vigencia, etiquetas, descripción)
    ├── Permisos (quién ve / descarga)
    └── Enlaces (a Empresa, Contacto, Producto, Negocio CRM)
```

Cada archivo puede ser:
- **Subido** (almacenado en Lovable Cloud Storage)
- **Enlazado** desde Google Drive (URL + metadatos, sin duplicar el archivo)

---

## 2. Funcionalidades clave

**Gestión de archivos**
- Subir arrastrando o seleccionando (un archivo o varios)
- Reemplazar archivo → crea automáticamente nueva versión (la anterior queda en historial)
- Marcar versión como "vigente" / "obsoleta"
- Renombrar, mover entre categorías/carpetas, eliminar (soft delete)
- Previsualización para PDF, imágenes y Office

**Organización**
- Categorías predefinidas + creación libre por Admin
- Carpetas anidadas dentro de cada categoría
- Etiquetas múltiples (ej. `chevron`, `2026`, `industrial`)
- Atributos opcionales: marca (Chevron/Phillips 66), vigencia (desde/hasta), notas

**Búsqueda y filtros**
- Buscador global por nombre, etiqueta, descripción
- Filtros: categoría, marca, etiqueta, tipo, fecha, autor, estado (vigente/obsoleto)
- Vista lista y vista cuadrícula con miniatura

**Vinculación a entidades**
- Adjuntar archivos a Empresa, Contacto, Producto o Negocio CRM (igual que Pipedrive/HubSpot)
- Desde la ficha de cada entidad se ve una pestaña "Archivos" con los vinculados

**Compartir**
- Enlace público temporal (con expiración configurable)
- Enlace interno (requiere login)
- Botón "Copiar enlace" + opción de enviar por correo

**Permisos por rol**
- Acceso al módulo controlado igual que el resto (`todos`/`equipo`/`propio`/`ninguno`)
- Por archivo: quién puede ver, descargar, editar metadatos, subir nueva versión, eliminar
- Categorías sensibles (ej. Contratos) restringibles a Admin/Manager

**Auditoría**
- Bitácora: quién subió, quién descargó, quién reemplazó, quién compartió, cuándo

---

## 3. Integración con Google Drive (opcional)

Dos modos disponibles:

**A. Enlazar archivos de Drive (recomendado, simple)**
- Pegar URL de Google Drive → el sistema valida y guarda el enlace + metadatos (nombre, tipo, miniatura) usando el conector Google Drive de Lovable
- El archivo vive en Drive; la Biblioteca lo organiza, versiona y comparte
- Útil cuando ya existe una estructura en Drive

**B. Sincronización (futuro / opcional)**
- Seleccionar una carpeta de Drive → importar archivos como entradas de Biblioteca
- Re-sincronización manual o programada

Importante: el conector Google Drive autentica **una sola cuenta** (la del administrador/empresa), no por usuario. Para un caso de uso "cada vendedor con su Drive" se requeriría OAuth por usuario (más complejo, se puede dejar para una segunda fase).

---

## 4. Navegación y UI

- Nuevo ítem en el sidebar: **Biblioteca** (entre "Documentos" y "Tareas y Actividades")
- Ruta: `/biblioteca`
- Estructura de páginas:
  - `/biblioteca` — explorador (sidebar de categorías + grid/lista de archivos + buscador)
  - `/biblioteca/archivo/:id` — detalle (preview + metadatos + versiones + permisos + bitácora)
  - `/biblioteca/admin/categorias` — gestión de categorías (Admin)
- Pestaña "Archivos" en Empresa, Contacto, Producto y Negocio CRM
- Todos los modales siguen el "Estilo Modal Refinado" del sistema

---

## 5. Detalles técnicos

**Tablas nuevas (Lovable Cloud)**
- `biblioteca_categorias` (nombre, color, icono, parent_id, orden, restricción de roles)
- `biblioteca_archivos` (categoria_id, carpeta, nombre, descripción, tipo (`subido`/`drive`), marca, vigencia_desde, vigencia_hasta, etiquetas[], estado, current_version_id, created_by)
- `biblioteca_versiones` (archivo_id, version, storage_path, drive_url, drive_file_id, size, mime, notas_cambio, subido_por, fecha)
- `biblioteca_links` (archivo_id, entidad_tipo, entidad_id) — vincula a empresa/contacto/producto/negocio
- `biblioteca_shares` (archivo_id, token, expira_en, creado_por, descargas) — enlaces públicos
- `biblioteca_bitacora` (archivo_id, accion, usuario_id, metadata, fecha)

**Storage**
- Bucket `biblioteca` (privado), políticas RLS por rol
- Para enlaces públicos: edge function genera URL firmada temporal

**Permisos (RLS)**
- Reutiliza `app_module` añadiendo `biblioteca`
- `get_user_module_access(user, 'biblioteca')` con niveles `todos/equipo/propio/ninguno`
- Categorías marcadas como "solo admin" filtran independientemente

**Conector Google Drive**
- Se activa al pegar el primer enlace de Drive (pide conectar si aún no está)
- Edge function `validate-drive-link` resuelve metadatos vía gateway

**Reemplazo / versionado**
- Botón "Subir nueva versión" en detalle: crea registro en `biblioteca_versiones`, actualiza `current_version_id` del archivo
- Historial visible con descarga de versiones anteriores

---

## 6. Fases sugeridas

**Fase 1 — MVP**
- Tablas + RLS + bucket + módulo en sidebar
- Subida, categorías, búsqueda, vista lista/grid
- Versionado básico (reemplazar = nueva versión)
- Permisos por rol

**Fase 2 — Integración y compartir**
- Enlazar archivos de Google Drive
- Enlaces públicos con expiración
- Pestaña "Archivos" en Empresa / Contacto / Producto / Negocio
- Bitácora

**Fase 3 — Avanzado (opcional)**
- Importación masiva desde carpeta de Drive
- Previsualización embebida (PDF.js, imágenes, Office viewer)
- Notificaciones cuando una lista de precios se actualiza

---

## 7. Decisiones que necesito confirmar

1. ¿Empezamos por el **MVP (Fase 1)** o quieres incluir Google Drive desde el inicio (Fase 1 + 2)?
2. ¿La pestaña "Archivos" en Empresa / Contacto / Producto / Negocio CRM la quieres desde el inicio o después?
3. Categorías iniciales propuestas: **Listas de Precio, Fichas Técnicas, Contratos, Marketing, Manuales**. ¿Agregar o quitar alguna?
4. Para Google Drive: ¿alcanza con **una cuenta corporativa** compartida (más simple) o cada usuario necesita conectar su propio Drive?
