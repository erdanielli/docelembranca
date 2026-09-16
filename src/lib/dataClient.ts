import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** The subset of `supabase-js` that components need, typed against the generated schema. */
export type DataClient = SupabaseClient<Database>;
