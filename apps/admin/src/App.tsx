import { Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_ROLE_LABELS } from "@proj/shared";
import { useAuth } from "./auth";
import { Loading, initials } from "./ui";
import Login from "./pages/Login";
import Registrations from "./pages/Registrations";
import RegistrationDetail from "./pages/RegistrationDetail";

export default function App() {
  const { admin, restoring, signOut } = useAuth();

  if (restoring) return <Loading label="Checking your session…" />;
  if (!admin) return <Login />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">U</span>
          <span>Uniliv Admin</span>
        </div>

        <div className="spacer" />

        <div className="who">
          <div style={{ textAlign: "right" }}>
            <div className="small" style={{ fontWeight: 600 }}>
              {admin.name}
            </div>
            <div className="caption">{ADMIN_ROLE_LABELS[admin.role]}</div>
          </div>
          <span className="avatar">{initials(admin.name)}</span>
          <button className="btn ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/registrations" element={<Registrations />} />
          <Route path="/registrations/:id" element={<RegistrationDetail />} />
          {/* Registrations is the only module for now, so it's the landing page. */}
          <Route path="*" element={<Navigate to="/registrations" replace />} />
        </Routes>
      </main>
    </div>
  );
}
