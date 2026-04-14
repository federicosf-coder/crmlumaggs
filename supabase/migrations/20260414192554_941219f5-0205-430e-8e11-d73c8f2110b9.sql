
-- Function to get the best (most permissive) access level for a user on a module
CREATE OR REPLACE FUNCTION public.get_user_module_access(_user_id uuid, _module app_module)
RETURNS access_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT 
        CASE 
          WHEN bool_or(rmp.access_level = 'todos') THEN 'todos'::access_level
          WHEN bool_or(rmp.access_level = 'equipo') THEN 'equipo'::access_level
          WHEN bool_or(rmp.access_level = 'propio') THEN 'propio'::access_level
          ELSE 'ninguno'::access_level
        END
      FROM public.user_roles ur
      JOIN public.role_module_permissions rmp ON rmp.role = ur.role AND rmp.module = _module
      WHERE ur.user_id = _user_id
    ),
    'ninguno'::access_level
  )
$$;

-- Function to get all user IDs that share a team with the given user
CREATE OR REPLACE FUNCTION public.get_user_team_member_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm2.user_id),
    ARRAY[_user_id]
  )
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm2.team_id = tm1.team_id
  WHERE tm1.user_id = _user_id
$$;
