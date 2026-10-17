import type { DispatchStatus, OfferStatus, RunStatus } from "../api/types";

export const DEFAULT_TEMPLATE = "🔥 *{product_name}*\n\nDe ~R$ {original_price}~ por *R$ {price}*\n{discount}% OFF\n\n🛒 {url}";

export const PLACEHOLDERS = ["product_name", "price", "original_price", "discount", "url"] as const;

export const WEEKDAYS = [
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
  { value: 7, short: "Dom" }
];

export function formatBRL(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString("pt-BR");
  return `${reais},${String(cents % 100).padStart(2, "0")}`;
}

export function centsFromInput(value: string): number {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits ? parseInt(digits, 10) : 0;
}

export function discountPercent(original: number, price: number): number {
  if (!original || price > original) {
    return 0;
  }

  return Math.round((100 * (original - price)) / original);
}

export function renderMessage(template: string | null, values: { product_name: string; price_cents: number; original_price_cents: number; url: string }): string {
  const map: Record<string, string> = {
    product_name: values.product_name,
    price: formatBRL(values.price_cents),
    original_price: formatBRL(values.original_price_cents),
    discount: String(discountPercent(values.original_price_cents, values.price_cents)),
    url: values.url
  };

  return (template || DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (match, key: string) => map[key] ?? match);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function whatsappToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/_([^_\n]+)_/g, "<i>$1</i>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatPhone(phone: string | null): string {
  if (!phone) {
    return "—";
  }

  const match = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `+55 (${match[1]}) ${match[2]}-${match[3]}` : `+${phone}`;
}

type Tone = "default" | "success" | "warning" | "danger" | "info" | "accent";

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  draft: { label: "Rascunho", tone: "default" },
  queued: { label: "Na fila", tone: "accent" },
  sent: { label: "Enviada", tone: "success" },
  archived: { label: "Arquivada", tone: "warning" }
};

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  running: { label: "Enviando", tone: "info" },
  completed: { label: "Concluído", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  skipped: { label: "Pulado", tone: "default" }
};

export const DISPATCH_STATUS: Record<DispatchStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendente", tone: "info" },
  sent: { label: "Enviado", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  skipped: { label: "Pulado", tone: "default" }
};

export const RUN_ERRORS: Record<string, string> = {
  "Queue is empty": "Fila vazia",
  "No queued offer matches the active groups": "Nenhuma oferta da fila combina com os grupos ativos",
  "No active groups": "Nenhum grupo ativo",
  "Daily limit reached": "Limite diário atingido",
  "WhatsApp is not connected": "WhatsApp desconectado",
  "WhatsApp disconnected": "WhatsApp caiu durante o envio",
  "Worker interrupted": "Worker interrompido",
  "Worker stopped": "Worker parado",
  "Run crashed": "Erro inesperado",
  "No message was sent": "Nenhuma mensagem enviada"
};
