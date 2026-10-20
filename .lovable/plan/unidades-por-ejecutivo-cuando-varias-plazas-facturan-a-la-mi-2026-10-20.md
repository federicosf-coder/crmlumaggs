# Unidades por ejecutivo cuando varias plazas facturan a la misma razón social

## Qué está pasando (caso VELOCITY MX, octubre)
Cada factura ya trae su plaza por la serie (MXL = Mexicali, TIJ = Tijuana, ENS = Ensenada). El problema es el ejecutivo que el sistema le propone a cada factura:

| Factura | Plaza de la factura | Ejecutivo asignado | Plaza del ejecutivo |
|---|---|---|---|
| MXL1549 | Mexicali | Miguel Zavala | Mexicali |
| MXL1568 (60 uds) | Mexicali | Wilber Zamora | Tijuana |
| MXL1595 (100 uds) | Mexicali | Erick Vargas | Ensenada |
| TIJ3483 / TIJ3488 | Tijuana | Wilber Zamora | Tijuana |
| ENS1128 | Ensenada | Erick Vargas | Ensenada |

Al importar el XML, el sistema toma el ejecutivo del último pedido o cotización de la empresa, sea de la plaza que sea. Por eso dos facturas de Mexicali quedaron con vendedores de otras plazas. Además, en el Directorio cada empresa solo tiene ejecutivos, sin decir en qué plaza atiende cada uno.

## Método: "ejecutivo por plaza" dentro de la misma razón social
La regla es: **las unidades de una factura son del ejecutivo que atiende a esa empresa en la plaza de la factura.**

1. **Directorio: un ejecutivo por plaza.** En la ficha de la empresa, cada ejecutivo asignado lleva su plaza. Por ejemplo, VELOCITY MX: Mexicali → Miguel, Tijuana → Wilber, Ensenada → Erick. Si no se elige, se usa la plaza del perfil del ejecutivo, así que las empresas actuales quedan llenas solas.
2. **Importar XML con la plaza de la factura.** Primero se detecta la plaza por la serie. El ejecutivo sugerido sale en este orden:
   1. El ejecutivo que tiene la empresa en esa plaza.
   2. El ejecutivo del último pedido o cotización de la empresa **en esa misma plaza**.
   3. Si no hay ninguno de los dos, la factura queda "sin ejecutivo" para que se elija a mano. Ya no se toma un ejecutivo de otra plaza.
3. **Aviso de cruce de plaza.** Si alguien elige a mano un ejecutivo de otra plaza, aparece un aviso ámbar: "Esta factura es de Mexicali y el ejecutivo es de Tijuana". Deja guardar, porque puede haber casos válidos.
4. **Revisión de lo que ya está mal.** Se agrega una lista en Importar XML con las facturas del mes donde la plaza de la factura y la del ejecutivo no coinciden. Desde ahí se reasigna con un clic al ejecutivo de esa plaza. Ninguna factura se cambia sin que alguien lo confirme.
5. **Los reportes no cambian.** El Reporte diario, Seguimiento y Unidades siguen contando por el ejecutivo de la factura, como pidió Federico. Al corregir el ejecutivo, a cada quien le cuentan solo sus ventas de su plaza y no se tocan las de otra plaza.

Resultado esperado en VELOCITY MX: si confirmas MXL1568 y MXL1595, Miguel tendría 104 + 160 = 264 unidades. Wilber perdería 60 y Erick 100, que no vendieron ellos. Las de Tijuana y Ensenada no cambian.

## Detalle técnico
- Migración: agregar `plaza_id uuid null` a `company_ejecutivos` y llenarla con `profiles.plaza_id`. Es un cambio que no rompe nada; se agrega un índice en `(company_id, plaza_id)`.
- `ImportarFacturasXML.tsx` `cargarPerfilEmpresa`: hoy calcula un default por empresa. Pasará a calcularse por empresa y plaza (`plaza_id_detectado`), filtrando `company_ejecutivos.plaza_id` y los pedidos o cotizaciones con `.eq("plaza_id", plaza)`. También se agrega el aviso de cruce de plaza.
- Ficha de empresa (los ejecutivos en `CompanyFormDialog`): se agrega un selector de plaza por cada ejecutivo.
- Pestaña nueva "Plaza vs ejecutivo" en Importar XML: consulta las facturas `documentos.plaza_id` ≠ `profiles.plaza_id` y actualiza `ejecutivo_venta_id` solo con la confirmación de quien la usa.
- Se agrega un test para la regla de prioridad (plaza de la empresa → último pedido de la plaza → sin ejecutivo).
- No se tocan las fórmulas de los reportes ni `saldo_pendiente_cobranza`.
