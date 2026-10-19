import { CalendarClock, Gauge, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "../api/client";
import type { DispatchSettings, Schedule } from "../api/types";
import { useToast } from "../components/Toast";
import { EmptyState, PageHeader, PageLoading, Spinner, Switch } from "../components/ui";
import { WEEKDAYS } from "../utils/format";
import { conflictingSchedule, describeNextRun, nextRun } from "../utils/schedule";

function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="day-picker">
      {WEEKDAYS.map((day) => {
        const on = value.includes(day.value);
        return (
          <button key={day.value} type="button" className={`day ${on ? "on" : ""}`} onClick={() => onChange(on ? value.filter((item) => item !== day.value) : [...value, day.value].sort())}>
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

function SettingsCard() {
  const toast = useToast();
  const [settings, setSettings] = useState<DispatchSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: DispatchSettings }>("/dispatch-settings").then((data) => setSettings(data.settings)).catch(toast.error);
  }, [toast]);

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setBusy(true);

    try {
      const data = await api<{ settings: DispatchSettings }>("/dispatch-settings", { method: "PATCH", body: settings });
      setSettings(data.settings);
      toast.success("Ritmo de envio salvo");
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <div className="card"><PageLoading /></div>;
  }

  const set = (key: keyof DispatchSettings) => (event: ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, [key]: Number(event.target.value) });
  const invalid = settings.min_delay_seconds > settings.max_delay_seconds;

  return (
    <form className="card" onSubmit={save}>
      <div className="card-header">
        <Gauge size={18} />
        <div className="grow">
          <div className="card-title">Ritmo de envio</div>
          <div className="card-subtitle">Intervalos aleatórios entre grupos reduzem o risco de bloqueio do número.</div>
        </div>
      </div>
      <div className="card-pad form-stack">
        <div className="form-row">
          <div className="field">
            <label className="label" htmlFor="min">Intervalo mínimo (s)</label>
            <input id="min" className={`input ${invalid ? "invalid" : ""}`} type="number" min={5} max={300} value={settings.min_delay_seconds} onChange={set("min_delay_seconds")} />
          </div>
          <div className="field">
            <label className="label" htmlFor="max">Intervalo máximo (s)</label>
            <input id="max" className={`input ${invalid ? "invalid" : ""}`} type="number" min={5} max={300} value={settings.max_delay_seconds} onChange={set("max_delay_seconds")} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="limit">Limite diário de mensagens</label>
          <input id="limit" className="input" type="number" min={1} max={1000} value={settings.daily_limit} onChange={set("daily_limit")} />
          <span className="hint">Ao atingir o limite, os grupos restantes são pulados até o dia seguinte.</span>
        </div>
        <div className="row between">
          <span className="hint" style={invalid ? { color: "var(--danger)" } : undefined}>{invalid ? "O mínimo não pode ser maior que o máximo." : `Cada grupo espera entre ${settings.min_delay_seconds} e ${settings.max_delay_seconds} segundos.`}</span>
          <button className="btn btn-primary" disabled={busy || invalid}>
            {busy && <Spinner />}
            Salvar
          </button>
        </div>
      </div>
    </form>
  );
}

export function SchedulesPage() {
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ schedules: Schedule[] }>("/schedules").then((data) => setSchedules(data.schedules)).catch((err) => { toast.error(err); setSchedules([]); });
  }, [toast]);

  useEffect(load, [load]);

  const conflict = schedules && time ? conflictingSchedule(time, schedules) : null;

  async function create(event: FormEvent) {
    event.preventDefault();

    if (conflict) {
      return;
    }

    setBusy(true);

    try {
      await api("/schedules", { body: { send_time: time, days_of_week: days } });
      toast.success(`Horário ${time} criado`);
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function update(schedule: Schedule, body: Partial<Schedule>) {
    setSchedules((current) => current?.map((item) => (item.id === schedule.id ? { ...item, ...body } : item)) ?? null);

    try {
      await api(`/schedules/${schedule.id}`, { method: "PATCH", body });
    } catch (err) {
      toast.error(err);
      load();
    }
  }

  async function remove(schedule: Schedule) {
    try {
      await api(`/schedules/${schedule.id}`, { method: "DELETE" });
      toast.success("Horário removido");
      load();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <>
      <PageHeader title="Horários" subtitle={schedules ? `Próximo disparo: ${describeNextRun(nextRun(schedules))}` : undefined} />
      <div className="page-body">
        <div className="editor schedules-layout">
          <div className="card">
            <div className="card-header">
              <CalendarClock size={18} />
              <div className="grow">
                <div className="card-title">Horários de disparo</div>
                <div className="card-subtitle">Horário de Brasília. Uma oferta da fila por horário, com pelo menos 1 hora entre um horário e outro.</div>
              </div>
            </div>
            <form className="card-pad form-stack" style={{ borderBottom: "1px solid var(--border)" }} onSubmit={create}>
              <div className="row wrap" style={{ gap: 16, alignItems: "flex-end" }}>
                <div className="field" style={{ width: 130 }}>
                  <label className="label" htmlFor="time">Horário</label>
                  <input id="time" className={`input ${conflict ? "invalid" : ""}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
                <div className="field grow">
                  <span className="label">Dias</span>
                  <DayPicker value={days} onChange={setDays} />
                </div>
                <button className="btn btn-primary" disabled={busy || !days.length || !!conflict}>
                  {busy ? <Spinner /> : <Plus size={16} />}
                  Adicionar
                </button>
              </div>
              <span className="hint" style={conflict ? { color: "var(--danger)" } : undefined}>
                {conflict ? `Muito perto de ${conflict.send_time}. Deixe pelo menos 1 hora entre os horários, mesmo em dias diferentes.` : "Deixe pelo menos 1 hora entre os horários, mesmo em dias diferentes."}
              </span>
            </form>
            {schedules === null ? (
              <PageLoading />
            ) : schedules.length === 0 ? (
              <EmptyState icon={<CalendarClock size={20} />} title="Nenhum horário" text="Adicione horários como 09:00, 12:00 e 18:00, com pelo menos 1 hora entre eles. O worker dispara a próxima oferta da fila em cada um." />
            ) : (
              schedules.map((schedule) => (
                <div key={schedule.id} className="list-row schedule-row" style={{ opacity: schedule.active ? 1 : 0.55 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, width: 80, fontVariantNumeric: "tabular-nums" }}>{schedule.send_time}</div>
                  <div className="grow">
                    <DayPicker value={schedule.days_of_week} onChange={(value) => value.length && update(schedule, { days_of_week: value })} />
                  </div>
                  <Switch checked={schedule.active} label={`Ativar ${schedule.send_time}`} onChange={(active) => update(schedule, { active })} />
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(schedule)} title="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          <SettingsCard />
        </div>
      </div>
    </>
  );
}
