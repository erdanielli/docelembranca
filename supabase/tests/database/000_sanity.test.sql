-- Proves the pgTAP harness itself is wired up before any real assertion
-- depends on it. Every test file in this directory follows this shape:
-- transaction, search_path set so pgTAP's functions resolve from the
-- `extensions` schema, plan, assertions, finish, rollback.
begin;
set local search_path to extensions, public;

select plan(1);

select has_extension(
  'extensions',
  'pgtap',
  'pgTAP is installed in the extensions schema, so database tests can run'
);

select * from finish();
rollback;
