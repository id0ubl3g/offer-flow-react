import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner } from "../components/ui";
import { AuthShell } from "./AuthShell";
import { PASSWORD_RULES, PasswordRules } from "./RegisterPage";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/auth/forgot-password", { body: { email: email.trim() }, auth: false });
      setInfo("Se existir uma conta com esse e-mail, enviamos um código de 6 caracteres. Ele vale por 10 minutos.");
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar código");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/auth/reset-password", { body: { email: email.trim(), code: code.trim(), password }, auth: false });
      navigate("/login", { state: { email: email.trim(), message: "Senha alterada. Entre com a nova senha." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle={step === "request" ? "Enviaremos um código para o seu e-mail." : "Digite o código recebido e a nova senha."}>
      {step === "request" ? (
        <form className="form-stack" onSubmit={requestCode}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <Spinner />}
            Enviar código
          </button>
        </form>
      ) : (
        <form className="form-stack" onSubmit={resetPassword}>
          {info && <div className="badge badge-info" style={{ padding: "8px 12px", borderRadius: 8, whiteSpace: "normal" }}>{info}</div>}
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="code">Código</label>
            <input id="code" className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} required autoFocus style={{ letterSpacing: "0.3em", fontWeight: 600 }} />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Nova senha</label>
            <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <PasswordRules password={password} />
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || code.length !== 6 || !PASSWORD_RULES.every((rule) => rule.test(password))}>
            {busy && <Spinner />}
            Redefinir senha
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep("request")}>
            Enviar outro código
          </button>
        </form>
      )}
      <div className="muted">
        <Link to="/login">Voltar para o login</Link>
      </div>
    </AuthShell>
  );
}
