-- 1. automatizaciones
CREATE TABLE public.automatizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  nivel_acceso text NOT NULL DEFAULT 'basica' CHECK (nivel_acceso IN ('basica','avanzada')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual','programado')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  requiere_aprobacion boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automatizaciones TO authenticated;
GRANT ALL ON public.automatizaciones TO service_role;

-- 2. automatizacion_pasos
CREATE TABLE public.automatizacion_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automatizacion_id uuid NOT NULL REFERENCES public.automatizaciones(id) ON DELETE CASCADE,
  orden integer NOT NULL,
  tipo_paso text NOT NULL CHECK (tipo_paso IN ('enviar_correo','enviar_whatsapp','generar_documento','generar_hoja_calculo','crear_tarea','esperar_respuesta','condicion','pendiente_implementacion')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  requiere_aprobacion boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automatizacion_id, orden)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automatizacion_pasos TO authenticated;
GRANT ALL ON public.automatizacion_pasos TO service_role;

-- 3. automatizacion_usuarios
CREATE TABLE public.automatizacion_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automatizacion_id uuid NOT NULL REFERENCES public.automatizaciones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rol text NOT NULL DEFAULT 'colaborador' CHECK (rol IN ('dueño','colaborador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automatizacion_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automatizacion_usuarios TO authenticated;
GRANT ALL ON public.automatizacion_usuarios TO service_role;

-- 4. automatizacion_constructores
CREATE TABLE public.automatizacion_constructores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.automatizacion_constructores TO authenticated;
GRANT ALL ON public.automatizacion_constructores TO service_role;

-- 5. automatizacion_ejecuciones
CREATE TABLE public.automatizacion_ejecuciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automatizacion_id uuid NOT NULL REFERENCES public.automatizaciones(id) ON DELETE CASCADE,
  estatus text NOT NULL DEFAULT 'en_progreso' CHECK (estatus IN ('pendiente_aprobacion','en_progreso','esperando_respuesta','completada','fallida','cancelada')),
  paso_actual integer NOT NULL DEFAULT 1,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_key text,
  disparado_por uuid REFERENCES auth.users(id),
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  completado_at timestamptz
);
GRANT SELECT ON public.automatizacion_ejecuciones TO authenticated;
GRANT ALL ON public.automatizacion_ejecuciones TO service_role;

-- 6. automatizacion_ejecucion_log
CREATE TABLE public.automatizacion_ejecucion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ejecucion_id uuid NOT NULL REFERENCES public.automatizacion_ejecuciones(id) ON DELETE CASCADE,
  paso_id uuid REFERENCES public.automatizacion_pasos(id),
  estatus text NOT NULL CHECK (estatus IN ('ejecutado','fallido','pendiente_aprobacion')),
  resultado jsonb,
  ejecutado_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automatizacion_ejecucion_log TO authenticated;
GRANT ALL ON public.automatizacion_ejecucion_log TO service_role;

-- 7. automatizacion_solicitudes_funcion
CREATE TABLE public.automatizacion_solicitudes_funcion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automatizacion_id uuid REFERENCES public.automatizaciones(id) ON DELETE SET NULL,
  paso_id uuid REFERENCES public.automatizacion_pasos(id) ON DELETE SET NULL,
  nombre_solicitada text,
  descripcion_necesidad text NOT NULL,
  solicitado_por uuid NOT NULL REFERENCES auth.users(id),
  estatus text NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','en_desarrollo','implementada','rechazada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resuelto_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.automatizacion_solicitudes_funcion TO authenticated;
GRANT ALL ON public.automatizacion_solicitudes_funcion TO service_role;

-- Helper functions (security definer, evitan recursión en RLS)
CREATE OR REPLACE FUNCTION public.can_view_automatizacion(_automatizacion_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.automatizacion_usuarios au
        WHERE au.automatizacion_id = _automatizacion_id AND au.user_id = _user_id
      );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_automatizacion(_automatizacion_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.automatizaciones a
        WHERE a.id = _automatizacion_id AND a.created_by = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.automatizacion_usuarios au
        WHERE au.automatizacion_id = _automatizacion_id AND au.user_id = _user_id AND au.rol = 'dueño'
      );
$$;

CREATE OR REPLACE FUNCTION public.is_automatizacion_constructor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.automatizacion_constructores c WHERE c.user_id = _user_id);
$$;

-- RLS
ALTER TABLE public.automatizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_constructores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_ejecuciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_ejecucion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizacion_solicitudes_funcion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automatizaciones_select" ON public.automatizaciones FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.can_view_automatizacion(id, auth.uid()));
CREATE POLICY "automatizaciones_insert" ON public.automatizaciones FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      nivel_acceso = 'basica'
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_automatizacion_constructor(auth.uid())
    )
  );
CREATE POLICY "automatizaciones_update" ON public.automatizaciones FOR UPDATE TO authenticated
  USING (public.can_manage_automatizacion(id, auth.uid()))
  WITH CHECK (public.can_manage_automatizacion(id, auth.uid()));
CREATE POLICY "automatizaciones_delete" ON public.automatizaciones FOR DELETE TO authenticated
  USING (public.can_manage_automatizacion(id, auth.uid()));

CREATE POLICY "automatizacion_pasos_select" ON public.automatizacion_pasos FOR SELECT TO authenticated
  USING (public.can_view_automatizacion(automatizacion_id, auth.uid()));
CREATE POLICY "automatizacion_pasos_write" ON public.automatizacion_pasos FOR ALL TO authenticated
  USING (public.can_manage_automatizacion(automatizacion_id, auth.uid()))
  WITH CHECK (public.can_manage_automatizacion(automatizacion_id, auth.uid()));

CREATE POLICY "automatizacion_usuarios_select" ON public.automatizacion_usuarios FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_automatizacion(automatizacion_id, auth.uid()));
CREATE POLICY "automatizacion_usuarios_insert" ON public.automatizacion_usuarios FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_automatizacion(automatizacion_id, auth.uid()));
CREATE POLICY "automatizacion_usuarios_update" ON public.automatizacion_usuarios FOR UPDATE TO authenticated
  USING (public.can_manage_automatizacion(automatizacion_id, auth.uid()))
  WITH CHECK (public.can_manage_automatizacion(automatizacion_id, auth.uid()));
CREATE POLICY "automatizacion_usuarios_delete" ON public.automatizacion_usuarios FOR DELETE TO authenticated
  USING (public.can_manage_automatizacion(automatizacion_id, auth.uid()));

CREATE POLICY "automatizacion_constructores_select" ON public.automatizacion_constructores FOR SELECT TO authenticated USING (true);
CREATE POLICY "automatizacion_constructores_insert" ON public.automatizacion_constructores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "automatizacion_constructores_delete" ON public.automatizacion_constructores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "automatizacion_ejecuciones_select" ON public.automatizacion_ejecuciones FOR SELECT TO authenticated
  USING (public.can_view_automatizacion(automatizacion_id, auth.uid()));

CREATE POLICY "automatizacion_ejecucion_log_select" ON public.automatizacion_ejecucion_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automatizacion_ejecuciones e
    WHERE e.id = ejecucion_id AND public.can_view_automatizacion(e.automatizacion_id, auth.uid())
  ));

CREATE POLICY "solicitudes_funcion_select" ON public.automatizacion_solicitudes_funcion FOR SELECT TO authenticated
  USING (solicitado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "solicitudes_funcion_insert" ON public.automatizacion_solicitudes_funcion FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid());
CREATE POLICY "solicitudes_funcion_update" ON public.automatizacion_solicitudes_funcion FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_automatizaciones_updated_at
BEFORE UPDATE ON public.automatizaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_automatizacion_pasos_auto ON public.automatizacion_pasos(automatizacion_id);
CREATE INDEX idx_automatizacion_usuarios_user ON public.automatizacion_usuarios(user_id);
CREATE INDEX idx_automatizacion_ejecuciones_auto ON public.automatizacion_ejecuciones(automatizacion_id);
CREATE INDEX idx_automatizacion_ejecucion_log_ejec ON public.automatizacion_ejecucion_log(ejecucion_id);