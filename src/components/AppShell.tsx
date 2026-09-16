import { useState } from "react";
import { CatalogTab } from "../features/catalog/CatalogTab";
import type { DataClient } from "../lib/dataClient";
import { supabase } from "../lib/supabaseClient";

type TabId = "catalog" | "stock" | "customers" | "orders";

// pt_BR labels per Constitution VI; pending Eduardo's wording review (task T138).
const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: "catalog", label: "Catálogo" },
  { id: "stock", label: "Estoque" },
  { id: "customers", label: "Clientes" },
  { id: "orders", label: "Pedidos" },
];

export function AppShell({ client = supabase }: { client?: DataClient }) {
  const [activeId, setActiveId] = useState<TabId>("catalog");

  const panels: Record<TabId, React.ReactNode> = {
    catalog: <CatalogTab client={client} />,
    stock: null,
    customers: null,
    orders: null,
  };

  return (
    <>
      <main className="content" data-tab={activeId}>
        <div
          className="tabpanel"
          role="tabpanel"
          id={`panel-${activeId}`}
          aria-labelledby={`tab-${activeId}`}
        >
          {panels[activeId]}
        </div>
      </main>

      <nav className="tabbar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className={`tabbar__tab${tab.id === activeId ? " tabbar__tab--active" : ""}`}
            aria-selected={tab.id === activeId}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
