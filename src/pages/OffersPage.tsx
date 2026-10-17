import { Archive, ArchiveRestore, ImageOff, ListPlus, ListX, Pencil, Plus, Send, Tag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Group, Instance, Offer, OfferStatus, Paginated } from "../api/types";
import type { LayoutContext } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Badge, ConfirmDialog, EmptyState, Modal, PageHeader, PageLoading, SkeletonOfferGrid, Spinner } from "../components/ui";
import { TagList } from "../components/Tags";
import { useLive } from "../live/LiveContext";
import { collectTags, groupsForOffer } from "../utils/tags";
import { OFFER_STATUS, formatBRL, renderMessage } from "../utils/format";
import { OfferEditor, WhatsAppPreview } from "./OfferEditor";

const TABS: { key: OfferStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "draft", label: "Rascunhos" },
  { key: "queued", label: "Na fila" },
  { key: "sent", label: "Enviadas" },
  { key: "archived", label: "Arquivadas" }
];

function TestSendModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const toast = useToast();
  const [instance, setInstance] = useState<Instance | null | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ instance: Instance }>("/whatsapp").then((data) => setInstance(data.instance)).catch(() => setInstance(null));
    api<{ groups: Group[] }>("/whatsapp/groups").then((data) => {
      const sendable = data.groups.filter((group) => group.can_send);
      setGroups(sendable);
      setGroupId(sendable.find((group) => group.active)?.id ?? sendable[0]?.id ?? "");
    }).catch(() => setGroups([]));
  }, []);

  async function send() {
    setBusy(true);

    try {
      const data = await api<{ message: string }>(`/offers/${offer.id}/test-send`, { body: { group_id: groupId } });
      toast.success(data.message);
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  const connected = instance?.status === "open";

  return (
    <Modal
      title="Enviar teste"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={send} disabled={!connected || !groupId || busy}>
            {busy ? <Spinner /> : <Send size={15} />}
            Enviar agora
          </button>
        </>
      }
    >
      {instance === undefined ? (
        <PageLoading />
      ) : !connected ? (
        <EmptyState icon={<Send size={20} />} title="WhatsApp desconectado" text="Conecte seu número para enviar ofertas." action={<Link to="/whatsapp" className="btn btn-primary">Conectar WhatsApp</Link>} />
      ) : (
        <div className="form-stack">
          <div className="field">
            <label className="label" htmlFor="group">Grupo</label>
            <select id="group" className="select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.participants_count ?? "?"} membros{group.active ? " · ativo" : ""}
                </option>
              ))}
            </select>
            <span className="hint">O envio é imediato e não usa a fila.</span>
          </div>
          <WhatsAppPreview text={renderMessage(offer.message, offer)} imageUrl={offer.image_url} />
        </div>
      )}
    </Modal>
  );
}

export function OffersPage() {
  const toast = useToast();
  const { refreshSidebar } = useOutletContext<LayoutContext>();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [tab, setTab] = useState<OfferStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { groups: liveGroups } = useLive();
  const groups = liveGroups ?? [];
  const [editing, setEditing] = useState<Offer | null | undefined>(undefined);
  const [testing, setTesting] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(() => {
    api<Paginated<"offers", Offer>>("/offers?per_page=100")
      .then((data) => setOffers(data.offers))
      .catch((err) => {
        toast.error(err);
        setOffers([]);
      });
  }, [toast]);

  useEffect(load, [load]);

  useEffect(() => {
    if (searchParams.get("new")) {
      setEditing(null);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function action(offer: Offer, run: () => Promise<unknown>, message: string) {
    setBusyId(offer.id);

    try {
      await run();
      toast.success(message);
      load();
      refreshSidebar();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }

    await action(deleting, () => api(`/offers/${deleting.id}`, { method: "DELETE" }), "Oferta excluída");
    setDeleting(null);
  }

  const allTags = collectTags(offers ?? [], groups);
  const offerTags = collectTags(offers ?? []);
  const activeGroups = groups.filter((group) => group.active && group.can_send);
  const byTag = (offers ?? []).filter((offer) => !tagFilter || offer.tags?.includes(tagFilter));
  const visible = byTag.filter((offer) => tab === "all" || offer.status === tab);
  const count = (key: OfferStatus | "all") => byTag.filter((offer) => key === "all" || offer.status === key).length;

  return (
    <>
      <PageHeader
        title="Ofertas"
        subtitle="Cadastre produtos e coloque na fila de disparo."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Nova oferta
          </button>
        }
      />
      <nav className="tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
            {offers && <span className="tab-count">{count(key)}</span>}
          </button>
        ))}
      </nav>
      <div className="page-body">
        {offerTags.length > 0 && (
          <div className="tag-filter">
            <span className="small muted">Etiqueta:</span>
            <button className={`chip ${tagFilter === null ? "on" : ""}`} onClick={() => setTagFilter(null)}>Todas</button>
            {offerTags.map((tag) => (
              <button key={tag} className={`chip ${tagFilter === tag ? "on" : ""}`} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {offers === null ? (
          <SkeletonOfferGrid />
        ) : visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Tag size={20} />}
              title={tab === "all" && !tagFilter ? "Nenhuma oferta ainda" : "Nada por aqui"}
              text={tagFilter ? "Nenhuma oferta com essa etiqueta nesse status." : tab === "all" ? "Cadastre a primeira oferta com preço, link e imagem. Depois é só colocar na fila." : "Nenhuma oferta com esse status."}
              action={tab === "all" && !tagFilter && <button className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={16} />Nova oferta</button>}
            />
          </div>
        ) : (
          <div className="grid grid-offers">
            {visible.map((offer) => {
              const status = OFFER_STATUS[offer.status];
              const busy = busyId === offer.id;
              const reach = groupsForOffer(offer, activeGroups).length;

              return (
                <article key={offer.id} className="card offer-card">
                  <div className="offer-image">
                    {offer.image_url ? <img src={offer.image_url} alt="" loading="lazy" /> : <ImageOff size={28} />}
                    {offer.discount_percent > 0 && <span className="offer-discount">-{offer.discount_percent}%</span>}
                  </div>
                  <div className="offer-body">
                    <div className="offer-name" title={offer.product_name}>{offer.product_name}</div>
                    <div className="price-row">
                      <span className="price">R$ {formatBRL(offer.price_cents)}</span>
                      {offer.original_price_cents > offer.price_cents && <span className="price-old">R$ {formatBRL(offer.original_price_cents)}</span>}
                    </div>
                    <TagList tags={offer.tags ?? []} />
                    <div className="offer-meta">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {activeGroups.length > 0 && (offer.status === "draft" || offer.status === "queued") && (
                        <Badge tone={reach ? "default" : "warning"}>{reach ? `${reach} grupo${reach === 1 ? "" : "s"}` : "Nenhum grupo"}</Badge>
                      )}
                      <a href={offer.url} target="_blank" rel="noreferrer" className="small truncate" style={{ maxWidth: 160 }}>{offer.url.replace(/^https?:\/\//, "")}</a>
                    </div>
                  </div>
                  <div className="offer-actions">
                    {offer.status === "queued" ? (
                      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => action(offer, () => api(`/offers/${offer.id}/queue`, { method: "DELETE" }), "Removida da fila")}>
                        <ListX size={14} />
                        Tirar da fila
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => action(offer, () => api(`/offers/${offer.id}/queue`, { method: "POST" }), "Adicionada à fila")}>
                        <ListPlus size={14} />
                        {offer.status === "sent" ? "Reenfileirar" : "Pôr na fila"}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Enviar teste" onClick={() => setTesting(offer)}>
                      <Send size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setEditing(offer)}>
                      <Pencil size={14} />
                    </button>
                    {offer.status === "archived" ? (
                      <button className="btn btn-ghost btn-sm" title="Restaurar" disabled={busy} onClick={() => action(offer, () => api(`/offers/${offer.id}`, { method: "PATCH", body: { status: "draft" } }), "Oferta restaurada")}>
                        <ArchiveRestore size={14} />
                      </button>
                    ) : (
                      offer.status !== "queued" && (
                        <button className="btn btn-ghost btn-sm" title="Arquivar" disabled={busy} onClick={() => action(offer, () => api(`/offers/${offer.id}`, { method: "PATCH", body: { status: "archived" } }), "Oferta arquivada")}>
                          <Archive size={14} />
                        </button>
                      )
                    )}
                    <button className="btn btn-ghost btn-sm" title="Excluir" style={{ marginLeft: "auto" }} onClick={() => setDeleting(offer)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {editing !== undefined && <OfferEditor offer={editing} groups={activeGroups} suggestions={allTags} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); refreshSidebar(); }} />}
      {testing && <TestSendModal offer={testing} onClose={() => setTesting(null)} />}
      {deleting && <ConfirmDialog title="Excluir oferta" text={<>A oferta <b>{deleting.product_name}</b> e a imagem dela serão apagadas. O histórico de envios é mantido.</>} confirmLabel="Excluir" danger busy={busyId === deleting.id} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
    </>
  );
}
