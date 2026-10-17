import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "../components/ui";
import { AuthShell } from "./AuthShell";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/offers" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await login(email.trim(), password);
      navigate("/offers", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta para gerenciar as ofertas.">
      <form className="form-stack" onSubmit={submit}>
        {(location.state as { message?: string } | null)?.message && <div className="badge badge-success" style={{ padding: "8px 12px", borderRadius: 8 }}>{(location.state as { message: string }).message}</div>}
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <div className="row between">
            <label className="label" htmlFor="password">Senha</label>
            <Link to="/forgot-password" className="small">Esqueci a senha</Link>
          </div>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy && <Spinner />}
          Entrar
        </button>
      </form>
      <div className="muted">
        Não tem conta? <Link to="/register">Criar conta</Link>
      </div>
    </AuthShell>
  );
}
