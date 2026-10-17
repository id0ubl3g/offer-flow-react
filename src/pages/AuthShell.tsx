import { CalendarClock, MessageCircle, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "../components/Logo";

const FEATURES = [
  { icon: Tag, title: "Cadastre a oferta uma vez", text: "Produto, preço, desconto e imagem em um só lugar." },
  { icon: MessageCircle, title: "Envie para todos os grupos", text: "Sem copiar e colar o link grupo a grupo." },
  { icon: CalendarClock, title: "Dispare no horário certo", text: "A fila envia uma oferta por horário, todos os dias." }
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-side">
        <Logo size={28} />
        <div>
          <h2>Suas promoções nos grupos certos, na hora certa.</h2>
          <div className="auth-features">
            {FEATURES.map(({ icon: Icon, title: featureTitle, text }) => (
              <div key={featureTitle} className="auth-feature">
                <div className="auth-feature-icon">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="auth-feature-title">{featureTitle}</div>
                  <p className="auth-feature-text">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="small muted">Automação de ofertas para WhatsApp</p>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-logo">
            <Logo size={28} />
          </div>
          <div>
            <h1>{title}</h1>
            <div className="muted" style={{ marginTop: 8 }}>
              {subtitle}
            </div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
