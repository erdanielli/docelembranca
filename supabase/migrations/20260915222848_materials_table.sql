-- Same shape and RLS as ingredients, for the non-consumable side of the
-- catalog: packaging and other non-edible items (FR-002).
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit public.unit_of_measure not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.materials is
  'Agnostic material catalog entries, referenced by Recipe composition (FR-002).';
comment on column public.materials.active is
  'Deactivated materials are hidden from new Recipe composition and new Order selections but remain valid on rows that already reference them (FR-008a).';

alter table public.materials enable row level security;

create policy "is_allowed_user" on public.materials
  for all
  using (public.is_allowed_user())
  with check (public.is_allowed_user());
