import { CalendarClock, History, ListOrdered, LogOut, MessageCircle, Settings, Tag, WifiOff } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LiveProvider, useLive } from "../live/LiveContext";
import { formatPhone } from "../utils/format";
import { describeNextRun, nextRun } from "../utils/schedule";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { SplashScreen } from "./ui";

export type LayoutContext = { refreshSidebar: () => void };

function FlowStatus() {
  const { instance, queue, schedules } = useLive();

  if (instance === undefined) {
    return <div className="flow-status skeleton" />;
  }

  if (instance?.status !== "open") {
    const connecting = instance?.status === "connecting";

    return (
      <Link to="/whatsapp" className="flow-status flow-status-alert">
        <div className="flow-status-head">
          <WifiOff size={14} />
          {connecting ? "Aguardando QR code" : "WhatsApp desconectado"}
        </div>
        <div className="flow-status-text">{connecting ? "Escaneie o código para retomar os disparos." : "Os disparos estão pausados. Conecte para retomar."}</div>
      </Link>
    );
  }

  const next = nextRun(schedules ?? []);
  const size = queue?.length ?? 0;

  return (
    <Link to="/queue" className="flow-status">
      <div className="flow-status-head">
        <span className="pulse" />
        Próximo disparo
      </div>
      <div className="flow-status-value">{describeNextRun(next)}</div>
      <div className="flow-status-text">{!next ? "Cadastre um horário para começar." : size ? `${size} oferta${size === 1 ? "" : "s"} na fila` : "Fila vazia, o horário será pulado."}</div>
    </Link>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const live = useLive();
  const connected = live.instance?.status === "open";
  const queueSize = live.queue?.length ?? 0;

  if (!live.ready) {
    return <SplashScreen />;
  }

  const links = [
    { to: "/offers", label: "Ofertas", icon: Tag },
    { to: "/queue", label: "Fila", icon: ListOrdered, count: queueSize },
    { to: "/schedules", label: "Horários", icon: CalendarClock },
    { to: "/history", label: "Histórico", icon: History }
  ];

  return (
    <div className="app fade-in">
      <aside className="sidebar">
        <Link to="/offers" className="sidebar-brand" aria-label="Offer Flow">
          <Logo size={26} />
        </Link>

        <FlowStatus />

        <nav className="nav">
          {links.map(({ to, label, icon: Icon, count }) => (
            <NavLink key={to} to={to} className="nav-link">
              <Icon size={17} />
              <span>{label}</span>
              {!!count && <span className="nav-count">{count}</span>}
            </NavLink>
          ))}
          <div className="nav-divider" />
          <NavLink to="/whatsapp" className="nav-link">
            <MessageCircle size={17} />
            <span>WhatsApp</span>
            <span className={`dot ${connected ? "on" : live.instance?.status === "connecting" ? "warn" : "off"}`} title={connected ? formatPhone(live.instance?.phone ?? null) : "Desconectado"} />
          </NavLink>
          <NavLink to="/settings" className="nav-link">
            <Settings size={17} />
            <span className="nav-long">Configurações</span>
            <span className="nav-short">Ajustes</span>
          </NavLink>
        </nav>

        <Onboarding />

        <div className="sidebar-footer">
          <div className="user-meta">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Sair" aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ refreshSidebar: live.refresh } satisfies LayoutContext} />
      </main>
    </div>
  );
}

export function Layout() {
  return (
    <LiveProvider>
      <Shell />
    </LiveProvider>
  );
}
