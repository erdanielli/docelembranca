-- The single access-control expression every RLS policy in this feature calls
-- (Principle III, research.md §4). Keeping it in one function means the allowed
-- address is changed in one place rather than in every policy, and a policy can
-- never drift from the rule by copying it slightly wrong.
--
-- `search_path = ''` forces every reference to be schema-qualified, so the
-- function cannot be redirected by a caller's search_path.
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'giselypasquini@gmail.com';
$$;

comment on function public.is_allowed_user() is
  'True when the request carries the single allowed user''s email. Every RLS policy delegates to this.';
