import { vi } from "vitest";

/**
 * A recording stand-in for the supabase-js client.
 *
 * Component tests assert on two things: the results a component renders, and
 * which calls it made — including calls it must *not* make, such as the
 * budgeting screen recomputing costs without touching the network (FR-021).
 */
export type RecordedCall = { readonly method: string; readonly args: readonly unknown[] };

export type StubResult<T> = { data: T | null; error: { message: string } | null };

export type SupabaseStubOptions = {
  /** Result returned by `rpc(name, ...)`, keyed by RPC name. */
  readonly rpc?: Readonly<Record<string, StubResult<unknown>>>;
  /** Rows returned by a `from(table)` query chain, keyed by table name. */
  readonly tables?: Readonly<Record<string, readonly unknown[]>>;
};

const ok = <T,>(data: T): StubResult<T> => ({ data, error: null });

export function createSupabaseStub(options: SupabaseStubOptions = {}) {
  const calls: RecordedCall[] = [];
  const record = (method: string, ...args: readonly unknown[]) => {
    calls.push({ method, args });
  };

  const queryBuilder = (table: string) => {
    const rows = options.tables?.[table] ?? [];
    const result = ok(rows);
    const chain = {
      select: vi.fn((...args: readonly unknown[]) => (record(`${table}.select`, ...args), chain)),
      insert: vi.fn((...args: readonly unknown[]) => (record(`${table}.insert`, ...args), chain)),
      update: vi.fn((...args: readonly unknown[]) => (record(`${table}.update`, ...args), chain)),
      delete: vi.fn((...args: readonly unknown[]) => (record(`${table}.delete`, ...args), chain)),
      eq: vi.fn((...args: readonly unknown[]) => (record(`${table}.eq`, ...args), chain)),
      order: vi.fn((...args: readonly unknown[]) => (record(`${table}.order`, ...args), chain)),
      single: vi.fn(() => Promise.resolve(ok(rows[0] ?? null))),
      then: (resolve: (value: StubResult<readonly unknown[]>) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };

  return {
    calls,
    /** Calls made to `rpc`, in order — the log FR-021's "no round trip" test reads. */
    rpcCalls: () => calls.filter((call) => call.method === "rpc"),
    client: {
      from: vi.fn((table: string) => (record("from", table), queryBuilder(table))),
      rpc: vi.fn((name: string, args?: unknown) => {
        record("rpc", name, args);
        return Promise.resolve(options.rpc?.[name] ?? ok(null));
      }),
    },
  };
}
