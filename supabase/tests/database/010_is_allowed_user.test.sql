-- is_allowed_user() is the single expression every RLS policy in this feature
-- delegates to (research.md §4), so it gets its own test before any table uses it.
begin;
set local search_path to extensions, public;

select plan(4);

select has_function(
  'public',
  'is_allowed_user',
  'is_allowed_user() exists for RLS policies to call'
);

select set_config('request.jwt.claims', '{"email":"giselypasquini@gmail.com"}', true);
select is(
  public.is_allowed_user(),
  true,
  'the allowed user is recognised'
);

select set_config('request.jwt.claims', '{"email":"someone.else@example.com"}', true);
select is(
  public.is_allowed_user(),
  false,
  'any other signed-in email is rejected'
);

select set_config('request.jwt.claims', '', true);
select is(
  public.is_allowed_user(),
  false,
  'an anonymous request with no claims is rejected'
);

select * from finish();
rollback;
