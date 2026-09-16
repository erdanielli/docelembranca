-- convert_unit() mirrors the client-side convert() in src/lib/units exactly, so
-- cost maths agrees whether it runs in the browser or inside an RPC (research.md §3).
begin;
set local search_path to extensions, public;

select plan(8);

select has_type('public', 'unit_of_measure', 'the shared unit enum exists');
select has_function('public', 'convert_unit', 'convert_unit() exists');

select is(public.convert_unit(1, 'kg', 'g'), 1000::numeric, '1 kg is 1000 g');
select is(public.convert_unit(500, 'mg', 'g'), 0.5::numeric, '500 mg is 0.5 g');
select is(public.convert_unit(2, 'l', 'ml'), 2000::numeric, '2 l is 2000 ml');
select is(public.convert_unit(3, 'un', 'un'), 3::numeric, 'counts convert to themselves');
select is(public.convert_unit(395, 'g', 'g'), 395::numeric, 'same-unit conversion is the identity');

select throws_ok(
  $$ select public.convert_unit(1, 'g', 'ml') $$,
  '22023',
  null,
  'converting across measurement dimensions is rejected'
);

select * from finish();
rollback;
