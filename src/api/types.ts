export type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export type OfferStatus = "draft" | "queued" | "sent" | "archived";

export type Offer = {
  id: string;
  user_id: string;
  product_name: string;
  url: string;
  message: string | null;
  original_price_cents: number;
  price_cents: number;
  discount_percent: number;
  image_path: string | null;
  image_url: string | null;
  status: OfferStatus;
  tags: string[];
  queued_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferInput = {
  product_name: string;
  url: string;
  message: string | null;
  original_price_cents: number;
  price_cents: number;
  tags: string[];
};

export type InstanceStatus = "connecting" | "open" | "close";

export type Instance = {
  id: string;
  status: InstanceStatus;
  phone: string | null;
  profile_name: string | null;
  connected_at: string | null;
  created_at: string | null;
};

export type Group = {
  id: string;
  jid: string;
  name: string;
  participants_count: number | null;
  is_announce: boolean;
  is_admin: boolean | null;
  can_send: boolean;
  active: boolean;
  tags: string[];
  removed_at: string | null;
  synced_at: string;
};

export type Schedule = {
  id: string;
  send_time: string;
  days_of_week: number[];
  timezone: string;
  active: boolean;
  created_at: string;
};

export type DispatchSettings = {
  min_delay_seconds: number;
  max_delay_seconds: number;
  daily_limit: number;
};

export type DispatchStatus = "pending" | "sent" | "failed" | "skipped";

export type RunStatus = "running" | "completed" | "failed" | "skipped";

export type Dispatch = {
  id: string;
  run_id: string | null;
  offer_id: string | null;
  group_id: string | null;
  group_name: string;
  status: DispatchStatus;
  attempts: number;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

export type Run = {
  id: string;
  schedule_id: string | null;
  offer_id: string | null;
  offer_name: string | null;
  scheduled_for: string;
  status: RunStatus;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  summary?: Record<DispatchStatus, number>;
  dispatches?: Dispatch[];
};

export type Paginated<K extends string, T> = {
  page: number;
  per_page: number;
  total: number;
} & Record<K, T[]>;
