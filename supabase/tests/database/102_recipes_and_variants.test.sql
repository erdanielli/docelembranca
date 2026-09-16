-- The Recipe composition graph (FR-003–FR-007, FR-021b): a Recipe has one or
-- more named Size Variants, each composed of Ingredient/Material amounts.
-- `touch_open_orders` (data-model.md) is what lets a later phase compare an
-- Order line's `costed_at` against its Variant's `updated_at` to know it
-- needs recalculation, so its side effect is asserted here directly.
begin;
set local search_path to extensions, public;

select plan(21);

select has_table('public', 'recipes', 'recipes table exists');
select has_table('public', 'recipe_size_variants', 'recipe_size_variants table exists');
select has_table('public', 'recipe_variant_ingredients', 'recipe_variant_ingredients table exists');
select has_table('public', 'recipe_variant_materials', 'recipe_variant_materials table exists');

set local role authenticated;
select set_config('request.jwt.claims', '{"email":"giselypasquini@gmail.com"}', true);

insert into public.ingredients (name, unit) values ('Test Sugar', 'kg');
insert into public.materials (name, unit) values ('Test Box', 'un');

select lives_ok(
  $$ insert into public.recipes (name) values ('Chocolate Cake') $$,
  'the allowed user can insert a recipe'
);

select is(
  (select active from public.recipes where name = 'Chocolate Cake'),
  true,
  'recipes.active defaults to true'
);

select lives_ok(
  $$ insert into public.recipe_size_variants (recipe_id, name)
     select id, 'Medium' from public.recipes where name = 'Chocolate Cake' $$,
  'insert a size variant'
);

select throws_ok(
  $$ insert into public.recipe_size_variants (recipe_id, name)
     select id, 'Medium' from public.recipes where name = 'Chocolate Cake' $$,
  '23505',
  null,
  'unique (recipe_id, name) on variants'
);

select lives_ok(
  $$ insert into public.recipe_variant_ingredients (variant_id, ingredient_id, amount)
     select v.id, i.id, 2
     from public.recipe_size_variants v, public.ingredients i
     where v.name = 'Medium' and i.name = 'Test Sugar' $$,
  'insert a recipe-ingredient composition row'
);

select throws_ok(
  $$ insert into public.recipe_variant_ingredients (variant_id, ingredient_id, amount)
     select v.id, gen_random_uuid(), 1
     from public.recipe_size_variants v where v.name = 'Medium' $$,
  '23503',
  null,
  'the FK on recipe_variant_ingredients.ingredient_id rejects a non-existent ingredient (FR-007)'
);

select throws_ok(
  $$ insert into public.recipe_variant_ingredients (variant_id, ingredient_id, amount)
     select v.id, i.id, -1
     from public.recipe_size_variants v, public.ingredients i
     where v.name = 'Medium' and i.name = 'Test Sugar' $$,
  '23514',
  null,
  'amount must be > 0 on recipe_variant_ingredients'
);

select throws_ok(
  $$ insert into public.recipe_variant_ingredients (variant_id, ingredient_id, amount)
     select v.id, i.id, 1
     from public.recipe_size_variants v, public.ingredients i
     where v.name = 'Medium' and i.name = 'Test Sugar' $$,
  '23505',
  null,
  'unique (variant_id, ingredient_id)'
);

select lives_ok(
  $$ insert into public.recipe_variant_materials (variant_id, material_id, amount)
     select v.id, m.id, 1
     from public.recipe_size_variants v, public.materials m
     where v.name = 'Medium' and m.name = 'Test Box' $$,
  'insert a recipe-material composition row'
);

select throws_ok(
  $$ insert into public.recipe_variant_materials (variant_id, material_id, amount)
     select v.id, gen_random_uuid(), 1
     from public.recipe_size_variants v where v.name = 'Medium' $$,
  '23503',
  null,
  'the FK on recipe_variant_materials.material_id rejects a non-existent material'
);

select throws_ok(
  $$ insert into public.recipe_variant_materials (variant_id, material_id, amount)
     select v.id, m.id, -1
     from public.recipe_size_variants v, public.materials m
     where v.name = 'Medium' and m.name = 'Test Box' $$,
  '23514',
  null,
  'amount must be > 0 on recipe_variant_materials'
);

select throws_ok(
  $$ insert into public.recipe_variant_materials (variant_id, material_id, amount)
     select v.id, m.id, 1
     from public.recipe_size_variants v, public.materials m
     where v.name = 'Medium' and m.name = 'Test Box' $$,
  '23505',
  null,
  'unique (variant_id, material_id)'
);

create temporary table _before_touch as
  select updated_at from public.recipe_size_variants where name = 'Medium';

select pg_sleep(0.01);

update public.recipe_variant_ingredients
set amount = 3
where variant_id = (select id from public.recipe_size_variants where name = 'Medium');

select ok(
  (select updated_at from public.recipe_size_variants where name = 'Medium')
    > (select updated_at from _before_touch),
  'the touch_open_orders trigger bumps recipe_size_variants.updated_at when a composition row changes (FR-021b)'
);

select set_config('request.jwt.claims', '{"email":"someone.else@example.com"}', true);

select is(
  (select count(*) from public.recipes)::int,
  0,
  'RLS hides existing recipes from a non-allowed user'
);

select is(
  (select count(*) from public.recipe_size_variants)::int,
  0,
  'RLS hides existing recipe_size_variants from a non-allowed user'
);

select is(
  (select count(*) from public.recipe_variant_ingredients)::int,
  0,
  'RLS hides existing recipe_variant_ingredients from a non-allowed user'
);

select is(
  (select count(*) from public.recipe_variant_materials)::int,
  0,
  'RLS hides existing recipe_variant_materials from a non-allowed user'
);

select * from finish();
rollback;
