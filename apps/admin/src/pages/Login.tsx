import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { messageOf } from "../api";
import { SCOPE } from "../modules";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card animate-fade-up" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">T</span>
          <span className="brand-word">THAPAR</span>
          <span className="brand-sub">Admin</span>
        </div>

        <div className="stack-sm">
          <h1>Sign in</h1>
          <p className="muted small">
            {SCOPE} · review registrations, requests and move-ins.
          </p>
        </div>

        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@thapar.test"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button className="btn block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="caption" style={{ textAlign: "center" }}>
          Warden &amp; Ops Excellence console · access is by invitation
        </p>
      </form>
    </div>
  );
}
