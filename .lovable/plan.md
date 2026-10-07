# Indicador «Ya compró» en la bandeja de WhatsApp

## Objetivo
Que al abrir una conversación de WhatsApp se vea de inmediato si ese contacto/empresa ya ha comprado, con cuándo fue su última compra y por qué monto.

## Cómo se detecta
La conversación ya está ligada a un contacto (`contact_id`) y el contacto a su empresa. Con la empresa se consultan las facturas (`documentos` tipo factura, no canceladas) de ambas marcas (Chevron y Galsa):

- **Sin empresa ligada o sin facturas** → se muestra «Sin compras registradas» (prospecto).
- **Con facturas** → se muestra «Ya compró» con: fecha de la última factura, monto total acumulado y número de facturas.

## Cambios visibles
1. **Panel lateral de la conversación** (donde hoy se ven los datos del contacto y empresa): nueva tarjeta «Compras» con el estado, última compra, total acumulado y número de facturas.
2. **Lista de conversaciones**: una marca discreta (punto/etiqueta verde «Cliente») en las conversaciones cuyo contacto ya compró, para distinguir prospectos de clientes sin abrir el chat.

## Detalles técnicos
- Consulta en `WhatsAppInbox.tsx`: al cargar el contacto/empresa activo, buscar facturas en `documentos` por `empresa_id` (estatus distinto de cancelada), agrupando count, sum(total) y max(fecha).
- Para la marca en la lista: una sola consulta por lote con los `company_id` de las conversaciones visibles.
- Sin cambios en base de datos; solo consultas de lectura respetando los permisos actuales.
- Verificación con `bunx tsgo --noEmit -p tsconfig.app.json`.
