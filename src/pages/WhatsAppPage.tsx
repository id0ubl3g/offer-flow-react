import { Lock, MessageCircle, Pencil, Power, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Group, Instance, Offer, Paginated } from "../api/types";
import { useToast } from "../components/Toast";
import { Badge, ConfirmDialog, EmptyState, Modal, PageHeader, PageLoading, Spinner, Switch } from "../components/ui";
import { TagInput, TagList } from "../components/Tags";
import { useLive } from "../live/LiveContext";
import { MAX_ACTIVE_GROUPS } from "../utils/limits";
import { collectTags } from "../utils/tags";
import { formatDateTime, formatPhone } from "../utils/format";

type Filter = "all" | "active" | "sendable" | "blocked";

function ConnectCard({ instance, qrcode, busy, onConnect }: { instance: Instance | null; qrcode: string | null; busy: boolean; onConnect: () => void }) {
  const waiting = instance?.status === "connecting";

  return (
    <div className="card card-pad">
      <div className="row" style={{ gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="qr-box">
          {waiting && qrcode ? <img src={qrcode} alt="QR code do WhatsApp" /> : waiting ? <Spinner /> : <MessageCircle size={48} color="var(--faint)" />}
        </div>
        <div className="grow form-stack" style={{ minWidth: 260 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>{waiting ? "Escaneie o QR code" : "Conecte seu WhatsApp"}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {waiting ? "O código muda a cada ~20 segundos e esta tela atualiza sozinha." : "Use o número que vai disparar as ofertas nos grupos."}
            </div>
          </div>
          <ol className="steps">
            <li>Abra o <b>WhatsApp</b> no celular</li>
            <li>Toque em <b>Mais opções → Aparelhos conectados</b></li>
            <li>Toque em <b>Conectar um aparelho</b> e aponte para o código</li>
          </ol>
          <div className="row">
            <button className="btn btn-primary" onClick={onConnect} disabled={busy}>
              {busy ? <Spinner /> : <RefreshCw size={15} />}
              {waiting ? "Gerar novo QR code" : "Gerar QR code"}
            </button>
          </div>
          <div className="hint">O risco de bloqueio do número é do dono da conta. Evite intervalos curtos e grupos que não esperam suas ofertas.</div>
        </div>
      </div>
    </div>
  );
}

function GroupTagsModal({ group, suggestions, onClose, onSaved }: { group: Group; suggestions: string[]; onClose: () => void; onSaved: (group: Group) => void }) {
  const toast = useToast();
  const [tags, setTags] = useState<string[]>(group.tags ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);

    try {
      await api(`/whatsapp/groups/${group.id}`, { method: "PATCH", body: { tags } });
      toast.success("Etiquetas salvas");
      onSaved({ ...group, tags });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Etiquetas do grupo"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner />}
            Salvar
          </button>
        </>
      }
    >
      <div className="form-stack">
        <div style={{ fontWeight: 500 }}>{group.name}</div>
        <div className="field">
          <label className="label" htmlFor="group-tags">Etiquetas</label>
          <TagInput id="group-tags" value={tags} onChange={setTags} suggestions={suggestions} autoFocus />
          <span className="hint">
            {tags.length ? "Este grupo só recebe ofertas com pelo menos uma dessas etiquetas." : "Sem etiquetas, o grupo recebe todas as ofertas da fila."}
          </span>
        </div>
      </div>
    </Modal>
  );
}

export function WhatsAppPage() {
  const toast = useToast();
  const { instance, qrcode, groups: liveGroups, setInstance, setGroups, refresh, refreshStatus } = useLive();
  const groups = liveGroups ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<"disconnect" | "delete" | null>(null);
  const [editingTags, setEditingTags] = useState<Group | null>(null);
  const [offerTags, setOfferTags] = useState<string[]>([]);
  const previousStatus = useRef<string | null | undefined>(undefined);
  const expectingChange = useRef(false);

  const loadGroups = useCallback(() => {
    api<{ groups: Group[] }>("/whatsapp/groups").then((data) => setGroups(data.groups)).catch(toast.error);
  }, [setGroups, toast]);

  useEffect(() => {
    refreshStatus();
    loadGroups();
    api<Paginated<"offers", Offer>>("/offers?per_page=100").then((data) => setOfferTags(collectTags(data.offers))).catch(() => setOfferTags([]));
  }, [refreshStatus, loadGroups]);

  useEffect(() => {
    const status = instance === undefined ? undefined : instance?.status ?? null;
    const previous = previousStatus.current;
    previousStatus.current = status;

    if (previous === undefined || previous === status) {
      return;
    }

    if (status === "open") {
      toast.success("WhatsApp conectado");
      refresh();
      sync();
    } else if (previous === "open" && !expectingChange.current) {
      toast.error("O WhatsApp foi desconectado. Escaneie o QR code para voltar a disparar.");
    }

    expectingChange.current = false;
  }, [instance, refresh, toast]);

  async function connect() {
    setBusy("connect");

    try {
      const data = await api<{ instance: Instance; qrcode: string | null }>("/whatsapp/connect", { method: "POST" });
      setInstance(data.instance, data.qrcode);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");

    try {
      const data = await api<{ groups: Group[] }>("/whatsapp/groups/sync", { method: "POST" });
      setGroups(data.groups);
      toast.success(`${data.groups.length} grupos sincronizados`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(group: Group, active: boolean) {
    if (active && groups.filter((item) => item.active).length >= MAX_ACTIVE_GROUPS) {
      toast.error(`Limite de ${MAX_ACTIVE_GROUPS} grupos ativos. Desative um grupo para ativar outro.`);
      return;
    }

    setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, active } : item)));

    try {
      await api(`/whatsapp/groups/${group.id}`, { method: "PATCH", body: { active } });
    } catch (err) {
      setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, active: !active } : item)));
      toast.error(err);
    }
  }

  async function runConfirm() {
    setBusy(confirm);

    try {
      if (confirm === "disconnect") {
        expectingChange.current = true;
        await api("/whatsapp/disconnect", { method: "POST" });
        toast.success("WhatsApp desconectado");
      } else {
        expectingChange.current = true;
        await api("/whatsapp", { method: "DELETE" });
        setGroups([]);
        toast.success("Conexão removida");
      }

      await refreshStatus();
      refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  if (instance === undefined) {
    return (
      <>
        <PageHeader title="WhatsApp" />
        <PageLoading />
      </>
    );
  }

  const connected = instance?.status === "open";
  const activeCount = groups.filter((group) => group.active).length;
  const atLimit = activeCount >= MAX_ACTIVE_GROUPS;
  const reach = groups.filter((group) => group.active).reduce((total, group) => total + (group.participants_count ?? 0), 0);
  const visible = groups.filter((group) => {
    if (query && !group.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }

    return filter === "all" || (filter === "active" && group.active) || (filter === "sendable" && group.can_send) || (filter === "blocked" && !group.can_send);
  });

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle={connected ? `Conectado como ${formatPhone(instance.phone)}${instance.profile_name ? ` · ${instance.profile_name}` : ""}` : "Conecte o número que vai disparar as ofertas."}
        actions={
          instance && (
            <>
              {connected && (
                <button className="btn btn-secondary" onClick={() => setConfirm("disconnect")}>
                  <Power size={15} />
                  Desconectar
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setConfirm("delete")} title="Remover conexão">
                <Trash2 size={15} />
              </button>
            </>
          )
        }
      />
      <div className="page-body">
        {!connected && <ConnectCard instance={instance} qrcode={qrcode} busy={busy === "connect"} onConnect={connect} />}

        {connected && (
          <div className="grid grid-kpi">
            <div className="card kpi">
              <div className="kpi-label"><span className="dot on" /> Status</div>
              <div className="kpi-value" style={{ fontSize: 20 }}>Conectado</div>
              <div className="kpi-foot">desde {formatDateTime(instance.connected_at)}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><Users size={14} /> Grupos ativos</div>
              <div className="kpi-value">{activeCount}<span className="muted" style={{ fontSize: 16, fontWeight: 500 }}> / {MAX_ACTIVE_GROUPS}</span></div>
              <div className="kpi-foot">{atLimit ? "limite atingido, desative um para trocar" : `limite de ${MAX_ACTIVE_GROUPS} · ${groups.length} sincronizados`}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><MessageCircle size={14} /> Alcance por disparo</div>
              <div className="kpi-value">{reach.toLocaleString("pt-BR")}</div>
              <div className="kpi-foot">membros somados nos grupos ativos</div>
            </div>
          </div>
        )}

        {(connected || groups.length > 0) && (
          <div className="card">
            <div className="card-header wrap card-toolbar">
              <div className="grow">
                <div className="card-title">Grupos</div>
                <div className="card-subtitle">Ative até {MAX_ACTIVE_GROUPS} grupos para receber as ofertas agendadas. Use etiquetas para que um grupo receba só certos produtos.</div>
              </div>
              <div className="search">
                <Search size={15} />
                <input className="input" placeholder="Buscar grupo" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="select toolbar-select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="sendable">Posso enviar</option>
                <option value="blocked">Só admins enviam</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={sync} disabled={!connected || busy === "sync"}>
                {busy === "sync" ? <Spinner /> : <RefreshCw size={14} />}
                Sincronizar
              </button>
            </div>
            {groups.length === 0 ? (
              <EmptyState icon={<Users size={20} />} title="Nenhum grupo sincronizado" text="Busque os grupos do seu número para escolher quais recebem as ofertas." action={<button className="btn btn-primary" onClick={sync} disabled={busy === "sync"}>{busy === "sync" && <Spinner />}Sincronizar grupos</button>} />
            ) : visible.length === 0 ? (
              <EmptyState icon={<Search size={20} />} title="Nenhum grupo encontrado" text="Ajuste a busca ou o filtro." />
            ) : (
              <table className="table table-cards">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Membros</th>
                    <th>Permissão</th>
                    <th>Etiquetas</th>
                    <th style={{ width: 90 }}>Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((group) => (
                    <tr key={group.id}>
                      <td className="cell-title">
                        <div style={{ fontWeight: 500 }}>{group.name.endsWith("@g.us") ? <span className="muted">Grupo sem nome</span> : group.name}</div>
                      </td>
                      <td className="muted" data-label="Membros">{group.participants_count?.toLocaleString("pt-BR") ?? "—"}</td>
                      <td data-label="Permissão">
                        {!group.can_send ? (
                          <Badge tone="danger"><Lock size={12} />Só admins enviam</Badge>
                        ) : group.is_announce ? (
                          <Badge tone="info"><ShieldCheck size={12} />Você é admin</Badge>
                        ) : (
                          <Badge tone="success">Todos enviam</Badge>
                        )}
                      </td>
                      <td data-label="Etiquetas">
                        <div className="row">
                          <TagList tags={group.tags ?? []} empty="Recebe todas" />
                          <button className="btn btn-ghost btn-sm" title="Editar etiquetas" onClick={() => setEditingTags(group)}>
                            <Pencil size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="cell-action">
                        <Switch checked={group.active} disabled={!group.can_send || (atLimit && !group.active)} label={`Ativar ${group.name}`} onChange={(value) => toggle(group, value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {editingTags && (
        <GroupTagsModal
          group={editingTags}
          suggestions={collectTags(groups.map((group) => ({ tags: group.tags })), offerTags.map((tag) => ({ tags: [tag] })))}
          onClose={() => setEditingTags(null)}
          onSaved={(saved) => {
            setGroups((current) => current.map((item) => (item.id === saved.id ? saved : item)));
            setEditingTags(null);
          }}
        />
      )}
      {confirm === "disconnect" && <ConfirmDialog title="Desconectar WhatsApp" text="O número sai dos aparelhos conectados e os disparos agendados vão falhar até você conectar de novo. Os grupos ficam salvos." confirmLabel="Desconectar" busy={busy === "disconnect"} onConfirm={runConfirm} onClose={() => setConfirm(null)} />}
      {confirm === "delete" && <ConfirmDialog title="Remover conexão" text="A conexão e a lista de grupos serão apagadas. Para usar de novo será preciso escanear um novo QR code e reativar os grupos." confirmLabel="Remover" danger busy={busy === "delete"} onConfirm={runConfirm} onClose={() => setConfirm(null)} />}
    </>
  );
}
