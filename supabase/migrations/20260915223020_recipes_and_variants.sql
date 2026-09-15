-- The Recipe composition graph (FR-003–FR-007): a Recipe has one or more
-- named Size Variants, each composed of Ingredient and Material amounts.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "is_allowed_user" on public.recipes
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

create table public.recipe_size_variants (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, name)
);

alter table public.recipe_size_variants enable row level security;

create policy "is_allowed_user" on public.recipe_size_variants
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

create table public.recipe_variant_ingredients (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.recipe_size_variants (id),
  ingredient_id uuid not null references public.ingredients (id),
  amount numeric not null check (amount > 0),
  unique (variant_id, ingredient_id)
);

alter table public.recipe_variant_ingredients enable row level security;

create policy "is_allowed_user" on public.recipe_variant_ingredients
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

create table public.recipe_variant_materials (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.recipe_size_variants (id),
  material_id uuid not null references public.materials (id),
  amount numeric not null check (amount > 0),
  unique (variant_id, material_id)
);

alter table public.recipe_variant_materials enable row level security;

create policy "is_allowed_user" on public.recipe_variant_materials
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

-- Bumps the parent Variant's updated_at whenever its composition changes, so a
-- later phase can flag an open Order's line as needing recalculation by
-- comparing this against order_recipe_lines.costed_at (FR-021b).
create or replace function public.touch_open_orders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- clock_timestamp(), not now(): now() is frozen for the whole enclosing
  -- transaction, so a second touch in the same transaction would otherwise
  -- write back the same value it started with.
  update public.recipe_size_variants
  set updated_at = clock_timestamp()
  where id = coalesce(new.variant_id, old.variant_id);

  return coalesce(new, old);
end;
$$;

comment on function public.touch_open_orders() is
  'Bumps recipe_size_variants.updated_at when a composition row changes, so open Orders can be flagged for recalculation (FR-021b).';

create trigger touch_open_orders
  after insert or update or delete on public.recipe_variant_ingredients
  for each row execute function public.touch_open_orders();

create trigger touch_open_orders
  after insert or update or delete on public.recipe_variant_materials
  for each row execute function public.touch_open_orders();
