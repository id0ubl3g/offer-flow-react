import { CheckCircle2, History, RotateCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Dispatch, Paginated, Run } from "../api/types";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Modal, PageHeader, PageLoading, SkeletonKpis, Spinner } from "../components/ui";
import { DISPATCH_STATUS, RUN_ERRORS, RUN_STATUS, formatDateTime } from "../utils/format";

const PER_PAGE = 20;
const REFRESH_INTERVAL = 10000;

function translate(error: string | null): string {
  return error ? RUN_ERRORS[error] ?? error : "";
}

function RunDetail({ runId, onClose, onChanged }: { runId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [run, setRun] = useState<Run | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ run: Run }>(`/dispatch-runs/${runId}`).then((data) => setRun(data.run)).catch(toast.error);
  }, [runId, toast]);

  useEffect(load, [load]);

  async function retry(dispatch: Dispatch) {
    setRetrying(dispatch.id);

    try {
      const data = await api<{ message: string }>(`/dispatches/${dispatch.id}/retry`, { method: "POST" });
      toast.success(data.message);
      load();
      onChanged();
    } catch (err) {
      toast.error(err);
      load();
    } finally {
      setRetrying(null);
    }
  }

  const dispatches = [...(run?.dispatches ?? [])].sort((a, b) => (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at));

  return (
    <Modal title={run?.offer_name ?? "Disparo"} onClose={onClose}>
      {!run ? (
        <PageLoading />
      ) : (
        <div className="form-stack">
          <div className="row wrap">
            <Badge tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Badge>
            <span className="muted small">Agendado para {formatDateTime(run.scheduled_for)}</span>
            {run.finished_at && <span className="muted small">· terminou {formatDateTime(run.finished_at)}</span>}
          </div>
          {run.error && (run.status === "failed" ? <div className="form-error">{translate(run.error)}</div> : <div className="badge" style={{ padding: "8px 12px", borderRadius: 8 }}>{translate(run.error)}</div>)}
          {dispatches.length === 0 ? (
            <div className="muted">Nenhum grupo recebeu este disparo.</div>
          ) : (
            <div className="card">
              {dispatches.map((dispatch) => {
                const status = DISPATCH_STATUS[dispatch.status];
                return (
                  <div key={dispatch.id} className="list-row" style={{ padding: "12px 16px" }}>
                    {dispatch.status === "sent" ? <CheckCircle2 size={18} color="var(--success)" /> : dispatch.status === "failed" ? <XCircle size={18} color="var(--danger)" /> : <span className="dot" />}
                    <div className="grow">
                      <div className="truncate" style={{ fontWeight: 500 }}>{dispatch.group_name}</div>
                      <div className="small muted">
                        {dispatch.sent_at ? `Enviado ${formatDateTime(dispatch.sent_at)}` : translate(dispatch.error) || status.label}
                        {dispatch.attempts > 1 && ` · ${dispatch.attempts} tentativas`}
                      </div>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {(dispatch.status === "failed" || dispatch.status === "skipped") && (
                      <button className="btn btn-secondary btn-sm" onClick={() => retry(dispatch)} disabled={retrying !== null}>
                        {retrying === dispatch.id ? <Spinner /> : <RotateCw size={13} />}
                        Reenviar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function HistoryPage() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<"runs", Run> | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Paginated<"runs", Run>>(`/dispatch-runs?page=${page}&per_page=${PER_PAGE}`).then(setData).catch(toast.error);
  }, [page, toast]);

  useEffect(load, [load]);

  const hasRunning = data?.runs.some((run) => run.status === "running");

  useEffect(() => {
    if (!hasRunning) {
      return;
    }

    const timer = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [hasRunning, load]);

  const totals = (data?.runs ?? []).reduce(
    (acc, run) => ({ sent: acc.sent + (run.summary?.sent ?? 0), failed: acc.failed + (run.summary?.failed ?? 0) }),
    { sent: 0, failed: 0 }
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  return (
    <>
      <PageHeader
        title="Histórico"
        subtitle="Cada horário executado pelo worker, com o resultado por grupo."
        actions={
          <button className="btn btn-secondary" onClick={load}>
            <RotateCw size={15} />
            Atualizar
          </button>
        }
      />
      <div className="page-body">
        {!data ? <SkeletonKpis /> : <div className="grid grid-kpi">
          <div className="card kpi">
            <div className="kpi-label">Disparos</div>
            <div className="kpi-value">{data?.total ?? "—"}</div>
            <div className="kpi-foot">horários executados</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><CheckCircle2 size={14} color="var(--success)" /> Mensagens enviadas</div>
            <div className="kpi-value">{totals.sent}</div>
            <div className="kpi-foot">nesta página</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><XCircle size={14} color="var(--danger)" /> Falhas</div>
            <div className="kpi-value">{totals.failed}</div>
            <div className="kpi-foot">abra o disparo para reenviar</div>
          </div>
        </div>}
        <div className="card">
          {!data ? (
            <PageLoading />
          ) : data.runs.length === 0 ? (
            <EmptyState icon={<History size={20} />} title="Nenhum disparo ainda" text="Quando um horário chegar e o worker estiver rodando (python worker.py), o resultado aparece aqui." />
          ) : (
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Oferta</th>
                  <th>Status</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => {
                  const status = RUN_STATUS[run.status];
                  return (
                    <tr key={run.id} className="clickable" onClick={() => setSelected(run.id)}>
                      <td className="muted" data-label="Horário" style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateTime(run.scheduled_for)}</td>
                      <td className="cell-title">{run.offer_name ?? <span className="muted">Sem oferta</span>}</td>
                      <td className="cell-action">
                        <Badge tone={status.tone}>
                          {run.status === "running" && <Spinner />}
                          {status.label}
                        </Badge>
                      </td>
                      <td data-label="Resultado">
                        {run.error && !run.summary?.sent ? (
                          <span className="muted small">{translate(run.error)}</span>
                        ) : (
                          <div className="row">
                            {!!run.summary?.sent && <Badge tone="success">{run.summary.sent} enviados</Badge>}
                            {!!run.summary?.failed && <Badge tone="danger">{run.summary.failed} falhas</Badge>}
                            {!!run.summary?.skipped && <Badge>{run.summary.skipped} pulados</Badge>}
                            {!!run.summary?.pending && <Badge tone="info">{run.summary.pending} pendentes</Badge>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {pages > 1 && (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span className="muted small">Página {page} de {pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Próxima</button>
          </div>
        )}
      </div>
      {selected && <RunDetail runId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </>
  );
}
