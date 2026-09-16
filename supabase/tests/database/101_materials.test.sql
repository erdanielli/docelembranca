-- materials mirrors ingredients exactly (FR-002, data-model.md) — same shape,
-- same RLS pattern (research.md §4), so this test mirrors 100_ingredients.
begin;
set local search_path to extensions, public;

select plan(9);

select has_table('public', 'materials', 'materials table exists');

set local role authenticated;
select set_config('request.jwt.claims', '{"email":"giselypasquini@gmail.com"}', true);

select lives_ok(
  $$ insert into public.materials (name, unit) values ('Cake Box', 'un') $$,
  'the allowed user can insert a material'
);

select is(
  (select active from public.materials where name = 'Cake Box'),
  true,
  'active defaults to true'
);

select throws_ok(
  $$ insert into public.materials (unit) values ('un') $$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$ insert into public.materials (name, unit) values ('Cake Box', 'un') $$,
  '23505',
  null,
  'name is unique'
);

select throws_ok(
  $$ insert into public.materials (name) values ('Ribbon') $$,
  '23502',
  null,
  'unit is required'
);

select throws_ok(
  $$ insert into public.materials (name, unit) values ('Ribbon', 'invalid') $$,
  '22P02',
  null,
  'unit only accepts mg|g|kg|ml|l|un'
);

select set_config('request.jwt.claims', '{"email":"someone.else@example.com"}', true);

select is(
  (select count(*) from public.materials)::int,
  0,
  'RLS hides existing rows from a non-allowed user'
);

select throws_ok(
  $$ insert into public.materials (name, unit) values ('Mold', 'un') $$,
  '42501',
  null,
  'RLS blocks a non-allowed user from inserting'
);

select * from finish();
rollback;
