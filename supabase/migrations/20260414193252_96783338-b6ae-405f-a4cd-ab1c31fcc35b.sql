
-- Manager: equipo en módulos principales
UPDATE public.role_module_permissions SET access_level = 'equipo' WHERE role = 'manager' AND module IN ('cotizaciones','inventario','entregas','transferencias','facturacion','productos','proyectos','capacitacion','reportes');
UPDATE public.role_module_permissions SET access_level = 'equipo' WHERE role = 'manager' AND module IN ('modificar_pdf_cotizacion','eliminar_pdf_cotizacion');

-- Delivery: todos en entregas e inventario, propio en capacitacion
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'delivery' AND module IN ('entregas','inventario');
UPDATE public.role_module_permissions SET access_level = 'propio' WHERE role = 'delivery' AND module = 'capacitacion';

-- Warehouse: todos en inventario, productos, transferencias
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'warehouse' AND module IN ('inventario','productos','transferencias');
UPDATE public.role_module_permissions SET access_level = 'propio' WHERE role = 'warehouse' AND module = 'capacitacion';

-- Customer Service: todos en directorio, propio en CRM y cotizaciones
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'customer_service' AND module = 'directorio';
UPDATE public.role_module_permissions SET access_level = 'propio' WHERE role = 'customer_service' AND module IN ('crm_chevron','crm_phillips66','cotizaciones');
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'customer_service' AND module = 'productos';

-- Accounting: todos en facturacion y reportes, propio en cotizaciones
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'accounting' AND module IN ('facturacion','reportes');
UPDATE public.role_module_permissions SET access_level = 'propio' WHERE role = 'accounting' AND module = 'cotizaciones';
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'accounting' AND module = 'directorio';
