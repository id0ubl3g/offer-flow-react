import { CalendarClock, ImageOff, ListOrdered, ListX, Users } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Offer } from "../api/types";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, PageHeader, PageLoading, SkeletonKpis } from "../components/ui";
import { useLive } from "../live/LiveContext";
import { formatBRL, formatDateTime } from "../utils/format";
import { TagList } from "../components/Tags";
import { groupsForOffer } from "../utils/tags";
import { describeNextRun, nextRun } from "../utils/schedule";

export function QueuePage() {
  const toast = useToast();
  const { queue, schedules: liveSchedules, groups: liveGroups, refresh } = useLive();
  const schedules = liveSchedules ?? [];
  const groups = (liveGroups ?? []).filter((group) => group.active);

  useEffect(refresh, [refresh]);

  async function remove(offer: Offer) {
    try {
      await api(`/offers/${offer.id}/queue`, { method: "DELETE" });
      toast.success("Removida da fila");
      refresh();
    } catch (err) {
      toast.error(err);
    }
  }

  const sendable = groups.filter((group) => group.can_send);
  const next = nextRun(schedules);
  const firstSendable = (queue ?? []).findIndex((offer) => groupsForOffer(offer, sendable).length > 0);
  const activeSchedules = schedules.filter((schedule) => schedule.active);

  return (
    <>
      <PageHeader title="Fila" subtitle="Em cada horário, a primeira oferta da fila vai para os grupos ativos com a mesma etiqueta e para os grupos sem etiqueta." />
      <div className="page-body">
        {queue === null ? <SkeletonKpis /> : <div className="grid grid-kpi">
          <div className="card kpi">
            <div className="kpi-label"><ListOrdered size={14} /> Ofertas na fila</div>
            <div className="kpi-value">{queue?.length ?? "—"}</div>
            <div className="kpi-foot">{queue?.length ? `${queue.length} disparo${queue.length > 1 ? "s" : ""} garantido${queue.length > 1 ? "s" : ""}` : "adicione ofertas na tela de Ofertas"}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><CalendarClock size={14} /> Próximo disparo</div>
            <div className="kpi-value" style={{ fontSize: 20 }}>{describeNextRun(next)}</div>
            <div className="kpi-foot">{activeSchedules.length} horário{activeSchedules.length === 1 ? "" : "s"} ativo{activeSchedules.length === 1 ? "" : "s"} · <Link to="/schedules">editar</Link></div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><Users size={14} /> Grupos que recebem</div>
            <div className="kpi-value">{sendable.length}</div>
            <div className="kpi-foot"><Link to="/whatsapp">gerenciar grupos</Link></div>
          </div>
        </div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">Ordem de envio</div>
          </div>
          {queue === null ? (
            <PageLoading />
          ) : queue.length === 0 ? (
            <EmptyState icon={<ListOrdered size={20} />} title="Fila vazia" text="Horários com a fila vazia são pulados. Coloque ofertas na fila para manter os grupos ativos." action={<Link to="/offers" className="btn btn-primary">Ir para ofertas</Link>} />
          ) : (
            queue.map((offer, index) => {
              const reach = groupsForOffer(offer, sendable).length;

              return (
                <div key={offer.id} className="list-row queue-row">
                  <div className="list-index">{index + 1}</div>
                  {offer.image_url ? <img src={offer.image_url} alt="" className="thumb" /> : <div className="thumb"><ImageOff size={18} /></div>}
                  <div className="grow">
                    <div className="truncate" style={{ fontWeight: 500 }}>{offer.product_name}</div>
                    <div className="row small muted">
                      <span>R$ {formatBRL(offer.price_cents)}</span>
                      {offer.discount_percent > 0 && <Badge tone="success">-{offer.discount_percent}%</Badge>}
                      <span>· na fila desde {formatDateTime(offer.queued_at)}</span>
                    </div>
                    {offer.tags?.length > 0 && <div style={{ marginTop: 4 }}><TagList tags={offer.tags} /></div>}
                  </div>
                  {sendable.length > 0 && (reach ? <Badge>{reach} grupo{reach === 1 ? "" : "s"}</Badge> : <Badge tone="warning">Nenhum grupo · será pulada</Badge>)}
                  {index === firstSendable && next && <Badge tone="accent">{describeNextRun(next)}</Badge>}
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(offer)}>
                    <ListX size={14} />
                    Remover
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
