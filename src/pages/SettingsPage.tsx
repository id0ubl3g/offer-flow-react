import { AlertTriangle, Check, KeyRound, LogOut, MessageSquareText, Palette, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { MessageTemplateField } from "../components/MessageTemplate";
import { Modal, PageHeader, Spinner } from "../components/ui";
import { DEFAULT_TEMPLATE, formatDateTime, renderMessage } from "../utils/format";
import { getUserTemplate, saveUserTemplate } from "../utils/template";
import { getTheme, saveTheme, type Theme } from "../utils/theme";
import { WhatsAppPreview } from "./OfferEditor";

const SAMPLE_OFFER = {
  product_name: "Fone JBL Tune 520BT",
  price_cents: 19990,
  original_price_cents: 29990,
  url: "https://amzn.to/exemplo"
};

function TemplateCard({ userId }: { userId: string }) {
  const toast = useToast();
  const [saved, setSaved] = useState(() => getUserTemplate(userId));
  const [template, setTemplate] = useState(saved);

  useEffect(() => {
    const current = getUserTemplate(userId);
    setSaved(current);
    setTemplate(current);
  }, [userId]);

  function save() {
    saveUserTemplate(userId, template);
    setSaved(getUserTemplate(userId));
    setTemplate(getUserTemplate(userId));
    toast.success("Mensagem padrão salva");
  }

  return (
    <div className="card">
      <div className="card-header">
        <MessageSquareText size={18} />
        <div className="grow">
          <div className="card-title">Mensagem padrão</div>
          <div className="card-subtitle">Usada ao criar novas ofertas. Fica salva neste navegador.</div>
        </div>
      </div>
      <div className="card-pad template-settings">
        <div className="form-stack">
          <MessageTemplateField
            id="default-template"
            label="Modelo"
            value={template}
            onChange={setTemplate}
            rows={9}
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)} disabled={template === DEFAULT_TEMPLATE}>
                Restaurar original
              </button>
            }
          />
          <div className="row">
            <button className="btn btn-primary" onClick={save} disabled={template === saved || !template.trim()}>
              Salvar padrão
            </button>
            {template !== saved && (
              <button className="btn btn-ghost" onClick={() => setTemplate(saved)}>
                Descartar
              </button>
            )}
          </div>
        </div>
        <WhatsAppPreview text={renderMessage(template, SAMPLE_OFFER)} imageUrl={null} />
      </div>
    </div>
  );
}

const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Claro", hint: "Fundo branco" },
  { value: "dark", label: "Escuro", hint: "Fundo preto" },
  { value: "system", label: "Sistema", hint: "Segue o aparelho" }
];

function AppearanceCard() {
  const [theme, setTheme] = useState<Theme>(getTheme);

  function choose(value: Theme) {
    setTheme(value);
    saveTheme(value);
  }

  return (
    <div className="card">
      <div className="card-header">
        <Palette size={18} />
        <div className="grow">
          <div className="card-title">Aparência</div>
          <div className="card-subtitle">Escolha o tema da interface. Fica salvo neste navegador.</div>
        </div>
      </div>
      <div className="card-pad theme-options" role="radiogroup" aria-label="Tema">
        {THEMES.map(({ value, label, hint }) => (
          <button key={value} type="button" role="radio" aria-checked={theme === value} className={`theme-option ${theme === value ? "on" : ""}`} onClick={() => choose(value)}>
            <span className={`theme-swatch theme-swatch-${value}`}>
              <span />
              <span />
            </span>
            <span className="theme-option-text">
              <span className="theme-option-label">{label}</span>
              <span className="small muted">{hint}</span>
            </span>
            {theme === value && <Check size={16} className="theme-check" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);

    try {
      await api("/auth/delete-account", { method: "DELETE" });
      toast.success("Conta excluída");
      logout();
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados da sua conta e preferências." />
      <div className="page-body" style={{ maxWidth: 960 }}>
        <div className="card">
          <div className="card-header">
            <UserRound size={18} />
            <div className="card-title grow">Conta</div>
            <button className="btn btn-secondary btn-sm" onClick={logout}>
              <LogOut size={14} />
              Sair
            </button>
          </div>
          <dl className="details">
            <div><dt>Nome</dt><dd>{user.name}</dd></div>
            <div><dt>E-mail</dt><dd>{user.email}</dd></div>
            <div><dt>Criada em</dt><dd>{formatDateTime(user.created_at)}</dd></div>
          </dl>
        </div>

        <AppearanceCard />

        <TemplateCard userId={user.id} />

        <div className="card">
          <div className="card-header">
            <KeyRound size={18} />
            <div className="grow">
              <div className="card-title">Senha</div>
              <div className="card-subtitle">Receba um código por e-mail para definir uma nova senha.</div>
            </div>
            <Link to="/forgot-password" className="btn btn-secondary btn-sm" onClick={logout}>Trocar senha</Link>
          </div>
        </div>

        <div className="card danger-zone">
          <div className="card-header">
            <AlertTriangle size={18} color="var(--danger)" />
            <div className="grow">
              <div className="card-title">Excluir conta</div>
              <div className="card-subtitle">Apaga ofertas, imagens, horários, histórico e a conexão do WhatsApp. Não dá para desfazer.</div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setDeleting(true)}>Excluir conta</button>
          </div>
        </div>
      </div>
      {deleting && (
        <Modal
          title="Excluir conta"
          size="sm"
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(false)} disabled={busy}>Cancelar</button>
              <button className="btn btn-danger" onClick={deleteAccount} disabled={busy || confirmEmail.trim() !== user.email}>
                {busy && <Spinner />}
                Excluir definitivamente
              </button>
            </>
          }
        >
          <div className="form-stack">
            <div className="muted">Para confirmar, digite seu e-mail: <b style={{ color: "var(--text)" }}>{user.email}</b></div>
            <input className="input" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoFocus />
          </div>
        </Modal>
      )}
    </>
  );
}
