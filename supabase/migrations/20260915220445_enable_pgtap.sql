-- pgTAP powers the database test suite (`supabase test db`), which asserts RLS
-- policies, RPC behaviour, views and triggers inside Postgres itself. It lives
-- in the `extensions` schema so its ~300 assertion functions are never exposed
-- through the Data API the way a `public` install would be.
create extension if not exists pgtap with schema extensions;
