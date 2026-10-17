import { Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner } from "../components/ui";
import { AuthShell } from "./AuthShell";

export const PASSWORD_RULES = [
  { label: "8 a 64 caracteres", test: (value: string) => value.length >= 8 && value.length <= 64 },
  { label: "Letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Número", test: (value: string) => /\d/.test(value) },
  { label: "Caractere especial", test: (value: string) => /[\W_]/.test(value) }
];

export function PasswordRules({ password }: { password: string }) {
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <span key={rule.label} className={`badge ${ok ? "badge-success" : ""}`}>
            {ok ? <Check size={12} /> : <X size={12} />}
            {rule.label}
          </span>
        );
      })}
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = PASSWORD_RULES.every((rule) => rule.test(password));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/auth/register", { body: { name: name.trim(), email: email.trim(), password }, auth: false });
      navigate("/login", { state: { email: email.trim(), message: "Conta criada. Confirme o e-mail, se solicitado, e entre." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Comece a disparar suas ofertas em minutos.">
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required autoFocus />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <PasswordRules password={password} />
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !valid}>
          {busy && <Spinner />}
          Criar conta
        </button>
      </form>
      <div className="muted">
        Já tem conta? <Link to="/login">Entrar</Link>
      </div>
    </AuthShell>
  );
}
