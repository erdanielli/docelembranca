import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * The `supabase-js` client type components depend on, typed against the
 * generated schema. Components only ever call `from`/`rpc` in practice; the
 * test stub (tests/helpers/supabaseStub.ts) implements just that subset and
 * bridges the gap to this full type in one place, rather than every test
 * call site casting through `unknown` on its own.
 */
export type DataClient = SupabaseClient<Database>;
