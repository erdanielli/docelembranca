-- ingredients is the first of ~15 tables this feature adds; its RLS test
-- establishes the pattern every later table test follows: switch to the
-- non-superuser `authenticated` role (the `postgres` connection pg_prove uses
-- bypasses RLS entirely) before asserting policy behaviour (research.md §4).
begin;
set local search_path to extensions, public;

select plan(9);

select has_table('public', 'ingredients', 'ingredients table exists');

set local role authenticated;
select set_config('request.jwt.claims', '{"email":"giselypasquini@gmail.com"}', true);

select lives_ok(
  $$ insert into public.ingredients (name, unit) values ('Sugar', 'kg') $$,
  'the allowed user can insert an ingredient'
);

select is(
  (select active from public.ingredients where name = 'Sugar'),
  true,
  'active defaults to true'
);

select throws_ok(
  $$ insert into public.ingredients (unit) values ('g') $$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$ insert into public.ingredients (name, unit) values ('Sugar', 'g') $$,
  '23505',
  null,
  'name is unique'
);

select throws_ok(
  $$ insert into public.ingredients (name) values ('Flour') $$,
  '23502',
  null,
  'unit is required'
);

select throws_ok(
  $$ insert into public.ingredients (name, unit) values ('Flour', 'invalid') $$,
  '22P02',
  null,
  'unit only accepts mg|g|kg|ml|l|un'
);

select set_config('request.jwt.claims', '{"email":"someone.else@example.com"}', true);

select is(
  (select count(*) from public.ingredients)::int,
  0,
  'RLS hides existing rows from a non-allowed user'
);

select throws_ok(
  $$ insert into public.ingredients (name, unit) values ('Cocoa', 'kg') $$,
  '42501',
  null,
  'RLS blocks a non-allowed user from inserting'
);

select * from finish();
rollback;
