-- Units of measure, shared by the catalog, the shelf, and every cost
-- calculation. Factors are expressed in each dimension's smallest unit so the
-- arithmetic stays exact, mirroring src/lib/units/convert.ts (research.md §3).
create type public.unit_of_measure as enum ('mg', 'g', 'kg', 'ml', 'l', 'un');

create or replace function public.unit_dimension(p_unit public.unit_of_measure)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_unit
    when 'mg' then 'mass'
    when 'g' then 'mass'
    when 'kg' then 'mass'
    when 'ml' then 'volume'
    when 'l' then 'volume'
    when 'un' then 'count'
  end;
$$;

create or replace function public.unit_factor(p_unit public.unit_of_measure)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_unit
    when 'mg' then 1
    when 'g' then 1000
    when 'kg' then 1000000
    when 'ml' then 1
    when 'l' then 1000
    when 'un' then 1
  end::numeric;
$$;

create or replace function public.convert_unit(
  p_value numeric,
  p_from public.unit_of_measure,
  p_to public.unit_of_measure
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from = p_to then
    return p_value;
  end if;

  if public.unit_dimension(p_from) is distinct from public.unit_dimension(p_to) then
    raise exception 'cannot convert % to %: different measurement dimensions', p_from, p_to
      using errcode = '22023';
  end if;

  return p_value * public.unit_factor(p_from) / public.unit_factor(p_to);
end;
$$;

comment on function public.convert_unit(numeric, public.unit_of_measure, public.unit_of_measure) is
  'Converts an amount between units of the same measurement dimension; mirrors convert() in src/lib/units.';
