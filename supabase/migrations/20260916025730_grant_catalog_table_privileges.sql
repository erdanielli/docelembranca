-- Every table this feature has created so far went straight through `create
-- table` with no explicit GRANT. RLS alone is not enough: Postgres checks
-- table-level privileges before a single RLS policy is even evaluated, so
-- without a GRANT the `authenticated` (and `service_role`) roles are denied
-- outright with "permission denied for table X", regardless of what the
-- policy says. The local CLI stack re-bootstraps its own default privileges
-- on every `supabase start`, which papered over this; the hosted project
-- does not, so this only surfaced there. RLS remains the real access
-- control (Principle III) — these grants just clear the privilege floor
-- Postgres checks first, the same way Supabase's own dashboard-created
-- tables get it automatically.
grant usage on schema public to anon, authenticated, service_role;

grant all on public.ingredients to anon, authenticated, service_role;
grant all on public.materials to anon, authenticated, service_role;
grant all on public.recipes to anon, authenticated, service_role;
grant all on public.recipe_size_variants to anon, authenticated, service_role;
grant all on public.recipe_variant_ingredients to anon, authenticated, service_role;
grant all on public.recipe_variant_materials to anon, authenticated, service_role;

-- Every table this feature creates from here on inherits these grants
-- automatically, so the same bug can't recur per new table.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
