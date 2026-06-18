
-- Add new app_module enum values
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'inventario.demanda';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'inventario.minmax';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'inventario.restricciones';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'inventario.traspasos';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'inventario.dashboard_red';
