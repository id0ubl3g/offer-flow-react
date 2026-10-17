import type { Session } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const STORAGE_KEY = "offer-flow.session";
const REFRESH_MARGIN_SECONDS = 60;
const RETRY_DELAY_MS = 400;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
};

let session: Session | null = readSession();
let refreshing: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null): void {
  session = next;

  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    return;
  }
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

async function refreshSession(): Promise<boolean> {
  if (!session?.refresh_token) {
    return false;
  }

  if (!refreshing) {
    const refreshToken = session.refresh_token;

    refreshing = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        const data = await response.json();

        setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at
        });

        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

function isExpiringSoon(): boolean {
  return !!session && session.expires_at - Date.now() / 1000 < REFRESH_MARGIN_SECONDS;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (options.auth !== false && session) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body
  });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authenticated = options.auth !== false;

  if (authenticated && isExpiringSoon()) {
    await refreshSession();
  }

  const method = options.method ?? (options.body !== undefined || options.form ? "POST" : "GET");
  const retryable = method === "GET";
  let response: Response | null = null;

  for (let attempt = 1; attempt <= (retryable ? 2 : 1); attempt++) {
    try {
      response = await send(path, options);
    } catch {
      response = null;
    }

    if (response && response.status < 500) {
      break;
    }

    if (attempt === 1 && retryable) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (!response) {
    throw new ApiError("Não foi possível conectar à API. Ela está rodando?", 0);
  }

  if (response.status === 401 && authenticated && session && (await refreshSession())) {
    response = await send(path, options);
  }

  if (response.status === 401 && authenticated && session) {
    setSession(null);
    unauthorizedHandler?.();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? `Erro ${response.status}`, response.status);
  }

  return data as T;
}
