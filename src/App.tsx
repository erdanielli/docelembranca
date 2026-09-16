import { AppShell } from "./components/AppShell";
import { LoginGate } from "./components/LoginGate";
import { supabase } from "./lib/supabaseClient";

function App() {
  return (
    <LoginGate>
      <div className="screen">
        <header className="navbar">
          <span className="navbar__title">docelembranca</span>
          <button className="navbar__action" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </header>

        <AppShell />
      </div>
    </LoginGate>
  );
}

export default App;
