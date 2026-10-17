import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ApiError, api } from "../api/client";
import type { Group, Instance, Offer, Schedule } from "../api/types";

const STATUS_INTERVAL = 5000;
const CONNECTING_INTERVAL = 3000;
const DATA_INTERVAL = 15000;

type Live = {
  ready: boolean;
  instance: Instance | null | undefined;
  qrcode: string | null;
  queue: Offer[] | null;
  schedules: Schedule[] | null;
  groups: Group[] | null;
  setInstance: (instance: Instance | null, qrcode?: string | null) => void;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  refresh: () => void;
  refreshStatus: () => Promise<Instance | null>;
};

const LiveContext = createContext<Live | null>(null);

function visible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<Instance | null | undefined>(undefined);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [queue, setQueue] = useState<Offer[] | null>(null);
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [ready, setReady] = useState(false);
  const statusInFlight = useRef<Promise<Instance | null> | null>(null);

  const refreshStatus = useCallback(() => {
    if (!statusInFlight.current) {
      statusInFlight.current = api<{ instance: Instance; qrcode: string | null }>("/whatsapp")
        .then((data) => {
          setInstance(data.instance);
          setQrcode((current) => (data.instance.status === "connecting" ? data.qrcode ?? current : null));
          return data.instance;
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) {
            setInstance(null);
            setQrcode(null);
          } else {
            setInstance((current) => (current === undefined ? null : current));
          }

          return null;
        })
        .finally(() => {
          statusInFlight.current = null;
        });
    }

    return statusInFlight.current;
  }, []);

  const refreshData = useCallback(() => {
    return Promise.allSettled([
      api<{ queue: Offer[] }>("/offers/queue").then((data) => setQueue(data.queue)),
      api<{ schedules: Schedule[] }>("/schedules").then((data) => setSchedules(data.schedules)),
      api<{ groups: Group[] }>("/whatsapp/groups").then((data) => setGroups(data.groups))
    ]);
  }, []);

  const refresh = useCallback(() => {
    refreshStatus();
    refreshData();
  }, [refreshStatus, refreshData]);

  const connecting = instance?.status === "connecting";

  useEffect(() => {
    Promise.all([refreshStatus(), refreshData()]).finally(() => setReady(true));
  }, [refreshStatus, refreshData]);

  useEffect(() => {
    const timer = setInterval(() => visible() && refreshStatus(), connecting ? CONNECTING_INTERVAL : STATUS_INTERVAL);
    return () => clearInterval(timer);
  }, [connecting, refreshStatus]);

  useEffect(() => {
    const timer = setInterval(() => visible() && refreshData(), DATA_INTERVAL);
    return () => clearInterval(timer);
  }, [refreshData]);

  useEffect(() => {
    const onVisible = () => visible() && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const setGroupsState = useCallback<Dispatch<SetStateAction<Group[]>>>((update) => {
    setGroups((current) => (typeof update === "function" ? update(current ?? []) : update));
  }, []);

  const setInstanceState = useCallback((next: Instance | null, nextQrcode: string | null = null) => {
    setInstance(next);
    setQrcode(nextQrcode);
  }, []);

  return <LiveContext.Provider value={{ ready, instance, qrcode, queue, schedules, groups, setInstance: setInstanceState, setGroups: setGroupsState, refresh, refreshStatus }}>{children}</LiveContext.Provider>;
}

export function useLive(): Live {
  const context = useContext(LiveContext);

  if (!context) {
    throw new Error("useLive must be used inside LiveProvider");
  }

  return context;
}
