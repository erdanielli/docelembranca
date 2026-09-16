-- Deleting a Size Variant used to require the app to delete its ingredient
-- and material rows first in separate round trips (RecipeForm.deleteVariant),
-- because the FK from those rows to recipe_size_variants had no ON DELETE
-- behavior and so blocked the parent delete outright. A failure between the
-- app's three sequential deletes left the variant partially deleted. Cascading
-- the FK makes the whole delete a single atomic statement instead.
alter table public.recipe_variant_ingredients
  drop constraint recipe_variant_ingredients_variant_id_fkey,
  add constraint recipe_variant_ingredients_variant_id_fkey
    foreign key (variant_id) references public.recipe_size_variants (id) on delete cascade;

alter table public.recipe_variant_materials
  drop constraint recipe_variant_materials_variant_id_fkey,
  add constraint recipe_variant_materials_variant_id_fkey
    foreign key (variant_id) references public.recipe_size_variants (id) on delete cascade;
