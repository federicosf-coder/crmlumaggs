create or replace function public.list_nombres_por_emails(_emails text[])
returns table(email text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select lower(p.email), p.full_name
  from public.profiles p
  where p.email is not null
    and lower(p.email) = any (select lower(unnest(_emails)))
$$;

revoke all on function public.list_nombres_por_emails(text[]) from public;
revoke all on function public.list_nombres_por_emails(text[]) from anon;
grant execute on function public.list_nombres_por_emails(text[]) to authenticated;