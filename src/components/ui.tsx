import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { LogoMark } from "./Logo";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "accent";

export function Badge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone === "default" ? "" : `badge-${tone}`}`}>{children}</span>;
}

export function Spinner() {
  return <span className="spinner" aria-label="Carregando" />;
}

export function Skeleton({ width, height, radius, className = "" }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} />;
}

export function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="list-row">
          <Skeleton width={40} height={40} radius={8} />
          <div className="grow skeleton-stack">
            <Skeleton width={`${60 - index * 7}%`} height={12} />
            <Skeleton width={`${35 - index * 4}%`} height={10} />
          </div>
          <Skeleton width={72} height={24} radius={9999} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-kpi" role="status" aria-label="Carregando">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card kpi skeleton-stack">
          <Skeleton width="45%" height={12} />
          <Skeleton width="35%" height={28} />
          <Skeleton width="60%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonOfferGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-offers" role="status" aria-label="Carregando">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card offer-card">
          <Skeleton className="offer-image" radius={0} />
          <div className="offer-body skeleton-stack">
            <Skeleton width="85%" height={14} />
            <Skeleton width="40%" height={20} />
            <Skeleton width="55%" height={12} />
          </div>
          <div className="offer-actions">
            <Skeleton width={96} height={30} radius={8} />
            <Skeleton width={30} height={30} radius={8} />
            <Skeleton width={30} height={30} radius={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="splash" role="status" aria-label="Carregando">
      <LogoMark size={44} />
      <span className="loader-bar" />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-text">{text}</div>
      {action}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Modal({ title, onClose, children, footer, size = "md" }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${size === "md" ? "" : `modal-${size}`}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel, danger, busy, onConfirm, onClose }: { title: string; text: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="muted">{text}</div>
    </Modal>
  );
}
