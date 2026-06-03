INSERT INTO public.role_module_permissions (role, module, access_level)
SELECT role, 'seguimiento_ventas'::app_module, access_level
FROM public.role_module_permissions
WHERE module = 'crm_chevron'
ON CONFLICT (role, module) DO UPDATE SET access_level = EXCLUDED.access_level;