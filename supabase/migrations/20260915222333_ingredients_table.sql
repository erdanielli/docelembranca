-- First of the catalog tables (FR-001). Ingredients are registered in
-- agnostic form (name + canonical unit) and referenced by Recipe composition.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit public.unit_of_measure not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ingredients is
  'Agnostic ingredient catalog entries, referenced by Recipe composition (FR-001).';
comment on column public.ingredients.active is
  'Deactivated ingredients are hidden from new Recipe composition and new Order selections but remain valid on rows that already reference them (FR-008a).';

alter table public.ingredients enable row level security;

create policy "is_allowed_user" on public.ingredients
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());
